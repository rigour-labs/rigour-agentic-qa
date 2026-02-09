# Rigour QA

[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/) [![Node 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Rigour Labs](https://img.shields.io/badge/by-Rigour%20Labs-black.svg)](https://rigour.run)

**Write scenes. Get autonomous tests.**

An open-source agentic QA framework that transforms natural language test descriptions into autonomous, self-healing test suites. Powered by Claude, Rigour QA generates executable tests, explores edge cases, and fixes failures without manual intervention.

---

## What is Rigour QA?

Rigour QA is a **Claude agent-powered** test automation framework that eliminates the tedious work of writing and maintaining test code:

1. **Write Test Scenes** — Describe what you want to test in plain English (YAML format)
2. **Agents Generate Tests** — Claude autonomously generates production-quality pytest code
3. **Tests Execute** — Your tests run against your API with semantic assertion judging
4. **Edge Cases Explored** — The agentic engine autonomously discovers 8+ edge case categories
5. **Failures Self-Heal** — When tests break, agents diagnose and fix them automatically

No more brittle, hard-to-maintain test code. Just describe your intentions, and let the agent handle the details.

---

## Key Features

- **Natural Language Test Definitions** — Write test scenes in YAML (plain English descriptions, no code)
- **Agent-Powered Code Generation** — Claude agents generate executable pytest code from scene descriptions
- **Autonomous Edge Case Discovery** — Automatically explore boundary values, auth issues, timing, data edge cases, state machines, business logic, input validation, and integration problems
- **Semantic Assertion Judging** — Tests evaluate response quality semantically, not just with brittle exact-match assertions
- **Self-Healing Tests** — When tests fail, agentic diagnostics identify root causes and generate fixes automatically
- **Quality Judgment** — Evaluate API responses for schema correctness, data consistency, and error clarity
- **Zero Setup Demo** — Works out-of-the-box with JSONPlaceholder API
- **Beautiful CLI** — Rich, scannable command-line interface with detailed reports
- **Python & Node SDKs** — Python SDK fully production-ready; Node.js SDK in development

---

## Monorepo Structure

```
rigour-qa/
├── packages/
│   ├── sdk-python/         # Python SDK (fully working, recommended)
│   └── sdk-node/           # Node.js SDK (in development)
├── examples/
│   ├── scenes/             # Example test scene YAML files
│   │   ├── demo-api.yaml   # Works with JSONPlaceholder API
│   │   ├── api-crud.yaml   # CRUD operation examples
│   │   └── login-flow.yaml # Auth scenario examples
│   └── connection.yaml     # Example API connection config
├── docs/                   # Documentation
└── LICENSE                 # MIT License
```

---

## Quick Start

### 1. Install

```bash
# Python SDK (recommended)
pip install -e packages/sdk-python

# Or from PyPI (when published)
pip install rigour-qa
```

### 2. Generate Example Files

```bash
rigour-qa init
```

This creates `scenes.yaml` and `connection.yaml` in your current directory.

### 3. Run Demo (No Setup Required)

```bash
# Uses JSONPlaceholder API out-of-the-box
rigour-qa run examples/scenes/demo-api.yaml --connection-file examples/connection.yaml
```

You'll see:
- Generated pytest test code
- Test execution results
- Semantic judgment scores
- Discovered edge cases
- Self-healing recommendations (if tests fail)

---

## CLI Commands

### Run test scenes
```bash
rigour-qa run <scenes.yaml> --connection-file <conn.yaml> \
    --enable-exploration \
    --enable-healing \
    --max-edge-cases 10
```

### Initialize example files
```bash
rigour-qa init --output-dir .
```

### Explore edge cases for a scene
```bash
rigour-qa explore <scene.yaml> --connection-file <conn.yaml>
```

### View last execution report
```bash
rigour-qa report --last
```

### Check version
```bash
rigour-qa version
```

---

## Scene YAML Format

Define test scenarios in plain English:

```yaml
scenes:
  - title: "Get All Users"
    description: "Verify the GET /users endpoint returns a list of users"
    priority: high
    steps:
      - action: "GET /users"
        expect: "200 with a list of users"
    assertions:
      - type: status_code
        target: response
        expected: 200
      - type: body_contains
        target: response
        expected: "Leanne Graham"
    edge_cases:
      - "What happens with invalid query parameters?"
      - "What happens with limit=0?"
    tags: ["api", "users", "smoke"]

  - title: "Create a Post"
    description: "Verify POST /posts creates a new post and returns it with an id"
    priority: medium
    steps:
      - action: "POST /posts"
        input:
          title: "Test Post"
          body: "This is a test"
          userId: 1
        expect: "201 with created post including id"
    assertions:
      - type: status_code
        target: response
        expected: 201
      - type: body_contains
        target: response
        expected: "Test Post"
    edge_cases:
      - "What happens with empty title?"
      - "What happens with missing userId?"
      - "What happens with extremely long body text?"
    tags: ["api", "posts", "crud"]
```

---

## Connection Configuration

Configure your target API:

```yaml
# Basic configuration
base_url: "https://api.example.com"
timeout: 30
headers:
  X-Request-Source: "rigour-qa"

# Bearer token authentication
auth_type: "bearer"
auth_token: "$BEARER_TOKEN"  # Use env var

# API key authentication
auth_type: "api_key"
auth_token: "$API_KEY"

# Basic authentication
auth_type: "basic"
username: "admin"
password: "secret"
```

Environment variables are supported: `$ENV_VAR_NAME` syntax.

---

## How the Agentic Pipeline Works

```
PARSE → PLAN → EXECUTE → JUDGE → EXPLORE → HEAL → REPORT
```

### 1. Parse
YAML scene files are parsed into structured Scene objects with steps, assertions, edge cases, and metadata.

### 2. Plan
Claude agent reads each Scene and autonomously generates executable pytest code that calls your API and validates responses.

### 3. Execute
Generated test code runs in a subprocess via pytest with timeout protection and rich error capture.

### 4. Judge
A semantic judge evaluates response quality beyond simple status code checks. Uses Claude to assess correctness, data completeness, and error clarity.

### 5. Explore
The edge case explorer autonomously generates 8+ categories of edge case variants:
- **Boundary Values** — Empty strings, max lengths, special characters, unicode
- **Auth Edge Cases** — Invalid tokens, expired tokens, wrong permissions
- **Timing Issues** — Concurrent requests, slow responses, timeouts
- **Data Edge Cases** — Null fields, duplicates, malformed JSON
- **State Machine** — Invalid state transitions, replay attacks
- **Business Logic** — Limits exceeded, business rule violations
- **Input Validation** — SQL injection, XSS, command injection payloads
- **Integration** — Cascading failures, dependency issues

### 6. Heal
When tests fail, the self-healing agent:
- Diagnoses root cause (assertion failure, timeout, network error, etc.)
- Detects flakiness (intermittent vs. real failures)
- Suggests specific fixes
- Generates corrected test code
- Re-executes to verify the fix

### 7. Report
Pretty-printed results with execution summaries, pass/fail rates, edge cases found, and healing recommendations.

---

## Configuration Options

Toggle agentic capabilities via config:

```python
from rigour_qa.runner import RigourQAConfig

config = RigourQAConfig(
    enable_edge_case_exploration=True,    # Auto-discover edge cases
    enable_healing=True,                   # Auto-fix failing tests
    enable_quality_judgment=True,          # Semantic response judging
    max_edge_cases_per_scene=10,          # Limit edge case generation
    executor_timeout=60,                   # Test execution timeout (seconds)
)
```

---

## Python SDK

### Basic Usage

```python
from rigour_qa import RigourQA, Connection, SceneBuilder

# Configure connection
connection = Connection(
    base_url="https://api.example.com",
    auth_type="bearer",
    auth_token="token_xxx",
    timeout=30,
)

# Create scenes programmatically
scenes = [
    SceneBuilder("Get Users", "Fetch user list")
        .with_priority("high")
        .with_step("GET /users", None)
        .with_assertion("status_code", "response", 200)
        .with_tags("api", "users")
        .build(),
]

# Run full agentic pipeline
qa = RigourQA(connection)
result = qa.run(scenes, enable_exploration=True, enable_healing=True)

print(f"Passed: {result.passed}/{result.total}")
print(f"Edge cases found: {result.edge_cases_found}")
```

### Parse Natural Language

```python
from rigour_qa.scene.parser import SceneParser

parser = SceneParser()

# Parse YAML file
scenes = parser.parse_yaml("scenes.yaml")

# Parse natural language (single scene)
scene = parser.parse_natural_language(
    "Verify GET /users returns a list of users with status 200"
)
```

### Custom Assertions

```python
from rigour_qa.judges import SemanticJudge

judge = SemanticJudge()

# Use Claude to judge semantic correctness
result = judge.judge(
    assertion={
        "type": "semantic",
        "target": "response",
        "prompt": "Does the response contain all required fields?"
    },
    response_data=api_response,
)

print(f"Passed: {result.passed}, Score: {result.score}")
```

---

## Requirements

- **Python 3.10+** (Python SDK)
- **Node 18+** (Node SDK, in development)
- **Anthropic API Key** (`ANTHROPIC_API_KEY` environment variable)
- **Internet access** (for Claude API calls)

### Install Dependencies

```bash
# Python SDK
pip install -e packages/sdk-python

# Node SDK (development)
cd packages/sdk-node
pnpm install
pnpm build
```

---

## Environment Variables

```bash
# Required
export ANTHROPIC_API_KEY=sk-ant-...

# Optional
export TEST_BASE_URL=https://api.example.com
export TEST_AUTH_TYPE=bearer
export TEST_AUTH_TOKEN=token_xxx
export TEST_TIMEOUT=30
```

---

## Examples

See the `examples/` directory:

- **`examples/scenes/demo-api.yaml`** — Basic API testing (works with JSONPlaceholder)
- **`examples/scenes/api-crud.yaml`** — CRUD operations (create, read, update, delete)
- **`examples/scenes/login-flow.yaml`** — Authentication scenarios
- **`examples/connection.yaml`** — Connection configuration templates

Run any example:

```bash
rigour-qa run examples/scenes/demo-api.yaml --connection-file examples/connection.yaml
```

---

## Architecture

```
RigourQA (Main Orchestrator)
├── SceneParser           # Natural → Structured
├── AgenticPlanner        # Scene → Pytest Code (Claude agent)
├── AgenticExecutor       # Pytest Code → Results
├── EdgeExplorer          # Results → Edge Cases (Claude agent)
├── SemanticJudge         # Response → Judgment (Claude agent)
├── QualityJudge          # Response → Quality Metrics
├── SelfHealer            # Failure → Diagnosis & Fix (Claude agent)
└── ConsoleReporter       # Results → Pretty Output
```

---

## Contributing

Contributions welcome! Areas for enhancement:

- Additional assertion types
- More agent model support
- CI/CD pipeline integration
- Enhanced reporting (HTML, Allure, etc.)
- Performance optimizations
- Mobile app testing support

Please open an issue or pull request on GitHub.

---

## License

MIT License — See [LICENSE](./LICENSE) file

---

## Roadmap

- Multi-user parallel test execution
- Historical trend analysis
- Machine learning-based test prioritization
- Integration with bug tracking systems
- Web dashboard for test management
- Mobile app testing support
- Performance profiling integration
- Slack/Teams notifications
- API diff detection and testing

---

## Support

- **Documentation** — [docs.rigourlabs.com](https://docs.rigourlabs.com)
- **Issues** — [GitHub Issues](https://github.com/rigour-labs/rigour-qa/issues)
- **Email** — [hello@rigour.run](mailto:hello@rigour.run)
- **Community** — [Slack](https://slack.rigourlabs.com) (coming soon)

---

## About Rigour Labs

[Rigour Labs](https://rigour.run) builds agentic tools for modern development. Rigour QA is our flagship open-source project bringing Claude agent-powered QA to every team.

**Made with ♡ by Rigour Labs**
