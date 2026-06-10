import { motion, AnimatePresence } from "framer-motion";
import { XIcon } from "lucide-react";
import DecorativeShapes from "./DecorativeShapes";

function MembersModal({ members, onClose }) {
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
            <h2>Channel Members</h2>
            <button onClick={onClose} className="modal-close-btn">
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="modal-body">
            {members.map((member) => (
              <div key={member.user.id} className="modal-member-item">
                {member.user?.image ? (
                  <img
                    src={member.user.image}
                    alt={member.user.name}
                    className="modal-member-avatar"
                  />
                ) : (
                  <div className="modal-member-avatar-placeholder">
                    <span>
                      {(member.user.name || member.user.id).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="modal-member-name">
                  {member.user.name || member.user.id}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default MembersModal;
