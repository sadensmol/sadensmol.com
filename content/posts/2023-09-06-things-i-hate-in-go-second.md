+++
title = 'Things I Hate in Go. Second.'
slug = 'things-i-hate-in-go-second'
date = 2023-09-06
draft = false
description = 'Exploring the surprising behaviour of defer in Go — how it evaluates parameters eagerly despite delaying the function call, and how it differs from closures.'
tags = ['go', 'golang', 'closures']
medium_url = 'https://medium.com/@sadensmol/things-i-hate-in-go-second-46d3655747fa'
+++

"Each time a defer statement executes, the function value and parameters to the call are evaluated as usual and saved anew but the actual function is not invoked" - Go specification.

![Things I hate in Go](/images/posts/things-i-hate-in-go-hero.png)

What does it mean? Let's check how do we use defer.

One point to note here is that we use a function invocation here but the actual call is delayed until defer is get to its turn.

```go
i := 0

defer fmt.Println(i) // we introduce the function, but its call is deferred

for ; i < 4; i++ {}
// output: 0
```

How could we explain it? According to the specification i was evaluated at the same time when defer first appeared in our program, but the actual call was done when the surrounding block is finished.

But what we could expect here as a developer who thinks logically about this code?

Since defer is executed at the end of surrounding block, which has i=4 at that time, we expect 4 here!

Let's rewrite this code with closure. defer is just a closure in Go but ...

```go
i := 0

d := func() { // we introduce a function first
	fmt.Println(i)
}

for ; i < 4; i++ {}

d() // we call the function
// output: 4
```

In short it should work the same way as in a previous example — we created a closure, and delayed it's call to the end of the block execution. But the result is different!

## Conclusion

RTFM! Sometimes Go has weird behaviours and uses the same concepts in a different ways for different things, maybe to make if compiling faster — so don't trust your general assumptions.

In this case despite you add a call for a function with defer it's not actually called, but its parameters are evaluated. You might think calling is just a syntactical sugar here but it's partially true! I don't know how to explain it, help me in comments! :)
