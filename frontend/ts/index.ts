// * ANNOTATIONS
// -------------------------------------------------------------------------------------------------------------------------
// string
let myName: string = "indieDev";
myName = "IndieDev";
console.log(myName);

// number
let myAge = 20;
myAge = 21;
console.log(myAge);

// boolean
let isProgrammer: boolean = false;
isProgrammer = true;
console.log(isProgrammer);
// -------------------------------------------------------------------------------------------------------------------------

// * TYPE INFERENCE
// -------------------------------------------------------------------------------------------------------------------------
let role = "Fullstack Software Developer";
console.log(role);

// role = undefined; // !ERROR
// -------------------------------------------------------------------------------------------------------------------------

//  * ANY TYPE
// -------------------------------------------------------------------------------------------------------------------------
let company: any = "Google";
console.log(company);

company = true;
console.log(company);

company = 50;
console.log(company);
// -------------------------------------------------------------------------------------------------------------------------

// * FUNCTION PARAMETER ANNOTATION
// -------------------------------------------------------------------------------------------------------------------------
function speak(voice: string) {
	return voice;
}
const dog = speak("bhow bhow...");
console.log(dog);

const addTwo = (a: number, b: number) => {
	return a + b;
};
const sum = addTwo(1, 2);
console.log(sum);
// -------------------------------------------------------------------------------------------------------------------------

//  * DEFAULT PARAMETER VALUE
// -------------------------------------------------------------------------------------------------------------------------
function greet(msg: string = "Hello, Buddy!") {
	return msg;
}
const greeting = greet();
console.log(greeting);
// -------------------------------------------------------------------------------------------------------------------------

// * RETURN ANNOTATIONS
// -------------------------------------------------------------------------------------------------------------------------
function subtract(a: number, b: number): number {
	return a - b;
}
const subRes = subtract(7, 5);
console.log(subRes);

const half = (a: number): number => {
	return a / 2;
};
const halfRes = half(5);
console.log(halfRes);
// -------------------------------------------------------------------------------------------------------------------------

// * VOID
// -------------------------------------------------------------------------------------------------------------------------
function sayHello(): void {
	console.log("Hello, Geek!");
}
sayHello();
// -------------------------------------------------------------------------------------------------------------------------

// * NEVER
// -------------------------------------------------------------------------------------------------------------------------
function throwErr(msg: string): never {
	throw new Error(msg);
}
// throwErr("Throw Error!");

let nope: never;
function neverReturns(): never {
	while (true) {}
}
// nope = neverReturns();

function infiniteLoop(): never {
	while (true) {
		console.log("NEVER, Infinite Loop!");
	}
}
// infiniteLoop();
// -------------------------------------------------------------------------------------------------------------------------

// * ARRAY
// -------------------------------------------------------------------------------------------------------------------------
let numArr: number[] = [1, 2, 3]; // []notation syntax
console.log(numArr);

let strArr: Array<string> = ["a", "b", "c"]; // Array<type> syntax
console.log(strArr);
strArr.push("d");
strArr.push("e");
strArr.push("f");
console.log(strArr);
// -------------------------------------------------------------------------------------------------------------------------

// * MULTIDIMENSIONAL ARRAYS
// -------------------------------------------------------------------------------------------------------------------------
let mdArr: number[][] = [[1, 2, 3]];
console.log(mdArr);

let tripleMdArr: number[][][] = [[[1, 2, 3]]];
console.log(tripleMdArr);
// -------------------------------------------------------------------------------------------------------------------------

//  * OBJECTS
// -------------------------------------------------------------------------------------------------------------------------
const employee: {
	name: string;
	email: string;
	role: string;
	age: number;
	id: number;
} = {
	name: "IndieDev",
	email: "indieDev@gmail.com",
	role: "Fullstack Software Developer",
	age: 20,
	id: 589385293412,
};
console.log(employee);
console.log(employee.name, "|", employee.role);

function printUser(): { name: string; age: number; location: string } {
	return { name: "IndieDev", age: 20, location: "Germany" };
}
const res = printUser();
console.log(res);
// -------------------------------------------------------------------------------------------------------------------------

// * TYPE ALIASES
// -------------------------------------------------------------------------------------------------------------------------
type Person = {
	name: string;
	age: number;
};

function printPerson(person: Person) {
	console.log(person.name, "|", person.age);
}
printPerson({
	name: "Devlooper",
	age: 20,
});
// -------------------------------------------------------------------------------------------------------------------------

// * OPTIONAL PROPERTIES AND READONLY PROPERTY
// -------------------------------------------------------------------------------------------------------------------------
type someDev = {
	name: string;
	age?: number;
	readonly role: string;
};

function printDev(dev: someDev) {
	console.log(dev.name, "|", dev.age, "|", dev.role);
}
printDev({ name: "Devlooper", role: "SDE" });

// -------------------------------------------------------------------------------------------------------------------------

// * INTERSECTION TYPE
// -------------------------------------------------------------------------------------------------------------------------
type man = {
	name: string;
	age?: number;
};

type employee = {
	readonly id: number;
	role: string;
};

type manAndEmployee = man & employee;

const geek: manAndEmployee = {
	name: "Devlooper",
	id: 113129312882,
	role: "SDE",
};
console.log(geek);
// -------------------------------------------------------------------------------------------------------------------------

// * UNIONS
// -------------------------------------------------------------------------------------------------------------------------
let unionVar: number | string = 20;
console.log(unionVar);

const items: (number | string)[] = [1, 2, 3, "one", "two", "three"];
console.log(items);
// -------------------------------------------------------------------------------------------------------------------------

// * LITERALS
// -------------------------------------------------------------------------------------------------------------------------
let aA: 1 | 2;
aA = 1;
aA = 2;
// aA = 3; // !ERROR
console.log(aA);
// -------------------------------------------------------------------------------------------------------------------------

// * TUPLES
// -------------------------------------------------------------------------------------------------------------------------
let myTup: [string, number] = ["Hello", 123];
console.log(myTup);
console.log(myTup[0]);
console.log(myTup[1]);

// destructuring
const [elem1, elem2] = myTup;
console.log(elem1, elem2);
// -------------------------------------------------------------------------------------------------------------------------

// * ENUMS
// -------------------------------------------------------------------------------------------------------------------------
enum weatherConditions {
	sunny = "Sunny",
	cloudy = "Cloudy",
	rainy = "Rainy",
	foggy = "Foggy",
	snowy = "Snowy",
}

let currentWeather = weatherConditions.cloudy;
console.log(currentWeather);
// -------------------------------------------------------------------------------------------------------------------------

// * INTERFACES
// -------------------------------------------------------------------------------------------------------------------------
interface human {
	firstName: string;
	lastName: string;
	age: number;
	saySomething(): string;
}

const newHuman: human = {
	firstName: "Jonathan",
	lastName: "Buyers",
	age: 29,
	saySomething() {
		return "Hello Geek!";
	},
};
console.log(newHuman);
console.log(newHuman.saySomething());

interface mathOp {
	(a: number, b: number): number;
}

const add: mathOp = (a, b) => {
	return a + b;
};
console.log(add(5, 6));
// -------------------------------------------------------------------------------------------------------------------------

// * GENERICS
// -------------------------------------------------------------------------------------------------------------------------
// TODO: CONTINUE LEARNING WITH GENERICS
// -------------------------------------------------------------------------------------------------------------------------
