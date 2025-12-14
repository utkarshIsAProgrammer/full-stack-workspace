// callbacks...
const callback1 = (req, res, next) => {
	console.log("Callback 1");
	next();
};

const callback2 = (req, res, next) => {
	console.log("Callback 2");
	next();
};

const callback3 = (req, res) => {
	console.log("Callback 3");
	res.send("Array of callbacks");
};

// array of callbacks...
app.get("/callback-arrays", [callback1, callback2, callback3]);
