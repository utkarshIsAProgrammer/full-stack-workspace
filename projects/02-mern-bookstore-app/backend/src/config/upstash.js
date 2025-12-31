import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import "dotenv/config";

// rate limit to 100 requests in 60 seconds
const rateLimit = new Ratelimit({
	redis: Redis.fromEnv(),
	limiter: Ratelimit.slidingWindow(100, "60 s"),
});

export default rateLimit;
