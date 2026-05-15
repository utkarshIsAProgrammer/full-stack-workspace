package main

import "fmt"

func slices() {
	fmt.Println("--- SLICES START ---")

	// create slice
	slice := []int{1, 2, 3, 4, 5}
	fmt.Println(slice)
	fmt.Println(len(slice))
	fmt.Println(cap(slice))

	// create slice from array
	slicedSlice := slice[1:3]
	fmt.Println(len(slicedSlice))
	fmt.Println(cap(slicedSlice))
	fmt.Println(slicedSlice)

	// create slice withe make()
	// SYNTAX: ([]type, length, capacity)
	makeSlice := make([]int, 4)
	newMakeSlice := make([]int, 10)
	fmt.Println(makeSlice, len(makeSlice), cap(makeSlice))
	fmt.Println(newMakeSlice, len(newMakeSlice), cap(newMakeSlice))

	fmt.Println("--- SLICES END ---")
}
