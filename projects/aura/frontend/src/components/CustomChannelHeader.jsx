import { HashIcon, LockIcon, UsersIcon, PinIcon, VideoIcon } from "lucide-react";
import { useChannelStateContext } from "stream-chat-react";
import { useState } from "react";
import { motion } from "framer-motion";
import { useUser } from "@clerk/clerk-react";
import MembersModal from "./MembersModal";
import PinnedMessagesModal from "./PinnedMessagesModal";
import InviteModal from "./InviteModal";

const CustomChannelHeader = () => {
  const { channel } = useChannelStateContext();
  const { user } = useUser();

  const memberCount = Object.keys(channel.state.members).length;

  const [showInvite, setShowInvite] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);

  const otherUser = Object.values(channel.state.members).find(
    (member) => member.user.id !== user.id
  );

  const isDM = channel.data?.member_count === 2 && channel.data?.id.includes("user_");

  const handleShowPinned = async () => {
    const channelState = await channel.query();
    setPinnedMessages(channelState.pinned_messages);
    setShowPinnedMessages(true);
  };

  const handleVideoCall = async () => {
    if (channel) {
      const callUrl = `${window.location.origin}/call/${channel.id}`;
      await channel.sendMessage({
        text: `I've started a video call. Join me here: ${callUrl}`,
      });
    }
  };

  return (
    <>
      <div className="channel-header">
        <div className="channel-header-left">
          {isDM && otherUser?.user?.image && (
            <img
              src={otherUser.user.image}
              alt={otherUser.user.name || otherUser.user.id}
              className="w-7 h-7 rounded-full object-cover"
            />
          )}
          {channel.data?.private ? (
            <LockIcon className="channel-header-btn-icon text-[var(--aura-text-secondary)]" />
          ) : (
            <HashIcon className="channel-header-btn-icon text-[var(--aura-text-secondary)]" />
          )}
          <span className="channel-header-name">
            {isDM
              ? otherUser?.user?.name || otherUser?.user?.id
              : channel.data?.name || channel.data?.id}
          </span>
        </div>

        <div className="channel-header-right">
          <motion.button
            className="channel-header-btn"
            onClick={() => setShowMembers(true)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <UsersIcon className="channel-header-btn-icon" />
            <span>{memberCount}</span>
          </motion.button>

          <motion.button
            className="channel-header-btn"
            onClick={handleVideoCall}
            title="Start Video Call"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <VideoIcon className="channel-header-btn-icon" style={{ color: "var(--aura-accent)" }} />
          </motion.button>

          {channel.data?.private && (
            <motion.button
              className="channel-header-invite-btn"
              onClick={() => setShowInvite(true)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              Invite
            </motion.button>
          )}

          <motion.button
            className="channel-header-btn"
            onClick={handleShowPinned}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <PinIcon className="channel-header-btn-icon" />
          </motion.button>
        </div>
      </div>

      {showMembers && (
        <MembersModal
          members={Object.values(channel.state.members)}
          onClose={() => setShowMembers(false)}
        />
      )}

      {showPinnedMessages && (
        <PinnedMessagesModal
          pinnedMessages={pinnedMessages}
          onClose={() => setShowPinnedMessages(false)}
        />
      )}

      {showInvite && <InviteModal channel={channel} onClose={() => setShowInvite(false)} />}
    </>
  );
};

export default CustomChannelHeader;
