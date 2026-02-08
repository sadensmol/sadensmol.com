+++
title = 'Go Gems: 1. Powerful Go Context in MSA'
slug = 'go-gems-1-powerful-go-context-in-msa'
date = 2024-10-05
draft = false
description = 'How Go context and gRPC work together to automatically propagate cancellation and timeouts across microservices in a synchronous communication chain.'
tags = ['go', 'golang', 'grpc']
medium_url = 'https://medium.com/@sadensmol/go-gems-1-powerful-go-context-in-msa-f209a09a7320'
+++

We all know Go's context package!

https://pkg.go.dev/context

It has very useful methods, and one of them — WithTimeout. It allows us create a Context which could be cancelled automatically in certain period of time.

## context.WithTimeout. Why is it useful?

Imagine you have an application with microservice-based architecture where you have a few microservices which communicate with each other:

![Synchronous communication pattern in MSA](/images/posts/go-gems-context-msa.png)

For example "Service 1" sends some request to "Service 2" which sequentially sends request to "Service 3". This chained requests pattern is called "Synchronous communication pattern in MSA".

The main question and problem here — how to properly implement timeout in such Synchronous chained requests?

As a "Service 1" I'd like to cancel request to "Service 2" after some time, but as well I like "Service 2" cancel all related requests to "Service 3".

The answer is simple — Go's context will do it for you!

But you can ask — "How come that different services/applications know that they need to cancel a request?". The main solution I always use in MSA — GRPC.

GRPC allows you to automatically propagate contexts across the whole call chain, multiple microservices and even database!

So you cancel context on "Service 1" and it will be automatically cancelled on "Service 2" and "Service 3" (all child contexts / sub contexts).

## Practice time.

I created a simple demo for this article.

https://github.com/sadensmol/article-go-gems-1

Let's just practice and test how it all works!

First, let's start our server:

```bash
make start-server
godotenv -f infrastructure/local/.env go run cmd/server/main.go
Starting gRPC server on port 5050...
```

now let's start client which will make a request via GRPC to the server, but also will cancel context in 3 seconds:

```bash
make start-client
go run cmd/client/main.go
calling Test ...
Failed to call Test: rpc error: code = DeadlineExceeded desc = context deadline exceeded
exit status 1
```

Client says "rpc err" — this is what returned to us GRPC call to our server. Means server cancelled context as well, when we cancelled it on client side!

What we see in server logs now?

```
received test request ...
requesting DB ...
context is done...
committing transaction ...
failed to commit transaction context canceled
rolling back transaction ...
```

We could describe it in the following way:

1. client cancelled context by timeout
2. server's context processed context cancellation (you see "context is done")
3. when we try to commit a DB transaction after that — you see an error — so context based transaction is also cancelled.
4. we safely roll back our transaction.

## Summary

GRPC and Context is a real gem while building MSA. It allows you to think about your business logic and make tools you're using help you with that.

Use Context with GRPC and get auto context cancellation for free across any kind of distributed systems!
