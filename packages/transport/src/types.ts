export interface TransportConfig {
  endpoint: string;
  apiKey: string;
  /** Max events per batch (default: 50, max: 100) */
  batchSize?: number;
  /** Flush interval in ms (default: 5000) */
  flushIntervalMs?: number;
  /** Max retry attempts per batch (default: 3) */
  maxRetries?: number;
}

export interface BatchPayload {
  batch: unknown[];
}

export interface BatchResponse {
  accepted: number;
  rejected: number;
  errors: string[];
}
