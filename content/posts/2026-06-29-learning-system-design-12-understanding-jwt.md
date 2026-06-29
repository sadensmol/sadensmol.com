+++
title = 'Learning System Design #12: Understanding JWT'
slug = 'learning-system-design-12-understanding-jwt'
date = 2026-06-29
draft = false
description = 'JWT explained from first principles — what it actually solves, how signing and JWKS work, the revocation trap, and when you should NOT reach for one.'
tags = ['system-design', 'security', 'web', 'authentication']
+++

Part #12 of the "Learning System Design" series! This time it's JWT — three Base64 strings everybody copy-pastes from a tutorial and almost nobody can explain when something goes wrong. I've debugged enough "Hash invalid" and "token expired but it's not expired" incidents to think it's worth slowing down and looking at what's really going on.

![Understanding JWT](/images/posts/learning-system-design-12-understanding-jwt-hero.jpg)

The mental model I keep coming back to is a stamped passport. It's self-contained, it carries claims about you, any border agent can verify it without phoning the country that issued it — and it expires. That's a JWT.

## The problem in one sentence

> Service A authenticated the user. Now request after request hits services B, C and D. How do they trust that *this* request is still that same authenticated user — **without calling back to a central session store every single time**?

That's the whole motivation. Everything else is detail.

## The old way, and where it creaks

The classic answer is the **opaque session**:

```text
1. User logs in.
2. Server generates a random session ID, stores {sid -> userID, roles, expiry} in Redis/DB.
3. Sends the opaque sid back as a cookie.
4. Every later request: look up sid in the store to learn who the user is.
```

This works great and has one *enormous* superpower we'll come back to: **you can delete the row to revoke a session instantly.**

Where it creaks is scale. Every request needs a store lookup. With a dozen stateless services behind a gateway, that's a hot dependency on one central store, and service D in another region has to reach it too. Statelessness is the goal; a per-request central lookup is the exact opposite.

JWT makes a trade: **move the identity into the token itself**, sign it so nobody can forge it, and let each service verify it locally with zero network calls. You trade *easy revocation* for *no lookup*. Remember that sentence — it's the whole article.

## Anatomy of a JWT

A JWT is three Base64URL parts joined by dots: `header.payload.signature`.

![A JWT is header.payload.signature, with the signature computed over the first two parts](/images/posts/learning-system-design-12-understanding-jwt-anatomy.png)

The header says how it's signed (`alg`, plus a `kid` key id). The payload carries the **claims**. The signature covers the header *and* the payload — change a single byte of either and it stops verifying. That's the entire integrity guarantee.

Here's the part people miss: **Base64URL is encoding, not encryption.** Anyone holding the token can decode and read the payload. A signed JWT protects against *tampering*, not against *reading*. So never put passwords, secrets, or full PII in there — treat the payload as public.

```json
{
  "iss": "https://auth.acme.com",
  "sub": "user_8f3a1c",
  "aud": "https://api.acme.com",
  "exp": 1735689600,
  "roles": ["editor"]
}
```

## The claims that actually carry weight

The three-letter registered claims are the load-bearing ones:

| Claim | Meaning | Why it matters |
|-------|---------|----------------|
| `iss` | Issuer | Came from the identity provider you trust |
| `sub` | Subject | *Who* the token is about |
| `aud` | Audience | *Who* the token is for — reject tokens minted for another service |
| `exp` | Expiry | Hard stop; your #1 defense against a stolen token |

`aud` and `iss` are how you pin a token to one service. A JWT is a **bearer credential** — whoever holds it can use it — so a token your auth server minted for the *payments* API must be dead on arrival at the *admin* API. Each service is configured with its own identifier and rejects any token whose `aud` isn't itself.

Skip that check and you get the classic **confused-deputy bug**: a token the user holds for a low-privilege service gets replayed against a high-privilege one, and the second service happily honors a credential it was never meant to receive. Always validate `iss` and `aud`.

## Signing — symmetric vs asymmetric

Two families, and picking the wrong one is a real footgun.

| Family | Examples | Key model | Use when |
|--------|----------|-----------|----------|
| **HMAC** | HS256 | One shared secret signs *and* verifies | Single trust domain — you issue and you verify |
| **RSA / ECDSA** | RS256, ES256 | Private key signs, public key verifies | Many independent verifiers / external IdP |

The rule of thumb: **the moment more than one party verifies tokens — real microservices, or an external provider like Keycloak/Auth0 — use asymmetric (RS256/ES256).** Then verifiers only ever hold the *public* key. With HS256 every verifier holds the secret, which means every verifier can also *mint* tokens. One leaked service and an attacker can forge anything.

But asymmetric only works if every verifier has the issuer's public key — and keys rotate. That's what **JWKS** solves: the issuer publishes its public keys at a well-known URL, the verifier fetches and caches them, reads the `kid` from the token header, picks the matching key, and verifies locally. No per-request call to the issuer. Key rotation becomes painless — publish the new key alongside the old one and verifiers transparently pick the right one.

In practice the code you write is the "verify, don't issue" side:

```go
import (
    "github.com/golang-jwt/jwt/v5"
    "github.com/MicahParks/keyfunc/v3"
)

// fetch + auto-refresh the issuer's public keys at startup
jwks, _ := keyfunc.NewDefault([]string{
    "https://auth.acme.com/.well-known/jwks.json",
})

func verify(raw string) (jwt.MapClaims, error) {
    token, err := jwt.Parse(raw, jwks.Keyfunc,
        jwt.WithIssuer("https://auth.acme.com"),   // who minted it
        jwt.WithAudience("https://api.acme.com"),  // for THIS service
        jwt.WithValidMethods([]string{"RS256"}),   // PIN the algorithm
        jwt.WithExpirationRequired(),
    )
    if err != nil || !token.Valid {
        return nil, err
    }
    return token.Claims.(jwt.MapClaims), nil
}
```

That `WithValidMethods` line matters more than it looks — pinning the algorithm is what closes the `alg` attacks below.

## The footguns that actually bite

| Footgun | What goes wrong | Fix |
|---------|-----------------|-----|
| `alg: none` | Some libs once accepted an unsigned token if the header said so. Instant forgery. | Reject `none`, pin allowed algorithms |
| `alg` confusion (RS→HS) | Attacker flips `RS256` to `HS256` and signs with your *public* key as the HMAC secret | Pin the algorithm; never let the token choose |
| No `exp` / huge `exp` | A stolen token works forever | Short-lived access tokens, require `exp` |
| Decode without verify | Code that reads claims without checking the signature trusts forged data | Always verify the signature *first* |
| Token in `localStorage` | Any XSS can read and exfiltrate it | Prefer `HttpOnly` + `Secure` + `SameSite` cookies |

None of these are exotic. They're the ones I've actually seen in code review.

## The big one — revocation

This is the question every interviewer loves, and the reason JWT isn't a free lunch.

> A signed JWT is valid until it **expires**. There's no central record to delete. So how do you log someone out *right now*, or kill a token after a password change?

Natively, you can't. That's the cost of statelessness. The standard answer is to split the token in two:

![Access tokens verify locally; the refresh token is checked against a store and is the revocable choke point](/images/posts/learning-system-design-12-understanding-jwt-refresh.png)

- **Access token** — short-lived (≈5–15 min), attached to every request, verified statelessly. Because it dies fast, a stolen one is only useful for minutes.
- **Refresh token** — long-lived (days/weeks), sent *only* to the auth server's `/refresh` endpoint, and checked **against a store on every use**. This is the one spot you deliberately reintroduce state — so it's revocable.

To log someone out everywhere, you delete their refresh tokens. Existing access tokens still die on their own within minutes. If you need *instant* invalidation, add a small `jti` denylist or a per-user `tokenVersion` claim — both reintroduce a lookup, but against a tiny, short-lived set instead of the full session store.

## When you should NOT reach for JWT

Honestly, this is the most useful section. JWT is a trade, not an upgrade.

![Decision: single app → opaque sessions; many verifiers without instant-revocation needs → stateless JWT](/images/posts/learning-system-design-12-understanding-jwt-decision.png)

If you have a **single backend** and you need **instant, fine-grained revocation** (banking "kill this session NOW", admin force-logout), opaque server sessions in Redis are simpler, safer, and revocable for free. Don't add JWT to a Rails/Django monolith because it's fashionable — you'd be paying the revocation tax for a benefit you don't use.

JWT earns its keep the moment **independent parties must verify identity without calling back to a central store**: microservices, public/partner APIs, mobile + SPA clients, "Login with Google" (the OIDC ID token *is* a JWT).

## You usually verify, you don't issue

Here's the part most tutorials skip. **In production you rarely sign JWTs yourself.** Issuing them correctly means owning password hashing, 2FA, refresh rotation, key rotation, breach detection, SAML/SCIM, compliance — each its own multi-week subsystem with nasty footguns (forget to rotate a signing key and a leaked key signs valid tokens forever).

The classic trap is *"it's just username + password + JWT, right?"* — you ship v1 in a weekend, then spend two years bolting on password reset, email verification, refresh tokens, TOTP, SSO, SCIM, and SOC 2.

For ~95% of teams: don't issue tokens, integrate a platform — Keycloak or Ory if you self-host (Ory is Go-based, nice for Go shops), Auth0/Clerk/WorkOS if you buy. Either way your services still just *verify* via JWKS. Build your own only at hyperscale where SaaS pricing breaks, or with a hard requirement to keep all PII in your own infra.

## Summary

- A JWT is `header.payload.signature`, Base64URL-encoded — **signed, not encrypted.** Treat the payload as public.
- It exists to make auth **stateless**: verify locally, skip the central lookup.
- `iss` + `aud` bind a token to a specific issuer and a specific service, so it can't be replayed where it doesn't belong.
- That same statelessness makes **revocation hard** — solve it with short-lived access tokens + a revocable refresh token (and/or a `jti` denylist).
- Use **asymmetric** signing (RS256/ES256) + **JWKS** the moment more than one party verifies.
- Pin the algorithm, require `exp`, validate `iss`/`aud`, and never trust claims before checking the signature.
- Single app that needs instant logout? **Plain server sessions are often the right call.**

More detailed notes — every claim, all the algorithms, JWKS, OAuth/OIDC flows, and a system-design interview cheat sheet:

https://github.com/sadensmol/learning_system-design/blob/main/jwt-guide.md

Thanks for reading! More system design topics coming in the next parts of the series.

PS: what's your revocation strategy in production — short-lived access + refresh, a `jti` denylist, or did you just go back to opaque sessions? I'd love to hear what worked for you.
