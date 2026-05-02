import Feedback from "../models/feedback.model.js";

// display welcome message
export const home = async (_, res) => {
	res.json({ message: "Welcome to the homepage!" });
};

// create feedback
export const submitFeedback = async (req, res) => {
	const { name, email, event, rating, comment } = req.body;
	if (!name || !email || !event || !rating || !comment) {
		return res
			.status(400)
			.json({ success: false, error: "All fields must be provided!" });
	}

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	if (!emailRegex.test(email)) {
		return res
			.status(400)
			.json({ success: false, error: "Invalid email format!" });
	}

	if (rating < 1 || rating > 5) {
		return res.status(400).json({
			success: false,
			error: "Rating should not be less than 1 and greater than 5.",
		});
	}

	try {
		const newFeedback = await Feedback.create({
			name,
			email,
			event,
			rating,
			comment,
		});
		res.status(201).json({
			success: true,
			message: "Feedback created successfully!",
			newFeedback,
		});
	} catch (err) {
		console.log(`Error in the submitFeedback controller! ${err.message}`);
		res.status(500).json({
			success: false,
			error: "Internal server error!",
		});
	}
};

// display all feedbacks
export const showAllFeedbacks = async (req, res) => {
	try {
		const allFeedbacks = await Feedback.find().sort({ createdAt: -1 });
		if (allFeedbacks.length === 0) {
			return res
				.status(200)
				.json({ success: true, error: "No feedbacks found!" });
		} else {
			res.status(200).json({
				success: true,
				message: "Feedbacks fetched successfully!",
				allFeedbacks,
			});
		}
	} catch (err) {
		console.log(`Error in the showAllFeedbacks controller! ${err.message}`);
		res.status(500).json({
			success: false,
			error: "Internal server error!",
		});
	}
};
