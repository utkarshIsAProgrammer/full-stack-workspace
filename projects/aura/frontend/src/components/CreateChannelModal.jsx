import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router";
import { useChatContext } from "stream-chat-react";
import { motion } from "framer-motion";
import gsap from "gsap";
import * as Sentry from "@sentry/react";
import toast from "react-hot-toast";
import { AlertCircleIcon, HashIcon, LockIcon, UsersIcon, XIcon } from "lucide-react";
import DecorativeShapes from "./DecorativeShapes";

const modalOverlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

const modalCardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 10,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};

const CreateChannelModal = ({ onClose }) => {
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState("public");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [_, setSearchParams] = useSearchParams();
  const formRef = useRef(null);

  const { client, setActiveChannel } = useChatContext();

  useEffect(() => {
    const fetchUsers = async () => {
      if (!client?.user) return;
      setLoadingUsers(true);
      try {
        const response = await client.queryUsers(
          { id: { $ne: client.user.id } },
          { name: 1 },
          { limit: 100 }
        );
        const usersOnly = response.users.filter((user) => !user.id.startsWith("recording-"));
        setUsers(usersOnly || []);
      } catch (error) {
        console.log("Error fetching users");
        Sentry.captureException(error, {
          tags: { component: "CreateChannelModal" },
          extra: { context: "fetch_users_for_channel" },
        });
        setUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };
    fetchUsers();
  }, [client]);

  useEffect(() => {
    if (channelType === "public") setSelectedMembers(users.map((u) => u.id));
    else setSelectedMembers([]);
  }, [channelType, users]);

  // GSAP entrance
  useEffect(() => {
    if (formRef.current) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          formRef.current.querySelectorAll(".form-row, .form-group--full, .modal-footer"),
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power2.out", delay: 0.15 }
        );
      }, formRef);
      return () => ctx.revert();
    }
  }, []);

  const validateChannelName = (name) => {
    if (!name.trim()) return "Channel name is required";
    if (name.length < 3) return "Channel name must be at least 3 characters";
    if (name.length > 22) return "Channel name must be less than 22 characters";
    return "";
  };

  const handleChannelNameChange = (e) => {
    const value = e.target.value;
    setChannelName(value);
    setError(validateChannelName(value));
  };

  const handleMemberToggle = (id) => {
    if (selectedMembers.includes(id)) {
      setSelectedMembers(selectedMembers.filter((uid) => uid !== id));
    } else {
      setSelectedMembers([...selectedMembers, id]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validateChannelName(channelName);
    if (validationError) return setError(validationError);

    if (isCreating || !client?.user) return;

    setIsCreating(true);
    setError("");

    try {
      const channelId = channelName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "")
        .slice(0, 20);

      const channelData = {
        name: channelName.trim(),
        created_by_id: client.user.id,
        members: [client.user.id, ...selectedMembers],
      };

      if (description) channelData.description = description;

      if (channelType === "private") {
        channelData.private = true;
        channelData.visibility = "private";
      } else {
        channelData.visibility = "public";
        channelData.discoverable = true;
      }

      const channel = client.channel("messaging", channelId, channelData);
      await channel.watch();

      setActiveChannel(channel);
      setSearchParams({ channel: channelId });

      toast.success(`Channel "${channelName}" created successfully!`);
      onClose();
    } catch (error) {
      console.log("Error creating the channel", error);
      toast.error("Failed to create channel");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <motion.div
      className="modal-overlay"
      variants={modalOverlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="modal-card modal-card--create"
        variants={modalCardVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(e) => e.stopPropagation()}
      >
        <DecorativeShapes variant="modal" />
        <div className="modal-header">
          <h2>Create a channel</h2>
          <button onClick={onClose} className="modal-close-btn">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="modal-body" ref={formRef}>
          <form onSubmit={handleSubmit}>
            {error && (
              <motion.div
                className="form-error"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <AlertCircleIcon className="w-4 h-4" />
                <span>{error}</span>
              </motion.div>
            )}

            {/* ── Row: Channel Name + Channel Type ── */}
            <div className="form-row">
              {/* Channel name */}
              <div className="form-group form-group--half">
                <label className="form-label">Channel name</label>
                <div className="input-with-icon">
                  <HashIcon className="w-4 h-4 input-icon" />
                  <input
                    id="channelName"
                    type="text"
                    value={channelName}
                    onChange={handleChannelNameChange}
                    placeholder="e.g. marketing"
                    className={`form-input ${error ? "form-input--error" : ""}`}
                    autoFocus
                    maxLength={22}
                  />
                </div>
                {channelName && (
                  <div className="form-hint">
                    # {channelName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "")}
                  </div>
                )}
              </div>

              {/* Channel type */}
              <div className="form-group form-group--half">
                <label className="form-label">Channel type</label>
                <div className="channel-type-group">
                  <label
                    className={`channel-type-option ${channelType === "public" ? "channel-type-option--active" : ""}`}
                  >
                    <input
                      type="radio"
                      value="public"
                      checked={channelType === "public"}
                      onChange={(e) => setChannelType(e.target.value)}
                      className="channel-type-radio"
                    />
                    <HashIcon className="size-4" />
                    <div className="channel-type-label">Public</div>
                  </label>
                  <label
                    className={`channel-type-option ${channelType === "private" ? "channel-type-option--active" : ""}`}
                  >
                    <input
                      type="radio"
                      value="private"
                      checked={channelType === "private"}
                      onChange={(e) => setChannelType(e.target.value)}
                      className="channel-type-radio"
                    />
                    <LockIcon className="size-4" />
                    <div className="channel-type-label">Private</div>
                  </label>
                </div>
              </div>
            </div>

            {/* ── Description ── */}
            <div className="form-group form-group--full">
              <label className="form-label" htmlFor="description">
                Description <span className="form-label--optional">(optional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this channel about?"
                className="form-textarea form-textarea--compact"
                rows={2}
              />
            </div>

            {/* ── Members (private only) ── */}
            {channelType === "private" && (
              <div className="form-group form-group--full">
                <div className="member-selection-header">
                  <label className="form-label form-label--no-margin">
                    Add members
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => setSelectedMembers(users.map((u) => u.id))}
                    disabled={loadingUsers || users.length === 0}
                  >
                    <UsersIcon className="w-4 h-4" />
                    Select Everyone
                  </button>
                  <span className="selected-count">{selectedMembers.length} selected</span>
                </div>

                <div className="members-list">
                  {loadingUsers ? (
                    <p className="team-channel-list__message">Loading users...</p>
                  ) : users.length === 0 ? (
                    <p className="team-channel-list__message">No users found</p>
                  ) : (
                    users.map((user) => (
                      <label key={user.id} className="member-item">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(user.id)}
                          onChange={() => handleMemberToggle(user.id)}
                          className="member-checkbox"
                        />
                        {user.image ? (
                          <img src={user.image} alt={user.name || user.id} className="member-avatar" />
                        ) : (
                          <div className="member-avatar member-avatar-placeholder">
                            <span>{(user.name || user.id).charAt(0).toUpperCase()}</span>
                          </div>
                        )}
                        <span className="member-name">{user.name || user.id}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="modal-footer">
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!channelName.trim() || isCreating}
                className="btn btn-primary"
              >
                {isCreating ? "Creating..." : "Create Channel"}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CreateChannelModal;
