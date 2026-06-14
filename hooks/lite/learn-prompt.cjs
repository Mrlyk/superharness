'use strict';
// Single source of truth for the auto-learning instruction.
//
// The Stop hook (stop-learn.js) injects this into a background `claude -p`
// learner; the learn-auto / learn-wiki benchmarks read it back (via the hook's
// dry-run mode) so arm B always tests the exact instruction production ships.
// Keep the wiki-merge cues here intact — they are what the benchmark grades.

const REPLAY_HEADER =
  'The following development session just happened in THIS project '
  + '(replayed for you verbatim):';

// What the learner must do with the session it just reviewed. Phrased to work
// both as a background prompt (after a replay) and as an inline Stop-block
// reason (the sync fallback), so there is one wording to benchmark and ship.
const LEARN_INSTRUCTION =
  'Review this development session for durable learnings: user corrections, '
  + 'pitfalls with their fixes, or project decisions not visible in code. '
  + 'If none qualify, do nothing and stop. Otherwise persist them in the project '
  + 'knowledge wiki at the repository root (the directory containing .git, NOT a '
  + 'subdirectory you happen to be working in): <repo-root>/.superharness/learnings/ '
  + 'holds one markdown page per topic (frontmatter topic/tags; concise rules), '
  + 'not a file per learning. Read INDEX.md, then merge each learning into the '
  + 'existing <topic>.md page it belongs to — keep the page focused and '
  + 'deduplicated, cross-link related topics with [[topic]] — creating a new '
  + '<topic>.md only when no topic fits. If a learning updates or contradicts a '
  + 'rule already on a page, replace the old rule instead of adding a second copy '
  + '— the wiki holds current truth, not its history. Then always update INDEX.md so it lists '
  + 'every page as a markdown link with a one-line summary, exactly in the form '
  + '`- [Topic](topic.md) — what it covers` — INDEX.md is the only file injected '
  + 'into future sessions, so a page missing from it (or listed without its '
  + '[link](file.md)) is invisible; then stop.';

// Operational guardrails for the UNSUPERVISED background learner. Kept separate
// from LEARN_INSTRUCTION (which the benchmark reads) because they constrain the
// autonomous context, not the learning quality.
//
// They are per-CLI because file I/O works differently. Claude Code edits via
// dedicated Read/Write/Edit tools, so the hook also withholds Bash and the
// guardrail can forbid shell outright. Codex performs file I/O THROUGH the shell
// (apply_patch / cat), so forbidding shell would leave it unable to read or write
// the wiki at all; instead it is sandboxed to workspace-write and told to touch
// only the learnings directory and never git/commit.
const CHILD_GUARDRAILS = {
  claude:
    'Operating rules: edit only files under .superharness/learnings/. Do not touch '
    + 'any other file. Merge into existing pages — never delete a page. Do not run '
    + 'git or any shell command, and never commit or push. Make at most a few edits, '
    + 'then stop.',
  codex:
    'Operating rules: edit only files under .superharness/learnings/ (read and write '
    + 'them with your normal tools as needed). Do not modify any file outside '
    + '.superharness/learnings/. Merge into existing pages — never delete a page. '
    + 'Never run git, never commit or push. Make at most a few edits, then stop.',
};

// Render a transcript-derived replay plus the instruction for the background
// learner. The replay is the only context the fresh learner session has. `cli`
// selects the guardrail wording for the target runtime ('claude' | 'codex').
function buildChildPrompt(replay, cli) {
  const guardrails = CHILD_GUARDRAILS[cli] || CHILD_GUARDRAILS.claude;
  return `${REPLAY_HEADER}\n\n${replay}\n\n${LEARN_INSTRUCTION}\n\n${guardrails}`;
}

module.exports = { REPLAY_HEADER, LEARN_INSTRUCTION, CHILD_GUARDRAILS, buildChildPrompt };
