+++
title = 'Exception Based Flow Control in Spring Boot Application'
date = 2022-09-18
draft = false
description = 'Using exceptions as a flow control mechanism in Spring Boot microservices, treating them as domain objects that map to HTTP status responses.'
tags = ['java', 'kotlin', 'spring-boot', 'exception']
medium_url = 'https://medium.com/@sadensmol/exception-based-flow-control-in-spring-boot-application-e5793057a5c9'
+++

Here I'd like to describe the way I'm using while working on different Java/Kotlin/Spring Boot microservice based applications. The code for demo the idea is located here:

https://github.com/sadensmol/article_sb_exceptions

## Why exception based?

You ask "Why exception based?", and it's a good question! All modern languages have special structures to control the execution flow — the most known one is **`if statement`**

> ```
> if (expression is true) then
>   {execute block a}
> else
>   {execute block b}
> ```

Here we check the `expression` and decide what code to execute based on the evaluation result. But we mostly choose between 2 cases - **`positive case (forward evaluation)`** - when the expression suits our expectation and **`fallback case`** - when we should handle something unwanted or unexpected. Doesn't the second sound like **`exception`** case? It does!

In simple words — every **`if-then`** could be easily replaced with exceptions. Exception would cover the `failed branch` and all other code the **`main branch`**

Java and Kotlin are both support **`exceptions`** on a language level. And Spring supports exceptions very well!

## Exceptions in Spring Boot

Let's see some internal constructs in SB which are made based on the exceptions.

**@RestController, *ResponseStatusException*, *ControllerAdvice***

They are designed to allow Controllers work directly with exceptions — you can just throw an exception and SB will decide automatically how to handle it, based on additional configurations.

**Validators**

Automatic validations are working through the exceptions as well — you can use DTO validators and control the errors via @ControllerAdvice.

**@Repository**

Class which adds this annotation is automatically added with [DataAccessException](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/dao/DataAccessException.html) translation when used in conjunction with a [`PersistenceExceptionTranslationPostProcessor`](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/dao/annotation/PersistenceExceptionTranslationPostProcessor.html)

and some others as well.

## Exceptions in Java/Kotlin

Spring Boot is a framework for java applications.

In Java **`an event that occurs during the execution of a program that disrupts the normal flow of instructions`** is called an exception. This is generally an unexpected or unwanted event which can occur either at compile-time or run-time in application code.

Checked exceptions in Java are designed to be explicitly processed (in `if-then` style explained before), but runtime exceptions are the same in java and kotlin - they are mostly designed for critical errors. But we can use them in internal logic as well!

## Spring boot and layered architecture

Let's see now how the usual SB microservice is designed.

![Spring Boot layered architecture](/images/posts/sb-exceptions-layers.png)

I'm always using layered Spring architecture — where the core layer is domain which contains all the models specific to your microservice. Domain is wrapped with service layer which contains all the business logic (or domain logic), and the outer layer is a controller which responsibility is to manage interaction with your microservice.

Controller layer contains the logic to handle requests and responses, validate payload (your DTOs). Controller operates with DTOs which are designed within this layer. DTOs should be never accessible from the inner layers, they are only for the controller.

The main rule here — outer layers should be not accessible from inner layers, this helps to maintain clean code. You can access domain model from controller or the service, but you should never use DTOs in service or domain layer.

## Start here — exceptions in controller layer

Exceptions are domain objects. The main rule here — every exception should be mapped to a http status response. I call them REST exceptions.

We setup here **ControllerAdvice** to specify all the exceptions which are possible in our application

https://github.com/sadensmol/article_sb_exceptions/blob/main/src/main/kotlin/me/sadensmol/article_sb_exceptions/controller/ControllerAdvice.kt

ControllerAdvice should implement only general (controller) errors — they are called:

**`BadRequestException`**, **`NotFoundException`**, **`AlreadyExistsException`**, **`TerminalException`**.

This rule will make the service determined — it could return only a specific list of errors. So this microservice is easy to integrate into some big system, or application.

## Go further — exceptions in bottom layers

So we added exceptions into controllers and configured them to return a proper payload to the clients. What if we go down and use these exceptions in the service layer as well?

Since exceptions are based on the domain layer we could easily use them in services but control the api behaviour/flow on controller level!

```kotlin
@Service
class BankTransferService {

    fun transfer(recipient: String) {
        if (recipient == "faulty_bl_test_recipient") throw TerminalException("Something wrong happened!", "BTS_OO1")
        if (recipient == "not_found_test_recipient") throw NotFoundException("Recipient not found!", "BTS_OO1")
    }
}
```

https://github.com/sadensmol/article_sb_exceptions/blob/main/src/main/kotlin/me/sadensmol/article_sb_exceptions/service/BankTransferService.kt

Sometimes it's really handy when we get some exceptions case in our service, but would like to immediately answer the client with the specific error. There is no need in any further processing — we get to a problem, we throw an exception and we know that proper error will be returned to the client!

## Microservices

In microservice based SB application it's really useful if you can use the same web infrastructure across all the services, this means always unified error responses across the whole platform.

First you need to create a starter for your SB application — app_starter_web.

Move there **`@ControllerAdvice`** and all REST exceptions, and error responses. Now use it in every microservice. On any call to it, when you get an error - you either get **`200 OK`** with related DTO, or just error which is strictly determined in your web starter. And you can directly use it and caller microservice.

There never be a situation when you do a call and return error a different from what you expect while working through the web starter.

## Business exceptions

Along with REST exceptions, of course every service might have business exceptions. These exceptions could be defined in domain layer or directly in your service. They are needed to control the flow in controller. Every time controller gets such exception it could decide how to return the answer. In most cases it's just TerminalException, which is enough for the caller microservice to understand that request failed.

Declare your exceptions first.

You can declare service specific exceptions directly in related services, but common exceptions like `BusinessError` should be declared in domain.

```kotlin
open class BusinessError(message: String? = null, val code: String? = null) : Exception(message)

class BankTransferError(message: String? = null, code: String? = null) : BusinessError(message, code)
```

In service you can just throw them to the upstream controller layer:

```kotlin
@Service
class BankTransferService(private val bankClient: BankApiClient) {

    fun transfer(amount: BigDecimal, recipient: String) {
        ...

        try {
            bankClient.sendTransfer(amount, 1)
        } catch (e: BankApiClient.BankIsClosedException) {
            throw BankTransferError("Could not send transfer", code = "BTS_011")
        } catch (e: BankApiClient.TargetAccountIsInvalid) {
            throw BankTransferError("Could not send transfer", code = "BTS_012")
        }
    }
}
```

And on controller layer you need to explicitly handle it. Of course controller throws always only REST exceptions.

```kotlin
@RestController
@RequestMapping("/api/v1/ops")
class BankTransferController(
    private val bankTransferService: BankTransferService
) {

    @PostMapping("/transfer")
    fun transfer(@RequestBody @Validated request: BankTransfer) {
        ...

        try {
            bankTransferService.transfer(request.amount, request.recipient)
        } catch (e: BankTransferError) {
            throw TerminalException("Bank transfer isn't possible, sorry, try later again", e.code)
        }
    }
}
```

## External integrations

![External integrations](/images/posts/sb-exceptions-external.png)

In external integrations exceptions are placed directly in the client (external service client), they aren't related to the domain of the service, but mostly specific to the external API.

Service layer could operate with these exceptions, but they should be mapped to domain ones (business exceptions) in service layer.

It worth to mention that external integrations are out of the SB layer architecture — they work as external ports — so they should not rely on the domain layer (including our REST exceptions), they should have their own domain. This means you should not throw REST exceptions from the client, but operate with the service through own domain related exceptions.

## Problems to discuss

- Since error API are provided with 4 default exceptions (number could be increased for sure), then it's hard to provide reason what happened in the microservice to the client. Since we have additional error fields here — like `code` it's easy to store this information there and have error processing more granular. But mostly when you talk between microservices it means - request failed, no need in any retry on the client side. Do you really need any granularity here?
- Kotlin exceptions aren't designed to be used this way (based on the https://elizarov.medium.com/kotlin-and-exceptions-8062f589d07). In a nutshell Kotlin is using exceptions for many things — coroutines, assertions. If we are talking about REST exceptions in this article — it's just a way to propagate errors to clients in a single /unified way, but if we are talking about business exceptions — maybe yes, it's better to go with a functional approach here. I will write next article about it! Because current way it's hard to distinguish between logic problems and critical problems (exception cases). If it's much simpler anyway!

## Conclusion

Controlling the flow in the SB based on the exceptions seamlessly integrating into the platform. It's easy to use, it clearly determines the scope of possible errors from the microservice, which make external integrations easy.

Welcome to the discussions, I'm curious if somebody is using some similar approach.
