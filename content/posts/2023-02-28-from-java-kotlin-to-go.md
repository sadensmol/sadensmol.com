+++
title = 'From Java/Kotlin to Go(Golang)'
slug = 'from-java-kotlin-to-go'
date = 2023-02-28
draft = false
description = 'My experience moving from JVM to Go — comparing languages, ecosystems, and development approaches after 10 years in Java/Kotlin world.'
tags = ['go', 'java', 'kotlin']
medium_url = 'https://medium.com/@sadensmol/from-java-kotlin-to-go-golang-ab9a8f370ea4'
+++

![From Java/Kotlin to Go](/images/posts/from-java-kotlin-to-go.jpeg)

## About myself

I started as a Java developer about 10 years ago with Java 5. It was time when most enterprises were built on Java EE and running on Jboss. EJB, XLS, Struts, Hibernate, Eclipse and similar technologies were using at that time. Applications were heavy, too resource hungry and used dedicated servers. At that time I was mostly developing CLI tools, then switched to Spring and video processing (Red5, Wowza) where Flash was mostly used for web and client side applications.

Then enterprises started moving away from heavy application servers to Spring framework, better tools and shorter development cycles.

During past 10 years many things have changed — we moved from mono repos and monoliths to microsevices, Spring Boot was introduced, Intellij IDEA became the leading IDE in Java world. We moved away from heavy hibernate to Jooq, from application event buses to Kafka and RabbitMQ, from dedicated servers to clouds.

Things are changing in JVM world but the basic is staying the same — OOP, GoF patterns, SOLID, CAP, maven/gradle, and related to it project and system architectures (mainly based on Spring Boot).

And now we have Kotlin as a next step in JVM apps development which supports almost fully current tools/dev approaches and huge JVM ecosystem.

I switched to Kotlin 4 years ago and could say it was my best experience in JVM world, it is just so pleasant to work with!

## Why Go(Golang)?

I'm just bored with JVM, Spring and all related stuff. It becomes too trivial and repetitive.

Same Spring project architecture everywhere — 3 tier application with controller, service, and repository. Heavy Intellij IDE which is the only main choice to work with Kotlin — too slow, eats up too much memory.

Applications are too slow in development — it takes forever to build the project, spin up spring, test containers and start a single integration test. It requires lots of parameters to properly configure your application in production. They are very resource hungry — base image of single microservice is 100–200 Mbs in size, eats up to 0.5 Gb or memory without doing anything, and starts in 10 seconds!

Why companies are still using java if there are different better alternatives? My answer is simple — there are tons of Java developers, there are lots of projects already tighten up with JVM ecosystem. And of course — clouds and providers promote JVM always and always — because this how they earn money selling huge infrastructure for simple projects/services.

So during past 2 years I was looking around and found that companies started moving some of their services to Go and check how it's going and actually they did it pretty well, and provided positive feedbacks. Uber, Netflix, Ethereum, Mastodon, almost all new startups are going with Go from the beginning.

So I decided to give it a try with having a few attempts in Go world mostly related to writing some cli tools, http traffic routers and a worked on a few side projects in VoD area (mostly using Go as a wrapper over different C libraries), video processing area (OpenAV, ffmpeg) and some startups related to gaming industry. And now I decided to move completely to Go.

This article will summarise my past 3 months of deeply learning Go on a real project for a real company.

## Go is simple and fast!

The authors decided to make language simple. It's mainly based on ANSI-C paradigms but shares many things with Java like: static typing, interfaces, both are compiled languages, have type inference, Garbage Collector — you don't need to manage memory manually, as well as concurrency out of the box.

Along with it Go doesn't share or apply on multiple heavy things from Java which makes it simpler and faster — like no Virtual Machine, no objects, no inheritance, dependency management is simple and very powerful, no exceptions, and it has pointers, and interfaces are working in a slight different way than in Java.

Go has really powerful internal library, and wide variety of different community driven libraries for all kind of tasks including CLI tools, http web servers/routers, db drivers and even desktop and game frameworks!

There are no tons of external jars you need to use in JVM world, you don't need to pack a fat .jar if you want to have a single executable but build process generates you a native application.

When you work with external libraries — you don't need .jar decomplier to take a look into library source code, but rather you include the library source code directly into your application and you can always open it and read how it was originally written by the author.

Go is FAST. It has incredible fast compiler, and since it's a native application once built it works really fast! Comparing to Java it works about 10% faster with lower CPU and memory usage in general applications, but it's up to 50–70% faster is we compare requests per second for http requests/latency and it requires less resources within the same load comparing to Java.

- https://www.youtube.com/watch?v=8CiErLxdaA8
- https://medium.com/@shyamsundarb/c-vs-rust-vs-go-a-performance-benchmarking-in-kubernetes-c303b67b84b5

I won't talk about generics here, since many ppl think they are not much related to simplicity of the language but rather make it a bit heavier.

## Go(Golang) good sides

### Go is very idiomatic

There is already out-of-the box answer on how to structure your application, how to write your code — you don't need to try tons of different ways of solve the same problem — just follow guidelines google and community created for you!

- https://go.dev/doc/effective_go
- https://github.com/golovers/effective-go

This is not an official project layout but I like it a lot:

- https://github.com/golang-standards/project-layout

it includes such idioms like : explicit error handling, ok idiom

### No custom IDE

When you work with Go you don't need to install proprietary IDE like in case of Kotlin — you can work with VS code, vim and even with SublimeText. Choose tools you like more!

### Build system, dependency management

No gradle/maven — choose any tool you want to manage your build process.

People are mostly used well known Makefile also some other interesting tools like task.dev.

Dependency management tool inbuilt into the language — go mod. Very powerful and simple CLI to manage your module dependency.

### Internal formatter/linter

Google provides you with default code formatters and linters — but you're free to choose side linters as well!

### Functions can return multiple values!

In Kotlin we have Pair which represents a pair of two values which we could return from the function, we also have arrow.kt which if functional framework in Kotlin where we have something like Either to return 2 values.

But in Go we could return as many values as we want! All values should be consumed, or explicitly ignored, otherwise it will give you a compilation error:

```go
func fullName() (string, string, string) {
	return "John", "V", "Doe"
}
```

### No exceptions!

Java has 2 exception types including checked exceptions — these which you need explicitly declare and handle, Kotlin goes a bit further in that — it has only runtime exceptions which you could forgot to properly handle. But anyway working with exception makes you split your logic flow into 2 parts — business logic and exception logic which makes code harder to write and read. link: https://medium.com/@sadensmol/exception-based-flow-control-in-spring-boot-application-e5793057a5c9

Even in Kotlin ppl are mostly moving away from exceptions to functional error handling with help of some frameworks like arrow.kt. But even arrow.kt doesn't guarantee that you properly handle errors - you can just forgot about it.

In Go you should explicitly handle every error which is generated in your function or method. Otherwise it will give you a compile error.

Yes it brings some boilerplate on board, but after some time you start thinking in this paradigm and it gets accepted by your mind.

Go provides you with internal error interface you can use to handle errors and generate your own custom errors.

### No objects and inheritance

I tried to remember how many times I used inheritance in Java/Kotlin. But cannot remember lots of such facts. So it seems OOP principles in Java aren't much useful in standard backend applications. Can you remember well known phrase from Uncle Bob Martin: "Prefer composition over inheritance".

This is how Go works — there are no objects, but rather types. Most commonly used types are structs. And you can compose structs in any way you like. This make code less coupled and easier to maintain/support (SOLID).

This is how you can simple compose 2 structs (every could have own method which will be "inherited" as well)

```go
type Swimmer struct {
	style string
}
type Runner struct {
	style string
}
type Hippo struct {
	Swimmer
	Runner
}
```

### Duck typing for interfaces

In Java world you describe the interface and then explicitly declares that some class implements this interface. In Go you just declare the interface and all structs with the same methods are implementing this interface implicitly. This allows you to do some interesting things — like describing interfaces on the consumer side. Which is quite idiomatic in Go!

### Methods and functions can't be overloaded

This is the common interview question for Middle Java role, and this is an always a problem for me when interviewer asks about some corner cases — like checked exceptions for overloaded functions etc. But from my practice I didn't remember that I used function overloading too much in java (since it seems like a code architecture problem more than some good using feature).

In Kotlin it's much simpler — since you have named function arguments and you can use just a single function with different list of parameters.

But in Go — they just aren't exist! Simple! And I quite like it!

### Access modifiers

Only 2 — public and package private vs 4 in Java. Simple and actually this solves all the problems developer could face during development of external library or internal application.

This brings some problems at first like declaring constants/enums. In Go they are not upper case, but just like normal variables/constants.

### Slices aren't arrays but rather something similar to ArrayList

This is how slice is declared in Go:

```go
a3 := []string{"a", "b", "c"}
```

It's actually a dynamic array with some backing structure similar to ArrayList in java — it contains length and capacity and has ability to dynamically resize. But they are too simple!

There are some problems developers could face related to slices in Go — since under the hood they are implemented with arrays and pointers, and there are 2 different ways of passing slices to the methods. But this is maybe good to explain in another article.

### Concurrency

Goroutines feels at first look like coroutines in Kotlin, but they are much simpler in understanding and using.

Go channels is a counterpart for Kotlin's channels but they works simpler and more understandable as well

### Great integration with existing C/C++ libraries

It's easy in Go to write C/C++ library wrapper, and integrate into your application! And there are already lots of wrappers for some well known C libraries.

## Go(Golang) bad sides

I will notice just a few here, but there are a lot more!

### Some internal stuff of Go isn't much idiomatic

Gophers are complaining about some core language implementation details which are developed in not much idiomatic way. There are list of some proposals for Go 2.0 which possible might be with a breaking changes but will clean up some internal things.

### Problems with immutability and functional programming style

There is almost no way to work with immutable data structures in Go — since it has pointers.

An assignment to a variable can be constant, but the value itself can still mutate.

It still feels terrible to me that you can create a function that receives a pointer to your variable and change it, and it's a good and idiomatic way to do such things in Go.

There are actually some ways to implement semi-immutable types in go with external wrappers but they are limited because of package private default visibility.

### No normal Enums

Lack of enums like we have in Java world.

### Shadowing

Shadowing it's when you can override existing variable or constant or even language elements and this could broke all your application and even external libraries.

### Namespace pollution

All package private method are visible within the package. So if you have lots of code within the package it might become a problem to choose some good function names or constants.

### No named function parameters

I love this in Kotlin, but unfortunately the only way to make it working in Go — we need to pass some structure to a method — in this case we could use default values, and named structure parameters.

### Not reach collections library

Collections in Java are just awesome, and even better in Kotlin. Stream/flow APIs are too great to use in every project.

But in Go — we don't have them in the language. You can use external libraries for that for sure, but it feels so unnatural. There are some parts of code for sorting and filtering in Go standard library but there is no seamless integration into the language. Simplicity?

## Conclusion

It was a few months of very unusual experience for me by learning Go very deeply! Since my past is mostly JVM world enterprises and this was my first deep try in Go ecosystem which felt at first as a huge step back from solid system architecture, GoF design patterns, clean documentation (which means a lot even in startups) and different testing and deployment approaches.

But as a result I started seeing Go as a good opportunity to rethink my approach in developing things — going on a bit lower level of creating applications — thinking not just in business paradigms but also thinking about code structure and architecture, communication between different parts of applications and code, apply code generation.

Go is a simple language but writing simple code is very hard!

But I'm happy that

- I use vscode now and CLI
- Language I'm using now is simpler and more understandable, and idiomatic
- I can write simple CLI tool, or backend app in just a matter of hours and deploy it into some low price cloud VM
- I can develop more in debug mode — it's quick and simple!
- It's now more clear how some things are working, and I care more about the code and architecture

The only downside for me right now — there are not much companies who hire engineers who decided to change the stack from JVM to Go. Either they require 3+ years of proven experience in Go, or it's just some project where ppl rewrite Go into Java/Kotlin, since cannot understand it, and as we know there are lots of Java devs on the market and companies who are ready to spend money on huge infrastructures and lots of low productive Java devs :)

## Resources

Go Go Java Developer by Piotr Przybyl:

https://www.youtube.com/watch?v=Od1rNJa40bk&t=800s
