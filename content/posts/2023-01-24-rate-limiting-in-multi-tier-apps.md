+++
title = 'Rate Limiting in Multi-Tier Apps'
date = 2023-01-24
draft = false
description = 'Exploring different approaches to rate limiting unsecured API endpoints in a multi-tier web application with React.js, Next.js BFF, and Go backend.'
tags = ['go', 'microservices', 'rate-limiting']
medium_url = 'https://medium.com/@sadensmol/rate-limiting-in-multi-tier-apps-ad3292143731'
+++

One day we found that we need to rate limit some of our not secured API endpoints. Mostly they are related to the functionality like password reset or sending feedback/contact me forms. In this application we don't use authentification for these endpoints and they are actually publicly exposed.

Here is a structure of our web application.

![Web application architecture](/images/posts/rate-limiting-architecture.png)

We have a Front-End (FE), Back End for Front End (BFF) and Back End. FE is a react.js application, BFF is next.js based and our BE are written in Go.

When user fill a form on FE we send a request to BFF which acts as a gateway/proxy in this case, and then request passes to BE where the target API is located.

There are a few places where we could place the rate limiter and a few ways to implement it.

**1** Captcha on FE. User is asked to fill the captcha every time he tries to use these publicly available endpoints. This looks quite weird from UX point of view — have you ever seen apps which ask you to enter captcha to reset your password? Also this solution won't help in case of automated abusing your endpoints with direct requests to your BFF API.

**2** Rate limiter for specific endpoints directly on BFF. There are some ready to use solutions like:

- https://www.npmjs.com/package/express-rate-limit
- https://www.npmjs.com/package/express-slow-down

The main pros of using rate limiting at this stage — use it as earlier as possible on the request's route (fail-fast approach). This will save your backend infrastructure of abusing on these endpoints in case of massive automated requests. If you're planning to use multiple gateways to your BE (other BFFs) then it a good solution as well, since you can manage rate limiting better — give more throttle for some of your client. The main problem here — this logic will be tightly coupled into your business logic.

**3** We could also use some additional proxies between BFF and BE to apply rate limiting. This will be well decoupled from codebase means easier to manage and change, but this will make our infrastructure a bit messier as well — 2 proxies between FE and BE, isn't it too much?

In case of k8s deployment this might be easily achieved by installing sidecar to the target BE pod with some well known proxy like nginx or envoy. If you are using service mesh like IstIo this is available out of the box.

**4** Another solution here — we could place rate limiting functionality into our BE Go application, by using some middleware or implement some custom solution.

If you're using microservice architecture and limiting your serviceA in point 3 or 4 then all other services which are using serviceA internally will suffer from this limitation as well. If you're using 2 position, then you're limiting only external requests to your BE.

So we decided that the best solution here — insert rate limiting directly to BFF.
