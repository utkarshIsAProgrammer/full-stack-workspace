// -------------------------------------------------------------

// each step only execute when it's previous step is successfully executed

setTimeout(() => {
	console.log("Step 1");

	setTimeout(() => {
		console.log("Step 2");

		setTimeout(() => {
			console.log("Step 3");

			setTimeout(() => {
				console.log("Step 4");
			}, 1000);
		}, 1000);
	}, 1000);
}, 1000);

// -------------------------------------------------------------
