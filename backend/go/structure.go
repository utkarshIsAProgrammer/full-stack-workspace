package main

import "fmt"

func structures() {
	fmt.Println("--- STRUCTURES START ---")

	// create structure
	type Person struct {
		name         string
		age          int
		gpa          float32
		isProgrammer bool
	}

	// access members
	var man1 Person
	man1.name = "IndieDev"
	man1.age = 20
	man1.gpa = 9.6
	man1.isProgrammer = true
	fmt.Println(man1.name, man1.age, man1.gpa, man1.isProgrammer)

	fmt.Println("--- STRUCTURES END ---")
	fmt.Println()
}
