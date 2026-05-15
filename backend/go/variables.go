package main

import "fmt"

func variables() {
	fmt.Println("--- VARIABLES START ---")

	// create variables
	var name string = "IndieDev"
	var age int = 20
	var gpa float32 = 9.6
	var isProgrammer bool = true
	isProgressing := true // (automatically infer the type)
	fmt.Println(name, age, gpa, isProgrammer, isProgressing)

	// variable declaration only
	var x string // ""
	var y int    // 0
	var z bool   // false
	fmt.Println(x, y, z)

	// multiple variable in one line (type specified)
	var a, b, c int = 1, 2, 3
	fmt.Println(a, b, c)

	// multiple variable in one line (no type specified)
	var m, n = 'M', "IndieDev"
	fmt.Println(m, n)

	// block declaration
	var (
		x1 = 19
		y1 = 14
	)
	fmt.Println(x1, y1)

	// CONSTANT VARIABLE
	const PI float32 = 3.14 // (untyped)
	fmt.Println(PI)

	const ROLL_NO = 24061312262 // (typed)
	fmt.Println(ROLL_NO)

	fmt.Println("--- VARIABLES END ---")
	fmt.Println()

}
