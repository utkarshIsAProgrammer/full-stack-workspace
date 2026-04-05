// ------------------------------------------------------------------------
// function declaration
function greetUser(user) {
	console.log("Greetings from the developer....");
	return "Hello " + user + "!";
}

let result = greetUser("Jonathan");
console.log(result);

// function expression
const sayHello = function (user) {
	return "Hello " + user + "!";
};
result = sayHello("Marie");
console.log(result);

// callback function
function calc(a, b, add) {
	return add(a, b);
}

function add(a, b) {
	return a + b;
}

result = calc(5, 7, add);
console.log(result);

// arrow function
const greet = (name) => {
	console.log(`Hello!, ${name}`);
};

greet("IndieDev");
// ------------------------------------------------------------------------
