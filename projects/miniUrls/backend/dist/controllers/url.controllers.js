"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleRedirect = exports.createShortenUrl = void 0;
const nanoid_1 = require("nanoid");
const url_model_1 = __importDefault(require("../models/url.model"));
const url_schema_1 = require("../schemas/url.schema");
// get base url from env
const BASE_URL = process.env.BASE_URL;
// create a shortened url
const createShortenUrl = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const result = url_schema_1.urlSchema.safeParse(req.body);
    // validation check
    if (!result.success) {
        return res.status(400).json({
            success: false,
            message: "Invalid data!",
            error: result.error.issues,
        });
    }
    const { originalUrl } = result.data;
    // return existing if already shortened
    const existing = yield url_model_1.default.findOne({ originalUrl });
    if (existing) {
        return res.status(200).json({
            success: true,
            shortCode: existing.shortCode,
            shortUrl: `${BASE_URL}/${existing.shortCode}`,
            message: "URL already shortened!",
        });
    }
    // generate unique short code
    let shortCode = "";
    let isUnique = false;
    while (!isUnique) {
        shortCode = (0, nanoid_1.nanoid)(7);
        const exists = yield url_model_1.default.findOne({ shortCode });
        if (!exists)
            isUnique = true;
    }
    // save to database
    const newUrl = yield url_model_1.default.create({ originalUrl, shortCode });
    res.status(201).json({
        success: true,
        shortCode: newUrl.shortCode,
        shortUrl: `${BASE_URL}/${newUrl.shortCode}`,
        message: "URL shortened successfully!",
    });
});
exports.createShortenUrl = createShortenUrl;
// handle redirection to original url
const handleRedirect = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { code } = req.params;
    // validate input
    if (!code || typeof code !== "string") {
        return res.status(400).json({
            success: false,
            message: "Invalid or missing short code!",
        });
    }
    try {
        // find url in db
        const urlEntry = yield url_model_1.default.findOne({ shortCode: code });
        if (!urlEntry) {
            return res.status(404).json({
                success: false,
                message: "Link not found!",
            });
        }
        // redirect to original url
        return res.redirect(302, urlEntry.originalUrl);
    }
    catch (err) {
        console.error(`Redirect error: ${err.message}`);
        res.status(500).json({
            success: false,
            message: "Internal server error!",
        });
    }
});
exports.handleRedirect = handleRedirect;
//# sourceMappingURL=url.controllers.js.map