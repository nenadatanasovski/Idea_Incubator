/**
 * Types for API Call Statistics
 */

export interface ApiCall {
  id: number;
  userId: string | null;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  createdAt: string;
}

export interface CallStats {
  endpoint: string;
  method: string;
  count: number;
  avgResponseTime: number;
}

export interface StatsSummary {
  totalCalls: number;
  uniqueEndpoints: number;
  avgResponseTime: number;
  period: string;
  requestCount: number;
}

export interface CallStatsFilters {
  endpoint?: string;
  from?: string;
  to?: string;
}
