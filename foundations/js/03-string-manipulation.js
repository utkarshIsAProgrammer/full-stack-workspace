firstName = "Indie";
lastName = "Dev";

// ----------------------------------------------------------------------------------------------
// 1. concat method
console.log(firstName.concat(lastName));

// 2. appending
let word = "this world";
word += " is awesome!";
console.log(word);

// 3. length method
console.log(word.length);

// 4. uppercase and lowercase method
const myName = "IndieDev";
console.log(myName.toLocaleLowerCase());
console.log(myName.toUpperCase());

// 5. slice method
console.log(myName.slice(5));
console.log(myName.slice(0, 5));
console.log(myName.slice(-3));

// 6. split and join method
const mySplitName = myName.split("e");
console.log(mySplitName);
console.log(mySplitName.join("-"));

// 7. includes method
console.log(myName.includes("n"));
console.log(myName.includes("N"));

// 8. trim method
let trimText = "   Trim Me!   ";
console.log(trimText.trim());
// ----------------------------------------------------------------------------------------------

// ----------------------------------------------------------------------------------------------
// multiline string
let multiLineString = `
This is a
multiline
string;
`;
console.log(multiLineString);
// ----------------------------------------------------------------------------------------------

// ----------------------------------------------------------------------------------------------
// template literal
console.log(`Hello! ${firstName} ${lastName}!`);
// ----------------------------------------------------------------------------------------------
