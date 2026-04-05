// ---------------------------------------------------------------------
const user1 = Symbol();
const user2 = Symbol();
console.log(user1, user2, user1 === user2);

const name = Symbol("name");
const age = Symbol("age");

const userData = {};
userData[name] = "IndieDev";
userData[age] = 20;
console.log(userData);

// ---------------------------------------------------------------------
