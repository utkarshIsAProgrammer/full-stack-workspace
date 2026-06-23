/**
 * Response Streaming for Large Datasets
 * 
 * This utility provides response streaming capabilities for large datasets
 * to reduce memory usage and improve response times.
 */

import { Response } from 'express';

/**
 * Stream JSON response
 */
export const streamJsonResponse = (
  res: Response,
  dataGenerator: AsyncGenerator<any, void, unknown>,
  filename?: string
): void => {
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
    } catch (error) {
      console.error('Stream error:', error);
      res.write(']');
      res.end();
    }
  };

  processStream();
};

/**
 * Stream CSV response
 */
export const streamCsvResponse = (
  res: Response,
  dataGenerator: AsyncGenerator<any, void, unknown>,
  headers: string[],
  filename?: string
): void => {
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
    } catch (error) {
      console.error('CSV stream error:', error);
      res.end();
    }
  };

  processStream();
};

/**
 * Create cursor-based pagination for large datasets
 */
export class CursorPagination<T> {
  private cursor: string | null = null;
  private limit: number;
  private data: T[] = [];

  constructor(limit: number = 50) {
    this.limit = limit;
  }

  /**
   * Set cursor
   */
  setCursor(cursor: string | null): this {
    this.cursor = cursor;
    return this;
  }

  /**
   * Set limit
   */
  setLimit(limit: number): this {
    this.limit = limit;
    return this;
  }

  /**
   * Set data
   */
  setData(data: T[]): this {
    this.data = data;
    return this;
  }

  /**
   * Get next cursor
   */
  getNextCursor(): string | null {
    if (this.data.length < this.limit) {
      return null;
    }

    const lastItem = this.data[this.data.length - 1];
    return Buffer.from(JSON.stringify(lastItem)).toString('base64');
  }

  /**
   * Get paginated response
   */
  getResponse(): {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
  } {
    return {
      data: this.data,
      nextCursor: this.getNextCursor(),
      hasMore: this.data.length >= this.limit,
    };
  }

  /**
   * Parse cursor
   */
  static parseCursor(cursor: string): any {
    try {
      return JSON.parse(Buffer.from(cursor, 'base64').toString());
    } catch (error) {
      return null;
    }
  }
}

/**
 * Batch processor for large datasets
 */
export class BatchProcessor<T, R> {
  private batchSize: number;
  private processor: (batch: T[]) => Promise<R[]>;

  constructor(batchSize: number, processor: (batch: T[]) => Promise<R[]>) {
    this.batchSize = batchSize;
    this.processor = processor;
  }

  /**
   * Process items in batches
   */
  async *process(items: T[]): AsyncGenerator<R, void, unknown> {
    for (let i = 0; i < items.length; i += this.batchSize) {
      const batch = items.slice(i, i + this.batchSize);
      const results = await this.processor(batch);
      
      for (const result of results) {
        yield result;
      }
    }
  }
}

/**
 * Memory-efficient data stream from MongoDB cursor
 */
export const streamMongoCursor = async function* <T>(
  cursor: any
): AsyncGenerator<T, void, unknown> {
  try {
    for await (const doc of cursor) {
      yield doc;
    }
  } catch (error) {
    console.error('MongoDB cursor stream error:', error);
    throw error;
  }
};

/**
 * Transform stream
 */
export const transformStream = async function* <T, R>(
  stream: AsyncGenerator<T, void, unknown>,
  transformer: (item: T) => R | Promise<R>
): AsyncGenerator<R, void, unknown> {
  try {
    for await (const item of stream) {
      const transformed = await transformer(item);
      yield transformed;
    }
  } catch (error) {
    console.error('Transform stream error:', error);
    throw error;
  }
};

/**
 * Filter stream
 */
export const filterStream = async function* <T>(
  stream: AsyncGenerator<T, void, unknown>,
  filter: (item: T) => boolean | Promise<boolean>
): AsyncGenerator<T, void, unknown> {
  try {
    for await (const item of stream) {
      const shouldInclude = await filter(item);
      if (shouldInclude) {
        yield item;
      }
    }
  } catch (error) {
    console.error('Filter stream error:', error);
    throw error;
  }
};
