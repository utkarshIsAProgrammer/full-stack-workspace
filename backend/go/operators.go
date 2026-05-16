package main

import "fmt"

func operators() {
	fmt.Println("--- OPERATORS START ---")

	// ARITHMETIC OPERATORS
	var a int = 45

	fmt.Println(5 + 5)
	fmt.Println(7 - 4)
	fmt.Println(9 * 2)
	fmt.Println(25 / 5)
	fmt.Println(25 % 5)

	a++
	fmt.Println(a)

	a--
	fmt.Println(a)

	// ASSIGNMENT OPERATORS
	a += 2
	fmt.Println(a)

	a -= 5
	fmt.Println(a)

	a *= 4
	fmt.Println(a)

	a /= 7
	fmt.Println(a)

	a %= 4
	fmt.Println(a)

	// COMPARISON OPERATORS
	fmt.Println(5 == 6)
	fmt.Println(76 > 5)
	fmt.Println(5 < 24)
	fmt.Println(2 >= 1)
	fmt.Println(1 <= 7)

	// LOGICAL OPERATORS
	fmt.Println((5 > 2) && (2 < 4))
	fmt.Println((5 > 2) || (5 < 2))
	fmt.Println(!(2 < 4))

	fmt.Println("--- OPERATORS END ---")
	fmt.Println()
}
