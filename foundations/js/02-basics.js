// -------------------------------------------------------------------
console.log("Hello, World!");
console.log(2 + 4 + 5);
console.error("This is an error!");
console.warn("This is a warning!");
console.table({ name: "IndieDev", age: 20 });
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// this is a single line comment.

/* 
  this is a 
  multiline
  comment.
*/
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// variables
// 1. var
console.log(myName);
var myName;
myName = "IndieDev";
console.log(myName);

// 2. let
let myAge = 19;
console.log(myAge);

myAge = 20;
console.log(myAge);

// 3. const
const isDeveloper = true;
console.log(isDeveloper);

const BLACK_COLOR = "#000";
console.log(BLACK_COLOR);
// -------------------------------------------------------------------

// -------------------------------------------------------------------

// primitive data types
// 1. Number
let num = -10;
console.log(typeof num);

console.log(2 + 2);
console.log(6 - 4);
console.log(4 * 4);
console.log(14 / 2);
console.log(2 ** 6);
console.log(9 % 6);

let counter = 0;
counter++;
console.log(counter);

counter++;
console.log(counter);

counter--;
console.log(counter);

// 2. Boolean
let knowsJavascript = true;
console.log(knowsJavascript);

let knowsRuby = false;
console.log(typeof knowsRuby);

// 3. NaN
let isNan = NaN;
console.log(typeof isNan);

// 4. undefined
let undo = undefined;
console.log(typeof undo);
// -------------------------------------------------------------------

// -------------------------------------------------------------------
// comparison operators
// 1. relational
console.log(5 > 2);
console.log(1 < 5);
console.log(1 >= 2);
console.log(1 <= 2);

// 2. equality
console.log(1 == "1");
console.log(1 === "1");
console.log(2 != "2");
console.log(2 !== "2");
// -------------------------------------------------------------------
