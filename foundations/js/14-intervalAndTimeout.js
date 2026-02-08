// -----------------------------------------------------------------------------------
const intervalID = setInterval(() => {
	console.log("Run after every interval period.");
}, 2000);

// stop interval after 10 seconds
setTimeout(() => {
	clearInterval(intervalID);
	console.log("Interval Stopped.....");
}, 10000);

/* setTimeout(() => {
	console.log("Run after 3 seconds.");
}, 3000); */

// -----------------------------------------------------------------------------------
