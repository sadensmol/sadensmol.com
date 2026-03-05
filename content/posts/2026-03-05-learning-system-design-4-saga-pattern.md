+++
title = 'Learning System Design #4: Saga Pattern'
slug = 'learning-system-design-4-saga-pattern'
date = 2026-03-05
draft = false
description = 'Saga pattern for distributed transactions — choreography vs orchestration, compensating transactions, and when to use each.'
tags = ['system-design', 'microservices']
+++

Fourth part of the "Learning System Design" series! This time we're tackling the Saga pattern — something you'll inevitably run into the moment you split a monolith into microservices and realize your nice `BEGIN/COMMIT` doesn't work across service boundaries anymore.

![Saga Pattern](/images/posts/saga-pattern-hero.jpg)

## The Problem

In a monolith, distributed transactions don't exist. You have one database, one transaction:

```sql
BEGIN TRANSACTION
  1. Deduct money from wallet
  2. Create order record
  3. Reserve inventory
COMMIT
```

Step 3 fails? Database rolls back everything. Done.

But in microservices — each service owns its database. Order Service has DB1, Payment Service has DB2, Inventory Service has DB3. There's no shared transaction boundary. You can't wrap calls to three different services in a single `BEGIN/COMMIT`.

So what happens when Payment succeeds but Inventory fails? You end up with a charged customer and no reserved stock. Not great.

**The Saga pattern solves this** by breaking a distributed transaction into a sequence of local transactions, each with a compensating action to undo its work if a later step fails.

## What is a Saga?

Think of it like booking a vacation. You book a flight, then a hotel, then a rental car. If the rental car is unavailable — you cancel the hotel, then cancel the flight. Unwinding in reverse order.

A Saga is exactly that:
1. Each step performs a local transaction and publishes an event or sends a command
2. If a step fails, **compensating transactions** run in reverse to undo previous steps
3. The system reaches **eventual consistency** — not immediate

The important thing — sagas give you **ACD** from ACID, but **not Isolation**. Intermediate states are visible to other transactions. This is the biggest challenge and we'll get to how to handle it.

## Two Strategies: Choreography vs Orchestration

There are two fundamentally different ways to coordinate saga steps.

### Choreography

No central coordinator. Each service listens for events and decides independently what to do next. Services communicate through an event bus — Kafka, RabbitMQ, whatever you prefer.

![Saga choreography — services react to events from each other](/images/posts/saga-pattern-choreography.png)

The happy path is straightforward — Order Service creates the order, publishes an event, Payment Service picks it up, charges the customer, publishes another event, Inventory reserves stock. But when something fails, compensation events flow back in reverse.

**When to use:** simple sagas with 2-4 steps, loosely coupled services that already publish domain events, teams that want full autonomy.

**The catch:** logic is spread across services. It's hard to understand the full flow, cyclic dependencies can emerge, and good luck figuring out "where is this saga right now?"

### Orchestration

A **central orchestrator** tells each service what to do and when. It manages the sequence, handles failures, and triggers compensations.

![Saga orchestration — central coordinator manages the flow](/images/posts/saga-pattern-orchestration.png)

The orchestrator holds the saga definition — all steps and their compensations. It persists state so it can recover from crashes. Communication is command-based — request/reply instead of fire-and-forget events.

**When to use:** complex sagas with 5+ steps, branching logic, or when you need clear visibility into the saga's progress.

**The catch:** orchestrator can become a single point of failure (mitigate with persistence + replayability). Also — resist putting business logic in it. It's a coordinator, not a god service.

### Which One to Pick?

![Decision guide — choreography vs orchestration](/images/posts/saga-pattern-decision.png)

| Aspect | Choreography | Orchestration |
|--------|-------------|---------------|
| **Coordination** | Decentralized (events) | Centralized (orchestrator) |
| **Coupling** | Loose — services only know events | Medium — orchestrator knows all participants |
| **Complexity at scale** | Grows rapidly (spaghetti events) | Grows linearly |
| **Visibility** | Hard to trace | Easy — orchestrator tracks state |
| **Testing** | Harder (full event flow) | Easier (test orchestrator logic) |

My honest recommendation? **Start with orchestration** unless you have a strong reason not to. It's easier to debug, easier to maintain, and easier to explain to your team.

## Compensating Transactions

This is the core of the Saga pattern. Compensations are **not** rollbacks — they're new transactions that semantically reverse the effect of a previous step.

Three key principles:

**1. Must be idempotent.** A compensation might be retried if it fails or the system crashes mid-way. Running it twice must produce the same result.

```
// BAD: Not idempotent
wallet.balance += refundAmount

// GOOD: Idempotent
if not exists(refund for this saga_id):
    wallet.balance += refundAmount
    record refund
```

**2. Not all steps need compensation.** Some steps are inherently retriable (can be repeated safely) or are pivot transactions (point of no return).

**3. Order your steps wisely:**

```
[Compensatable steps] → [Pivot transaction] → [Retriable steps]
```

For an e-commerce order this looks like:

| Step | Type | Compensation |
|------|------|-------------|
| Create Order (PENDING) | Compensatable | Cancel order |
| Reserve Inventory | Compensatable | Release inventory |
| Charge Payment | **Pivot** | — (point of no return) |
| Confirm Order | Retriable | — (will eventually succeed) |
| Send Email | Retriable | — (will eventually succeed) |

Move the pivot transaction as late as possible. Once you charge a credit card, you're committed to going forward.

## Handling the Isolation Problem

Since sagas don't provide isolation, concurrent operations can see intermediate states. Someone might see an order as PENDING with payment completed but stock not yet reserved. Here's how to deal with it:

**Semantic locks** — mark records as "in-progress" during the saga. Order status = PENDING, not CONFIRMED. Other operations know to wait or handle accordingly.

**Reread values** — re-check data before committing a step. Verify inventory count before reserving — it might have changed since you last looked.

**Version checks** — use optimistic concurrency. Update only if the version matches what you read.

**Commutative updates** — design operations so order doesn't matter. Increment/decrement counters instead of setting absolute values.

## Saga vs Two-Phase Commit

This comes up in every system design interview. Why not just use 2PC?

| Aspect | Saga | 2PC |
|--------|------|-----|
| **Consistency** | Eventual | Strong (immediate) |
| **Availability** | High — no global locks | Lower — blocked if coordinator fails |
| **Scalability** | High | Low — lock contention |
| **Best for** | Microservices, long-lived transactions | Short transactions, same trust boundary |

2PC requires all participants to support XA protocol, hold locks during the prepare phase, and can block indefinitely if the coordinator fails. In microservices where services are independently deployed and scaled — this is impractical. Sagas trade isolation for availability and scalability.

## Practical Tips

A few things I've found important when implementing sagas in real systems:

1. **Use a workflow engine** — Temporal, AWS Step Functions, Cadence. Don't build saga infrastructure from scratch unless you enjoy suffering
2. **Log everything** — saga ID, step, status, timestamps, payloads. You will need this for debugging at 3am
3. **Design compensations from day one** — don't bolt them on later, it never works well
4. **Test failure scenarios explicitly** — kill services mid-saga, simulate timeouts, test double-deliveries
5. **Use correlation IDs** — a unique saga ID that flows through every service for tracing
6. **Monitor saga durations** — a saga taking too long likely has a stuck step
7. **Set up dead letter queues** — for messages that repeatedly fail processing

## Summary

The Saga pattern is how you do distributed transactions in microservices. Break a big transaction into small local ones, each with a compensating action. If something fails — unwind in reverse.

Two strategies: choreography (event-driven, decentralized) for simple flows, orchestration (central coordinator) for anything complex. Start with orchestration — you'll thank yourself later.

The hardest part isn't the pattern itself — it's handling the lack of isolation and designing proper compensations. Get those right and sagas work beautifully.

More detailed notes with all the diagrams, comparison tables, and interview questions:

https://github.com/sadensmol/learning_system-design/blob/main/saga-pattern.md

Thanks for reading! More system design topics coming in the next parts of the series.

PS: have you implemented sagas in production? Choreography or orchestration? I'd love to hear about your experience!
