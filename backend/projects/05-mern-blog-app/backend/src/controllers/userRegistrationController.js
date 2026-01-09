import User from "../models/User.js";

export async function createUser(req, res) {
	const { name } = req.body;

	if (!name) {
		return res.status(404).json({ message: "Name is required!" });
	}

	try {
		const newUser = await User.create({
			name,
		});

		res.status(201).json(newUser);
	} catch (err) {
		if (err.code === 11000) {
			return res.status(400).json({ message: "Username already taken!" });
		}
		console.log("Error in the createUser controller!", err.message);
		res.status(500).json({ message: "Internal Server Error!" });
	}
}
