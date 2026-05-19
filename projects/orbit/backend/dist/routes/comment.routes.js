"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commentRoutes = void 0;
const express_1 = __importDefault(require("express"));
const comment_controllers_1 = require("../controllers/comment.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = express_1.default.Router();
exports.commentRoutes = router;
router.get("/:postId", comment_controllers_1.getComment);
router.post("/:postId", auth_middleware_1.protect, comment_controllers_1.addComment);
router.put("/:commentId", auth_middleware_1.protect, comment_controllers_1.updateComment);
router.delete("/:commentId", auth_middleware_1.protect, comment_controllers_1.deleteComment);
//# sourceMappingURL=comment.routes.js.map