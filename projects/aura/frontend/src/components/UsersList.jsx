import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useSearchParams } from "react-router";
import { useChatContext } from "stream-chat-react";

import * as Sentry from "@sentry/react";
import { CircleIcon } from "lucide-react";

const UsersList = ({ activeChannel }) => {
  const { client } = useChatContext();
  const [_, setSearchParams] = useSearchParams();

  const fetchUsers = useCallback(async () => {
    if (!client?.user) return;

    const response = await client.queryUsers(
      { id: { $ne: client.user.id } },
      { name: 1 },
      { limit: 20 }
    );

    const usersOnly = response.users.filter((user) => !user.id.startsWith("recording-"));

    return usersOnly;
  }, [client]);

  const {
    data: users = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["users-list", client?.user?.id],
    queryFn: fetchUsers,
    enabled: !!client?.user,
    staleTime: 1000 * 60 * 5,
  });

  const startDirectMessage = async (targetUser) => {
    if (!targetUser || !client?.user) return;

    try {
      const channelId = [client.user.id, targetUser.id].sort().join("-").slice(0, 64);
      const channel = client.channel("messaging", channelId, {
        members: [client.user.id, targetUser.id],
      });
      await channel.watch();
      setSearchParams({ channel: channel.id });
    } catch (error) {
      console.log("Error creating DM", error),
        Sentry.captureException(error, {
          tags: { component: "UsersList" },
          extra: {
            context: "create_direct_message",
            targetUserId: targetUser?.id,
          },
        });
    }
  };

  if (isLoading) return <div className="team-channel-list__message">Loading users...</div>;
  if (isError) return <div className="team-channel-list__message">Failed to load users</div>;
  if (!users.length) return <div className="team-channel-list__message">No other users found</div>;

  return (
    <div className="team-channel-list__users">
      {users.map((user) => {
        const channelId = [client.user.id, user.id].sort().join("-").slice(0, 64);
        const channel = client.channel("messaging", channelId, {
          members: [client.user.id, user.id],
        });
        const unreadCount = channel.countUnread();
        const isActive = activeChannel && activeChannel.id === channelId;

        return (
          <button
            key={user.id}
            onClick={() => startDirectMessage(user)}
            className={`str-chat__channel-preview-messenger ${
              isActive ? "str-chat__channel-preview-messenger--active" : ""
            }`}
          >
            <div className="flex items-center gap-2 w-full min-w-0">
              <div className="relative shrink-0">
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || user.id}
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-[var(--aura-accent)] flex items-center justify-center">
                    <span className="text-[0.6rem] text-white font-semibold">
                      {(user.name || user.id).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}

                {user.online && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--aura-success)] border-2 border-[var(--aura-sidebar)]" />
                )}
              </div>

              <span className="str-chat__channel-preview-messenger-name truncate">
                {user.name || user.id}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default UsersList;
