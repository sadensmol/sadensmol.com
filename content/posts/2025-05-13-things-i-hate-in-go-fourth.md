+++
title = 'Things I Hate in Go. Fourth.'
slug = 'things-i-hate-in-go-fourth'
date = 2025-05-13
draft = false
description = 'Go and immutability — why it barely exists, why it matters in fintech and critical systems, and how it compares to Java and Rust.'
tags = ['go', 'immutability', 'java']
medium_url = 'https://medium.com/@sadensmol/things-i-hate-in-go-fourth-c19eece0e65f'
+++

![Things I hate in Go. Fourth.](/images/posts/things-i-hate-in-go-fourth.png)

"Simplicity, efficiency, and reliability" — the main principles in Go.

Today we are going to talk about immutability — which is hardly linked to Go's "efficiency" and "simplicity" principles.

## Immutability is not a thing in Go!

Since you have pointer methods and ability to work with pointers, you can change actually everything! Moreover it's highly encouraged by programmers to return pointers to large structures and pass them by pointers, which leads to lack of immutability.

## Why is it a problem?

Even if you create a config for the application — simple as it is, and you pass it by pointer, anybody could change it, and make your settings different, which could lead to something dangerous or ever catastrophic (like pointing your service to some harmful location). I'm not even telling about your financial transactions and data processing.

When you're working in some critical areas, such as fintech (finances/transactions etc…), medicine, space or even using or creating some external libraries you should understand that if you can't rely on data if it's mutable, and also you should process everything only in immutable way.

Is it good or bad?
Could we use Go in fintech area?
How hard is to write fully safe applications in Go?

Let's try to figure it out!

## What elements are immutable by default

In many programming languages base types are immutable by default — when you perform some operations on them then new variable is always created!

But in Go we have only strings which are fully immutable, also channels could be used to pass data safely, even mutable data, after being passing through the channel become copies, so cannot even get a reference of original data on the receiver's side.

If we are talking about collections — well, we don't have immutable collections in Go's standard library.

## Objects immutability

From my past Java experience there were only a few rules how to make object fully immutable:

1. Make object final (prevents value to change the reference)
2. All internal fields make private final (init via constructor) and provide getters only for all properties
3. If constructors receive any external objects we need to use copy (deep copy for collections) and unmodifiable collections to store passed information
4. When exposing methods which modify the state of the class, always return a copy instead of the actual object reference

but how it's possible in Go?

1. we cannot use `const` keyword for objects in Go! (this const is quite weird language element!)
2. private fields are package level thing, so we can not guarantee that it works within a package. so anybody in the same package could access all internals of your object!
3. this is a valid point to make an internal copy of passed information, at least when somebody changes this data, this won't affect original information.
4. this is also a good point, but it works only outside of the package.

## Summary

When I started learning Go 3–4 years ago, it was my first question in related forums "Guys, how does Go support immutability?", many ppl answered "Just make a wrapper over the type/object". This means throw away all that "Simplicity, efficiency" and, probably "reliability" and write new Java/Rust in Go if you need it.

So back to the question "Could I use Go in Fintech", I could probably answer, yes but … you need to write all new language in Go to have it working right, so maybe better to look back to Java or run forward to Rust!

Thanks for reading!

PS: let me know your thoughts on this, or if you want me to elaborate more on this aspect of programming in Go — with examples and more!
