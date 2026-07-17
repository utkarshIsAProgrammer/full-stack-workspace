import type { Message } from "../types";

interface ConversationLastMessageProps {
	lastMessage?: Message | null;
}

export default function ConversationLastMessage({
	lastMessage,
}: ConversationLastMessageProps) {
	if (lastMessage?.isDeleted) {
		return (
			<span className="italic">
				deleted message
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
				sent attachment
			</span>
		);
	}

	return (
		<span className="italic">
			Start a conversation
		</span>
	);
}
