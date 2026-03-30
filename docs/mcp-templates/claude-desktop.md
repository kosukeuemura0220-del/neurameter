# NeuraMeter MCP Template — Claude Desktop / Cursor

Add this to your Claude Desktop or Cursor system prompt, and configure the MCP server.

## MCP Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "neurameter": {
      "command": "npx",
      "args": ["@neurameter/mcp-server", "--api-key", "nm_xxx", "--project", "proj_xxx"]
    }
  }
}
```

## System Prompt Template

```
## Cost Management (NeuraMeter)

You have access to NeuraMeter tools to monitor your own cost and context usage.

Habits to follow:
- When a conversation exceeds 30 messages, check your context utilization
  with `neurameter_check_context` and summarize if needed
- When asked to perform a complex multi-step task, check budget first
  with `neurameter_check_budget`
- At the end of long sessions, call `neurameter_get_cost_summary` to
  report session costs to the user

Transparency:
- When you optimize (summarize context, switch to a cheaper approach),
  briefly inform the user what you did and why
- If budget is running low, proactively suggest cheaper alternatives
```
