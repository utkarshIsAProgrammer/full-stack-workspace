import { Trash2 } from "lucide-react";
import UserAvatar from "./UserAvatar";
import ConversationLastMessage from "./ConversationLastMessage";
import type { User as UserType, Conversation } from "../types";

interface ConversationListItemProps {
	conv: Conversation;
	user: UserType;
	onSelect: () => void;
	onDelete: (e: React.MouseEvent) => void;
	formatMessageTime: (iso: string) => string;
}

export default function ConversationListItem({
	conv,
	user,
	onSelect,
	onDelete,
	formatMessageTime,
}: ConversationListItemProps) {
	const partner =
		conv.participants.find((p) => p && p._id !== user._id) || user;
	const presence: "online" | "offline" = conv.presence || "offline";
	const unread = conv.unreadCounts?.[user._id] || 0;

	return (
		<div
			onClick={onSelect}
			className="flex items-center gap-3 rounded-2xl p-2.5 cursor-pointer transition-all border hover:bg-zinc-900/30 text-zinc-300 border-transparent"
		>
			<div className="relative shrink-0">
				<UserAvatar
					src={partner.profilePic?.url}
					alt={partner.fullName}
					className="h-9 w-9 rounded-full object-cover border border-zinc-800"
				/>
				{presence === "online" && (
					<span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-zinc-950 shadow-md" />
				)}
			</div>

			<div className="flex-1 min-w-0 text-left">
				<div className="flex justify-between items-start gap-1">
					<span className="text-[12px] font-black leading-tight truncate text-zinc-100 uppercase tracking-wide">
						{partner.fullName}
					</span>
					{conv.lastMessage && (
						<span className="text-[8.5px] font-mono text-zinc-500 shrink-0 mt-0.5">
							{formatMessageTime(conv.lastMessage.createdAt)}
						</span>
					)}
				</div>
				<div className="flex justify-between items-center gap-2 mt-1">
					<p className="text-[11px] truncate leading-tight flex-1 text-zinc-400">
						<ConversationLastMessage lastMessage={conv.lastMessage} />
					</p>
					{unread > 0 && (
						<span className="h-4.5 min-w-4.5 px-1 rounded-full bg-white text-[9px] font-extrabold text-black flex items-center justify-center shadow-sm border border-zinc-200 shrink-0">
							{unread}
						</span>
					)}
					<button
						onClick={onDelete}
						className="h-6 w-6 rounded-full flex items-center justify-center text-zinc-500 hover:text-red-450 hover:bg-white/5 transition-all cursor-pointer shrink-0 ml-1"
						title="Delete Conversation"
					>
						<Trash2 className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
}
