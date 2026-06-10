"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizePlainText = exports.sanitize = void 0;
const sanitize_html_1 = __importDefault(require("sanitize-html"));
const sanitize = (html) => {
    return (0, sanitize_html_1.default)(html, {
        allowedTags: ["b", "i", "em", "strong", "a", "br", "p"],
        allowedAttributes: {
            a: ["href"],
        },
    });
};
exports.sanitize = sanitize;
const sanitizePlainText = (text) => {
    return (0, sanitize_html_1.default)(text, {
        allowedTags: [],
        allowedAttributes: {},
    });
};
exports.sanitizePlainText = sanitizePlainText;
//# sourceMappingURL=sanitize.js.map