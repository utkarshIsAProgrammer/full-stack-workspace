package main

import "fmt"

func maps() {
	fmt.Println("--- MAP START")

	var a = map[string]string{"name": "IndieDev", "salary": "90k", "employer": "Google"}
	fmt.Println(a)

	b := make(map[string]int)
	b["age"] = 20
	b["gpa"] = 9
	fmt.Println(b)

	// NOTE: slice, map and function can't be used as a key as == operator is created for them

	// access element
	fmt.Println(a["name"], b["age"])

	// update and add element
	b["age"] = 21
	a["shift"] = "morning"
	fmt.Println(b["age"], a["shift"])

	// remove element
	delete(a, "shift")
	fmt.Println(a)

	// check specific key
	_, ok1 := a["name"] // not show value
	fmt.Println(ok1)

	val1, ok2 := a["employer"] // also show value
	fmt.Println(val1, ok2)

	fmt.Println("--- MAP END")
	fmt.Println()
}
