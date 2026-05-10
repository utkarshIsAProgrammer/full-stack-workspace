"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlRoutes = void 0;
const express_1 = require("express");
const url_controllers_1 = require("../controllers/url.controllers");
const router = (0, express_1.Router)();
exports.urlRoutes = router;
// route for redirecting and shortening
router.get("/:code", url_controllers_1.handleRedirect);
router.post("/url/shorten", url_controllers_1.createShortenUrl);
//# sourceMappingURL=url.routes.js.map