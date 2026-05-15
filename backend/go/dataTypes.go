package main

import "fmt"

func dataTypes() {
	fmt.Println("--- DATA TYPES START ---")

	// basic data types
	var name string = "IndieDev"
	var stock int = -20          // (signed integers - int8, int16, int32m int64)
	var age uint = 20            // (unsigned integers - int8, int16, int32m int64)
	var gpa float32 = 9.6        // (float32, float64)
	var isProgrammer bool = true // (true, false)
	isProgressing := true        // (automatically infer the type)
	fmt.Println(name, age, stock, gpa, isProgrammer, isProgressing)

	fmt.Println("--- DATA TYPES END ---")
	fmt.Println()
}
