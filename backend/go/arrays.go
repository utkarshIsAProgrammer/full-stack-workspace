package main

import "fmt"

func arrays() {
	fmt.Println("--- ARRAYS START ---")

	// create array
	var arr = []int{1, 2, 3, 4, 5}
	fmt.Println(arr)

	// access element
	fmt.Println(arr[0])
	fmt.Println(arr[0:2])

	// change element
	arr[0] = 10
	fmt.Println(arr[0])

	// initialize only specific element
	var newArr = []int{1: 50, 3: 20}
	fmt.Println(newArr)

	// length of array
	fmt.Println(len(arr))
	fmt.Println(len(newArr))

	fmt.Println("--- ARRAYS END ---")
	fmt.Println()
}
