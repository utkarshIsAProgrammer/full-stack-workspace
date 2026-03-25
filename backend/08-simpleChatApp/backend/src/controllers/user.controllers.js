import User from "../models/user.model.js";

export const getUsersForSidebar = async (req, res) => {
	try {
		const allUsers = await User.find().select("-password");

		return res.status(200).json({ success: true, allUsers });
	} catch (err) {
		console.log(
			`Error in the getUsersForSidebar controller! ${err.message}`,
		);
		res.status(500).json({ message: "Internal server error!" });
	}
};
