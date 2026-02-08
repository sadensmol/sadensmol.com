+++
title = 'Things I Hate in Go. Third.'
slug = 'things-i-hate-in-go-third'
date = 2023-09-23
draft = false
description = 'On the dogmatic "interfaces belong with the consumer" rule in Go — when it makes sense, when it does not, and why interviewers should think deeper about interface placement.'
tags = ['go', 'solid', 'interfaces']
medium_url = 'https://medium.com/@sadensmol/things-i-hate-in-go-third-ad26f2f82ddc'
+++

"Go interfaces generally belong in the package that uses values of the interface type, not the package that implements those values." — Go Code Review Comments.

![Things I hate in Go](/images/posts/things-i-hate-in-go-hero.png)

Why every time I take some interview or do the test task — reviewers ask me about this problem?

Where do you put interfaces?
No you failed our test, because you placed your interface along with your implementation. — https://github.com/sadensmol/test_faraway

I always reply to such questions or comments: "It depends" or "Please read the code more carefully to understand the idea behind it".

Why do these people follow some uncertain code review comments instead of just thinking about the problems on their own? It's even not a paradigm at all!

## When and why we place interfaces along with the implementation

Simple answer here — always when you use Interfaces in OOP, you put them along with your objects — in Go this is the way to work with inheritance and polymorphism.

Imagine we have a function which could accept polymorphic objects:

```go
package service

func Make(o ICar) {
	// make some stuff with this object
	// o.StartEngine()
	// o.Drive()
	// o.StopEngine()
}
```

And now you have a few different car types, e.g. Vehicle, Truck, and maybe some another class you can split in business logic TeslaCyberTruck.

For all these car types you need to ensure they conform to the interface, so you place this interface along with them and add strict type check directly into the objects:

```go
package domain

type ICar interface {
	StartEngine()
	Drive()
	StopEngine()
}

// you ask compiler to ensure that Vehicle conforms to the ICar interface
var _ ICar = &Vehicle{}

type Vehicle struct{
	// methods implementation
}
...
```

Here you need an interface in the place where your objects are implemented, since it's used for polymorphism.

Another simple answer here — when you share some API for other developers, and your library uses this API. You can see many well known interfaces in the Go standard lib — Stringer, error etc…

## When and why we place interfaces along with the code which uses it

This is when we follow SOLID and make our code more maintainable by using Dependency Inversion and decoupling parts of our application. This pattern is clearly described in every related Go book and article.

## Conclusion

Interviewers, please, start looking wider at this problem and don't blindly follow some uncertain "Go Code Review Comments"!
