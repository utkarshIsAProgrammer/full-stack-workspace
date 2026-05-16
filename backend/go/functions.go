package main

import "fmt"

func showName(fName string, lName string) string {
	return fmt.Sprintf("Hello! %v %v", fName, lName)
}

func functions() {
	fmt.Println("--- FUNCTIONS START---")

	result := showName("Indie", "Dev")
	fmt.Println(result)

	recursive(5)

	fmt.Println("--- FUNCTIONS END---")
	fmt.Println()
}

func recursive(x int) int {
	if x == 11 {
		return 0
	}

	fmt.Println(x)
	return recursive(x + 1)
}
