// --------------------------------------------------------
function checkNumber(number) {
	return new Promise((resolve, reject) => {
		if (number % 2 === 0) {
			resolve("Even number!");
		} else {
			reject("Odd number!");
		}
	});
}

checkNumber(3)
	.then((message) => {
		console.log("Task succeed!", message);
	})
	.catch((err) => {
		console.log("Task Failed!", err);
	});
// --------------------------------------------------------
