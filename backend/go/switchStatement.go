package main

import "fmt"

func switchStatement() {
	fmt.Println("--- SWITCH STATEMENT START ---")

	var day string = "Saturday"
	switch day {
	case "Monday":
		{
			fmt.Println("Working Day!")
		}
	case "Tuesday":
		{
			fmt.Println("Working Day!")
		}
	case "Wednesday":
		{
			fmt.Println("Working Day!")
		}
	case "Thursday":
		{
			fmt.Println("Frustrated Working Day!")
		}
	case "Friday":
		{
			fmt.Println("Tired Working Day!")
		}
	case "Saturday":
		{
			fmt.Println("Weekend Day!")
		}
	case "Sunday":
		{
			fmt.Println("Weekend Day!")
		}
	default:
		{
			fmt.Println("Invalid Day!")
		}
	}

	// multiple case switch
	var intDay int = 4
	switch intDay {
	case 1, 3, 5, 7:
		{
			fmt.Println("Odd Day!")
		}
	case 2, 4, 6:
		{
			fmt.Println("Even Day!")
		}
	default:
		{
			fmt.Println("Invalid Day!")
		}
	}

	fmt.Println("--- SWITCH STATEMENT END ---")
	fmt.Println()
}
