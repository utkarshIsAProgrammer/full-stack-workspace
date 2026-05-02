import Message from "../models/message.models.js";
import Conversation from "../models/conversation.model.js";

export const sendMessage = async (req, res) => {
	const { message } = req.body;
	const { id: receiverId } = req.params;
	const senderId = req.user._id;

	try {
		let conversation = await Conversation.findOne({
			participants: {
				$all: [senderId, receiverId],
			},
		});
		if (!conversation) {
			conversation = await Conversation.create({
				participants: [senderId, receiverId],
			});
		}

		const newMessage = await Message.create({
			senderId,
			receiverId,
			message,
		});
		if (newMessage) {
			conversation.messages.push(newMessage._id);
		}

		// TODO: SOCKET.IO IMPLEMENTATION TO MAKE IT REAL TIME

		await conversation.save();

		res.status(201).json({ success: true, newMessage });
	} catch (err) {
		console.log(`Error in the sendMessage controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const getMessages = async (req, res) => {
	const { id: userToChatId } = req.params;
	const senderId = req.user._id;

	try {
		const conversation = await Conversation.findOne({
			participants: [senderId, userToChatId],
		}).populate("messages"); // not just ids but actual messages from the "messages" array2
		if (!conversation) {
			return res.status(200).json([]);
		}

		const messages = conversation.messages;
		res.status(200).json(messages);
	} catch (err) {
		console.log(`Error in the getMessages controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
