// --------------------------------------------------------------------
let emptyObj = {};

let person = {
	name: "IndieDev",
	age: 20,
	role: "Programmer/Developer",
	isLearning: true,
	technologies: ["frontend", "backend"],

	// object method
	doWork: function () {
		console.log(this.name + " typed some code...");
	},
};

console.log(emptyObj);
console.log(person);
console.log(person.technologies.length);
person.doWork();

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
