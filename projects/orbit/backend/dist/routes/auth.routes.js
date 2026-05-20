"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auth_controllers_1 = require("../controllers/auth.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const ratelimit_middleware_1 = require("../middlewares/ratelimit.middleware");
const upload_middleware_1 = __importDefault(require("../middlewares/upload.middleware"));
const router = express_1.default.Router();
exports.authRoutes = router;
router.post("/signup", ratelimit_middleware_1.authLimiter, upload_middleware_1.default.single("profilePic"), auth_controllers_1.signup);
router.post("/login", ratelimit_middleware_1.authLimiter, auth_controllers_1.login);
router.post("/logout", auth_middleware_1.protect, auth_controllers_1.logout);
//# sourceMappingURL=auth.routes.js.map