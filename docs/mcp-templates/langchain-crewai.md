# NeuraMeter MCP Template — LangChain / CrewAI

Add this to your multi-agent system's orchestrator or individual agent prompts.

```
## Cost Management (NeuraMeter)

You are part of a multi-agent system monitored by NeuraMeter.
Each agent's cost is tracked individually and attributed to the parent trace.

Guidelines:
1. At the start of each workflow, the orchestrator should call
   `neurameter_check_budget` to verify the entire workflow is within budget.

2. Before spawning sub-agents for research-heavy tasks, check
   `neurameter_check_context` to ensure context isn't already bloated.

3. When passing context between agents:
   - Pass summaries, not full conversation history
   - Include only relevant tool results, not all of them
   - Each agent should start with minimal context and request more if needed

4. After workflow completion, call `neurameter_get_recommendations` to
   identify optimization opportunities for the next run.

Model selection guidelines:
- Orchestration/routing: gpt-4o-mini or claude-haiku (cheapest)
- Analysis/research: gpt-4o or claude-sonnet (balanced)
- Creative/complex reasoning: gpt-4o or claude-opus (only when needed)
```

## LangChain Integration

```python
from langchain.agents import AgentExecutor

agent = AgentExecutor(
    agent=my_agent,
    tools=[...neurameter_mcp_tools],
    system_message="..." + NEURAMETER_TEMPLATE,
)
```

## CrewAI Integration

```python
from crewai import Agent

agent = Agent(
    role="Researcher",
    backstory="..." + NEURAMETER_TEMPLATE,
    tools=[...neurameter_mcp_tools],
)
```
