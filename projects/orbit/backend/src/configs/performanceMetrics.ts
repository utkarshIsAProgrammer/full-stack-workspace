/**
 * Performance Monitoring and Metrics
 * 
 * This utility provides performance monitoring and metrics collection
 * to track backend performance and identify bottlenecks.
 */

import { redis } from './redis';

interface MetricData {
  value: number;
  timestamp: number;
  tags?: Record<string, string>;
}

class PerformanceMetrics {
  private metricsPrefix = 'metrics:';

  /**
   * Record metric
   */
  async recordMetric(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): Promise<void> {
    try {
      const key = `${this.metricsPrefix}${name}`;
      const data: MetricData = {
        value,
        timestamp: Date.now(),
        tags,
      };

      // Store in Redis with 24 hour TTL
      await redis.lpush(key, JSON.stringify(data));
      await redis.expire(key, 86400);

      // Keep only last 1000 data points
      await redis.ltrim(key, 0, 999);
    } catch (error) {
      console.error('Metric recording error:', error);
    }
  }

  /**
   * Get metric data
   */
  async getMetric(name: string, limit: number = 100): Promise<MetricData[]> {
    try {
      const key = `${this.metricsPrefix}${name}`;
      const data = await redis.lrange(key, 0, limit - 1) as string[];
      return data.map((item) => JSON.parse(item));
    } catch (error) {
      console.error('Metric retrieval error:', error);
      return [];
    }
  }

  /**
   * Record API response time
   */
  async recordApiResponse(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number
  ): Promise<void> {
    await this.recordMetric('api_response_time', duration, {
      endpoint,
      method,
      status_code: statusCode.toString(),
    });
  }

  /**
   * Record database query time
   */
  async recordDbQuery(
    collection: string,
    operation: string,
    duration: number
  ): Promise<void> {
    await this.recordMetric('db_query_time', duration, {
      collection,
      operation,
    });
  }

  /**
   * Record cache hit rate
   */
  async recordCacheHit(
    cacheName: string,
    hit: boolean
  ): Promise<void> {
    await this.recordMetric('cache_hit_rate', hit ? 1 : 0, {
      cache: cacheName,
      result: hit ? 'hit' : 'miss',
    });
  }

  /**
   * Get average metric value
   */
  async getAverageMetric(name: string, timeRange: number = 3600): Promise<number> {
    try {
      const data = await this.getMetric(name, 1000);
      const now = Date.now();
      const cutoff = now - (timeRange * 1000);

      const recentData = data.filter((d) => d.timestamp > cutoff);
      
      if (recentData.length === 0) return 0;

      const sum = recentData.reduce((acc, d) => acc + d.value, 0);
      return sum / recentData.length;
    } catch (error) {
      console.error('Average metric calculation error:', error);
      return 0;
    }
  }

  /**
   * Get percentile metric
   */
  async getPercentileMetric(
    name: string,
    percentile: number = 95,
    timeRange: number = 3600
  ): Promise<number> {
    try {
      const data = await this.getMetric(name, 1000);
      const now = Date.now();
      const cutoff = now - (timeRange * 1000);

      const recentData = data
        .filter((d) => d.timestamp > cutoff)
        .map((d) => d.value)
        .sort((a, b) => a - b);

      if (recentData.length === 0) return 0;

      const index = Math.ceil((percentile / 100) * recentData.length) - 1;
      const safeIndex = Math.max(0, Math.min(index, recentData.length - 1));
      return recentData[safeIndex] || 0;
    } catch (error) {
      console.error('Percentile metric calculation error:', error);
      return 0;
    }
  }

  /**
   * Get performance summary
   */
  async getPerformanceSummary(): Promise<{
    avgApiResponseTime: number;
    p95ApiResponseTime: number;
    avgDbQueryTime: number;
    cacheHitRate: number;
  }> {
    const [avgApiTime, p95ApiTime, avgDbTime, cacheHits] = await Promise.all([
      this.getAverageMetric('api_response_time'),
      this.getPercentileMetric('api_response_time', 95),
      this.getAverageMetric('db_query_time'),
      this.getAverageMetric('cache_hit_rate'),
    ]);

    return {
      avgApiResponseTime: avgApiTime,
      p95ApiResponseTime: p95ApiTime,
      avgDbQueryTime: avgDbTime,
      cacheHitRate: (cacheHits || 0) * 100, // Convert to percentage
    };
  }
}

// Export singleton instance
const performanceMetrics = new PerformanceMetrics();

export default performanceMetrics;

/**
 * Performance monitoring middleware
 */
export const performanceMonitoring = () => {
  return async (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Hook into response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      performanceMetrics.recordApiResponse(
        req.path,
        req.method,
        duration,
        res.statusCode
      );
    });

    next();
  };
};
