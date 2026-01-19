export const signup = async (req, res) => {
	try {
		const { fullName, email, password } = req.body;

		if (!fullName || !email || !password) {
			return res
				.status(400)
				.json({ message: "All fields are required!" });
		}

		if (password.length < 6) {
			return res
				.status(400)
				.json({ message: "Password must be at least 6 characters!" });
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return res.status(400).json({ message: "Invalid email format!" });
		}

		// ----------------------------------------------------
		// const user = ""
		// ----------------------------------------------------
	} catch (err) {
		console.log("Error in the signup controller!");
	}
};

export const login = async (req, res) => {
	try {
		res.status(200).json({ message: "Login successfully!" });
	} catch (err) {
		console.log("Error in the signup controller!");
	}
};

export const logout = async (req, res) => {
	try {
		res.status(200).json({ message: "Logout successfully!" });
	} catch (err) {
		console.log("Error in the signup controller!");
	}
};
