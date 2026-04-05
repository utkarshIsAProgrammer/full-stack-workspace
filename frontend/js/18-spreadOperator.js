// --------------------------------------------------------------
// function spread operator
function employeeStats(frontend, backend, authentication, deployment) {
	console.log(`Frontend: ${frontend}`);
	console.log(`Backend: ${backend}`);
	console.log(`Authentication: ${authentication}`);
	console.log(`Deployment: ${deployment}`);
}

const ratings = [4.2, 5, 4.7, 5];
employeeStats(...ratings);

// array spread operator
let arrOne = ["one", "two", "three", "four"];
let arrTwo = [1, 2, 3, 4];
let mixedArr = [...arrOne, ...arrTwo];
console.log(mixedArr);

// object spread operator
let objOne = { name: "IndieDev", age: 20, role: "Developer/Programmer" };
let newObj = { ...objOne };
console.log(newObj);
// --------------------------------------------------------------
