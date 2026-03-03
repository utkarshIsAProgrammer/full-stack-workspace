import Message from "../models/message.model.js";

export const sendMessage = async (req, res) => {
	try {
		const { message } = req.body;
		const { id } = req.params;
		const senderId = req.userId;
		res.send({
			json: "Successfully move into the sendMessage controller!",
		});
	} catch (err) {
		console.log(`Error in the sendMessage controller! ${err.message}`);
		res.status(500).json({ error: "Internal server error!" });
	}
};
