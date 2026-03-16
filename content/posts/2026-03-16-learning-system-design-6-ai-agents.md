+++
title = 'Learning System Design #6: AI Agents'
slug = 'learning-system-design-6-ai-agents'
date = 2026-03-16
draft = false
description = 'AI agents explained — how they work, architectures, context engineering, the Ralph Loop, and when to use them.'
tags = ['system-design', 'ai']
+++

Sixth part of the "Learning System Design" series! This time we're talking about AI agents — the thing that took the industry by storm and turned "just ask the AI" into "let the AI do it for you." If you've used Claude Code, Cursor, or GitHub Copilot agent mode — you've already interacted with one.

![AI Agents](/images/posts/learning-system-design-6-ai-agents-hero.jpg)

But what actually makes an agent an agent? How does it decide what to do? And most importantly — when should you build one vs just writing a normal program? Let's figure it out.

## What is an AI Agent?

Think of a regular chatbot as a waiter who can only answer questions from the menu. You ask "what soups do you have?" — you get a list. That's it. The waiter doesn't cook, doesn't go to the store, doesn't adjust recipes.

An agent is more like a personal chef. You say "make me something Italian." The chef checks the fridge (uses tools to gather information), realizes there's no basil, goes to the store (takes actions in the real world), adjusts the recipe based on what's available (reasons and adapts), and cooks the meal (produces the result). Nobody told the chef which steps to take or in what order — the chef figured it out.

That's the core difference: **a chatbot responds, an agent acts.**

Or if you prefer a programming analogy — a chatbot is a pure function: input in, output out. An agent is a program with a `while` loop that keeps running, making decisions, calling APIs, reading files, and adjusting its approach until the job is done.

The formula is surprisingly simple:

```
Agent = LLM + Tools + Loop
```

- **LLM** — the reasoning engine that reads the situation and decides what to do next
- **Tools** — functions the LLM can call to interact with the real world (read files, query databases, call APIs)
- **Loop** — the LLM keeps thinking and acting until the task is done, not just one response

That's it. Every agent framework — OpenAI, Anthropic, LangChain — is just a different way of wiring these three things together.

Four properties make something an agent: **autonomy** (it decides the steps, not a hardcoded script), **tool use** (it interacts with external systems), **reasoning** (it thinks about what to do based on observations), and **goal-directed behavior** (it works toward completing a task, not just answering a question).

## Agent vs Chatbot vs Pipeline

These terms get confused constantly. Here's the difference:

**Chatbot** — takes input, generates text. No tools, no actions. "What's the capital of France?" → "Paris." Done.

**Pipeline** — a fixed sequence of steps. Summarize → Translate → Format. The order is predetermined by the developer. Predictable, but rigid.

**Agent** — dynamically decides which tools to use and in what order. Can loop, retry, change strategy. The developer defines the tools and goal, but the agent decides the path.

The key insight: **a chatbot responds, an agent acts.**

```
Chatbot:    User asks → LLM responds → Done

Agent:      User asks → LLM thinks → Uses tool → Observes result
                      → Thinks again → Uses another tool → Observes
                      → ... (loop until goal is met)
                      → Delivers final answer
```

## The ReAct Loop

Every agent runs on the same pattern — **ReAct** (Reasoning + Acting). Here's a concrete example:

![The ReAct Loop — think, act, observe, repeat](/images/posts/learning-system-design-6-ai-agents-react-loop.png)

Say you ask: "What's the weather in the city where Apple HQ is located?"

```
Step 1 — THINK:  "I need to find where Apple's HQ is."
Step 2 — ACT:    search("Apple headquarters location")
Step 3 — OBSERVE: "Apple Park, Cupertino, California"
Step 4 — THINK:  "Now I need the weather there."
Step 5 — ACT:    get_weather("Cupertino, CA")
Step 6 — OBSERVE: "72°F, Sunny"
Step 7 — RESPOND: "It's 72°F and Sunny in Cupertino."
```

In code, this is embarrassingly simple:

```python
def agent_loop(user_goal, tools, llm):
    messages = [{"role": "user", "content": user_goal}]

    while True:
        response = llm.call(messages, tools=tools)

        if response.has_tool_call:
            result = tools[response.tool_call.name].execute(
                **response.tool_call.arguments
            )
            messages.append({"role": "assistant", "content": response})
            messages.append({"role": "tool", "content": result})
        else:
            return response.text
```

This is the core of **every** agent framework. Everything else is just wrappers and conveniences on top.

## Core Building Blocks

### Tools

Tools are what separate an agent from a chatbot. The LLM never calls tools directly — it's a text-in, text-out API. The flow is:

1. Your code sends the LLM a list of available tools (name, description, parameters)
2. The LLM responds with "I want to call tool X with arguments Y" (as structured JSON)
3. Your code executes the function and sends the result back
4. The LLM reads the result and decides what to do next

What makes a good tool: **clear name** (the LLM reads it), **clear description** (the LLM uses it to decide when to call), **typed parameters**, and **predictable output**.

### Memory and Context

Two closely related but different things:

- **Context** — the text sent to the LLM on each API call. Everything the LLM can "see"
- **Memory** — the mechanism that determines what goes into the context

Think of it this way: **context is the LLM's desk** — whatever papers are on it right now. **Memory is the filing cabinet** — where information lives between sessions.

The critical thing to understand: **LLMs are stateless.** Each API call starts completely fresh. Your code rebuilds the full context from memory every single time. The LLM thinks it's having a continuous conversation, but in reality your code is replaying everything on every call.

### Planning

Advanced agents break complex tasks into subtasks before executing. Three strategies:

- **Upfront planning** — create full plan, then execute step by step
- **Adaptive planning** — plan a few steps ahead, adjust based on results
- **Hierarchical planning** — break into high-level goals, then sub-goals

Planning agents are powerful, but there's a catch — **how does a human review and refine the plan before execution?** In most setups, the agent outputs a plan as text in the terminal. You can approve or reject it, but giving specific feedback ("delete step 3, change step 5 to use Redis") means typing everything out. For complex plans, this is tedious.

**Plannotator** (plannotator.ai) solves this. It integrates with coding agents like Claude Code and opens the agent's plan in a visual UI where you can select text, mark it for deletion, add comments, or suggest replacements. Feedback flows back to the agent as structured annotations. You can also share plans with your team via URL and save approved plans to Obsidian for a searchable archive. Plan quality determines execution quality — a 5-minute investment reviewing a plan visually can save hours of the agent going in the wrong direction.

### Guardrails

Safety mechanisms that validate inputs and outputs. **Input guardrails** block prompt injection, off-topic requests, or out-of-scope queries before the agent processes them. **Output guardrails** ensure no sensitive data is leaked and the response format is correct.

## Agent Architectures

There are several ways to structure multi-agent systems:

![Agent architectures — single, multi-agent handoffs, orchestrator-worker](/images/posts/learning-system-design-6-ai-agents-architectures.png)

**Single Agent** — one agent with multiple tools. The simplest architecture. Use for straightforward tasks.

**Multi-Agent Handoffs** — a triage agent routes requests to specialized agents. The math question goes to the math agent, the code question to the code agent. Use when different tasks require different instructions, tools, or models.

**Orchestrator-Worker** — a central orchestrator delegates subtasks to worker agents in parallel. Think of a research task: one worker searches the web, another analyzes data, a third writes the report. The orchestrator combines everything. Use for complex tasks that decompose into independent subtasks.

**Pipeline** — agents process data in a fixed sequence, each transforming the output for the next. Researcher → Analyzer → Writer → Reviewer. Use when stages are clear and sequential.

**Ralph Loop** — not a multi-agent pattern, but a meta-pattern worth mentioning here. Instead of coordinating multiple agents, you run the **same agent repeatedly** with the same prompt, letting it build on its own previous work through file changes. The codebase becomes the shared state. More on this below.

## Context Engineering

This is the hidden cost killer that nobody talks about enough. Every token in your context window costs money, adds latency, and competes for the LLM's attention. Worse — LLMs perform **worse** when given too much irrelevant context.

![Context engineering — naive approach vs engineered approach](/images/posts/learning-system-design-6-ai-agents-context-engineering.png)

In an agent loop, context accumulates with every step:

```
Step 1:   2,200 tokens  → $0.002
Step 5:  25,000 tokens  → $0.025
Step 10: 60,000 tokens  → $0.060
Step 20: 150,000 tokens → $0.150
```

Each step re-sends the **entire conversation history**. By step 10, you're paying for 60K input tokens just for the LLM to re-read early messages. This is where most agent cost comes from.

### How to Fix It

**Summarize, don't accumulate.** Instead of keeping every tool result verbatim, summarize older results. Keep only recent ones in full.

**Trim tool output.** A database query might return 500 rows when the agent only needs a count. A file read might return 5000 lines when only 20 are relevant. Design your tools to return just what's needed.

**Load on demand.** Don't put everything in the system prompt. Instead of 5000 tokens of product catalog always present, use tools that load specific info when the agent asks for it.

**Use tiered models.** Route simple subtasks (classify, extract, format) to cheaper models like Haiku. Save the expensive Opus for complex reasoning and planning.

## The Ralph Loop

The Ralph Loop (also called the "Ralph Wiggum technique," pioneered by Geoffrey Huntley) is one of the most interesting patterns I've seen for agent-powered development. The idea is beautifully simple: give the agent the **same prompt over and over**, and let it build on its own previous work each iteration.

```bash
while task_not_complete; do
  cat PROMPT.md | ai-agent --continue
done
```

![The Ralph Loop — same prompt, iterative improvement](/images/posts/learning-system-design-6-ai-agents-ralph-loop.png)

Each iteration:
1. Agent receives the **same prompt**
2. Works on the task, modifying files
3. Tries to finish
4. A hook intercepts the exit and feeds the same prompt again
5. Agent sees its previous work in the codebase
6. Iteratively improves until completion

The "self-referential" part is key: the agent doesn't get its previous output as input. Instead, it sees the **state of the codebase** it modified in prior iterations — like a developer coming back to their own code the next day.

### Why It Works

Traditional agent loops handle tool calls within a single session. The Ralph Loop operates at a higher level — it loops **entire agent sessions**.

**It overcomes single-session limitations.** Complex tasks often exceed what an agent can do in one pass. Ralph keeps the agent working across multiple sessions, each with a fresh context window.

**Failures become predictable.** The technique is described as "deterministically bad in a non-deterministic world." Failures follow patterns, so you can tune the prompt to avoid them systematically.

**Files are the memory.** No special memory system needed — the codebase itself is the memory. Each iteration reads the current state and builds on it.

### When to Use It

**Good fit:** tasks with clear success criteria — refactoring with tests, adding test coverage, building from a spec. Anything where "run tests" or "check coverage" can tell the agent if it's done.

**Bad fit:** tasks needing human design decisions, creative work, one-shot operations, or anything with unclear success criteria.

### Practical Example

```bash
ralph-loop "Refactor the database layer to use connection pooling. \
Run all tests after each change. \
Output <promise>REFACTOR COMPLETE</promise> when all tests pass." \
--completion-promise "REFACTOR COMPLETE" \
--max-iterations 15
```

The agent will analyze the code in iteration 1, start refactoring in iteration 2, fix failing tests in iteration 3, and keep going until everything passes. Each time it starts fresh but sees the accumulated changes in the files.

### Tips for Effective Ralph Loops

- **Write specific, measurable prompts** — "Fix the bug" is too vague. "Fix the auth token refresh, all tests must pass" is actionable
- **Include a verification command** — tell the agent to run tests or builds so it can self-verify
- **Always set max-iterations** — without it, a stuck loop burns tokens forever
- **Use completion promises** — let the agent signal when it's done rather than always hitting the max

## Real-World Agentic Systems

Agents aren't just a toy for chatbots. Here are systems that already exist or are being actively built:

**Coding assistants** — Claude Code, Cursor, GitHub Copilot agent mode. You describe what you want, the agent reads your codebase, writes code, runs tests, fixes errors, and iterates until it works. This is the most mature category right now.

**Customer support** — an agent that reads the customer's message, looks up their account in the database, checks order history, applies refund policies, and resolves the issue. No human in the loop for 80% of tickets. The remaining 20% get escalated with full context attached.

**Code review bots** — an agent that monitors PRs, reads the diff, checks for security issues, runs static analysis, verifies test coverage, and posts a structured review. Not just "looks good" — actual actionable feedback.

**Data analysis pipelines** — "analyze last quarter's sales and find anomalies." The agent queries the database, runs statistical analysis, generates charts, and writes a summary. Different every time because the data is different.

**DevOps incident response** — an agent that gets paged, reads logs, correlates metrics, identifies the root cause, and either fixes it automatically or prepares a runbook for the on-call engineer. At 3am, you want the agent to do the detective work for you.

**Research assistants** — "find all papers about distributed consensus published in the last 2 years and summarize the key insights." The agent searches, reads, filters, and synthesizes. What would take you a day takes the agent 10 minutes.

**Content pipelines** — writing, editing, fact-checking, and publishing. An agent that takes a topic, researches it, writes a draft, checks facts against sources, and formats it for your blog. I'm not saying this article was written by one... but it's a theme for another article!

### What You Could Build

If you're thinking about building something with agents, here are patterns that work well:

**Internal tools automation** — take your company's repetitive workflows (onboarding new employees, provisioning infrastructure, generating reports) and wrap them in an agent. The agent handles the happy path, escalates edge cases to humans.

**Smart assistants for domain experts** — a legal assistant that reads contracts and flags risky clauses, a medical assistant that summarizes patient history before a consultation, a financial assistant that monitors portfolios and explains anomalies. The agent doesn't replace the expert — it prepares the work.

**Multi-step workflows with branching logic** — anything where the next step depends on the result of the previous one. Insurance claim processing, loan applications, compliance checks. These are painful to hardcode because the decision tree is huge, but an agent with the right tools and guardrails handles them naturally.

**Monitoring and alerting** — agents that watch your systems, correlate signals across multiple sources, and only alert you when something actually needs attention. No more alert fatigue from dumb threshold-based rules.

## When to Use Agents (and When Not To)

**Use agents when:**
- Tasks require dynamic decision-making based on intermediate results
- You can't predict the exact steps needed upfront
- The task involves multiple tools and information sources
- You need iterative refinement (code, research, analysis)

**Don't use agents when:**
- A deterministic script would work — `if/else` is faster, cheaper, and more reliable than an LLM
- The task is simple and well-defined — a function call doesn't need an agent
- Latency matters — every LLM call adds seconds
- Cost matters at scale — agents are expensive per-task compared to traditional code
- You need guaranteed behavior — agents are non-deterministic by nature

The honest truth: most tasks don't need agents. A well-written function, a SQL query, or a simple pipeline will outperform an agent in speed, cost, and reliability for the vast majority of use cases. Agents shine when the problem is genuinely open-ended and requires reasoning.

## Summary

AI agents are LLM + Tools + Loop. The ReAct pattern (think → act → observe → repeat) is the foundation of every agent framework. Context engineering is the hidden lever for cost and quality — smaller, more relevant context beats larger, noisier context every time.

The Ralph Loop is a powerful pattern for complex iterative tasks — same prompt, multiple sessions, files as memory. And the most important lesson: don't reach for an agent when a simple function would do.

More detailed notes with all architectures, SDK examples (OpenAI, Anthropic, DSPy), and interview questions:

https://github.com/sadensmol/learning_system-design/blob/main/ai-agents-guide.md

Thanks for reading! More system design topics coming in the next parts of the series.

PS: are you building with agents? What frameworks are you using? I'd love to hear what's working for you and what's not!
