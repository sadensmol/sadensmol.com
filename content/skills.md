---
title: "Claude Code Skills"
description: "A ticket-to-merged-PR engineering system for Claude Code, Codex and OpenCode by Denis Sazonov: one /task command, three human checkpoints, parallel agent lanes, multi-repo worktrees and layered project plugins."
author: "Denis Sazonov"
image: "/images/profile.jpg"
keywords:
  - Claude Code skills
  - Claude Code workflow
  - agentic coding
  - AI software engineering
  - Codex
  - OpenCode
  - git worktrees
  - pair programming agents
  - code review agents
---

<div class="skills-page">

<p class="skills-lede"><strong>Ship tickets, not prompts.</strong> I type <code>/task new ENG-123</code>. The agents plan, build, test, review and open the PRs. I step in exactly <strong>three times</strong>.</p>

<div class="skills-stats">
  <div><span>32</span>skills</div>
  <div><span>6</span>reviewer agents</div>
  <div><span>3</span>harnesses</div>
  <div><span>3</span>human checkpoints</div>
</div>

Most people use coding agents like a chat window: prompt, wait, read, correct, repeat.
The human stays the bottleneck. My setup turns the agent into an **engineering team with a
process** — the same process a senior team runs: ticket, plan, review, build, test, code
review, PR, merge, docs. One source of skills drives it in
[Claude Code](https://claude.com/claude-code), Codex and OpenCode.

[View on GitHub &rarr;](https://github.com/sadensmol/skills)

## You are needed three times. Only three.

<div class="skills-gates">
  <div>
    <b>1 · Approve the plan</b>
    <p>A planner on the strongest model writes <code>PLAN.md</code>. You read it, annotate it, approve it.</p>
  </div>
  <div>
    <b>2 · Approve the diff</b>
    <p>Before any commit, you see the finished, tested, reviewed diff — once.</p>
  </div>
  <div>
    <b>3 · Critical decisions</b>
    <p>Prod, data loss, money, security, scope change. Everything else the agent decides and logs.</p>
  </div>
</div>

Everything between those points runs on its own. A red test, a failing CI job, a linter
complaint or a pending review is not a reason to stop — it is the work. The task runs
start to finish in one push.

## The task workflow

```
/task new ENG-123
   │
   ├─ worktrees      one isolated git worktree per repo the ticket touches
   ├─ plan           planner (Opus, xhigh) → PLAN.md + questions to clarify
   │                 ▶ CHECKPOINT 1: you approve the plan
   ├─ build          parallel lanes: builders, runners, fixers — each owns its files
   ├─ test           targeted tests while working, full suite in CI
   ├─ review         6 parallel reviewers: quality · security · tests
   │                 docs · simplicity · goal — every P0/P1 fixed
   │                 ▶ CHECKPOINT 2: you approve the diff
   ├─ ship           commits, PRs, CI watch, merge
   ├─ docs           updated once, last, when the code has stopped moving
   └─ /task cleanup  worktrees and sessions removed
```

| Command | What it does |
|---|---|
| `/task new <ticket>` | Creates the worktrees, opens the task session, starts planning |
| `/task plan` | Writes `PLAN.md` and opens the plan gate |
| `/task status` | Phase, PRs, CI, and what blocks `finish` — `--all` for every task |
| `/task switch <branch>` | Jumps to another running task |
| `/task pair` | Switches the task to pair mode |
| `/task reviewd` | Every decision the agent made alone — keep, change or revert it |
| `/task reviewq` | Every question asked and its answer |
| `/task changes` | All diffs of the task on one page |
| `/task finish` | Checks, code review, diff gate, PRs, merge |
| `/task cleanup` | Removes the task after the merge |

## Why it scales

**Parallel tasks, zero collisions.** Every task lives in its own git worktree. Run five
tickets at once; none of them touches your main checkout or another task.

**Multi-repo by default.** A ticket that spans a service, a shared library, an API spec
and the e2e tests gets one worktree per repo, under one task. One plan, one diff, one
set of PRs.

**A thin coordinator, many lanes.** The main session only coordinates. Each unit of work —
a repo, a test run, one PR, one CI run, one deploy — runs in its own subagent lane with a
written brief. Noisy output (CI logs, test failures) never floods the main context.

**The right model for the stage.** Planning runs on the strongest model at maximum effort.
Implementation runs at high effort. Runners that only read and report use a cheaper model.
The model follows the stage, so you never pay planning prices for grunt work.

**Pair programming between agents.** `--pair` opens a writer and a read-only reviewer of a
*different* agent kind — Claude Code writes, OpenCode reviews, or the other way round. Hard
decisions are agreed by both before a line is typed.

**Every decision is on the record.** The agent logs each choice it made alone, and each
question and answer. You audit them later with `reviewd` and `reviewq`, instead of
babysitting the session.

## The cockpit: an agterm-based flow

Ten agents in ten terminal tabs is chaos. The whole flow runs inside
[agterm](https://agterm.com), a macOS terminal built for agentic work, and the skills
drive it through its control CLI, `agtermctl`. The agents build their own layout.

| agterm | What the task flow does with it |
|---|---|
| **Workspace** | One per company or project. The workspace name tells `/task` which project plugin to load — no config, no flags. |
| **Session** | One per task, named after the ticket, tinted in the project color and flagged, so the flagged view lists every live task. |
| **Split** | Pair mode: the writer agent on the left, the reviewer agent on the right. |
| **Companions** | Test runs, infra, consoles and review sessions hang under their task session and fold away. |
| **Page companions** | Status reports, diffs and explainers open as local HTML pages next to the task — never a file path to open by hand. |
| **HUD** | A small spinner over the session while the agent collects status or waits. |
| **Agent status** | Each session row shows active, blocked or completed, so you see at once which of many agents needs you. |

**Your focus is sacred.** Every session the flow opens starts in the background. An agent
never switches your view; it only marks the row that needs you. You work on one task
while five others run, and you jump in only at a checkpoint.

## Retro: the system sleeps on it

The brain does not learn during the day. It learns at night: sleep replays the day, keeps
what matters and drops the noise. `/retro` does the same for the agents, once a week.

<div class="skills-gates skills-gates-4">
  <div>
    <b>1 · Replay</b>
    <p>Load every Claude Code and OpenCode session of the week. Strip secrets and personal data first.</p>
  </div>
  <div>
    <b>2 · Dream</b>
    <p>11 reviewers read the week in parallel, each through one lens, and cite the session and turn for every finding.</p>
  </div>
  <div>
    <b>3 · Consolidate</b>
    <p>Merge duplicates into incidents. Keep only those backed by a transcript quote.</p>
  </div>
  <div>
    <b>4 · Remember</b>
    <p>Write the smallest fix into the skill, hook or config that owns it. Unclear ones go to me first.</p>
  </div>
</div>

The 11 lenses: requirements · rework · tool use · scope · technical quality · testing ·
communication · user experience · safety and privacy · prevention · productivity.

The strongest signal is me saying "redo", "again" or "I told you". Each one becomes a rule,
so the same correction is never needed twice. The **productivity** lens works the other way:
it finds gates, reviewers and checks that cost effort and gave nothing, and removes them.
So the system does not only get safer every week — it gets faster. Project plugins add
their own retro steps, and the week ends with one table: problem, cause, what changed,
what to do next time.

## Sub-projects: one base, many companies

The skills are layered, so one core process serves every product I work on.

| Layer | What it holds | Example |
|---|---|---|
| **Base** (`sadensmol-*`, public) | The process and the craft: task flow, planning, code review, git safety, Go / TypeScript / Python / Swift / Flutter / SQL / API guides | `sadensmol-task`, `sadensmol-programming-go` |
| **Project plugin** (private) | One per company or product: repo layout, tracker, conventions, deploy, definition of done | `<project>-task`, `<project>-linear` |
| **Router** | Detects the workspace and the code, then loads the right skills before the first action | Go repo + Linear key → Go guide + Linear skill |

`/task` is the one entry point everywhere. It detects the project and hands the
project-specific steps (`new`, `plan`, `finish`, `cleanup`) to that project's plugin.
Adding a new company is a new plugin, not a fork: it inherits the whole process on
day one.

## One source, three harnesses

The skills use the open [Agent Skills](https://agentskills.io) format. The same folders serve
**Claude Code**, **Codex** and **OpenCode** through symlinks — edit a skill once, and it is
live everywhere in the next session. Small runtime files map the few mechanical
differences (subagents, background jobs, questions), so the skills themselves stay
harness-neutral.

## What is inside

| Area | Skills |
|---|---|
| **Workflow** | `task` · `plan` · `code-review` · `git` · `github` · `cleanup` · `retro` · `learn` |
| **Languages** | Go · TypeScript · Python · Swift · Dart · Flutter |
| **Engineering** | API design (REST, OpenAPI, gRPC) · PostgreSQL · system design · design patterns |
| **Trackers & chat** | Linear · Jira · Slack |
| **Infra** | Kubernetes · tmux · agterm · Jetson Orin Nano · Hugging Face |
| **Writing** | articles · books · invoices |

`learn` closes the loop: when I correct the agent, the correction goes back into the
skill, so the same mistake does not happen twice.

[Explore the repository &rarr;](https://github.com/sadensmol/skills)

</div>
