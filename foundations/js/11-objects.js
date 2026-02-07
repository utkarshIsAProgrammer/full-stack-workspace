// --------------------------------------------------------------------
let emptyObj = {};

let person = {
	name: "IndieDev",
	age: 20,
	role: "Programmer/Developer",
	isLearning: true,
	technologies: ["frontend", "backend"],
};

console.log(emptyObj);
console.log(person);
console.log(person.technologies.length);

// access keys value from objects
console.log(
	person.name,
	person.age,
	person["role"],
	person["isLearning"],
	person.technologies,
);

// delete key value pair
delete person.age;
console.log(person);
// --------------------------------------------------------------------
