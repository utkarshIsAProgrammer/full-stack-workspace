"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cookieOptions = void 0;
const env_1 = require("./env");
exports.cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: env_1.env.NODE_ENV === "production" ? "none" : "lax",
};
//# sourceMappingURL=cookie.js.map