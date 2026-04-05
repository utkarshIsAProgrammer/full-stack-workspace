// ---------------------------------------------------------------
const myMap = new Map([
	["name", "IndieDev"],
	["age", 20],
]);
console.log(myMap);

// set value
myMap.set(1, "One");
myMap.set(true, "yes");
console.log(myMap);

// get values
console.log(myMap.get("name"));
console.log(myMap.get(1));

// check existence
console.log(myMap.has("age"));

// delete value
myMap.delete(true);
console.log(myMap);

// size of a map
console.log(myMap.size);

// clear map
// myMap.clear();
// console.log(myMap);

// iterating over map
for (elem of myMap) {
	console.log(elem);
}

// iterating only keys
for (key of myMap.keys()) {
	console.log(key);
}

// iterating only values
for (value of myMap.values()) {
	console.log(value);
}
// ---------------------------------------------------------------
