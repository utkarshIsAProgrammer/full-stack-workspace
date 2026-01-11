export const signup = async (req, res) => {
	try {
	} catch (err) {
		console.log("Error in the signup controller!", err.message);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};

export const signin = async (req, res) => {
	try {
	} catch (err) {
		console.log("Error in the signin controller!", err.message);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};

export const logout = async (req, res) => {
	try {
	} catch (err) {
		console.log("Error in the logout controller!", err.message);
		res.status(500).json({ message: "Internal Server Error!" });
	}
};
