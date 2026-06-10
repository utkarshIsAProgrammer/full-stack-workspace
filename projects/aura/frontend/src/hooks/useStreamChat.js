import { useState, useEffect, useRef } from "react";
import { StreamChat } from "stream-chat";
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import * as Sentry from "@sentry/react";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

// this hook is used to connect the current user to the Stream Chat API
// so that users can see each other's messages, send messages to each other, get realtime updates, etc.
// it also handles the disconnection when the user leaves the page

export const useStreamChat = () => {
  const { user } = useUser();
  const [chatClient, setChatClient] = useState(null);
  const chatClientRef = useRef(null);

  // fetch stream token using react-query
  const {
    data: tokenData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!user?.id,
  });

  // init stream chat client
  useEffect(() => {
    if (!tokenData?.token || !user?.id || !STREAM_API_KEY) return;

    const client = StreamChat.getInstance(STREAM_API_KEY);
    chatClientRef.current = client;

    const connect = async () => {
      try {
        // Already connected as this user — nothing to do
        if (client.userID === user.id) {
          setChatClient(client);
          return;
        }

        await client.connectUser(
          {
            id: user.id,
            name:
              user.fullName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? user.id,
            image: user.imageUrl ?? undefined,
          },
          tokenData.token
        );
        setChatClient(client);
      } catch (error) {
        console.log("Error connecting to stream", error);
        Sentry.captureException(error, {
          tags: { component: "useStreamChat" },
          extra: {
            context: "stream_chat_connection",
            userId: user?.id,
            streamApiKey: STREAM_API_KEY ? "present" : "missing",
          },
        });
      }
    };

    connect();

    // NOTE: We deliberately do NOT disconnect in this effect's cleanup.
    // React strict mode double-invokes effects, and disconnectUser() on the
    // singleton StreamChat instance would break the subsequent effect run.
    // Disconnection is handled separately in the unmount-only effect below.
  }, [tokenData?.token, user?.id]);

  // cleanup: disconnect only on actual unmount
  useEffect(() => {
    return () => {
      if (chatClientRef.current) {
        chatClientRef.current.disconnectUser();
        chatClientRef.current = null;
      }
    };
  }, []);

  return { chatClient, isLoading, error };
};
