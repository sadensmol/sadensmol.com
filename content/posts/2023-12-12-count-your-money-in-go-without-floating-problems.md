+++
title = 'Count Your Money in Go Without Floating Problems'
date = 2023-12-12
draft = false
description = 'How to properly handle money in Go — avoiding floating point precision issues, choosing the right types, rounding rules, and passing monetary values between systems.'
tags = ['go', 'golang', 'money']
medium_url = 'https://medium.com/@sadensmol/count-your-money-in-go-without-floating-problems-ad4446c534d1'
+++

Money…

When we hear this at the start of development first we think about is "floating point numbers precision" and "money value representation".

So how to deal with money, how to store and how to pass them around — those are the questions I'd like to cover in this short essay.

## Why is it a problem at all?

Standard float types in Go have some certain precision (like in any other language), and you cannot use them for money operations. This simplest example here is the following:

```go
fmt.Println(0.1 + 0.2) // prints: 0.30000000000000004
```

You can calculate what is the minimum number of times you need to sum one value with another to get extra money on your account! But it works vice versa as well — in this case you just loose your money.

They are bad not only during the math operations on your money, but also in passing data around between different systems or services.

So this is the next problem — passing your money around. Every time you marshal your money from/to float you experience the same problem as shown above, along with different other problems related to the marshaller implementation - json, xml, text etc…

One other problem is rounding. If you're dealing with money you always face rounding problems. How should you round your money values? for example 0.345$ — should you say 34 cents, or 35?

## What are our options?

There are special types your can use for money representation and calculation.

Go stdlib has `big.Float` type from the `math/big` package represents arbitrary-precision floating-point number). Unlike `float32` and `float64`, which have fixed sizes and precision, `big.Float` allows you to set arbitrary precision for numbers and calculations.

Another good option is a decimal library https://github.com/shopspring/decimal

Regarding rounding there is a common rule in this case: "Round Half to Even" means (e.g. for USD):

- $1.234 => $1.23
- $1.235 => $1.24
- $1.236 => $1.24

and for example shopspring/decimal has ways to properly round values.

Another good option to consider — use currency units — in case of USD it's cents. So you move from floating number problems to integers and calculate everything as integers. The only place you are using rounding here — to pass result values around.

Now let's discuss our options in case of passing money around.

- **currency units** — we pass everything as integers, no floating problems here. Just control value limits, that's it
- **pass floats as strings**. Usually a good option as well — when you pass floating number as string, with required precision (specific number of decimal digits) you are safe when your party read this string value and convert it back to float.

You can come up with your own implementation for accurate representing your money operations. But it's a theme for another article!

## Brain train :)

You can play around with it on go playground: https://go.dev/play/p/D_v979phga1

```go
package main

import (
	"fmt"
	"github.com/shopspring/decimal"
)

func main() {
	a := 0.1
	b := 0.2
	c := decimal.NewFromFloat(a)
	d := decimal.NewFromFloat(b)
	fmt.Println(a, b, c.String(), d.String()) // 0.1 0.2 0.1 0.2
	fmt.Println(a + b)                        // 0.30000000000000004
	fmt.Println(c.Add(d).String())            // 0.3
}
```

## Conclusion

When dealing with money — use `math/big` or some money related libs like shopspring/decimal, or just operate with currency units, don't use floats here.

Pass money around as strings, or in currency units, don't use floats here.

Consult with the requirements for your domain area of money rounding, but in general use "Round Half to Even" rule.

Use ISO 4217 for currency codes.
