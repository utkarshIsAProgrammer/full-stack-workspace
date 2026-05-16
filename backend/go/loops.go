package main

import "fmt"

func loops() {
	fmt.Println("--- LOOPS START ---")

	for i := 1; i < 11; i++ {
		if i == 5 {
			fmt.Println("Loop continued!")
			continue
		}

		if i == 9 {
			fmt.Println("Loop broken!")
			break
		}

		fmt.Println(i)
	}

	marks := []int{55, 66, 79, 86, 42}
	for index, mark := range marks {
		fmt.Printf("%v) %v\n", index+1, mark)
	}

	fmt.Println("--- LOOPS END---")
	fmt.Println()
}
