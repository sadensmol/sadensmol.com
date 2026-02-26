+++
title = 'Learning System Design #3: Rate Limiting'
slug = 'learning-system-design-3-rate-limiting'
date = 2026-02-26
draft = false
description = 'Rate limiting algorithms explained — token bucket, leaky bucket, sliding windows, and how to pick the right one for your system.'
tags = ['system-design', 'rate-limiting']
+++

Third part of the "Learning System Design" series! This time — rate limiting. Something every backend developer deals with sooner or later, and something that comes up in almost every system design interview.

The concept is dead simple — control how many requests a client can make in a given time window. But the devil is in the details. There are multiple algorithms, each with different trade-offs, and picking the wrong one can either leave your system unprotected or annoy your users with unnecessary rejections.

## Why Rate Limiting?

Your API can handle, say, 1000 requests per second. What happens when someone sends 10,000? Everything slows down, legitimate users suffer, and your on-call engineer gets paged at 3am.

Rate limiting protects you from DoS attacks, brute-force attempts, buggy clients stuck in infinite loops, and one heavy user consuming all your resources. It's not optional — it's infrastructure.

Every rate limiter answers three questions: **who** is making the request (IP, API key, user ID), **how many** requests are allowed, and **in what time period**.

## The Algorithms

There are five main approaches. Let's go through each.

### Token Bucket

Think of it as an arcade — you get tokens at a steady rate, you can save them up to a maximum, and each request costs one token. No tokens left? Wait.

Two parameters control everything: **bucket size** (max burst allowed) and **refill rate** (sustained throughput). A bucket of 100 with a refill of 10/sec means you can burst 100 requests instantly, then sustain 10/sec after that.

This is what Twitter (X) uses — "300 requests per 15 minutes" is basically a token bucket with 300 capacity and 0.33 tokens/sec refill.

**Pros:** allows natural traffic bursts, simple, memory-efficient (just 2 values to store).
**Cons:** large bucket sizes can overwhelm your backend during a burst.

### Leaky Bucket

Requests go into a queue and get processed at a **constant rate** — like water leaking from a bucket through a small hole. Queue full? Request rejected.

The key difference from token bucket: token bucket controls **when you can request**, leaky bucket controls **when requests are processed**. Token bucket allows bursts, leaky bucket smooths everything out.

**Pros:** perfectly smooth output rate, great when calling rate-limited external APIs.
**Cons:** adds latency (requests wait in queue), new requests stuck behind old ones.

### Fixed Window Counter

The simplest approach — divide time into fixed windows (e.g., 1-minute chunks), count requests in each window, reset when the window ends. One counter, done.

But there's a nasty edge case. If someone sends 100 requests at 12:00:59 and another 100 at 12:01:01, both windows think they're under the limit. Result: 200 requests in 2 seconds while your limit is 100/minute. Effectively **double** the intended rate at window boundaries.

**Pros:** dead simple, minimal memory.
**Cons:** 2x burst at boundaries. Not suitable when strict limits matter.

### Sliding Window Log

Keep a timestamp of **every** request. For each new request, remove expired timestamps, count the rest. If under the limit — allow.

This is the most accurate approach. No boundary issues whatsoever. But you're storing every single timestamp, and cleanup is O(n). For high-volume APIs this just doesn't scale.

**Pros:** perfect accuracy.
**Cons:** memory-hungry, slow cleanup. Only practical for low-volume, high-accuracy scenarios like fraud detection.

### Sliding Window Counter

This is the sweet spot. Combine two fixed window counters — current and previous — and use a **weighted average** based on how far into the current window you are.

If you're 20 seconds into a 60-second window, the previous window gets 67% weight ((60-20)/60). So if the previous window had 84 requests and the current has 36, your estimate is: `84 × 0.67 + 36 = 92`. Under 100? Allow.

**Pros:** memory-efficient (just 2 counters), smooths boundary issues, good enough for production.
**Cons:** it's an approximation, not 100% precise. But for most use cases — more than good enough.

## Which One to Pick?

Here's a quick decision guide:

| Scenario | Algorithm |
|----------|-----------|
| General API | Sliding Window Counter |
| Need burst handling | Token Bucket |
| Calling external APIs | Leaky Bucket |
| Simple internal service | Fixed Window |
| Low-volume, high-accuracy | Sliding Window Log |

If you're unsure — **Sliding Window Counter** is the safe default. It's what most production APIs (GitHub, Stripe) use behind the scenes.

## Distributed Rate Limiting

Everything above works fine on a single server. Add a load balancer with 3 servers behind it, and your 100 req/min limit becomes 300 — each server counts independently.

The standard fix: use **Redis as a centralized counter**. All servers check the same shared state. It's accurate but now Redis is a critical dependency and every request has network latency.

A smarter approach is **token pre-fetching** — each server grabs a batch of tokens from Redis in advance (say, 100 at a time) and serves requests from the local pool. Extremely fast, no per-request network call. The trade-off: if a server crashes with unused tokens, those are wasted.

And the big question — what if Redis goes down? Most production systems **fail open** (allow all requests). It's better to temporarily over-serve than to have a complete outage because your rate limiter died. Log it, alert on-call, fix it.

## Implementation Tips

A few practical things that matter in real systems:

**Always return rate limit headers.** `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. When you reject with 429, include `Retry-After`. Your users will thank you.

**Use per-endpoint limits.** A `GET /users` is cheap, a `POST /export` is expensive. Same limit for both makes no sense.

**Tier your limits.** Anonymous gets 10/min, free users 100/min, pro users 1000/min. Simple, effective, and a natural upsell path.

**Combine identifiers.** Rate limiting by API key alone? Users create multiple keys. By IP alone? Shared offices get punished. Use a combination — API key + IP + user ID.

## Summary

Rate limiting is one of those things that seems trivial until you have to implement it properly. The algorithm choice matters — sliding window counter is the go-to default, token bucket when you need controlled bursts, leaky bucket when you need smooth output.

For distributed systems, centralized Redis counters or token pre-fetching solve the multi-server problem. And always fail open — your rate limiter should protect your system, not become another point of failure.

More detailed notes with code examples, ASCII diagrams, and algorithm comparisons:

https://github.com/sadensmol/learning_system-design/blob/main/rate-limiting-guide.md

Thanks for reading! More system design topics coming in the next parts of the series.

PS: what's your go-to rate limiting setup? I'd love to hear what algorithms and tools you use in production!
