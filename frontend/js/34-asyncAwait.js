// ------------------------------------------------------------

function fetchData() {
	return new Promise((resolve, reject) => {
		setTimeout(() => {
			resolve("Data retrieved from the server!");
		}, 4000);
	});
}

async function getUserData() {
	try {
		const data = await fetchData();
		console.log(data);
	} catch (err) {
		console.log("There is an error!, err");
	}
}
getUserData();

// ------------------------------------------------------------
