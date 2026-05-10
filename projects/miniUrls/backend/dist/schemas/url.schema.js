"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.urlSchema = void 0;
const zod_1 = require("zod");
// validation schema for urls
exports.urlSchema = zod_1.z.object({
    originalUrl: zod_1.z
        .preprocess((val) => {
        if (typeof val !== "string")
            return val;
        let url = val.trim();
        if (url.length === 0)
            return url;
        // add https:// if no protocol is present
        if (!/^https?:\/\//i.test(url)) {
            return `https://${url}`;
        }
        return url;
    }, zod_1.z.string().min(1, "URL is required!").url("Must be a valid URL!"))
        .transform((val) => val.trim()),
});
//# sourceMappingURL=url.schema.js.map