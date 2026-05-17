"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = __importDefault(require("express"));
const user_controllers_1 = require("../controllers/user.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = express_1.default.Router();
exports.userRoutes = router;
router.get("/", user_controllers_1.getAll);
router.delete("/delete-account/", auth_middleware_1.protect, user_controllers_1.deleteAccount);
router.post("/:userId/share", auth_middleware_1.protect, user_controllers_1.shareProfile);
//# sourceMappingURL=user.routes.js.map