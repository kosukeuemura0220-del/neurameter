# neurameter-crewai

CrewAI integration for [NeuraMeter](https://github.com/neuria-dev/neurameter) -- track AI agent costs, token usage, and latency across your CrewAI workflows.

## Installation

```bash
pip install neurameter-crewai
```

## Quick Start

```python
from crewai import Agent, Task, Crew
from neurameter_crewai import NeuraMeterCallback

# Create the NeuraMeter callback
callback = NeuraMeterCallback(
    api_key="nm_org123_yoursecretkey",
    project_id="proj_abc",
    tags={"environment": "production"},
)

# Define your agents
researcher = Agent(
    role="Researcher",
    goal="Research the given topic thoroughly",
    backstory="You are an expert researcher.",
    llm="gpt-4o",
)

writer = Agent(
    role="Writer",
    goal="Write a clear summary based on research",
    backstory="You are a skilled technical writer.",
    llm="gpt-4o-mini",
)

# Define tasks
research_task = Task(
    description="Research the latest trends in AI agents",
    agent=researcher,
    expected_output="A detailed research report",
)

writing_task = Task(
    description="Write a blog post summarizing the research",
    agent=writer,
    expected_output="A well-written blog post",
)

# Create and run the crew with NeuraMeter tracking
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, writing_task],
    callbacks=[callback],
)

result = crew.kickoff()

# Ensure all events are sent
callback.flush()
```

## Configuration

| Parameter    | Required | Default                                | Description                        |
|-------------|----------|----------------------------------------|------------------------------------|
| `api_key`    | Yes      | --                                     | NeuraMeter API key                 |
| `project_id` | Yes      | --                                     | NeuraMeter project ID              |
| `endpoint`   | No       | `https://ingest.meter.neuria.tech`     | Ingestion API base URL             |
| `tags`       | No       | `{}`                                   | Default tags for all events        |

## What Gets Tracked

- **Agent name** -- extracted from the agent's `role` property
- **Task name** -- extracted from the task's `description`
- **Model** -- extracted from the agent's LLM configuration
- **Token usage** -- input and output tokens when available
- **Cost** -- calculated from model pricing tables
- **Latency** -- wall-clock time for each task execution

## License

MIT
