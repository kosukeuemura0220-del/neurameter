import type { TransportConfig } from './types';

const DEFAULT_BATCH_SIZE = 50;
const MAX_BATCH_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_MAX_RETRIES = 3;

export class BatchTransport {
  private readonly endpoint: string;
  private readonly apiKey: string;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly maxRetries: number;

  private buffer: unknown[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private timer: any = null;
  private flushing = false;
  private online = true;

  constructor(config: TransportConfig) {
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.batchSize = Math.min(config.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
    this.flushIntervalMs = config.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

    this.startAutoFlush();
    this.setupOnlineListener();
  }

  enqueue(event: unknown): void {
    this.buffer.push(event);

    if (this.buffer.length >= this.batchSize) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.flushing || !this.online) return;

    this.flushing = true;

    while (this.buffer.length > 0 && this.online) {
      const batch = this.buffer.splice(0, this.batchSize);
      const success = await this.sendWithRetry(batch);

      if (!success) {
        // Put back at the front for retry later
        this.buffer.unshift(...batch);
        break;
      }
    }

    this.flushing = false;
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Best-effort final flush
    void this.flush();
  }

  get pendingCount(): number {
    return this.buffer.length;
  }

  private async sendWithRetry(batch: unknown[]): Promise<boolean> {
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.endpoint}/v1/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ batch }),
        });

        if (response.ok) return true;

        // 4xx errors (except 429) are not retryable
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return false;
        }

        // 429 or 5xx — wait and retry
        await this.backoff(attempt);
      } catch {
        // Network error — mark offline and stop retrying
        this.online = false;
        return false;
      }
    }
    return false;
  }

  private backoff(attempt: number): Promise<void> {
    const delayMs = Math.min(1000 * 2 ** attempt, 30_000);
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  private startAutoFlush(): void {
    this.timer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);

    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      (this.timer as { unref: () => void }).unref();
    }
  }

  private setupOnlineListener(): void {
    // Browser environment: listen for online/offline events
    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('online', () => {
        this.online = true;
        void this.flush();
      });
      globalThis.addEventListener('offline', () => {
        this.online = false;
      });
    }
  }
}
