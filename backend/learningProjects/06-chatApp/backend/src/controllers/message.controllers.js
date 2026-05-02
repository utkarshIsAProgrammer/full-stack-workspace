import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import cloudinary from "../utils/cloudinary.js";

export const getUsersForSidebar = async (req, res) => {
	try {
		const { loggedInUserId } = req.user.id;
		const { filteredUsers } = await User.find({
			_id: {
				$ne: loggedInUserId,
			},
		}).select("-password");

		res.status(200).json(filteredUsers);
	} catch (err) {
		console.log(
			`Error in the getUsersForSidebar controller! ${err.message}`,
		);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const getMessages = async (req, res) => {
	try {
		const { id: userToChatId } = req.params;
		const senderId = req.user._id;

		const messages = await Message.find({
			$or: [{ senderId: senderId, receiverId: userToChatId }],
			$or: [{ senderId: userToChatId, receiverId: senderId }],
		});

		res.status(200).json(messages);
	} catch (err) {
		console.log(`Error in the getMessages controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};

export const sendMessages = async (req, res) => {
	try {
		const { text, image } = req.body;
		const { id: receiverId } = req.params;
		const senderId = req.user._id;

		let imageUrl;
		if (imageUrl) {
			const uploadResponse = await cloudinary.uploader.upload(image);
			imageUrl = uploadResponse.secure_url;
		}

		const newMessage = new Message({
			senderId,
			receiverId,
			text,
			image: imageUrl,
		});

		await newMessage.save();

		// TODO: ADD SOCKET.IO FOR REALTIME MESSAGES

		res.status(201).json(newMessage);
	} catch (err) {
		console.log(`Error in the sendMessage controller! ${err.message}`);
		res.status(500).json({ message: "Internal server error!" });
	}
};
