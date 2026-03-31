#!/usr/bin/env node
// ---------------------------------------------------------------------------
// @neurameter/proxy  –  OpenAI-compatible proxy server
// ---------------------------------------------------------------------------
// Usage:
//   neurameter-proxy --api-key nm_xxx --project proj_xxx
//   npx @neurameter/proxy --api-key nm_xxx --project proj_xxx
//
// Env vars (fallbacks):
//   NEURAMETER_API_KEY, NEURAMETER_PROJECT_ID, NEURAMETER_PROXY_PORT,
//   NEURAMETER_PROXY_TARGET, NEURAMETER_ENDPOINT
// ---------------------------------------------------------------------------

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';
import { getModelPricing, calculateCostMicrodollars } from '@neurameter/core';
import type { TokenUsage } from '@neurameter/core';

// ---------------------------------------------------------------------------
// Argument parsing (lightweight — no external deps)
// ---------------------------------------------------------------------------

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProxyConfig {
  apiKey: string;
  projectId: string;
  port: number;
  target: string;
  agentName: string;
  endpoint: string;
}

// ---------------------------------------------------------------------------
// Event sending (async, never blocks response)
// ---------------------------------------------------------------------------

function sendEvent(config: ProxyConfig, event: Record<string, unknown>): void {
  const body = JSON.stringify({ events: [event] });
  const url = new URL('/v1/events', config.endpoint);

  fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body,
  }).catch((err: unknown) => {
    process.stderr.write(
      `[neurameter-proxy] Failed to send event: ${err instanceof Error ? err.message : String(err)}\n`,
    );
  });
}

function buildEvent(
  config: ProxyConfig,
  model: string,
  usage: TokenUsage,
  latencyMs: number,
): Record<string, unknown> {
  const pricing = getModelPricing('openai', model);
  const costMicrodollars = pricing
    ? calculateCostMicrodollars(usage, pricing)
    : 0;

  return {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    traceId: crypto.randomUUID(),
    spanId: crypto.randomUUID(),
    agentName: config.agentName,
    provider: 'openai',
    model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    reasoningTokens: usage.reasoningTokens ?? 0,
    cachedTokens: usage.cachedTokens ?? 0,
    costMicrodollars,
    latencyMs,
    orgId: '',
    projectId: config.projectId,
  };
}

// ---------------------------------------------------------------------------
// Body reading helper
// ---------------------------------------------------------------------------

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Forward request to upstream (OpenAI)
// ---------------------------------------------------------------------------

function forwardRequest(
  config: ProxyConfig,
  method: string,
  path: string,
  headers: Record<string, string>,
  body: Buffer | null,
): Promise<{ statusCode: number; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, config.target);
    const isHttps = url.protocol === 'https:';
    const reqFn = isHttps ? httpsRequest : httpRequest;

    const outHeaders: Record<string, string> = { ...headers };
    outHeaders['host'] = url.host;
    delete outHeaders['connection'];

    const req = reqFn(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: outHeaders,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const resHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) resHeaders[k] = Array.isArray(v) ? v.join(', ') : v;
          }
          resolve({
            statusCode: res.statusCode ?? 500,
            headers: resHeaders,
            body: Buffer.concat(chunks),
          });
        });
        res.on('error', reject);
      },
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Streaming forward (SSE passthrough with usage extraction)
// ---------------------------------------------------------------------------

function forwardStreaming(
  config: ProxyConfig,
  path: string,
  headers: Record<string, string>,
  body: Buffer,
  clientRes: ServerResponse,
  model: string,
  startTime: number,
): void {
  const url = new URL(path, config.target);
  const isHttps = url.protocol === 'https:';
  const reqFn = isHttps ? httpsRequest : httpRequest;

  const outHeaders: Record<string, string> = { ...headers };
  outHeaders['host'] = url.host;
  delete outHeaders['connection'];

  const req = reqFn(
    {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: 'POST',
      headers: outHeaders,
    },
    (res) => {
      clientRes.writeHead(res.statusCode ?? 500, res.headers);

      let usageFound: TokenUsage | null = null;

      res.on('data', (chunk: Buffer) => {
        clientRes.write(chunk);

        // Parse SSE lines for usage
        const text = chunk.toString('utf-8');
        for (const line of text.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') continue;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.usage) {
              usageFound = {
                inputTokens: parsed.usage.prompt_tokens ?? 0,
                outputTokens: parsed.usage.completion_tokens ?? 0,
                reasoningTokens: parsed.usage.completion_tokens_details?.reasoning_tokens ?? 0,
                cachedTokens: parsed.usage.prompt_tokens_details?.cached_tokens ?? 0,
              };
            }
          } catch {
            // not valid JSON, skip
          }
        }
      });

      res.on('end', () => {
        clientRes.end();
        if (usageFound) {
          const latencyMs = Date.now() - startTime;
          const event = buildEvent(config, model, usageFound, latencyMs);
          sendEvent(config, event);
        }
      });

      res.on('error', (err) => {
        process.stderr.write(
          `[neurameter-proxy] Upstream stream error: ${err.message}\n`,
        );
        clientRes.end();
      });
    },
  );

  req.on('error', (err) => {
    process.stderr.write(
      `[neurameter-proxy] Upstream request error: ${err.message}\n`,
    );
    clientRes.writeHead(502, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: { message: 'Bad gateway' } }));
  });

  req.write(body);
  req.end();
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------

async function handleRequest(
  config: ProxyConfig,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const path = req.url ?? '/';
  const method = req.method ?? 'GET';

  // Health check
  if (path === '/health' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', target: config.target }));
    return;
  }

  // POST /v1/chat/completions — the main proxy path
  if (path === '/v1/chat/completions' && method === 'POST') {
    const startTime = Date.now();
    const rawBody = await readBody(req);
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(rawBody.toString('utf-8'));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Invalid JSON body' } }));
      return;
    }

    const model = String(parsed['model'] ?? 'unknown');
    const isStream = parsed['stream'] === true;

    // Auto-inject stream_options for usage reporting
    if (isStream && !parsed['stream_options']) {
      parsed['stream_options'] = { include_usage: true };
    }

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    // Forward authorization header
    const auth = req.headers['authorization'];
    if (auth) headers['authorization'] = Array.isArray(auth) ? auth[0] : auth;

    const modifiedBody = Buffer.from(JSON.stringify(parsed), 'utf-8');
    headers['content-length'] = String(modifiedBody.length);

    if (isStream) {
      forwardStreaming(config, path, headers, modifiedBody, res, model, startTime);
    } else {
      try {
        const upstream = await forwardRequest(config, 'POST', path, headers, modifiedBody);
        const latencyMs = Date.now() - startTime;

        // Extract usage from response
        try {
          const respBody = JSON.parse(upstream.body.toString('utf-8'));
          if (respBody.usage) {
            const usage: TokenUsage = {
              inputTokens: respBody.usage.prompt_tokens ?? 0,
              outputTokens: respBody.usage.completion_tokens ?? 0,
              reasoningTokens: respBody.usage.completion_tokens_details?.reasoning_tokens ?? 0,
              cachedTokens: respBody.usage.prompt_tokens_details?.cached_tokens ?? 0,
            };
            const event = buildEvent(config, model, usage, latencyMs);
            sendEvent(config, event);
          }
        } catch {
          // response wasn't JSON, skip tracking
        }

        // Return upstream response as-is
        const outHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(upstream.headers)) {
          if (k !== 'transfer-encoding') outHeaders[k] = v;
        }
        outHeaders['content-length'] = String(upstream.body.length);
        res.writeHead(upstream.statusCode, outHeaders);
        res.end(upstream.body);
      } catch (err) {
        process.stderr.write(
          `[neurameter-proxy] Upstream error: ${err instanceof Error ? err.message : String(err)}\n`,
        );
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: 'Bad gateway' } }));
      }
    }
    return;
  }

  // GET /v1/models — passthrough
  if (path === '/v1/models' && method === 'GET') {
    const headers: Record<string, string> = {};
    const auth = req.headers['authorization'];
    if (auth) headers['authorization'] = Array.isArray(auth) ? auth[0] : auth;

    try {
      const upstream = await forwardRequest(config, 'GET', path, headers, null);
      res.writeHead(upstream.statusCode, upstream.headers);
      res.end(upstream.body);
    } catch {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'Bad gateway' } }));
    }
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: { message: 'Not found' } }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);

  if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
    process.stderr.write(
      [
        'neurameter-proxy — OpenAI-compatible proxy for NeuraMeter cost tracking',
        '',
        'Usage:',
        '  neurameter-proxy --api-key <key> --project <id> [options]',
        '',
        'Options:',
        '  --api-key     <key>   NeuraMeter API key (or NEURAMETER_API_KEY env)',
        '  --project     <id>    NeuraMeter project ID (or NEURAMETER_PROJECT_ID env)',
        '  --port        <num>   Listen port (default: 3100, or NEURAMETER_PROXY_PORT env)',
        '  --target      <url>   Upstream API URL (default: https://api.openai.com, or NEURAMETER_PROXY_TARGET env)',
        '  --agent-name  <name>  Agent name for events (default: proxy-agent)',
        '  --endpoint    <url>   Ingestion API URL (default: https://neurameter-ingestion.neurameter.workers.dev)',
        '  --help, -h            Show this help message',
        '',
        'Quick start:',
        '  # Start proxy on port 3100',
        '  neurameter-proxy --api-key nm_xxx --project proj_xxx',
        '',
        '  # Point your app at the proxy',
        '  OPENAI_BASE_URL=http://localhost:3100/v1 node app.js',
        '',
      ].join('\n'),
    );
    process.exit(0);
  }

  const apiKey =
    getFlag(args, '--api-key') ?? process.env['NEURAMETER_API_KEY'];
  const projectId =
    getFlag(args, '--project') ?? process.env['NEURAMETER_PROJECT_ID'];
  const port = Number(
    getFlag(args, '--port') ?? process.env['NEURAMETER_PROXY_PORT'] ?? '3100',
  );
  const target =
    getFlag(args, '--target') ??
    process.env['NEURAMETER_PROXY_TARGET'] ??
    'https://api.openai.com';
  const agentName =
    getFlag(args, '--agent-name') ?? 'proxy-agent';
  const endpoint =
    getFlag(args, '--endpoint') ??
    process.env['NEURAMETER_ENDPOINT'] ??
    'https://neurameter-ingestion.neurameter.workers.dev';

  if (!apiKey) {
    process.stderr.write(
      'Error: --api-key flag or NEURAMETER_API_KEY environment variable is required.\n',
    );
    process.exit(1);
  }

  if (!projectId) {
    process.stderr.write(
      'Error: --project flag or NEURAMETER_PROJECT_ID environment variable is required.\n',
    );
    process.exit(1);
  }

  const config: ProxyConfig = {
    apiKey,
    projectId,
    port,
    target,
    agentName,
    endpoint,
  };

  const server = createServer((req, res) => {
    handleRequest(config, req, res).catch((err: unknown) => {
      process.stderr.write(
        `[neurameter-proxy] Unhandled error: ${err instanceof Error ? err.message : String(err)}\n`,
      );
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify({ error: { message: 'Internal server error' } }));
    });
  });

  const shutdown = () => {
    process.stderr.write('[neurameter-proxy] Shutting down...\n');
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(port, () => {
    process.stderr.write(
      `[neurameter-proxy] Listening on http://localhost:${port}\n` +
        `[neurameter-proxy] Forwarding to ${target}\n`,
    );
  });
}

main();
