export interface MeterOptions {
  agentName: string;
  taskName?: string;
  customerId?: string;
  traceId?: string;
  parentSpanId?: string;
  tags?: Record<string, string>;
}
