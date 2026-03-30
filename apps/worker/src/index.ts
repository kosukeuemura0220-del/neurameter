// Placeholder — implementation in Task 5
export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    return new Response('NeuraMeter Ingestion API', { status: 200 });
  },
} satisfies ExportedHandler<Env>;

interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}
