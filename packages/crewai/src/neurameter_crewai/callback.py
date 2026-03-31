"""NeuraMeter callback handler for CrewAI.

Tracks agent name, task name, start/end times, and token usage,
then sends cost events to the NeuraMeter ingestion API via HTTP POST.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import requests

# Model pricing table (price per million tokens in microdollars)
# Kept in sync with @neurameter/core pricing data
MODEL_PRICING: Dict[str, Dict[str, float]] = {
    "gpt-4o": {"input": 2_500_000, "output": 10_000_000},
    "gpt-4o-mini": {"input": 150_000, "output": 600_000},
    "gpt-4-turbo": {"input": 10_000_000, "output": 30_000_000},
    "gpt-4": {"input": 30_000_000, "output": 60_000_000},
    "gpt-3.5-turbo": {"input": 500_000, "output": 1_500_000},
    "claude-3-5-sonnet-20241022": {"input": 3_000_000, "output": 15_000_000},
    "claude-3-5-haiku-20241022": {"input": 800_000, "output": 4_000_000},
    "claude-3-opus-20240229": {"input": 15_000_000, "output": 75_000_000},
    "gemini-1.5-pro": {"input": 1_250_000, "output": 5_000_000},
    "gemini-1.5-flash": {"input": 75_000, "output": 300_000},
}


def _calculate_cost_microdollars(
    model: str, input_tokens: int, output_tokens: int
) -> int:
    """Calculate cost in microdollars (1/1,000,000 of a dollar)."""
    pricing = MODEL_PRICING.get(model)
    if pricing is None:
        # Try prefix matching for versioned model names
        for key, val in MODEL_PRICING.items():
            if model.startswith(key):
                pricing = val
                break
    if pricing is None:
        return 0

    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return int(input_cost + output_cost)


def _map_provider(model: str) -> str:
    """Map a model name to a provider identifier."""
    lower = model.lower()
    if any(k in lower for k in ("gpt", "openai", "o1", "o3")):
        return "openai"
    if any(k in lower for k in ("claude", "anthropic")):
        return "anthropic"
    if any(k in lower for k in ("gemini", "palm", "google")):
        return "google"
    return "other"


@dataclass
class _TaskRun:
    """Tracks metadata for an in-flight task execution."""

    agent_name: str
    task_name: str
    start_time: float = field(default_factory=time.time)
    model: str = "unknown"
    input_tokens: int = 0
    output_tokens: int = 0


class NeuraMeterCallback:
    """CrewAI callback that sends cost events to the NeuraMeter ingestion API.

    Usage::

        from neurameter_crewai import NeuraMeterCallback

        callback = NeuraMeterCallback(
            api_key="nm_org123_secret",
            project_id="proj_abc",
        )

        crew = Crew(
            agents=[...],
            tasks=[...],
            callbacks=[callback],
        )
        crew.kickoff()

    Args:
        api_key: NeuraMeter API key (format: ``nm_{orgId}_{secret}``).
        project_id: NeuraMeter project identifier.
        endpoint: Ingestion API base URL.
            Defaults to ``https://neurameter-ingestion.neurameter.workers.dev``.
        tags: Optional default tags attached to every event.
    """

    def __init__(
        self,
        api_key: str,
        project_id: str,
        endpoint: str = "https://neurameter-ingestion.neurameter.workers.dev",
        tags: Optional[Dict[str, str]] = None,
    ) -> None:
        self.api_key = api_key
        self.project_id = project_id
        self.endpoint = endpoint.rstrip("/")
        self.tags = tags or {}

        # Extract org ID from API key (format: nm_{orgId}_{secret})
        parts = self.api_key.split("_")
        self.org_id = parts[1] if len(parts) >= 3 else "unknown"

        # Buffer for batching events
        self._buffer: List[Dict[str, Any]] = []
        self._active_runs: Dict[str, _TaskRun] = {}

    # ------------------------------------------------------------------
    # CrewAI callback interface
    # ------------------------------------------------------------------

    def on_task_start(self, task: Any) -> None:
        """Called when a CrewAI task begins execution."""
        task_id = str(id(task))
        agent_name = "unknown"
        task_name = "unknown"

        # Extract agent name
        if hasattr(task, "agent") and task.agent is not None:
            agent = task.agent
            if hasattr(agent, "role"):
                agent_name = str(agent.role)
            elif hasattr(agent, "name"):
                agent_name = str(agent.name)

        # Extract task description as task name
        if hasattr(task, "description"):
            desc = str(task.description)
            # Truncate long descriptions
            task_name = desc[:120] if len(desc) > 120 else desc
        elif hasattr(task, "name"):
            task_name = str(task.name)

        # Extract model from agent's LLM config
        model = "unknown"
        if hasattr(task, "agent") and task.agent is not None:
            agent = task.agent
            if hasattr(agent, "llm"):
                llm = agent.llm
                if hasattr(llm, "model"):
                    model = str(llm.model)
                elif hasattr(llm, "model_name"):
                    model = str(llm.model_name)

        self._active_runs[task_id] = _TaskRun(
            agent_name=agent_name,
            task_name=task_name,
            model=model,
        )

    def on_task_end(self, task: Any, output: Any = None) -> None:
        """Called when a CrewAI task completes."""
        task_id = str(id(task))
        run = self._active_runs.pop(task_id, None)
        if run is None:
            return

        latency_ms = int((time.time() - run.start_time) * 1000)

        # Try to extract token usage from output
        input_tokens = run.input_tokens
        output_tokens = run.output_tokens

        if output is not None:
            if hasattr(output, "token_usage"):
                usage = output.token_usage
                if hasattr(usage, "prompt_tokens"):
                    input_tokens = int(usage.prompt_tokens)
                if hasattr(usage, "completion_tokens"):
                    output_tokens = int(usage.completion_tokens)
            elif hasattr(output, "usage"):
                usage = output.usage
                if isinstance(usage, dict):
                    input_tokens = usage.get("prompt_tokens", 0)
                    output_tokens = usage.get("completion_tokens", 0)

        provider = _map_provider(run.model)
        cost_microdollars = _calculate_cost_microdollars(
            run.model, input_tokens, output_tokens
        )

        event = {
            "eventId": str(uuid.uuid4()),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()),
            "traceId": str(uuid.uuid4()),
            "spanId": str(uuid.uuid4()),
            "agentName": run.agent_name,
            "taskName": run.task_name,
            "provider": provider,
            "model": run.model,
            "inputTokens": input_tokens,
            "outputTokens": output_tokens,
            "costMicrodollars": cost_microdollars,
            "latencyMs": latency_ms,
            "orgId": self.org_id,
            "projectId": self.project_id,
            "tags": self.tags,
        }

        self._buffer.append(event)
        self._try_flush()

    def on_agent_action(self, agent: Any, action: Any = None) -> None:
        """Called when an agent takes an action (tool use, etc.)."""
        # Track intermediate LLM calls if token info is available
        if action is not None and hasattr(action, "token_usage"):
            usage = action.token_usage
            # Find the active run for this agent
            for run in self._active_runs.values():
                agent_name = ""
                if hasattr(agent, "role"):
                    agent_name = str(agent.role)
                elif hasattr(agent, "name"):
                    agent_name = str(agent.name)

                if run.agent_name == agent_name:
                    if hasattr(usage, "prompt_tokens"):
                        run.input_tokens += int(usage.prompt_tokens)
                    if hasattr(usage, "completion_tokens"):
                        run.output_tokens += int(usage.completion_tokens)
                    break

    # ------------------------------------------------------------------
    # HTTP transport
    # ------------------------------------------------------------------

    def _try_flush(self, force: bool = False) -> None:
        """Flush buffered events to the ingestion API."""
        if len(self._buffer) == 0:
            return
        if not force and len(self._buffer) < 50:
            # Only auto-flush when buffer is full or forced
            # For task-level granularity, flush after each task
            pass

        batch = self._buffer[:]
        self._buffer.clear()

        try:
            response = requests.post(
                f"{self.endpoint}/v1/events",
                json={"batch": batch},
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {self.api_key}",
                },
                timeout=10,
            )
            if not response.ok:
                # Re-buffer on failure
                self._buffer.extend(batch)
        except requests.RequestException:
            # Re-buffer on network error
            self._buffer.extend(batch)

    def flush(self) -> None:
        """Manually flush all buffered events to the ingestion API."""
        self._try_flush(force=True)

    def __del__(self) -> None:
        """Flush remaining events on garbage collection."""
        try:
            self.flush()
        except Exception:
            pass
