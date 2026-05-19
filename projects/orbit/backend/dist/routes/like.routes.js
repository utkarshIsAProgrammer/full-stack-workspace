"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.likeRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const like_controllers_1 = require("../controllers/like.controllers");
const router = express_1.default.Router();
exports.likeRoutes = router;
router.post("/post/:postId", auth_middleware_1.protect, like_controllers_1.togglePostLikes);
router.post("/comment/:commentId", auth_middleware_1.protect, like_controllers_1.toggleCommentLikes);
//# sourceMappingURL=like.routes.js.map