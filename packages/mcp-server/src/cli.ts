#!/usr/bin/env node
// ---------------------------------------------------------------------------
// @neurameter/mcp-server  –  CLI entry point
// ---------------------------------------------------------------------------
// Usage:
//   neurameter-mcp --api-key nm_xxx --project proj_xxx
//   npx @neurameter/mcp-server --api-key nm_xxx --project proj_xxx
//
// Env vars (fallbacks):
//   NEURAMETER_API_KEY, NEURAMETER_PROJECT_ID, NEURAMETER_ENDPOINT
// ---------------------------------------------------------------------------

import { NeuraMeterMCPServer } from './server.js';

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
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);

  if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
    process.stderr.write(
      [
        'neurameter-mcp — NeuraMeter MCP Server',
        '',
        'Usage:',
        '  neurameter-mcp --api-key <key> --project <id> [--endpoint <url>]',
        '',
        'Options:',
        '  --api-key   <key>   NeuraMeter API key (or NEURAMETER_API_KEY env)',
        '  --project   <id>    NeuraMeter project ID (or NEURAMETER_PROJECT_ID env)',
        '  --endpoint  <url>   Ingestion API base URL (default: https://ingest.meter.neuria.tech)',
        '  --help, -h          Show this help message',
        '',
        'Environment variables:',
        '  NEURAMETER_API_KEY       API key fallback',
        '  NEURAMETER_PROJECT_ID    Project ID fallback',
        '  NEURAMETER_ENDPOINT      Endpoint fallback',
        '',
      ].join('\n'),
    );
    process.exit(0);
  }

  const apiKey = getFlag(args, '--api-key') ?? process.env['NEURAMETER_API_KEY'];
  const projectId = getFlag(args, '--project') ?? process.env['NEURAMETER_PROJECT_ID'];
  const endpoint = getFlag(args, '--endpoint') ?? process.env['NEURAMETER_ENDPOINT'];

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

  const server = new NeuraMeterMCPServer({
    apiKey,
    projectId,
    endpoint,
    transport: 'stdio',
  });

  // Graceful shutdown
  const shutdown = () => {
    process.stderr.write('[neurameter-mcp] Shutting down...\n');
    server.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.start().catch((err: unknown) => {
    process.stderr.write(`[neurameter-mcp] Fatal: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
}

main();
