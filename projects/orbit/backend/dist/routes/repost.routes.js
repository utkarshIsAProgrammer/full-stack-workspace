"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.repostRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const repost_controllers_1 = require("../controllers/repost.controllers");
const router = express_1.default.Router();
exports.repostRoutes = router;
router.post("/:postId", auth_middleware_1.protect, repost_controllers_1.toggleRepost);
//# sourceMappingURL=repost.routes.js.map