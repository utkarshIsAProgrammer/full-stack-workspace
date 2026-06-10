import { useEffect, useState } from "react";
import { useChatContext } from "stream-chat-react";
import { motion, AnimatePresence } from "framer-motion";
import { XIcon } from "lucide-react";
import DecorativeShapes from "./DecorativeShapes";

const InviteModal = ({ channel, onClose }) => {
  const { client } = useChatContext();

  const [users, setUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      setError("");

      try {
        const members = Object.keys(channel.state.members);
        const res = await client.queryUsers({ id: { $nin: members } }, { name: 1 }, { limit: 30 });
        setUsers(res.users);
      } catch (error) {
        console.log("Error fetching users", error);
        setError("Failed to load users");
      } finally {
        setIsLoadingUsers(false);
      }
    };

    fetchUsers();
  }, [channel, client]);

  const handleInvite = async () => {
    if (selectedMembers.length === 0) return;

    setIsInviting(true);
    setError("");

    try {
      await channel.addMembers(selectedMembers);
      onClose();
    } catch (error) {
      setError("Failed to invite users");
      console.log("Error inviting users:", error);
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >          <motion.div
          className="modal-card"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          onClick={(e) => e.stopPropagation()}
        >
          <DecorativeShapes variant="modal" />
          <div className="modal-header">
            <h2>Invite Users</h2>
            <button onClick={onClose} className="modal-close-btn">
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="modal-body">
            {isLoadingUsers && (
              <p className="team-channel-list__message">Loading users...</p>
            )}
            {error && <p className="form-error">{error}</p>}
            {users.length === 0 && !isLoadingUsers && (
              <p className="team-channel-list__message">No users found</p>
            )}

            {users.length > 0 &&
              users.map((user) => {
                const isChecked = selectedMembers.includes(user.id);

                return (
                  <label
                    key={user.id}
                    className={`invite-user-item ${
                      isChecked ? "invite-user-item--selected" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="member-checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked)
                          setSelectedMembers([...selectedMembers, user.id]);
                        else
                          setSelectedMembers(
                            selectedMembers.filter((id) => id !== user.id)
                          );
                      }}
                    />

                    {user.image ? (
                      <img
                        src={user.image}
                        alt={user.name}
                        className="member-avatar"
                      />
                    ) : (
                      <div className="member-avatar member-avatar-placeholder">
                        <span>{(user.name || user.id).charAt(0).toUpperCase()}</span>
                      </div>
                    )}

                    <span className="member-name">{user.name || user.id}</span>
                  </label>
                );
              })}
          </div>

          <div className="modal-footer">
            <button
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isInviting}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleInvite}
              disabled={!selectedMembers.length || isInviting}
            >
              {isInviting ? "Inviting..." : "Invite"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InviteModal;
