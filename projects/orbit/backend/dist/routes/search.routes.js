"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchRoutes = void 0;
const express_1 = __importDefault(require("express"));
const search_controllers_1 = require("../controllers/search.controllers");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = express_1.default.Router();
exports.searchRoutes = router;
router.get("/users", auth_middleware_1.protect, search_controllers_1.searchUsers);
router.get("/posts", auth_middleware_1.protect, search_controllers_1.searchPosts);
//# sourceMappingURL=search.routes.js.map