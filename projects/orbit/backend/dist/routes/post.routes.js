"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postRoutes = void 0;
const express_1 = __importDefault(require("express"));
const post_controllers_1 = require("../controllers/post.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const view_middleware_1 = require("../middlewares/view.middleware");
const upload_middleware_1 = __importDefault(require("../middlewares/upload.middleware"));
const router = express_1.default.Router();
exports.postRoutes = router;
router.get("/:postId", post_controllers_1.getPost);
router.get("/", post_controllers_1.getAllPosts);
router.post("/", auth_middleware_1.protect, upload_middleware_1.default.single("image"), post_controllers_1.createPost);
router.put("/:postId", auth_middleware_1.protect, upload_middleware_1.default.single("image"), post_controllers_1.updatePost);
router.delete("/:postId", auth_middleware_1.protect, post_controllers_1.deletePost);
router.post("/:postId/view", view_middleware_1.protectViews, post_controllers_1.viewsCount);
router.post("/:postId/share", auth_middleware_1.protect, post_controllers_1.sharePost);
//# sourceMappingURL=post.routes.js.map