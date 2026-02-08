// ------------------------------------------------------------------
// array destructuring
const arr = [1, 2, 3, 4, 5];
const [one, two, three, four, five] = arr;
console.log(one, two, three, four, five);

// skipping elements
const [, , third] = arr;
console.log(third);

// default values
const [a = 1, b = 2] = [10];
console.log(a);
console.log(b);

// swap variables
let x = 6;
let y = 7;
[x, y] = [y, x];
console.log(x, y);

// rest operator
const [first, ...rest] = [1, 2, 3, 4];
console.log(first);
console.log(rest);

// ------------------------------------------------------------------

// ------------------------------------------------------------------
// object destructuring
const user = {
	name: "IndieDev",
	age: 20,
};
const { name, age } = user;
console.log(name);
console.log(age);

// rename variable
const { name: userName } = user;
console.log(userName);

// default value
const { role = "Developer/Programmer" } = user;
console.log(role);

// ------------------------------------------------------------------

// ------------------------------------------------------------------
// function destructing

// object destructuring
function userInfo({ name = "User", role = "Developer" } = {}) {
	console.log(`${name} is a ${role}`);
}
userInfo({ role: "Software Engineer" });
userInfo();

// array destructuring
function sum([a, b]) {
	return a + b;
}
sum([10, 20]);

// ------------------------------------------------------------------

// ------------------------------------------------------------------
// nested destructing
const newEmployee = {
	id: 1,
	profile: {
		newName: "IndieDev",
		newRole: "Software Developer",
	},
};

const {
	profile: { newName, newRole },
} = newEmployee;

console.log(newName, newRole);

// ------------------------------------------------------------------
