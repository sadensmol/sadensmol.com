+++
title = 'Things I Hate in Go. First.'
slug = 'things-i-hate-in-go-first'
date = 2023-07-06
draft = false
description = '"Accept an interface, return a struct" — exploring the testing pain points of this Go idiom through the lens of SOLID principles and dependency injection.'
tags = ['go', 'dependency-injection', 'solid']
medium_url = 'https://medium.com/@sadensmol/things-i-hate-in-go-first-fdbc1dd51948'
+++

"Accept an interface, return a struct" — well known Go idiom.

![Things I hate in Go](/images/posts/things-i-hate-in-go-hero.png)

Let's look more in deep into it. First, what comes on my mind when I think about this idiom is SOLID.

We are following Dependency Inversion principle here by injecting dependencies through the help of Go interfaces. Here we are using constructor injection:

```go
type UserService struct {
	r IUserRepository
}
type IUserRepository interface {
	GetByID(ID string) (*User, error)
}
func NewUserService(r IUserRepository) (*UserService, error) {...}
```

We could pass any user repository here and dynamically switch the service behaviour which provides us with all the benefits of DIP - loose coupling, modularity, testability etc…

If we decide to test this service we create IUserRepository mock, pass it in and do all needed assertions and control all expectations. Fine! Simple, and it works!

But what if we have something more complicated in in architecture we want to deeply test? For example we have some custom transaction manager which will handle begin,commit and rollback calls for us? So now we have something like 2 layers structure we need to test through:

```go
type Tx struct {}
type IDB interface {
	BeginTx() (*Tx, error)
}
type UserRepository struct {}
func NewUserRepository(db IDB) (*UserRepository, error) {...}
```

Here we have UserRepository which is depends on database abstraction IDB. Every time repository needs to execute code or part of the code in transaction it must call BeginTx method as receive the concrete type Tx - a transaction.

Now following the Single Responsibility principle we understand that transaction handling should be incapsulated into this Tx type - in short we get transaction and then could call Commit or Rollback methods of it.

```go
func (tx *Tx) Commit() error   {...}
func (tx *Tx) Rollback() error {...}
```

Let's try now to come up with some test which helps us to test proper transaction handling.

I want to test that Commit and Rollback methods are properly called within my repository. In real cases of course all transaction management is placed in service layer, since it's almost always related to application business logic.

So I created a go mock for our IDB interface. But what I see there?

BeginTx mock returns me a concrete implementation of our transaction type - Tx. Not an abstraction I could use to inject my another mock there as well.

Wait. I didn't face such problems before in Java or Kotlin I have big experience with — I always just return interface and mock it! Also it's quite well aligned with DI paradigm. But… It's Go now.

I figured out that there are 3 options here.

1. Move to interface in result value.
2. Use some mock sql driver (e.g. sqlmock), which already has expectations methods for tx management.
3. And this is my "favourite" one, suggestion I got from a senior Go dev - just test your transactions with integration tests! This almost killed me :)

To understand more about the problem you can take a look into internals of sql.DB and sql.Tx.

```go
type DB struct {}
type Tx struct {}
func (db *DB) BeginTx(ctx context.Context, opts *TxOptions) (*Tx, error) {...}
```

As you can see BeginTx method returns concrete type here, and this is a default db driver implementation from stdlib.

What do I think about it? It seems Go creators faced some problems related to returning interfaces from methods and functions and decided to just forbid this kind of development!

![Things I hate in Go - Part 1](/images/posts/things-i-hate-in-go-meme.png)

## Conclusion

Language idioms sometimes urges developers to do weird things. Sometimes these idioms just some excuses for the decisions made during the language development.

PS: Let me know if you're interesting in my basic implementation of transaction manager I could share the code.
