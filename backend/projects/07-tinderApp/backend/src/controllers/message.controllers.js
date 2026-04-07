import Message from "../models/message.model.js";

export const sendMessage = async (req, res) => {
	try {
		const { content, receiverId } = req.body;
		const newMessage = await Message.create({
			sender: req.user.id,
			receiver: req.user.id,
			content,
		});

		// TODO: SEND THE MESSAGE IN REAL TIME USING SOCKET.IO

		res.status(201).json({ success: true, message: newMessage });
	} catch (err) {
		console.log(`Error in the sendMessage controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const getConversation = async (req, res) => {
	const { userId } = req.params;

	try {
		const messages = await Message.find({
			$or: [
				{ sender: req.user._id, receiver: userId },
				{ sender: userId, receiver: req.user._id },
			],
		}).sort("createdAt");

		res.status(200).json({ success: true, messages });
	} catch (err) {
		console.log(`Error in the getConversation controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
