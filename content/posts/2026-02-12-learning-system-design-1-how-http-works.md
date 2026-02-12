+++
title = 'Learning System Design #1: How HTTP Works'
slug = 'learning-system-design-1-how-http-works'
date = 2026-02-12
draft = false
description = 'HTTP from the ground up — request-response model, methods, status codes, versions from 1.0 to 3, caching, cookies, CORS and the full request lifecycle.'
tags = ['http', 'system-design', 'networking']
+++

This is the first article in my "Learning System Design" series where I'm going through fundamental topics every backend engineer should know well. And what better place to start than HTTP!

We use it every day, but how often do we actually think about what's happening under the hood?

## Request-Response. Simple as it is.

HTTP is a **request-response** protocol. Client sends a request, server returns a response. Every interaction follows this pattern — no surprises here.

But what's important — HTTP is **stateless**. Server doesn't remember you between requests. Every request is independent. That's why we need cookies, tokens and sessions to maintain any kind of state. More on that later.

## Anatomy of HTTP Request

A request has four parts:

**1. Request line** — method, path, and HTTP version:

```
GET /api/users?page=2 HTTP/1.1
```

**2. Headers** — metadata about the request:

```
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOi...
```

**3. Body** (optional) — data you're sending, typically for POST/PUT/PATCH:

```json
{
  "name": "Alice",
  "email": "alice@example.com"
}
```

Response looks similar — status line, headers, and body. Nothing complicated.

## HTTP Methods

This is something every backend dev should know by heart:

- **GET** — read data. Idempotent, no body.
- **POST** — create something new. Not idempotent, has body.
- **PUT** — replace a resource entirely. Idempotent.
- **PATCH** — partial update. Not idempotent.
- **DELETE** — remove a resource. Idempotent.
- **HEAD** — same as GET but without response body. Useful for checking if resource exists.
- **OPTIONS** — describes communication options. You'll see this a lot with CORS preflight requests.

**Idempotent** means you can make the same request multiple times and get the same result. This matters a lot when you're designing retry logic in distributed systems!

## Status Codes That Actually Matter

There are lots of status codes but in practice you'll use maybe 15 of them regularly:

**2xx — all good:**
- `200` OK — standard success
- `201` Created — something was created (POST)
- `204` No Content — success, nothing to return (DELETE)

**3xx — go somewhere else:**
- `301` Moved Permanently
- `302` Found (temporary redirect)
- `304` Not Modified — your cached version is still good

**4xx — you messed up:**
- `400` Bad Request — malformed request
- `401` Unauthorized — who are you?
- `403` Forbidden — I know who you are, but you can't do this
- `404` Not Found
- `409` Conflict — request conflicts with current state
- `429` Too Many Requests — slow down! (rate limiting)

**5xx — server messed up:**
- `500` Internal Server Error — generic failure
- `502` Bad Gateway — upstream returned garbage
- `503` Service Unavailable — overloaded or maintenance
- `504` Gateway Timeout — upstream is too slow

The difference between `401` and `403` is a classic interview question by the way!

## What Happens Before HTTP — TCP and TLS

Before any HTTP data flows, we need a TCP connection. This is the famous three-way handshake — SYN, SYN-ACK, ACK. Only after that the HTTP request can be sent.

For HTTPS (and you should always use HTTPS!) there's an additional TLS handshake after TCP. This is where client and server negotiate encryption — exchange certificates, agree on cipher suite, establish encrypted channel.

So the full sequence is: **TCP handshake → TLS handshake → HTTP request**. That's at least 2-3 round trips before you even start exchanging data. This is why HTTP versions matter!

## HTTP Versions — the Evolution

### HTTP/1.0
One request per TCP connection. Connection closes after each response. Terrible for modern web pages with dozens of resources.

### HTTP/1.1
Big improvement! **Persistent connections** — we reuse the same TCP connection for multiple requests. Also introduced the `Host` header which enabled virtual hosting (multiple domains on one IP).

But there's a problem — **head-of-line blocking**. Second request waits for the first response to complete. If your `index.html` is slow, everything else waits.

### HTTP/2
Now we're talking! **Binary framing** instead of text, and most importantly — **multiplexing**. Multiple requests and responses can fly in parallel over a single TCP connection. Plus **header compression** (HPACK) which saves a lot of bandwidth on repetitive headers.

But there's still a catch — TCP underneath. A single packet loss stalls ALL streams because TCP guarantees ordered delivery.

### HTTP/3
The latest evolution. Runs over **QUIC** which is UDP-based instead of TCP. This eliminates TCP-level head-of-line blocking — if one stream loses a packet, other streams are not affected!

QUIC also combines transport and TLS handshake into one round trip. And it supports **connection migration** — your connection survives when you switch from Wi-Fi to cellular. Pretty cool for mobile!

## Caching — Don't Ask Twice

HTTP caching is one of the most powerful performance optimizations you can use. The idea is simple — don't fetch the same thing twice if it hasn't changed.

The key player here is `Cache-Control` header:

- `max-age=3600` — cache is valid for 1 hour
- `no-cache` — always check with server before using cache
- `no-store` — don't cache at all (sensitive data!)
- `private` — only browser can cache, not CDNs
- `public` — anyone can cache

For revalidation we use **ETags**. Server returns an `ETag` header with a version identifier. Next time client sends `If-None-Match` with that ETag. If content hasn't changed — server responds with `304 Not Modified` and no body. Saves bandwidth!

## Cookies — Because HTTP is Stateless

Since HTTP doesn't remember you, cookies solve this problem. Server sends `Set-Cookie` header, browser stores it and sends it back with every subsequent request.

Important cookie attributes you should know:

- **HttpOnly** — JavaScript can't access it (prevents XSS theft!)
- **Secure** — only sent over HTTPS
- **SameSite=Strict** — not sent with cross-site requests (CSRF protection)
- **Max-Age** — when the cookie expires

If you're building authentication — always use `HttpOnly` and `Secure` flags. This is security 101.

## CORS — The Thing That Breaks Your Frontend

CORS (Cross-Origin Resource Sharing) is probably the most annoying thing for frontend developers. Browser blocks requests from one origin to another by default. To allow it, server must respond with proper `Access-Control-Allow-Origin` headers.

For non-simple requests (PUT, DELETE, PATCH, or custom headers) browser sends a **preflight** OPTIONS request first. Server must respond with allowed methods and headers. Only then the actual request is sent.

If you ever see "CORS error" in your browser console — it's always a server-side configuration issue, not a client problem!

## The Full Picture

When you type a URL in browser, here's what happens:

1. **DNS resolution** — domain name → IP address
2. **TCP handshake** — establish connection
3. **TLS handshake** — negotiate encryption (if HTTPS)
4. **HTTP request** — send the actual request
5. **Server processing** — server does its thing
6. **HTTP response** — get the result back
7. **Parse and render** — browser processes HTML, discovers sub-resources (CSS, JS, images)
8. **Parallel requests** — fetch all sub-resources
9. **Page rendered**

Understanding this full lifecycle is crucial for performance optimization. Every step here is a potential bottleneck!

## Summary

HTTP is simple in concept but has lots of nuances that matter when you're building real systems. The key takeaways:

- It's stateless and request-response based — always remember this
- Know your methods and status codes — they exist for a reason
- HTTP/2 and HTTP/3 solve real performance problems — use them
- Caching with ETags can save you tons of bandwidth and server load
- Always use HTTPS, HttpOnly cookies, and proper CORS configuration

More detailed notes with diagrams and tables are in my learning repo:

https://github.com/sadensmol/learning_system-design/blob/main/http.md

Thanks for reading! This is just the beginning of the series — more system design topics coming soon.

PS: if you have suggestions on what topic to cover next — let me know!
