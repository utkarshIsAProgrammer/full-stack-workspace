"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_controllers_1 = require("../controllers/user.controllers");
const upload_middleware_1 = __importDefault(require("../middlewares/upload.middleware"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const view_middleware_1 = require("../middlewares/view.middleware");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const router = express_1.default.Router();
exports.userRoutes = router;
router.get("/", user_controllers_1.getAll);
router.delete("/delete-account/", auth_middleware_1.protect, user_controllers_1.deleteAccount);
router.post("/:userId/share", auth_middleware_1.protect, ratelimit_middleware_1.interactionLimiter, user_controllers_1.shareProfile);
router.post("/:userId/view", view_middleware_1.protectViews, ratelimit_middleware_1.interactionLimiter, user_controllers_1.viewsCount);
router.put("/update-profile", auth_middleware_1.protect, upload_middleware_1.default.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "bannerImage", maxCount: 1 },
]), user_controllers_1.updateProfile);
//# sourceMappingURL=user.routes.js.map