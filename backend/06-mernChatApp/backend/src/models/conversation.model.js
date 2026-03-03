import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
	{
		// user id in the participants array
		participants: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "User",
			},
		],

		// message id in the messages array
		messages: [
			{
				type: mongoose.Schema.Types.ObjectId,
				ref: "Message",
				default: [],
			},
		],
	},

	{ timestamps: true },
);

const Conversation = mongoose.model("Conversation", conversationSchema);
export default Conversation;
