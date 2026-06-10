import { HashIcon } from "lucide-react";

const CustomChannelPreview = ({ channel, setActiveChannel, activeChannel }) => {
  const isActive = activeChannel && activeChannel.id === channel.id;
  const isDM = channel.data.member_count === 2 && channel.data.id.includes("user_");

  if (isDM) return null;

  const unreadCount = channel.countUnread();

  return (
    <button
      onClick={() => setActiveChannel(channel)}
      className={`str-chat__channel-preview-messenger ${
        isActive ? "str-chat__channel-preview-messenger--active" : ""
      }`}
    >
      <HashIcon className="w-4 h-4 mr-2 shrink-0 opacity-60" />
      <span className="str-chat__channel-preview-messenger-name">
        {channel.data.name || channel.data.id}
      </span>

      {unreadCount > 0 && (
        <span className="flex items-center justify-center ml-auto size-5 text-[0.65rem] font-semibold rounded-full bg-[var(--aura-accent)] text-white shrink-0">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default CustomChannelPreview;
