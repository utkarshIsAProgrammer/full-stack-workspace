// ---------------------------------------------------------------------------
// create array
let emptyArray = [];
let numbers = [1, 2, 3, 4, 5, 6];
let tasks = ["eat", "sleep", "code", "repeat"];
let nestedArray = [
	[1, 2, 3, 4, 5],
	["a", "b", "c", "d", "e"],
];

console.log(emptyArray);
console.log(numbers);
console.log(tasks);
console.log(nestedArray);

// access array elements
console.log(tasks[0]);
console.log(tasks[2]);
console.log(nestedArray[0][1]);
console.log(nestedArray[1][2]);
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// concat method
console.log(numbers.concat(tasks));

// includes method
console.log(tasks.includes("sleep"));

// push method
nestedArray.push("endl");
console.log(nestedArray);

// unshift method
nestedArray.unshift("startl");
console.log(nestedArray);

// pop method
let popElement = nestedArray.pop();
console.log(nestedArray);
console.log(popElement);

// shift method
let shiftElement = nestedArray.shift();
console.log(nestedArray);
console.log(shiftElement);

// sort method
console.log(tasks.sort());

// slice method
console.log(numbers.slice(1, 4));

// splice method
numbers.splice(1, 3); // remove element
console.log(numbers);

numbers.splice(1, 0, "two"); // add element
console.log(numbers);

// ---------------------------------------------------------------------------
