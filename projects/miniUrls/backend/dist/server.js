"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
require("dotenv/config");
const db_1 = require("./db/db");
const url_routes_1 = require("./routes/url.routes");
const app = (0, express_1.default)();
const port = process.env.PORT || 3000;
// middleware
app.use((0, helmet_1.default)()); // security headers
app.use((0, cors_1.default)()); // enable cors
app.use(express_1.default.json()); // parse json bodies
// routes
app.use("", url_routes_1.urlRoutes);
// start server
(0, db_1.connectDB)().then(() => {
    app.listen(port, () => {
        console.log(`Server is running on PORT: ${port}`);
    });
});
//# sourceMappingURL=server.js.map