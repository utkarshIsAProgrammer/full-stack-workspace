import { StreamChat } from "stream-chat";

const streamApiKey = process.env.STREAM_API;
const streamSecret = process.env.STREAM_SECRET;

if (!streamApiKey || !streamSecret) {
	console.log(`Stream API key or Secret is missing!`);
}

const streamClient = StreamChat.getInstance(streamApiKey, streamSecret);

export const upsertStreamUser = async (userData) => {
	try {
		await streamClient.upsertUsers([userData]);
		return userData;
	} catch (err) {
		console.log(`Error upserting stream user! ${err.message}`);
	}
};

// TODO: do it later

export const generateStreamToken = async (userId) => {};
