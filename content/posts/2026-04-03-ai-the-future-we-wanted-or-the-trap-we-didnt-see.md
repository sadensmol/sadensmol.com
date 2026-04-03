+++
title = "AI: The Future We Wanted or the Trap We Didn't See?"
slug = 'ai-the-future-we-wanted-or-the-trap-we-didnt-see'
date = 2026-04-03
draft = false
description = 'The developer AI debate is a false binary. History and neuroscience reveal what we are actually losing.'
tags = ['ai', 'software-development', 'opinion']
+++

The developer world has split in two. Open any tech forum, any Twitter thread, any Slack channel — and you'll find the same fight. Camp one: "AI makes me 10x more productive, stop being a dinosaur." Camp two: "AI is making developers dumb, we're losing our craft." Both sides are loud. Both sides have data. And both sides are missing the real point.

![AI: The Future We Wanted or the Trap We Didn't See?](/images/posts/ai-future-or-trap-hero.jpg)

The productivity camp cites GitHub's numbers — 67% of developers use Copilot 5+ days a week, AI writes 46% of all code on the platform. The skeptics fire back with the METR study — a rigorous randomized controlled trial where 16 experienced open-source developers were actually **19% slower** with AI tools, despite believing they were 20% faster. A 40-percentage-point perception gap.

Stack Overflow's 2025 survey of 49,000+ developers shows the tension perfectly: 80% use AI tools, but trust in AI accuracy dropped from 40% to 29%. The top frustration, cited by 45% of respondents? AI solutions that are "almost right, but not quite."

Both camps are arguing about productivity. But that's the wrong argument. The real question is what's happening to our brains.

## How Your Brain Gets Good at Things

There's a specific physical mechanism behind how the brain learns. Understanding it changes how you think about the entire AI debate.

### The Myelination Loop

When you focus deeply on a hard problem — debugging a race condition, designing a data model, tracing a memory leak — something physical happens inside your skull. You're repeatedly firing the same neural circuits in isolation. The same pathways light up again and again as you hold the problem in your head, try approaches, fail, adjust, try again.

When a neural circuit fires repeatedly like this, your brain responds by wrapping more **myelin** — a fatty insulating substance — around the axons in that circuit. Each layer of myelin makes the signal travel faster, with less noise and fewer errors. It's like upgrading a dirt road to a highway. The more you use the circuit, the thicker the myelin, the faster and more reliable the signal.

This is not a metaphor. It's measurable. MRI studies of expert musicians show myelination patterns that directly mirror their thousands of hours of practice. London taxi drivers who memorized 25,000 streets show measurably thicker neural pathways in the hippocampus. The brain literally rewires itself around what you repeatedly do.

### Why It Has to Be Hard

Here's the part most people miss: **the difficulty is the mechanism, not an obstacle to it.**

When work feels easy — copying code, accepting AI suggestions, following tutorials — the neural circuits fire weakly and briefly. Not enough repetition, not enough intensity to trigger significant myelination. The brain doesn't bother upgrading a road that barely gets used.

When work feels hard — when you're stuck, frustrated, holding multiple variables in your head, trying approach after approach — that's when the circuits fire intensely and repeatedly. That's when the myelin wraps. Robert Bjork at UCLA calls these **"desirable difficulties"** — learning conditions that feel slow and frustrating but produce dramatically better long-term retention than methods that feel smooth and productive.

The irony is brutal: the approach that feels most productive (instant AI answers) builds the least neural infrastructure. The approach that feels least productive (struggling for hours) builds the most.

### Why Focus Matters

There's a catch: the circuits have to fire **in isolation**. This is why focused work — what Cal Newport calls "deep work" — is so critical. When you task-switch, your brain doesn't cleanly swap one set of circuits for another. Research shows there's an **attention residue** — part of your mind stays on the previous task, which means no single circuit gets the sustained, repeated activation needed for myelination.

Anders Ericsson, who studied expert performance for decades, put it bluntly: *"Diffused attention is almost antithetical to the focused attention required by deliberate practice."* Even elite performers max out at about 4 hours of truly focused practice per day. The brain can't sustain it longer. But those 4 hours of deep, focused struggle build more neural infrastructure than 12 hours of scattered, easy work.

This is the lens through which we need to view the entire history of software development. At every stage, the question isn't just "what tools did programmers use?" It's "what were their brains training on?"

## The Abstraction Ladder

Software development has always been a story of abstraction — each generation trading low-level understanding for higher-level productivity. And here's the key: **every previous transition replaced old cognitive load with new, equally demanding cognitive load.**

![The Abstraction Ladder — what does your brain train on at each level?](/images/posts/ai-future-or-trap-abstraction-ladder.png)

### Machine Code: When Code Was Physical

In the 1950s and 60s, programming meant understanding every circuit in the machine. Margaret Hamilton led the team that wrote the Apollo Guidance Computer software — code that was literally **hand-woven into physical memory** by workers threading wires through tiny magnetic cores. A wire through a core was a 1, bypassing it was a 0. Manufacturing a single memory module took 8 weeks.

There was no debugging tool. No Stack Overflow. No "undo." Programmers had to hold the entire machine in their heads — hardware, software, physics, everything. When the AGC threw alarms three minutes before the Apollo 11 lunar landing, Hamilton's defensive programming saved the mission. She had insisted on error-handling that others called unnecessary — "astronauts don't make mistakes," they said.

The cognitive load was total. And the brain trained on: electrical engineering, binary arithmetic, physical memory architecture.

### Assembly: Still Close to the Metal

Assembly gave us mnemonics instead of raw binary — `MOV AL, 61h` instead of `10110000 01100001`. A modest abstraction. Programmers still needed to understand registers, memory addressing, and instruction sets. A single wrong bit crashed the system.

The brain trained on: CPU architecture, memory models, instruction pipelines.

### High-Level Languages: The First Big Shift

When FORTRAN appeared in 1957, John Backus described the previous era as "hand-to-hand combat with the machine — with the machine often winning." Assembly programmers pushed back hard. Ed Post's famous 1983 essay "Real Programmers Don't Use Pascal" captured the contempt: *"If you can't do it in Fortran, do it in assembly language. If you can't do it in assembly language, it isn't worth doing."*

Dijkstra was more direct: *"The purpose of abstracting is not to be vague, but to create a new semantic level in which one can be absolutely precise."*

Here's the critical thing: when programmers stopped managing registers, they didn't become idle. They redirected that brainpower to **entirely new problems** — portable code design, operating system concepts, data structures, software architecture. Problems that couldn't even be conceived at the assembly level. The cognitive load didn't decrease. It shifted upward.

### Frameworks: Even More Abstraction

Ruby on Rails, Django, Spring, React — each encoded opinions about how applications should be built. A Rails developer could build a full CRUD application with `rails generate scaffold` without understanding TCP/IP, SQL joins, or how browsers render pages.

But the freed capacity was immediately consumed by new demands: distributed systems, API design, cloud architecture, DevOps pipelines, security at the application layer, scaling strategies, caching patterns. A Rails developer in 2015 didn't know assembly, but needed to understand HTTP semantics, database indexing, background job processing, deployment pipelines, and dozens of other concepts that didn't exist in the 1970s.

This is **Jevons Paradox** applied to software. As Addy Osmani put it: *"When high-level languages replaced assembly, programmers didn't write less code — they wrote orders of magnitude more, tackling problems that would have been economically impossible before."*

Each abstraction layer made previously unthinkable projects viable, which generated new complexity at a higher level. The total cognitive budget never shrank. It was reallocated.

### AI: Something Different?

And now we get to AI-assisted coding. The pattern should be the same, right? We abstract away implementation, and our brains redirect to higher-level problems — system architecture, product thinking, AI orchestration.

Maybe. But maybe not. Because there's a fundamental difference this time.

**Every previous transition required mastery of the new abstraction layer.** You couldn't be a productive C programmer without understanding pointers and memory allocation. You couldn't be a productive Rails developer without understanding HTTP and databases. The abstraction removed one layer of difficulty but demanded you master the next one.

With AI, you can "vibe code" — Andrej Karpathy's term for when you "fully give in to the vibes, embrace exponentials, and forget that the code even exists." You can be "productive" **without understanding any abstraction layer at all.** That has never happened before in the history of computing.

## What Happens When the Training Stops

We know how focused work builds neural pathways — myelin wraps around circuits that fire repeatedly. But the brain doesn't just build. It also actively dismantles what you don't use.

### The Generation Effect

Slamecka and Graf documented this in 1978: information is better remembered if it is **generated from your own mind** rather than provided by someone else. A meta-analysis of 86 studies confirmed a significant effect. Even failed attempts to generate answers enhance subsequent learning. The struggle itself primes the brain for encoding.

Think about what AI coding does. Instead of generating solutions yourself — struggling, failing, trying again — you describe the problem and receive a solution. You skip the generation step entirely. The code works, but the neural pathway that would have been built... wasn't.

### Cognitive Offloading: The Google Effect

Betsy Sparrow at Columbia University published a landmark study in *Science* (2011) showing that when people know information will be saved digitally, they have **significantly lower recall** of the information itself. They remember where to find it, but not the content. She called it "The Google Effect."

GPS provides an even more striking parallel. Dahmani and Bherer (2020) found that habitual GPS users showed steeper declines in hippocampal-dependent spatial memory over time. Greater GPS use correlated with worse spatial performance — the exact opposite of the London taxi drivers who actively navigated. Same brain region, opposite outcomes. The difference? Active cognitive engagement vs. passive following.

### Use It or Lose It

Synaptic pruning follows a strict rule: pathways that are frequently activated get stronger, while unused connections are eliminated. This isn't just a childhood process — it continues throughout adult life. Boston University research found that cognitive decline in old age is linked to increased pruning of brain cell connections.

The implication is clear: mental skills that are not actively exercised will physically degrade at the neural level. Not metaphorically. Structurally. The myelination that took years of focused practice to build? It degrades when those circuits stop firing.

## The Automation Paradox

None of this is new. In 1983, Lisanne Bainbridge published "Ironies of Automation" — a paper that predicted exactly what we're seeing now with AI coding tools.

Her core paradox: **the more advanced an automated system becomes, the more critical — and more difficult — the human role within it becomes.**

When automation works, operators don't practice their skills. When automation fails, operators must intervene — but their skills have atrophied precisely because they haven't been practicing. The operator is expected to monitor a system they no longer actively control and to take over expertly at a moment's notice.

This played out fatally in aviation. After decades of increasing cockpit automation, a NASA survey found 90% of commercial pilots believed pilots as a whole were losing flying skills due to automation. The 2009 Air France Flight 447 crash and the 2009 Colgan Air crash both involved pilots who had lost their kinesthetic sense of the aircraft.

It's playing out in software development right now. Anthropic's own study (January 2026) — a randomized controlled trial with 52 developers — found that those using AI coding assistance **scored 17% lower on comprehension tests**. Those who delegated code generation to AI scored below 40%, while those who used AI for conceptual inquiry scored 65% or higher.

Addy Osmani, engineering lead at Google, drew the distinction perfectly: *"A calculator still requires you to set up the problem; an AI can replace the entire thinking process."*

## Two Camps, One Truth

Here's the one truth neither camp wants to hear.

**Both sides are right. And that's not a contradiction — that's the trap.**

AI makes you faster today. AI makes you weaker tomorrow. These aren't opposing positions. They're two measurements of the same phenomenon at different timescales.

You've seen the pattern through 70 years of the abstraction ladder. Every transition replaced one hard skill with another equally hard one. The brain stayed loaded. The myelin just wrapped around different circuits. No net loss — ever.

Until now. **AI is the first transition in computing history where the brain has nothing equally hard to redirect to.** The replacement — prompt engineering, reviewing AI output — is not cognitively equivalent to what was lost. AI generates code at 140-200 lines per minute. Humans comprehend at 20-40. That's a 5-7x gap Osmani calls "comprehension debt" — surface correctness hiding hollowed-out understanding. Microsoft/Carnegie Mellon research (2025) confirmed that the more people leaned on AI tools, the less critical thinking they engaged in.

And neuroscience is unambiguous about what happens to a brain under reduced load: it prunes the circuits it no longer needs.

The numbers already show it. GitClear's analysis of 211 million lines of code: copy/pasted code up from 8.3% to 12.3%. Refactored code collapsed from 25% to under 10%. Code churn — code thrown away within two weeks — doubled. These are the fingerprints of code that nobody understands.

The junior developer pipeline is drying up. Employment for developers aged 22-25 dropped nearly 20% between 2022 and 2025. Companies say "AI handles the junior work now." But if you stop training juniors, you stop producing seniors. As Osmani warned: *"If you don't hire junior developers, you'll someday never have senior developers."*

For companies, AI is a clear short-term win — more output, lower costs, faster time to market. For the profession, for the industry, for the long-term health of the people building the systems the world runs on? It's a slow-motion disaster that feels like progress.

## Fight Back — But Fight Smart

I'm not saying "stop using AI." That would be like telling a 1960s programmer to reject compilers. The abstraction is here, and it's not going away.

But I am saying: **this is the one transition in computing history where you need to actively resist the comfort it offers.** Not reject it. Resist the easy path of full surrender. Because full surrender means full cognitive offload. And full cognitive offload means your neural circuits start pruning. Slowly, silently, irreversibly.

Socrates warned that writing would "implant forgetfulness in their souls." He was partly right — we lost the oral tradition's memory capacity. But writing demanded a compensating skill: structured thinking, argumentation, building on accumulated knowledge. The brain traded one workout for another.

AI is more like GPS. It doesn't demand a compensating skill. It just makes the old one unnecessary. And the taxi drivers' hippocampi don't care about your productivity metrics — they shrink when they stop being used.

So fight. Not against AI — but against your own atrophy.

**Write code without AI regularly.** Like an athlete doing basic drills, maintain the fundamental neural pathways. When you struggle with a bug for two hours, your brain is physically building something that an instant AI answer would have prevented.

**Use AI for acceleration, not for replacement.** Use it to speed up work you already understand. Not to skip understanding entirely.

**Learn the layer below.** Whatever abstraction level you work at, understand at least one level beneath it. If you write Python, understand how the interpreter works. If you use a framework, understand the protocol underneath.

**Train your brain on hard things.** The difficulty is the point. The struggle is not a bug in the learning process — it's the mechanism itself. Every hour of focused, hard problem-solving wraps myelin around your neural circuits. Every hour of passive AI acceptance lets it degrade.

Fred Brooks said it in 1986: *"The complexity of software is an essential property, not an accidental one. Descriptions of a software entity that abstract away its complexity often abstract away its essence."*

AI can abstract away accidental complexity — boilerplate, repetitive patterns, syntax. But essential complexity — the hard thinking about what to build and why — cannot be delegated without being lost.

## Summary

The developer AI debate is a false binary. Both camps are right — and that's the trap, not the answer.

Seventy years of neuroscience — from Maguire's taxi drivers to Bjork's desirable difficulties to Sparrow's Google Effect — tells us one thing clearly: your brain grows when you challenge it and atrophies when you don't. And AI is the first abstraction in computing history that doesn't replace the challenge with an equally hard one.

If we give up completely — if we hand over not just the boilerplate but the thinking itself — our future is not "developers assisted by AI." It's developers who can no longer function without AI. Dependent. Replaceable. And eventually, unnecessary. At that point, we haven't adopted a tool. We've surrendered to it. The machines won't need to take our jobs — we'll have already forgotten how to do them.

The real question isn't "should we use AI?" It's "are we training our brains hard enough to remain the ones in control?"

Because every generation of programmers before us kept their brains loaded. They traded one hard skill for another, and they stayed sharp. We're the first generation with the option to trade hard skills for nothing. And if we take that deal, we won't lose a battle to machines. We'll have simply walked off the field.

PS: where do you stand? Are you actively training your brain alongside AI tools, or have you noticed your skills shifting? I'd love to hear your experience.
