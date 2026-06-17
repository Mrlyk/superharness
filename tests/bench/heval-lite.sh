#!/usr/bin/env bash
# HumanEval A/B benchmark for superharness lite (north-star metric).
#
# Arm A: bare model (Skill tool disallowed, no superharness artifacts).
# Arm B: same model + superharness lite installed in the fixture — .claude/skills,
#   the Stop verify/learn hooks wired in .claude/settings.json, and an AGENTS.md
#   "run before done" pointer. The verify gate forcing a self-test before finishing
#   is the mechanism expected to lift pass@1.
#
# Reuses superskills' HumanEval dataset, canonical grader, pyfix fixture, and
# report renderer (set SS_BENCH to point at them; defaults to a sibling checkout).
#
#   tests/bench/heval-lite.sh [--screen-range 100:163] [--trials 3]
#                             [--model M] [--concurrency C] [--hard "12 33"]
#   BENCH_ARMS="B" re-measures only arm B.
set -uo pipefail

BENCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$BENCH_DIR/../.." && pwd)"
SS_BENCH="${SS_BENCH:-$REPO_ROOT/../superskills/tests/bench}"
MODEL="${BENCH_MODEL:-sonnet}"
TRIALS=3
CONC=3
RANGE="100:163"
HARD_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --screen-range) RANGE="$2"; shift 2 ;;
    --trials) TRIALS="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --concurrency) CONC="$2"; shift 2 ;;
    --hard) HARD_OVERRIDE="$2"; shift 2 ;;
    --plus) PLUS=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

PLUS="${PLUS:-0}"
if [[ "$PLUS" == 1 ]]; then
  DATA="$SS_BENCH/humaneval/HumanEvalPlus.jsonl"
  GRADER="$SS_BENCH/humaneval/grade-plus.py"
  TAG="heval-plus-lite"
else
  DATA="$SS_BENCH/humaneval/HumanEval.jsonl"
  GRADER="$SS_BENCH/humaneval/grade.py"
  TAG="heval-lite"
fi
PYFIX="$SS_BENCH/fixtures/pyfix"
REPORT="$SS_BENCH/report-heval.js"
for f in "$DATA" "$GRADER" "$PYFIX" "$REPORT"; do
  [[ -e "$f" ]] || { echo "missing reusable asset: $f (set SS_BENCH)" >&2; exit 1; }
done

WORK="$(mktemp -d)"
[[ "${BENCH_KEEP:-0}" == 1 ]] || trap 'rm -rf "$WORK"' EXIT
echo "work dir: $WORK | model: $MODEL | trials: $TRIALS"
mkdir -p "$BENCH_DIR/results"
SCREEN="$BENCH_DIR/results/$TAG-screen.jsonl"
RESULTS="$BENCH_DIR/results/$TAG-results.jsonl"

ALLOWED="Read,Glob,Grep,Write,Edit,MultiEdit,Skill,TodoWrite,Bash(python3:*),Bash(python:*),Bash(ls:*),Bash(cat:*),Bash(git:*),Bash(mkdir:*),Bash(rm:*),Bash(chmod:*)"

throttle() { while (( $(jobs -rp | wc -l) >= CONC )); do sleep 2; done; }

extract_problem() { # index outfile
  node -e 'const fs=require("fs");const[s,i,o]=process.argv.slice(1);fs.writeFileSync(o,fs.readFileSync(s,"utf8").trim().split("\n")[Number(i)]);' "$DATA" "$1" "$2"
}

make_fixture() { # dir arm
  local dir="$1" arm="$2"
  mkdir -p "$dir"
  cp -R "$PYFIX/." "$dir"
  if [[ "$arm" == A ]]; then
    printf '# pyfix\n' > "$dir/CLAUDE.md"
  else
    ( cd "$dir" && node "$REPO_ROOT/dist/index.js" init -y >/dev/null 2>&1 )
    cat > "$dir/AGENTS.md" <<'EOF'
# pyfix

Python project. Implement the requested function in solution.py.

Before reporting the task done, verify the solution by running it on the documented
examples plus boundary cases. For larger changes apply the superharness test skill.
EOF
    printf '@AGENTS.md\n' > "$dir/CLAUDE.md"
  fi
  git -C "$dir" init -q
  git -C "$dir" config user.email bench@local
  git -C "$dir" config user.name bench
  git -C "$dir" add -A
  git -C "$dir" commit -qm base >/dev/null 2>&1
}

run_one() { # dir arm problemFile outfile
  local dir="$1" arm="$2" pfile="$3" outfile="$4" fnprompt extra=() task
  fnprompt="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["prompt"])' "$pfile")"
  task="Create solution.py in the project root implementing exactly this function. Keep the given signature and docstring behavior; include any imports it needs. The deliverable is solution.py."
  [[ "$arm" == A ]] && extra+=(--disallowedTools "Skill")
  (
    cd "$dir"
    if [[ "$arm" == B ]]; then
      export SUPERHARNESS_STATE_DIR="$dir/.state"
    fi
    claude -p "$task

\`\`\`python
$fnprompt
\`\`\`" \
      --model "$MODEL" --permission-mode acceptEdits \
      --allowedTools "$ALLOWED" ${extra[@]+"${extra[@]}"} --max-turns 24
  ) > "$outfile" 2>&1 || true
}

grade_one() { # dir problemFile
  if [[ -f "$1/solution.py" ]] && python3 "$GRADER" "$2" "$1/solution.py" >/dev/null 2>&1; then
    echo true
  else
    echo false
  fi
}

screen_one() { # index
  local i="$1" dir="$WORK/s-$1"
  make_fixture "$dir" A
  extract_problem "$i" "$dir/.p.json"
  run_one "$dir" A "$dir/.p.json" "$dir/.r.txt"
  local pass; pass="$(grade_one "$dir" "$dir/.p.json")"
  printf '{"problem":%s,"pass":%s}\n' "$i" "$pass" >> "$SCREEN"
  echo "  screen: $i pass=$pass"
}

measure_one() { # index arm trial
  local i="$1" arm="$2" n="$3" dir="$WORK/m-$1-$2-$3"
  make_fixture "$dir" "$arm"
  extract_problem "$i" "$dir/.p.json"
  local t0=$SECONDS
  run_one "$dir" "$arm" "$dir/.p.json" "$dir/.r.txt"
  local pass; pass="$(grade_one "$dir" "$dir/.p.json")"
  local score=0; [[ "$pass" == true ]] && score=1
  printf '{"scenario":"heval_lite","arm":"%s","trial":%s,"problem":%s,"checks":{"pass":%s},"score":%s,"durationSec":%s}\n' \
    "$arm" "$n" "$i" "$pass" "$score" "$((SECONDS-t0))" >> "$RESULTS"
  echo "  done: $i arm=$arm trial=$n pass=$pass"
}

IFS=':' read -r LO HI <<< "$RANGE"
if [[ -n "$HARD_OVERRIDE" ]]; then
  HARD=($HARD_OVERRIDE)
else
  : > "$SCREEN"
  echo "== phase 1: screening baseline HumanEval/$LO..$HI (model=$MODEL) =="
  for i in $(seq "$LO" "$HI"); do throttle; screen_one "$i" & done
  wait
  HARD=($(node -e 'const fs=require("fs");console.log(fs.readFileSync(process.argv[1],"utf8").trim().split("\n").map(JSON.parse).filter(r=>!r.pass).map(r=>r.problem).sort((a,b)=>a-b).join(" "));' "$SCREEN"))
fi
echo "hard set: ${HARD[*]:-none}"
[[ "${#HARD[@]}" -gt 0 ]] || { echo "baseline saturated the screened range; widen --screen-range" >&2; exit 1; }

ARMS="${BENCH_ARMS:-A B}"
echo "== phase 2: measuring ${#HARD[@]} problems x [$ARMS] x $TRIALS trials =="
: > "$RESULTS"
for i in "${HARD[@]}"; do
  for arm in $ARMS; do
    for n in $(seq 1 "$TRIALS"); do throttle; measure_one "$i" "$arm" "$n" & done
  done
done
wait

[[ -f "$SCREEN" ]] || : > "$SCREEN"
node "$REPORT" "$RESULTS" "$SCREEN" > "$BENCH_DIR/results/$TAG-report.md"
echo "report: tests/bench/results/$TAG-report.md"
