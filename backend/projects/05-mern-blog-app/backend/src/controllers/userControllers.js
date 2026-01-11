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

		console.log(newUser, typeof newUser);
		res.status(201).json(newUser);
	} catch (err) {
		if (err.code === 11000) {
			return res.status(400).json({ message: "Username already taken!" });
		}
		console.log("Error in the createUser controller!", err.message);
		res.status(500).json({ message: "Internal Server Error!" });
	}
}

export async function getUsers(_, res) {
	try {
		const users = await User.find().sort({ createdAt: -1 });

		if (users.length === 0) {
			return res
				.status(404)
				.json({ message: "No users found in the database!" });
		}

		res.status(200).json(users);
	} catch (err) {
		console.log("Error in the getUsers controller!", err.message);
		res.status(500).json({ message: "Internal Server Error!" });
	}
}

export async function getUserById(req, res) {
	const id = req.params.id;
	try {
		const user = await User.findById({ _id: id });
		res.status(200).json(user);

		if (!user) {
			return res.status(404).json({ message: "User not found!" });
		}
	} catch (err) {
		console.log("Error in the getUserById controller!", err.message);
		res.status(500).json({ message: "Internal Server Error!" });
	}
}
