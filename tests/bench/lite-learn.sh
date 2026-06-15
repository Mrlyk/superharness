#!/usr/bin/env bash
# Auto-learning generation benchmark for superharness lite — the superskills
# learn-auto.sh suite re-pointed at lite's stop-learn hook.
#
# Both arms replay the same finished session containing project decisions the
# code cannot show. Arm B appends the REAL Stop reason emitted by lite's
# hooks/lite/stop-learn.cjs (the instruction the model sees when the hook
# fires); arm A appends a neutral close. Grading inspects the
# .superharness/learnings/ the model wrote: standard = recall (capture both
# corrections), hard = precision + wiki hygiene (keep the durable team rule,
# reject throwaways, keep INDEX/topic pages deduplicated).
#
#   tests/bench/lite-learn.sh [--trials 3] [--model M] [--concurrency C] [--hard]
set -uo pipefail

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$BENCH_DIR/../.." && pwd)"
SS_BENCH="${SS_BENCH:-$REPO_ROOT/../superskills/tests/bench}"
CLI="$REPO_ROOT/dist/index.js"
HOOK="$REPO_ROOT/hooks/lite/stop-learn.cjs"
GRADER="$BENCH_DIR/graders/learn-auto.cjs"
MODEL="${BENCH_MODEL:-sonnet}"
TRIALS=3
CONC=3
MODE=standard

while [[ $# -gt 0 ]]; do
  case "$1" in
    --trials) TRIALS="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --concurrency) CONC="$2"; shift 2 ;;
    --hard) MODE=hard; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

for f in "$SS_BENCH/fixtures/store" "$CLI" "$HOOK" "$GRADER"; do
  [[ -e "$f" ]] || { echo "missing asset: $f (set SS_BENCH / npm build)" >&2; exit 1; }
done

WORK="$(mktemp -d)"
[[ "${BENCH_KEEP:-0}" == 1 ]] || trap 'rm -rf "$WORK"' EXIT
echo "work dir: $WORK | model: $MODEL | trials: $TRIALS | mode: $MODE"
mkdir -p "$BENCH_DIR/results"
RESULTS="$BENCH_DIR/results/lite-learn-$MODE-results.jsonl"
: > "$RESULTS"
ALLOWED="Read,Glob,Grep,Write,Edit,MultiEdit,Skill,Bash(ls:*),Bash(cat:*),Bash(mkdir:*),Bash(git:*)"
throttle() { while (( $(jobs -rp | wc -l) >= CONC )); do sleep 2; done; }

SESSION_REPLAY_STANDARD='The following development session just happened in THIS project (replayed for you verbatim):

[user] Add a makeReceipt(totalCents) function to src/receipt.js that returns an object with the total and a creation time.
[assistant] (wrote src/receipt.js using Date.now() for the time and returning the total as a float)
[user] Two corrections — both are project conventions you could not have known from the code: (1) timestamps in this codebase are ALWAYS ISO-8601 UTC strings produced with new Date().toISOString(), never epoch milliseconds, because our downstream analytics pipeline only parses ISO-8601 strings; (2) monetary amounts are ALWAYS integer cents, never floats. Please fix both.
[assistant] (fixed: createdAt now uses new Date().toISOString(); totalCents kept as an integer)
[user] Correct, that matches our conventions now. We are done with the coding task.'

SESSION_REPLAY_HARD='The following development session just happened in THIS project (replayed for you verbatim):

[user] Refactor src/order.js to pull the tax math into its own function.
[assistant] (extracted computeTax)
[user] For this one, just the quickest thing — skip input validation, I will add it myself later.
[assistant] (kept it minimal, no validation)
[user] Important: in this codebase every API error code MUST use the E_ prefix (E_RANGE, E_TYPE, and so on). It is a hard team convention enforced in code review and the error catalog depends on it. Make computeTax throw E_RANGE on a negative rate.
[assistant] (threw new AppError("E_RANGE", ...))
[user] Also, just for today, console.log the intermediate subtotal so I can watch it run — I will strip that before committing.
[assistant] (added a temporary console.log)
[user] Great, that works. We are done.'

if [[ "$MODE" == hard ]]; then SESSION_REPLAY="$SESSION_REPLAY_HARD"; else SESSION_REPLAY="$SESSION_REPLAY_STANDARD"; fi

# The real Stop reason from lite's hook, driven by a qualifying transcript.
stop_reason() {
  local st="$WORK/reason-state" repo="$WORK/reason-repo" t="$WORK/reason.jsonl"
  mkdir -p "$st" "$repo"; git -C "$repo" init -q
  {
    local i
    for i in 1 2 3 4 5; do
      printf '{"type":"user","message":{"role":"user","content":"message %s"}}\n' "$i"
      printf '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"ok"}]}}\n'
    done
    printf '{"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Edit","input":{"file_path":"src/receipt.js"}}]}}\n'
  } > "$t"
  printf '{"session_id":"r","transcript_path":"%s","cwd":"%s","stop_hook_active":false}' "$t" "$repo" \
    | SUPERHARNESS_STATE_DIR="$st" SUPERHARNESS_LEARN_SYNC=1 node "$HOOK" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).reason||''))"
}
REASON="$(stop_reason)"
[[ -n "$REASON" ]] || { echo "FATAL: could not extract stop-learn reason" >&2; exit 1; }

make_fixture() { # dir
  local dir="$1"
  cp -R "$SS_BENCH/fixtures/store/." "$dir"
  ( cd "$dir" && node "$CLI" init -y >/dev/null 2>&1 )  # installs the learn skill + learnings dir
  git -C "$dir" init -q
  git -C "$dir" config user.email bench@local
  git -C "$dir" config user.name bench
  git -C "$dir" add -A
  git -C "$dir" commit -qm base >/dev/null 2>&1
}

run_arm() { # arm trial
  local arm="$1" n="$2" dir="$WORK/$arm-$n" prompt extra=()
  make_fixture "$dir"
  if [[ "$arm" == B ]]; then
    prompt="$SESSION_REPLAY

$REASON"
  else
    prompt="$SESSION_REPLAY

The session is complete. No further action is required."
    extra+=(--disallowedTools "Skill")
  fi
  ( cd "$dir" && SUPERHARNESS_NO_BG_LEARN=1 SUPERHARNESS_STATE_DIR="$dir/.state" \
      claude -p "$prompt" --model "$MODEL" --permission-mode acceptEdits \
      --allowedTools "$ALLOWED" ${extra[@]+"${extra[@]}"} --max-turns 12 ) \
    > "$dir/.response.txt" 2>&1 || true
  node "$GRADER" "$dir" "$arm" "$n" "$MODE" >> "$RESULTS"
  echo "  done: arm=$arm trial=$n score=$(tail -1 "$RESULTS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).score.toFixed(2)))")"
}

echo "auto-learning generation (lite): model=$MODEL trials=$TRIALS mode=$MODE"
for arm in A B; do
  for n in $(seq 1 "$TRIALS"); do throttle; run_arm "$arm" "$n" & done
done
wait
echo "results: tests/bench/results/lite-learn-$MODE-results.jsonl"
