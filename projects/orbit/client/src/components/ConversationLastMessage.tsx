import type { Message, Conversation } from "../types";

interface ConversationLastMessageProps {
	lastMessage?: Message | null;
	lastAction?: Conversation["lastAction"];
	currentUserId?: string;
}

/**
 * Human-readable label for a message's attachment so the conversation list
 * never says a generic "sent attachment" — it always names the type:
 * "sent a photo", "sent a video", "sent a voice note", "sent a document", etc.
 */
const getAttachmentLabel = (message: Message): string => {
	const att = message.attachments?.[0];
	if (!att) return "sent an attachment";		switch (att.type) {
		case "image":
			return "sent a photo";
		case "gif":
			return "sent a GIF";
		case "video":
			return "sent a video";
		case "voice_note":
			return "sent a voice note";
		case "file":
			return "sent a document";
		default:
			return "sent an attachment";
	}
};

export default function ConversationLastMessage({
	lastMessage,
	lastAction,
	currentUserId,
}: ConversationLastMessageProps) {
	if (lastMessage?.isDeleted) {
		return <span className="italic">deleted message</span>;
	}

	// The last interaction may be an ACTION (e.g. a reaction) rather than a
	// message. Show it when it is newer than the last message so the chat list
	// reflects the most recent thing that actually happened.
	const actionAt = lastAction?.createdAt
		? new Date(lastAction.createdAt).getTime()
		: null;
	const messageAt = lastMessage?.createdAt
		? new Date(lastMessage.createdAt).getTime()
		: null;
	const actionIsNewer =
		!!lastAction &&
		(actionAt !== null && messageAt !== null
			? actionAt >= messageAt
			: actionAt !== null);

	if (actionIsNewer && lastAction?.type === "reaction") {
		const actorId = lastAction.actor?._id;
		const isMyAction = !!currentUserId && actorId === currentUserId;
		const isMyMessage =
			!!currentUserId && lastAction.messageSenderId === currentUserId;
		const actorName =
			lastAction.actor?.fullName?.split(" ")[0] ||
			lastAction.actor?.username ||
			"Someone";

		if (isMyAction) {
			return (
				<span className="font-semibold text-zinc-300">
					You reacted {lastAction.emoji}
				</span>
			);
		}
		if (isMyMessage) {
			return (
				<span className="font-semibold text-zinc-300">
					{actorName} reacted {lastAction.emoji} to your message
				</span>
			);
		}
		return (
			<span className="font-semibold text-zinc-300">
				{actorName} reacted {lastAction.emoji}
			</span>
		);
	}

	if (lastMessage?.text) {
		return (
			<>
				{lastMessage.text}
				{lastMessage?.isEdited && (
					<span className="text-[10px] text-zinc-500 italic ml-1">
						(edited)
					</span>
				)}
			</>
		);
	}

	if (lastMessage?.attachments && lastMessage.attachments.length > 0) {
		return (
			<span className="font-semibold text-zinc-300">
				{getAttachmentLabel(lastMessage)}
			</span>
		);
	}

	return (
		<span className="italic">
			Start a conversation
		</span>
	);
}
