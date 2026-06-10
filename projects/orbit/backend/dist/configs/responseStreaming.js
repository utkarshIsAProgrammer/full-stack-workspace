"use strict";
/**
 * Response Streaming for Large Datasets
 *
 * This utility provides response streaming capabilities for large datasets
 * to reduce memory usage and improve response times.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.filterStream = exports.transformStream = exports.streamMongoCursor = exports.BatchProcessor = exports.CursorPagination = exports.streamCsvResponse = exports.streamJsonResponse = void 0;
/**
 * Stream JSON response
 */
const streamJsonResponse = (res, dataGenerator, filename) => {
    res.setHeader('Content-Type', 'application/json');
    if (filename) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    res.write('[');
    let isFirst = true;
    const processStream = async () => {
        try {
            for await (const item of dataGenerator) {
                if (!isFirst) {
                    res.write(',');
                }
                res.write(JSON.stringify(item));
                isFirst = false;
            }
            res.write(']');
            res.end();
        }
        catch (error) {
            console.error('Stream error:', error);
            res.write(']');
            res.end();
        }
    };
    processStream();
};
exports.streamJsonResponse = streamJsonResponse;
/**
 * Stream CSV response
 */
const streamCsvResponse = (res, dataGenerator, headers, filename) => {
    res.setHeader('Content-Type', 'text/csv');
    if (filename) {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
    // Write headers
    res.write(headers.join(',') + '\n');
    const processStream = async () => {
        try {
            for await (const item of dataGenerator) {
                const row = headers.map((header) => {
                    const value = item[header];
                    // Escape quotes and wrap in quotes if contains comma
                    const stringValue = String(value || '');
                    if (stringValue.includes(',') || stringValue.includes('"')) {
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                });
                res.write(row.join(',') + '\n');
            }
            res.end();
        }
        catch (error) {
            console.error('CSV stream error:', error);
            res.end();
        }
    };
    processStream();
};
exports.streamCsvResponse = streamCsvResponse;
/**
 * Create cursor-based pagination for large datasets
 */
class CursorPagination {
    constructor(limit = 50) {
        this.cursor = null;
        this.data = [];
        this.limit = limit;
    }
    /**
     * Set cursor
     */
    setCursor(cursor) {
        this.cursor = cursor;
        return this;
    }
    /**
     * Set limit
     */
    setLimit(limit) {
        this.limit = limit;
        return this;
    }
    /**
     * Set data
     */
    setData(data) {
        this.data = data;
        return this;
    }
    /**
     * Get next cursor
     */
    getNextCursor() {
        if (this.data.length < this.limit) {
            return null;
        }
        const lastItem = this.data[this.data.length - 1];
        return Buffer.from(JSON.stringify(lastItem)).toString('base64');
    }
    /**
     * Get paginated response
     */
    getResponse() {
        return {
            data: this.data,
            nextCursor: this.getNextCursor(),
            hasMore: this.data.length >= this.limit,
        };
    }
    /**
     * Parse cursor
     */
    static parseCursor(cursor) {
        try {
            return JSON.parse(Buffer.from(cursor, 'base64').toString());
        }
        catch (error) {
            return null;
        }
    }
}
exports.CursorPagination = CursorPagination;
/**
 * Batch processor for large datasets
 */
class BatchProcessor {
    constructor(batchSize, processor) {
        this.batchSize = batchSize;
        this.processor = processor;
    }
    /**
     * Process items in batches
     */
    async *process(items) {
        for (let i = 0; i < items.length; i += this.batchSize) {
            const batch = items.slice(i, i + this.batchSize);
            const results = await this.processor(batch);
            for (const result of results) {
                yield result;
            }
        }
    }
}
exports.BatchProcessor = BatchProcessor;
/**
 * Memory-efficient data stream from MongoDB cursor
 */
const streamMongoCursor = async function* (cursor) {
    try {
        for await (const doc of cursor) {
            yield doc;
        }
    }
    catch (error) {
        console.error('MongoDB cursor stream error:', error);
        throw error;
    }
};
exports.streamMongoCursor = streamMongoCursor;
/**
 * Transform stream
 */
const transformStream = async function* (stream, transformer) {
    try {
        for await (const item of stream) {
            const transformed = await transformer(item);
            yield transformed;
        }
    }
    catch (error) {
        console.error('Transform stream error:', error);
        throw error;
    }
};
exports.transformStream = transformStream;
/**
 * Filter stream
 */
const filterStream = async function* (stream, filter) {
    try {
        for await (const item of stream) {
            const shouldInclude = await filter(item);
            if (shouldInclude) {
                yield item;
            }
        }
    }
    catch (error) {
        console.error('Filter stream error:', error);
        throw error;
    }
};
exports.filterStream = filterStream;
//# sourceMappingURL=responseStreaming.js.map