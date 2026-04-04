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
