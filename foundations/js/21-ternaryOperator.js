// ------------------------------------------------------------------
let age = 47;

age <= 0
	? console.log(
			"Hey! be serious in your life and never joke like this again.",
		)
	: age >= 120
		? console.log(
				"I'll call the priest! there is no space for ghosts to watch this kind of content.",
			)
		: age === 18
			? console.log(
					"You are 18, but it doesn't mean that you are mature enough to watch this content. You have to submit an application to our staff then maybe you can get a chance to watch this content.",
				)
			: age < 18
				? console.log(
						"Hello baby! why are you here you should be in a kinder garden.",
					)
				: age > 60
					? console.log(
							"Hey Mr! don't you think you are too old to watch this kind of stuff.",
						)
					: console.log(
							"Welcome sir! feel free to have a seat and enjoy the show.",
						);

// ------------------------------------------------------------------
