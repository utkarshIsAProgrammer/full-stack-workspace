package main

import "fmt"

func outputFunc() {
	var x int = 10

	fmt.Println("--- OUTPUT FUNCTIONS START ---")

	fmt.Print("Print function\n")
	fmt.Println("Println function")
	fmt.Printf("Printf function %v & %T\n", x, x)

	fmt.Println("--- OUTPUT FUNCTIONS END ---")
	fmt.Println()

}
