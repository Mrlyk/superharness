#!/usr/bin/env bash
# Clarify auto-trigger benchmark for superharness lite.
#
# In lite, the clarify capability reaches the model two ways that both ship with
# `superharness init`: the clarify skill auto-triggers by its description, and
# the SessionStart hook injects the lite operating manual
# (.superharness/using-superharness-lite.md), which says to resolve undecided
# requirements BEFORE coding. This measures whether that combination makes the
# model AUTO-ask on an ambiguous request — without anyone saying "apply clarify"
# — and NOT over-ask on a clear one.
#
# Arms:
#   base-ambiguous  : bare model (Skill disallowed)        + ambiguous task (baseline)
#   lite-ambiguous  : superharness init (lite installed)    + ambiguous task (lift)
#   lite-clear      : superharness init (lite installed)    + clear task     (over-ask guard)
#
#   tests/bench/lite-clarify.sh [--trials 3] [--model M] [--concurrency C] [--no-baseline]
set -uo pipefail

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$BENCH_DIR/../.." && pwd)"
SS_BENCH="${SS_BENCH:-$REPO_ROOT/../superskills/tests/bench}"
CLI="$REPO_ROOT/dist/index.js"
GRADER="$BENCH_DIR/graders/clarify-nudge.cjs"
MODEL="${BENCH_MODEL:-sonnet}"
TRIALS=3
CONC=3
ARMS="base-ambiguous lite-ambiguous lite-clear"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --trials) TRIALS="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --concurrency) CONC="$2"; shift 2 ;;
    --no-baseline) ARMS="lite-ambiguous lite-clear"; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

for f in "$SS_BENCH/fixtures/store" "$CLI" "$GRADER"; do
  [[ -e "$f" ]] || { echo "missing asset: $f (set SS_BENCH / npm build)" >&2; exit 1; }
done

WORK="$(mktemp -d)"
[[ "${BENCH_KEEP:-0}" == 1 ]] || trap 'rm -rf "$WORK"' EXIT
echo "work dir: $WORK | model: $MODEL | trials: $TRIALS | arms: [$ARMS]"
mkdir -p "$BENCH_DIR/results"
RESULTS="$BENCH_DIR/results/lite-clarify-results.jsonl"
: > "$RESULTS"
ALLOWED="Read,Glob,Grep,Write,Edit,MultiEdit,Skill,TodoWrite,Bash(node:*),Bash(pnpm:*),Bash(npm:*),Bash(git:*),Bash(ls:*),Bash(cat:*),Bash(mkdir:*)"
throttle() { while (( $(jobs -rp | wc -l) >= CONC )); do sleep 2; done; }

AMBIG_TASK='Add an export feature for orders so users can download their order history.'
CLEAR_TASK='Add a function sumCents(items) in src/sum.js (ESM) that returns the integer sum of item.priceCents across the items array and returns 0 for an empty array. Add a node:test in test/sum.test.js covering the empty array and a two-item array, and make the test suite pass.'

make_fixture() { # dir arm
  local dir="$1" arm="$2"
  cp -R "$SS_BENCH/fixtures/store/." "$dir"
  if [[ "$arm" == base-* ]]; then
    printf '# store-app\n' > "$dir/CLAUDE.md"
  else
    ( cd "$dir" && node "$CLI" init -y >/dev/null 2>&1 )  # real lite: skills + hooks + manual
  fi
  git -C "$dir" init -q
  git -C "$dir" config user.email bench@local
  git -C "$dir" config user.name bench
  git -C "$dir" add -A
  git -C "$dir" commit -qm base >/dev/null 2>&1
}

run_arm() { # arm trial
  local arm="$1" n="$2" dir="$WORK/$arm-$n" task type extra=()
  if [[ "$arm" == *-clear ]]; then task="$CLEAR_TASK"; type=clear; else task="$AMBIG_TASK"; type=ambiguous; fi
  make_fixture "$dir" "$arm"
  [[ "$arm" == base-* ]] && extra+=(--disallowedTools "Skill")
  ( cd "$dir" && SUPERHARNESS_NO_BG_LEARN=1 SUPERHARNESS_STATE_DIR="$dir/.state" \
      claude -p "$task" --model "$MODEL" --permission-mode acceptEdits \
      --allowedTools "$ALLOWED" ${extra[@]+"${extra[@]}"} --max-turns 8 ) > "$dir/.response.txt" 2>&1 || true
  node "$GRADER" "$dir" "$dir/.response.txt" "$arm" "$type" >> "$RESULTS"
  echo "  done: arm=$arm trial=$n $(tail -1 "$RESULTS" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);console.log('asked='+r.asked+' code='+r.wroteCode+' score='+r.score.toFixed(2))})")"
}

echo "clarify auto-trigger (lite): model=$MODEL trials=$TRIALS"
for arm in $ARMS; do
  for n in $(seq 1 "$TRIALS"); do throttle; run_arm "$arm" "$n" & done
done
wait
echo "results: tests/bench/results/lite-clarify-results.jsonl"
