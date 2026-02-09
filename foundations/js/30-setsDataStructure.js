// ------------------------------------------------------------
const numbers = new Set([1, 2, 3, 4, 5, 6, 6, 5, 5, 4, 1, 2]);
console.log(numbers);

// adding value
numbers.add(-10);
numbers.add(50);
console.log(numbers);

// check existence
console.log(numbers.has(3));
console.log(numbers.has(32));

// delete value
numbers.delete(5);
console.log(numbers);

// size of set
console.log(numbers.size);

// clear set
numbers.clear();
console.log(numbers);

// ------------------------------------------------------------
