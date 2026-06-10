import { motion, AnimatePresence } from "framer-motion";
import { XIcon } from "lucide-react";
import DecorativeShapes from "./DecorativeShapes";

function PinnedMessagesModal({ pinnedMessages, onClose }) {
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
            <h2>Pinned Messages</h2>
            <button onClick={onClose} className="modal-close-btn">
              <XIcon className="w-4 h-4" />
            </button>
          </div>

          <div className="modal-body">
            {pinnedMessages.length === 0 ? (
              <div className="empty-message">No pinned messages</div>
            ) : (
              pinnedMessages.map((msg) => (
                <div key={msg.id} className="pinned-message-item">
                  <img
                    src={msg.user.image}
                    alt={msg.user.name}
                    className="pinned-message-avatar"
                  />
                  <div className="pinned-message-content">
                    <div className="pinned-message-name">{msg.user.name}</div>
                    <div className="pinned-message-text">{msg.text}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default PinnedMessagesModal;
