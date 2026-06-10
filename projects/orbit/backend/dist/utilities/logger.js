"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const log = (level, message, meta = {}) => {
    const logData = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
    };
    if (level === "error") {
        console.error(JSON.stringify(logData));
    }
    else if (level === "warn") {
        console.warn(JSON.stringify(logData));
    }
    else {
        console.log(JSON.stringify(logData));
    }
};
exports.logger = {
    debug: (message, meta) => log("debug", message, meta),
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),
};
//# sourceMappingURL=logger.js.map