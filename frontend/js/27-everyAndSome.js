// ------------------------------------------------
// every method (true if all elements pass the condition)
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
let result = numbers.every((number) => {
	return number % 2 === 0;
});
console.log(result);

// some method (true if atleast one element pass the condition)
result = numbers.some((number) => {
	return number % 2 === 0;
});
console.log(result);
// ------------------------------------------------
