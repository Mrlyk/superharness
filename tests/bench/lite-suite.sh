#!/usr/bin/env bash
# Capability A/B benchmark for superharness lite — the superskills run.sh suite
# re-pointed at lite. Arm A is the bare model; arm B is the same model with
# `superharness init` (lite) installed in the fixture, so the four lite
# capabilities (discover spec / learn memory / clarify / test) are the only
# variable.
#
# Reuses superskills' fixtures (store, store-learnings, staged, pyfix), graders
# (s1-s4, path-agnostic: they probe code/tests/git), and HumanEval control set.
# Point SS_BENCH at a superskills checkout (defaults to a sibling clone).
#
#   tests/bench/lite-suite.sh [--trials 3] [--model M] [--concurrency C]
#                             [--scenarios s1,s2,s3,s4,control]
#   BENCH_ARMS="B" re-measures only arm B; BENCH_KEEP=1 keeps fixtures.
set -uo pipefail

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$BENCH_DIR/../.." && pwd)"
SS_BENCH="${SS_BENCH:-$REPO_ROOT/../superskills/tests/bench}"
MODEL="${BENCH_MODEL:-sonnet}"
TRIALS=3
CONC=3
SCENARIOS="s1,s2,s3,s4,control"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --trials) TRIALS="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --concurrency) CONC="$2"; shift 2 ;;
    --scenarios) SCENARIOS="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

FIX="$SS_BENCH/fixtures"
GRADERS="$SS_BENCH/graders"
HEVAL="$SS_BENCH/humaneval/problems.jsonl"
HGRADE="$SS_BENCH/humaneval/grade.py"
CLI="$REPO_ROOT/dist/index.js"
for f in "$FIX/store" "$GRADERS/s1.js" "$HEVAL" "$HGRADE" "$CLI"; do
  [[ -e "$f" ]] || { echo "missing asset: $f (set SS_BENCH / run npm build)" >&2; exit 1; }
done

WORK="$(mktemp -d)"
[[ "${BENCH_KEEP:-0}" == 1 ]] || trap 'rm -rf "$WORK"' EXIT
echo "work dir: $WORK | model: $MODEL | trials: $TRIALS"
mkdir -p "$BENCH_DIR/results"
RESULTS="$BENCH_DIR/results/lite-suite-results.jsonl"
ARMS="${BENCH_ARMS:-A B}"
[[ "$ARMS" == "A B" ]] && : > "$RESULTS"

ALLOWED="Read,Glob,Grep,Write,Edit,MultiEdit,Skill,TodoWrite,Bash(node:*),Bash(npm:*),Bash(pnpm:*),Bash(git:*),Bash(ls:*),Bash(cat:*),Bash(mkdir:*),Bash(python3:*),Bash(wc:*),Bash(head:*),Bash(find:*)"
throttle() { while (( $(jobs -rp | wc -l) >= CONC )); do sleep 2; done; }

git_init() { # dir
  git -C "$1" init -q
  git -C "$1" config user.email bench@local
  git -C "$1" config user.name bench
  git -C "$1" add -A
  git -C "$1" commit -qm "chore: fixture base" >/dev/null 2>&1
}

# Install lite into a fixture (arm B). Quiet; lite is `init`'s default.
install_lite() { # dir
  ( cd "$1" && node "$CLI" init -y >/dev/null 2>&1 )
}

# superharness discover-style spec pointer: a thin AGENTS.md that sends the
# model to the repo's evidenced conventions, wired through CLAUDE.md. Mirrors
# what `discover` writes, so s1 measures the same "spec is loaded" variable as
# superskills, on superharness paths.
write_spec_pointer() { # dir
  local dir="$1"
  cat > "$dir/AGENTS.md" <<'EOF'
# store-app

A small storefront pricing library computing order totals in integer cents with
typed application errors (`AppError`). JavaScript ESM, tested with `node:test`.

## Conventions (read before writing code)
- Money is integer cents, never floats; round when applying percentages.
- Errors throw `AppError` with a stable `E_*` code (`E_TYPE`, `E_RANGE`).
- Public functions carry JSDoc (`@param` / `@returns`) and are re-exported from
  the `src/index.js` barrel.
- Tests use the built-in `node:test` runner; install/run with `pnpm`.
- See `CONTRIBUTING.md` and `docs/engineering-handbook.md`, and
  `.superharness/spec/guides/index.md` for the captured spec.
EOF
  printf '@AGENTS.md\n@.superharness/spec/guides/index.md\n' > "$dir/CLAUDE.md"
  mkdir -p "$dir/.superharness/spec/guides"
  cat > "$dir/.superharness/spec/guides/index.md" <<'EOF'
# Project spec

- Integer-cents money; round on percentage math.
- `AppError` with `E_*` codes for typed failures.
- JSDoc on public API; barrel re-exports via `src/index.js`.
- `node:test`; `pnpm` for install/test.
EOF
}

S1_TASK='Add a discount feature to this project: implement applyDiscount(items, percent) that returns the order total in cents after applying a percent discount. items have the shape {priceCents, qty}. Include input validation and tests.'
S2_TASK='Two things: (1) add a "Getting started" section to README.md showing how to install dependencies and run the tests; (2) implement src/receipt.js exporting makeReceipt(totalCents) that takes the total as a number and returns {id, createdAt, totalCents} where createdAt records when the receipt was created. Keep the test suite passing.'
S3_TASK='Add an export feature for orders so users can download their order history.'
S4_TASK_A='The applyCoupon feature in src/coupon.js was just developed (see the working tree). Write unit tests for it and make sure they pass.'
S4_TASK_B='The applyCoupon feature in src/coupon.js was just developed (see the working tree). Apply the test skill.'

run_model() { # dir arm prompt outfile maxturns
  local dir="$1" arm="$2" prompt="$3" outfile="$4" maxturns="$5" extra=()
  [[ "$arm" == A ]] && extra+=(--disallowedTools "Skill")
  (
    cd "$dir"
    # Arm B keeps state local and disables the background learner so scenario
    # runs never spawn a second claude (learning is benchmarked separately).
    if [[ "$arm" == B ]]; then
      export SUPERHARNESS_STATE_DIR="$dir/.state" SUPERHARNESS_NO_BG_LEARN=1
    fi
    claude -p "$prompt" --model "$MODEL" --permission-mode acceptEdits \
      --allowedTools "$ALLOWED" ${extra[@]+"${extra[@]}"} --max-turns "$maxturns"
  ) > "$outfile" 2>&1 || true
}

trial_generic() { # scenario arm trial
  local scenario="$1" arm="$2" n="$3" dir="$WORK/$scenario-$arm-$n"
  mkdir -p "$dir"
  cp -R "$FIX/store/." "$dir"
  [[ "$scenario" == s2 ]] && rm -f "$dir/CONTRIBUTING.md"  # isolate memory channel

  if [[ "$arm" == A ]]; then
    printf '# store-app\n' > "$dir/CLAUDE.md"
  else
    install_lite "$dir"
    case "$scenario" in
      s1) write_spec_pointer "$dir" ;;
      s2)
        printf '# store-app\n' > "$dir/CLAUDE.md"
        cp "$FIX/store-learnings/"* "$dir/.superharness/learnings/" 2>/dev/null || true
        ;;
      s3|s4) : ;;  # the skill itself is the variable
    esac
  fi

  local prompt maxturns=30 head0=""
  case "$scenario" in
    s1) prompt="$S1_TASK" ;;
    s2) prompt="$S2_TASK" ;;
    s3)
      maxturns=25
      git_init "$dir"; head0="$(git -C "$dir" rev-parse HEAD)"
      if [[ "$arm" == B ]]; then
        prompt="Apply the clarify skill to this request first, following it exactly. $S3_TASK"
      else
        prompt="$S3_TASK"
      fi
      ;;
    s4)
      cp "$FIX/staged/coupon.js" "$dir/src/coupon.js"  # untracked: "just developed"
      [[ "$arm" == B ]] && prompt="$S4_TASK_B" || prompt="$S4_TASK_A"
      ;;
  esac
  [[ -z "$head0" ]] && git_init "$dir"

  local t0=$SECONDS
  run_model "$dir" "$arm" "$prompt" "$dir/.response.txt" "$maxturns"
  local dur=$((SECONDS - t0))

  local grade="$dir/.grade.json"
  if [[ "$scenario" == s3 ]]; then
    node "$GRADERS/s3.js" "$dir" "$dir/.response.txt" "$head0" > "$grade"
  else
    node "$GRADERS/$scenario.js" "$dir" > "$grade"
  fi
  local score; score="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).score)' "$grade")"
  local checks; checks="$(node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).checks))' "$grade")"
  printf '{"scenario":"%s","arm":"%s","trial":%s,"checks":%s,"score":%s,"durationSec":%s}\n' \
    "$scenario" "$arm" "$n" "$checks" "$score" "$dur" >> "$RESULTS"
  echo "  done: $scenario arm=$arm trial=$n score=$score"
}

trial_control() { # arm problemIndex
  local arm="$1" i="$2" dir="$WORK/control-$arm-$i"
  mkdir -p "$dir"
  cp -R "$FIX/pyfix/." "$dir"
  if [[ "$arm" == A ]]; then
    printf '# pyfix\n' > "$dir/CLAUDE.md"
  else
    install_lite "$dir"
    cat > "$dir/AGENTS.md" <<'EOF'
# pyfix

Python project. Implement the requested function in solution.py.
Before reporting done, verify by running it on the documented examples plus
boundary cases.
EOF
    printf '@AGENTS.md\n' > "$dir/CLAUDE.md"
  fi
  git_init "$dir"

  local pfile="$dir/.problem.json"
  node -e 'const fs=require("fs");const[s,i,o]=process.argv.slice(1);fs.writeFileSync(o,fs.readFileSync(s,"utf8").trim().split("\n")[Number(i)]);' "$HEVAL" "$i" "$pfile"
  local fnprompt; fnprompt="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).prompt)' "$pfile")"
  local prompt="Create solution.py in the project root implementing exactly this function. Keep the given signature and docstring behavior; include any imports it needs. Write only solution.py.

\`\`\`python
$fnprompt
\`\`\`"

  local t0=$SECONDS
  run_model "$dir" "$arm" "$prompt" "$dir/.response.txt" 12
  local dur=$((SECONDS - t0))
  local pass=false
  if [[ -f "$dir/solution.py" ]] && python3 "$HGRADE" "$pfile" "$dir/solution.py" >/dev/null 2>&1; then pass=true; fi
  printf '{"scenario":"control","arm":"%s","trial":%s,"checks":{"pass":%s},"score":%s,"durationSec":%s}\n' \
    "$arm" "$i" "$pass" "$([[ $pass == true ]] && echo 1 || echo 0)" "$dur" >> "$RESULTS"
  echo "  done: control arm=$arm problem=$i pass=$pass"
}

echo "lite suite: scenarios=$SCENARIOS arms=[$ARMS]"
IFS=',' read -ra LIST <<< "$SCENARIOS"
for scenario in "${LIST[@]}"; do
  echo "== $scenario =="
  if [[ "$scenario" == control ]]; then
    for arm in $ARMS; do for i in $(seq 0 9); do throttle; trial_control "$arm" "$i" & done; done
  else
    for arm in $ARMS; do for n in $(seq 1 "$TRIALS"); do throttle; trial_generic "$scenario" "$arm" "$n" & done; done
  fi
  wait
done

node "$BENCH_DIR/report-lite.cjs" "$BENCH_DIR/results" > "$BENCH_DIR/results/lite-report.md" 2>/dev/null || true
echo "results: tests/bench/results/lite-suite-results.jsonl"
