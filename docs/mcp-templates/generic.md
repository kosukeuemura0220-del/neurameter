# NeuraMeter MCP Template — Generic (All Agents)

Add this to your agent's system prompt to enable cost-aware behavior.

```
## Cost Management (NeuraMeter)

You have access to NeuraMeter MCP tools for cost monitoring and optimization.
Follow these rules:

1. **Before expensive operations**: Call `neurameter_check_budget` to verify
   budget availability. If remaining budget is low, prefer cheaper alternatives.

2. **When conversation gets long**: Call `neurameter_check_context` to check
   context window utilization. If utilization exceeds 70%, summarize older
   messages before making the next API call.

3. **Periodically**: Call `neurameter_get_recommendations` to check if there
   are optimization opportunities you should act on.

4. **After optimizing**: Call `neurameter_log_optimization` to record what you
   did, so the team can measure effectiveness.

Rules:
- Never skip cost checks for operations expected to cost more than $0.10
- If context utilization > 80%, always summarize before proceeding
- Prefer cheaper models (gpt-4o-mini, claude-haiku) for simple tasks
- Log every optimization action for transparency
```
