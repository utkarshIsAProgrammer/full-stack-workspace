// ------------------------------------------------
// reduce method (parameters == (accumulator/result, currentValue, initialValue/startValue))
const numbers = [1, 2, 3, 4, 5];
let result = numbers.reduce((sum, number) => {
	return (sum += number);
});
console.log(result);
// ------------------------------------------------
