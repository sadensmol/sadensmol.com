+++
title = 'Learning System Design #2: Secure Game Launch for 3rd Party Integrations'
slug = 'learning-system-design-2-secure-game-launch-for-3rd-party-integrations'
date = 2026-02-19
draft = false
description = 'How to design a secure game launch flow when your game is opened via 3rd party aggregators — session tokens, attack vectors, and practical trade-offs.'
tags = ['system-design', 'security', 'web', 'gaming']
+++

Second article in the "Learning System Design" series! This time we're tackling something very specific — how to securely launch a game when it's integrated with 3rd party operators and aggregators.

If you've ever worked in iGaming or any B2B game provider setup, you know the drill — your game doesn't live on your own website. It gets launched inside someone else's platform, via redirect or iframe. And you need to make sure that the session is secure, can't be hijacked, and works correctly even when things go wrong.

## The Setup

Here's the situation. An operator (casino, gaming platform, whatever) wants to offer your game to their players. The flow looks like this:

1. Operator calls your backend via B2B API to authenticate a player
2. Your backend creates a **game session ID** (gsID) and returns a **launchURL** containing it
3. Player opens the game via that URL — either as a redirect or in an iframe

The gsID **must** be in the URL. It's also visible to the player and serves as a support ticket reference. Every B2B call generates a fresh gsID with a 4-hour TTL.

So the main question — how do you make this secure?

## The Core Problem

The gsID is right there in the URL bar. The player can see it. The aggregator knows it. Anyone looking over the player's shoulder can read it. If gsID alone was enough to play the game or make API calls — you'd have a serious problem.

**gsID must be a public identifier, not a credential.** Think of it like a username — visible, shareable, but useless without a password.

```
gsID = public identifier (like a username)
session token = credential (like a password)
```

All API calls require a **session token**. gsID alone is never sufficient.

## The Session Token Flow

When the game page loads, the frontend calls `/session/init` with the gsID. Backend validates it and issues a **session token** — the actual secret credential for all subsequent API calls.

```
Player opens launchURL (gsID in URL)
  → Frontend calls POST /session/init { gsID }
  → Backend validates gsID, creates session token
  → Returns { sessionToken, gsID }
  → gsID displayed in UI for support reference
  → sessionToken stored in JS memory only
  → All API calls use sessionToken
```

Why JS memory and not cookies or localStorage?

- **Cleared when tab closes** — natural session cleanup, no stale tokens hanging around
- **Not sent automatically** — prevents CSRF attacks because the browser doesn't attach it to cross-origin requests
- **Not accessible to other tabs** — limits the blast radius if XSS happens

## One Session Per gsID. Ever.

This is the critical rule. Once a session is created for a gsID, that gsID is **locked**. Any subsequent `/session/init` with the same gsID gets a `409 SESSION_ALREADY_EXISTS`.

No replacement. No kick-wars. No race conditions (well, almost — more on that later).

```
Tab 1 → POST /session/init { gsID } → 200 OK, sessionToken S1
Tab 2 → POST /session/init { gsID } → 409 SESSION_ALREADY_EXISTS
```

If the player's tab crashes? They go back to the operator, get a new B2B call, new gsID, new session. Clean slate. The old gsID and session expire naturally at the 4-hour TTL.

## What About Attacks?

Let's go through the real attack vectors. This is the part that matters most when you're presenting this design to your security team.

### gsID Theft — Safe

Someone sees the gsID? Doesn't matter. They can't make API calls with it (requires session token). They can't call `/session/init` because the session already exists (409). The only dangerous window is between the B2B call and the player opening the game — typically seconds. High-entropy gsID (UUIDv4) makes guessing infeasible.

### XSS — Dangerous

This is the big one. If an attacker injects malicious JavaScript into your game page, they can read the session token from JS memory and exfiltrate it. Game over.

**Mitigations:** strict CSP policy, input sanitization, never rendering untrusted data as HTML, security audits. You can also bind session tokens to IP/User-Agent as an extra layer — limits stolen token usability from other devices.

### CSRF — Safe

Since the session token lives in JS memory (not cookies), the browser never auto-attaches it to cross-origin requests. A malicious page can't trick the browser into making authenticated requests to your backend.

### MITM — Depends on HTTPS

Without HTTPS, session tokens are visible in plaintext. With HTTPS — fully encrypted. This one is straightforward. Enforce HTTPS, use HSTS headers, done.

### Replay Attacks — Needs Extra Work

An attacker captures a valid request and re-sends it. Without protection, this works. You need **idempotency keys** (unique request IDs, backend rejects duplicates) or **sequence numbers** (backend tracks action order per session).

### Clickjacking — Needs Headers

Someone embeds your game in a hidden iframe on a malicious page. The player thinks they're clicking on something else but actually triggering game actions. Fix with `X-Frame-Options` or CSP `frame-ancestors` directive — allowlist only the operator's domain.

### Race Condition on `/session/init` — Needs Atomicity

Two requests with the same gsID hit `/session/init` at the exact same time. Without atomic session creation, both could succeed. Use a database-level uniqueness constraint or distributed lock — only the first write wins, second gets 409.

## The Scorecard

| Vector | Status | Fix needed? |
|--------|--------|------------|
| gsID theft | Safe | — |
| XSS | Vulnerable | CSP, input sanitization |
| CSRF | Safe | — |
| MITM | Vulnerable | Enforce HTTPS, HSTS |
| Replay | Vulnerable | Idempotency keys |
| Clickjacking | Vulnerable | X-Frame-Options |
| Referer leakage | Safe | — |
| Brute-force | Safe | — |
| Race condition | Vulnerable | Atomic session creation |

4 out of 9 vectors are safe by design. The remaining 5 need explicit mitigation — but that's normal. No architecture is safe by default against XSS or MITM. The important thing is that the **core design** (gsID as public ID + session token as credential) is sound.

## Summary

The key insight here is simple — **separate the public identifier from the authentication credential**. gsID is public, visible, shareable. Session token is secret, stored in JS memory, required for every API call.

Combined with one-session-per-gsID rule and proper attack mitigations (CSP, HTTPS, idempotency keys, atomic session creation), this gives you a solid foundation for secure game launching in B2B integrations.

More detailed notes with diagrams and all attack vectors analyzed in depth:

https://github.com/sadensmol/learning_system-design/blob/main/secure-game-launch-platform.md

Thanks for reading! More system design topics coming in the next parts of the series.

PS: if you've dealt with similar problems in your B2B integrations — I'd love to hear how you solved them!
