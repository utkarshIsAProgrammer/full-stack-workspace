import { UserButton } from "@clerk/clerk-react";
import { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { useStreamChat } from "../hooks/useStreamChat";
import PageLoader from "../components/PageLoader";
import DecorativeShapes from "../components/DecorativeShapes";

import {
  Chat,
  Channel,
  ChannelList,
  MessageList,
  MessageComposer,
  Thread,
  Window,
} from "stream-chat-react";

import "../styles/stream-chat-theme.css";
import { HashIcon, PlusIcon, UsersIcon } from "lucide-react";
import CreateChannelModal from "../components/CreateChannelModal";
import CustomChannelPreview from "../components/CustomChannelPreview";
import UsersList from "../components/UsersList";
import CustomChannelHeader from "../components/CustomChannelHeader";

const sidebarVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
  },
};

const HomePage = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const containerRef = useRef(null);

  const { chatClient, error, isLoading } = useStreamChat();

  // set active channel from URL params
  useEffect(() => {
    if (chatClient) {
      const channelId = searchParams.get("channel");
      if (channelId) {
        const channel = chatClient.channel("messaging", channelId);
        setActiveChannel(channel);
      }
    }
  }, [chatClient, searchParams]);

  // GSAP entrance animation
  useEffect(() => {
    if (containerRef.current && !isLoading && chatClient) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          containerRef.current,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }
        );
      }, containerRef);
      return () => ctx.revert();
    }
  }, [isLoading, chatClient]);

  if (error) return <p>Something went wrong...</p>;
  if (isLoading || !chatClient) return <PageLoader />;

  return (
    <motion.div
      className="chat-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      ref={containerRef}
    >
      <div className="absolute inset-0 z-0 pointer-events-none">
        <DecorativeShapes variant="chat" />
      </div>
      <div className="chat-container">
        <Chat client={chatClient}>
          {/* LEFT SIDEBAR */}
          <motion.div
            className="str-chat__channel-list"
            variants={sidebarVariants}
            initial="hidden"
            animate="visible"
          >
            <div className="team-channel-list">
              {/* HEADER */}
              <div className="team-channel-list__header">
                <Link to="/" className="brand-container">
                  <img src="/logo.png" alt="Aura" className="brand-logo" />
                  <span className="brand-name">Aura</span>
                </Link>
                <div className="user-button-wrapper">
                  <UserButton />
                </div>
              </div>

              {/* CHANNELS LIST */}
              <div className="team-channel-list__content">
                <div className="create-channel-section">
                  <motion.button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="create-channel-btn"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <PlusIcon className="size-4" />
                    <span>Create Channel</span>
                  </motion.button>
                </div>

                {/* CHANNEL LIST */}
                <ChannelList
                  filters={{ members: { $in: [chatClient?.user?.id] } }}
                  options={{ state: true, watch: true }}
                  renderChannels={(channels) => (
                    <div className="channel-sections">
                      <div className="section-header">
                        <div className="section-title">
                          <HashIcon className="size-3" />
                          <span>Channels</span>
                        </div>
                      </div>

                      <div className="channels-list">
                        <AnimatePresence mode="popLayout">
                          {channels.map((channel, i) => (
                            <motion.div
                              key={channel.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03, duration: 0.3 }}
                            >
                              <CustomChannelPreview
                                channel={channel}
                                activeChannel={activeChannel}
                                setActiveChannel={(channel) =>
                                  setSearchParams({ channel: channel.id })
                                }
                              />
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>

                      <div className="section-header direct-messages">
                        <div className="section-title">
                          <UsersIcon className="size-3" />
                          <span>Direct Messages</span>
                        </div>
                      </div>

                      <UsersList activeChannel={activeChannel} />
                    </div>
                  )}
                />
              </div>
            </div>
          </motion.div>

          {/* RIGHT CONTAINER */}
          <div className="chat-main">
            <Channel channel={activeChannel}>
              <Window>
                <CustomChannelHeader />
                <MessageList />
                <MessageComposer />
              </Window>

              <Thread />
            </Channel>
          </div>
        </Chat>

        <AnimatePresence>
          {isCreateModalOpen && (
            <CreateChannelModal onClose={() => setIsCreateModalOpen(false)} />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default HomePage;
