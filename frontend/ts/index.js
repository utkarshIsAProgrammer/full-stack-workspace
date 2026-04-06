"use strict";
// * ANNOTATIONS
// -------------------------------------------------------------------------------------------------------------------------
// string
let myName = "indieDev";
myName = "IndieDev";
console.log(myName);
// number
let myAge = 20;
myAge = 21;
console.log(myAge);
// boolean
let isProgrammer = false;
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
let company = "Google";
console.log(company);
company = true;
console.log(company);
company = 50;
console.log(company);
// -------------------------------------------------------------------------------------------------------------------------
// * FUNCTION PARAMETER ANNOTATION
// -------------------------------------------------------------------------------------------------------------------------
function speak(voice) {
    return voice;
}
const dog = speak("bhow bhow...");
console.log(dog);
const addTwo = (a, b) => {
    return a + b;
};
const sum = addTwo(1, 2);
console.log(sum);
// -------------------------------------------------------------------------------------------------------------------------
//  * DEFAULT PARAMETER VALUE
// -------------------------------------------------------------------------------------------------------------------------
function greet(msg = "Hello, Buddy!") {
    return msg;
}
const greeting = greet();
console.log(greeting);
// -------------------------------------------------------------------------------------------------------------------------
// * RETURN ANNOTATIONS
// -------------------------------------------------------------------------------------------------------------------------
function subtract(a, b) {
    return a - b;
}
const subRes = subtract(7, 5);
console.log(subRes);
const half = (a) => {
    return a / 2;
};
const halfRes = half(5);
console.log(halfRes);
// -------------------------------------------------------------------------------------------------------------------------
// * VOID
// -------------------------------------------------------------------------------------------------------------------------
function sayHello() {
    console.log("Hello, Geek!");
}
sayHello();
// -------------------------------------------------------------------------------------------------------------------------
// * NEVER
// -------------------------------------------------------------------------------------------------------------------------
function throwErr(msg) {
    throw new Error(msg);
}
// throwErr("Throw Error!");
let nope;
function neverReturns() {
    while (true) { }
}
// nope = neverReturns();
function infiniteLoop() {
    while (true) {
        console.log("NEVER, Infinite Loop!");
    }
}
// infiniteLoop();
// -------------------------------------------------------------------------------------------------------------------------
// * ARRAY
// -------------------------------------------------------------------------------------------------------------------------
let numArr = [1, 2, 3]; // []notation syntax
console.log(numArr);
let strArr = ["a", "b", "c"]; // Array<type> syntax
console.log(strArr);
strArr.push("d");
strArr.push("e");
strArr.push("f");
console.log(strArr);
// -------------------------------------------------------------------------------------------------------------------------
// * MULTIDIMENSIONAL ARRAYS
// -------------------------------------------------------------------------------------------------------------------------
let mdArr = [[1, 2, 3]];
console.log(mdArr);
let tripleMdArr = [[[1, 2, 3]]];
console.log(tripleMdArr);
// -------------------------------------------------------------------------------------------------------------------------
//  * OBJECTS
// -------------------------------------------------------------------------------------------------------------------------
const employee = {
    name: "IndieDev",
    email: "indieDev@gmail.com",
    role: "Fullstack Software Developer",
    age: 20,
    id: 589385293412,
};
console.log(employee);
console.log(employee.name, "|", employee.role);
function printUser() {
    return { name: "IndieDev", age: 20, location: "Germany" };
}
const res = printUser();
console.log(res);
function printPerson(person) {
    console.log(person.name, "|", person.age);
}
printPerson({
    name: "Devlooper",
    age: 20,
});
function printDev(dev) {
    console.log(dev.name, "|", dev.age, "|", dev.role);
}
printDev({ name: "Devlooper", role: "SDE" });
const geek = {
    name: "Devlooper",
    id: 113129312882,
    role: "SDE",
};
console.log(geek);
// -------------------------------------------------------------------------------------------------------------------------
// * UNIONS
// -------------------------------------------------------------------------------------------------------------------------
let unionVar = 20;
console.log(unionVar);
const items = [1, 2, 3, "one", "two", "three"];
console.log(items);
// -------------------------------------------------------------------------------------------------------------------------
// * LITERALS
// -------------------------------------------------------------------------------------------------------------------------
let aA;
aA = 1;
aA = 2;
// aA = 3; // !ERROR
console.log(aA);
// -------------------------------------------------------------------------------------------------------------------------
// * TUPLES
// -------------------------------------------------------------------------------------------------------------------------
let myTup = ["Hello", 123];
console.log(myTup);
console.log(myTup[0]);
console.log(myTup[1]);
// destructuring
const [elem1, elem2] = myTup;
console.log(elem1, elem2);
// -------------------------------------------------------------------------------------------------------------------------
// * ENUMS
// -------------------------------------------------------------------------------------------------------------------------
var weatherConditions;
(function (weatherConditions) {
    weatherConditions["sunny"] = "Sunny";
    weatherConditions["cloudy"] = "Cloudy";
    weatherConditions["rainy"] = "Rainy";
    weatherConditions["foggy"] = "Foggy";
    weatherConditions["snowy"] = "Snowy";
})(weatherConditions || (weatherConditions = {}));
let currentWeather = weatherConditions.cloudy;
console.log(currentWeather);
const newHuman = {
    firstName: "Jonathan",
    lastName: "Buyers",
    age: 29,
    saySomething() {
        return "Hello Geek!";
    },
};
console.log(newHuman);
console.log(newHuman.saySomething());
const add = (a, b) => {
    return a + b;
};
console.log(add(5, 6));
// -------------------------------------------------------------------------------------------------------------------------
// * GENERICS
// -------------------------------------------------------------------------------------------------------------------------
function printInfo(x) {
    return x;
}
console.log(printInfo("Hello, printInfo!"));
console.log(printInfo(5));
console.log(printInfo(true));
// -------------------------------------------------------------------------------------------------------------------------
