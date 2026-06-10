"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
const redis_1 = require("@upstash/redis");
const env_1 = require("./env");
exports.redis = new redis_1.Redis({
    url: env_1.env.UPSTASH_REDIS_REST_URL,
    token: env_1.env.UPSTASH_REDIS_REST_TOKEN,
});
//# sourceMappingURL=redis.js.map