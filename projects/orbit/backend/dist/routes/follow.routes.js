"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.followRoutes = void 0;
const express_1 = __importDefault(require("express"));
const follow_controllers_1 = require("../controllers/follow.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const router = express_1.default.Router();
exports.followRoutes = router;
router.post("/:userId", auth_middleware_1.protect, ratelimit_middleware_1.interactionLimiter, follow_controllers_1.toggleFollowUser);
router.get("/:userId/followers", follow_controllers_1.getFollowers);
router.get("/:userId/following", follow_controllers_1.getFollowing);
//# sourceMappingURL=follow.routes.js.map