// ----------------------------------------------------------------
// with object
const user = {
	name: "IndieDev",
	age: 20,
	role: "Developer/Programmer",
};

for (keys in user) {
	console.log(keys, user[keys]);
}

// with array
const arr = [1, 2, 3, 4, 5];
for (elem in arr) {
	console.log(arr[elem]);
}
// ----------------------------------------------------------------
