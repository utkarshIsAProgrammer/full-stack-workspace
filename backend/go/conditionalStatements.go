package main

import "fmt"

func conditionalStatements() {
	fmt.Println("--- CONDITIONAL STATEMENTS START ---")

	var age int = 45
	if age < 0 || age > 120 {
		fmt.Println("Don't fool us!")
	} else if age >= 18 {
		fmt.Println("Welcome to the movie world!")
	} else {
		fmt.Println("You are too young!")
	}

	fmt.Println("--- CONDITIONAL STATEMENTS END---")
	fmt.Println()
}
