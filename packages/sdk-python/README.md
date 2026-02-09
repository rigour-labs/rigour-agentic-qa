# Rigour QA - Agentic Test Generation SDK

An intelligent, autonomous QA framework that generates, executes, and explores edge cases using Claude AI. Write test scenarios in natural language, and the system autonomously generates test code, executes tests, discovers edge cases, and heals failures.

## Features

- **Natural Language Test Scenarios**: Define tests in plain English, YAML, or Gherkin format
- **Autonomous Test Code Generation**: Claude generates production-quality pytest code from scenarios
- **Intelligent Edge Case Exploration**: Automatically discovers boundary conditions, auth edge cases, timing issues, and data edge cases
- **Self-Healing Tests**: Diagnoses failures and generates fixes autonomously
- **Semantic Assertions**: Use Claude to judge responses semantically, not just exact matches
- **Quality Judging**: Evaluate API response quality: schema correctness, data consistency, error clarity
- **Batch Execution**: Run multiple tests in parallel with detailed reporting
- **Rich CLI**: Beautiful command-line interface with comprehensive reporting

## Installation

```bash
pip install rigour-qa
```

## Quick Start

### 1. Initialize Example Files

```bash
rigour-qa init
```

This creates:
- `scenes.yaml` - Example test scenarios
- `connection.yaml` - Target system configuration

### 2. Define Your Tests

Edit `scenes.yaml`:

```yaml
- title: User Login
  description: User logs in with valid credentials and receives access token
  actor:
    role: user
    persona: Regular authenticated user
  steps:
    - action: POST /api/auth/login
      input:
        email: test@example.com
        password: correct_password
      expect: Returns access token
  assertions:
    - type: status_code
      target: response
      expected: 200
    - type: body_contains
      target: response
      expected: access_token
  edge_cases:
    - Login with empty password
    - Login with invalid email format
    - Login with SQL injection payload
  tags: [auth, critical]
  priority: high
```

### 3. Configure Connection

Edit `connection.yaml`:

```yaml
base_url: https://api.example.com
auth_type: bearer
auth_token: YOUR_TOKEN
headers:
  User-Agent: RigourQA/0.1.0
timeout: 30
verify_ssl: true
```

### 4. Run Tests

```bash
rigour-qa run scenes.yaml --connection connection.yaml
```

## Core Concepts

### Scenes

A **Scene** is a test scenario described in natural language or structured format:

```python
from rigour_qa import Scene, SceneBuilder, Priority

scene = SceneBuilder("Create User", "API creates new user and returns ID")
    .with_actor("admin")
    .with_priority(Priority.HIGH)
    .with_tags("users", "critical")
    .with_step("POST /api/users", {"name": "John", "email": "john@example.com"})
    .with_assertion("status_code", "response", 201)
    .with_assertion("body_contains", "response", "id")
    .with_edge_case("Create with empty name")
    .with_edge_case("Create with duplicate email")
    .build()
```

### The Agentic Pipeline

1. **Parse** - Convert natural language to structured Scene
2. **Plan** - Generate test code using Claude
3. **Execute** - Run test code in subprocess
4. **Explore** - Autonomously generate edge case variants
5. **Judge** - Evaluate responses semantically
6. **Heal** - Diagnose and fix failures
7. **Report** - Pretty-print results

### Edge Case Exploration

After initial test passes, the system autonomously generates edge cases:

- **Boundary Values**: Empty strings, max lengths, special characters, unicode
- **Auth Edge Cases**: Invalid tokens, expired tokens, wrong role/permissions
- **Timing Edge Cases**: Concurrent requests, slow responses, timeouts
- **Data Edge Cases**: Null fields, duplicates, malformed JSON
- **Business Logic**: Limits exceeded, invalid state transitions
- **Security**: SQL injection, XSS, command injection payloads

Each edge case is a new Scene ready for execution.

### Self-Healing

When a test fails, the system:

1. **Diagnoses** the root cause (assertion failure, timeout, network error, etc.)
2. **Detects flakiness** - is this an intermittent issue?
3. **Suggests fixes** - specific code improvements
4. **Generates healed code** - fixed test code
5. **Re-executes** - verifies the fix

## Python API

### Basic Usage

```python
from rigour_qa import RigourQA, Connection, Scene, SceneBuilder, Priority

# Configure connection
connection = Connection(
    base_url="https://api.example.com",
    auth_type="bearer",
    auth_token="token_xxx",
)

# Create scenes
scenes = [
    SceneBuilder("Login", "User logs in successfully")
        .with_actor("user")
        .with_step("POST /login", {"email": "test@example.com", "password": "pwd"})
        .with_assertion("status_code", "response", 200)
        .build(),
]

# Run full pipeline
qa = RigourQA(connection)
result = qa.run(scenes)

print(f"Passed: {result.passed}/{result.total_scenes}")
print(f"Edge cases found: {result.edge_cases_found}")
```

### Advanced Configuration

```python
from rigour_qa.runner import RigourQAConfig

config = RigourQAConfig(
    enable_edge_case_exploration=True,
    enable_healing=True,
    enable_quality_judgment=True,
    max_edge_cases_per_scene=10,
    executor_timeout=60,
)

qa = RigourQA(connection, config)
```

### Parse Natural Language

```python
from rigour_qa.scene.parser import SceneParser

parser = SceneParser()

# Parse natural language
scene = parser.parse_natural_language(
    "User logs in with valid credentials and sees the dashboard"
)

# Parse YAML file
scenes = parser.parse_yaml("scenes.yaml")

# Parse Gherkin format
scene = parser.parse_gherkin("""
    Feature: User Login
    Scenario: Login with valid credentials
        Given user is on login page
        When user enters valid email and password
        Then user sees dashboard
""")
```

### Custom Assertions

```python
from rigour_qa.judges import SemanticJudge
from rigour_qa.scene.schema import AssertionType

judge = SemanticJudge()

# Semantic assertion - uses Claude to evaluate
result = judge.judge(
    assertion=Assertion(
        type=AssertionType.SEMANTIC,
        target="response",
        expected="user data is complete",
        semantic_prompt="Does the response contain all required user fields?"
    ),
    actual_response=response_data,
)

print(f"Passed: {result.passed}")
print(f"Score: {result.score}")
print(f"Reasoning: {result.reasoning}")
```

### Batch Execution

```python
from rigour_qa.engine.executor import AgenticExecutor

executor = AgenticExecutor(timeout=60)

# Execute multiple plans in parallel
results = executor.execute_batch(plans, parallel=True)

for result in results:
    print(f"{result.plan_id}: {'PASS' if result.passed else 'FAIL'}")
```

## CLI Commands

### Initialize project

```bash
rigour-qa init --output-dir .
```

Creates example `scenes.yaml` and `connection.yaml`.

### Run tests

```bash
rigour-qa run scenes.yaml --connection connection.yaml \
    --enable-exploration \
    --enable-healing
```

### Explore edge cases

```bash
rigour-qa explore scene.yaml --connection connection.yaml
```

Generates and shows edge case variants for a single scene.

### Show reports

```bash
rigour-qa report --last
```

Shows the last execution report.

## Architecture

```
RigourQA (Orchestrator)
├── SceneParser (Natural → Structured)
├── AgenticPlanner (Scene → TestPlan)
├── AgenticExecutor (TestPlan → ExecutionResult)
├── EdgeExplorer (ExecutionResult → EdgeCaseScenes)
├── SemanticJudge (Response → Judgment)
├── QualityJudge (Response → QualityMetrics)
├── SelfHealer (Failure → DiagnosisAndFix)
└── ConsoleReporter (Results → Pretty Output)
```

## File Structure

```
rigour_qa/
├── scene/
│   ├── schema.py       - Core Scene, Actor, Step, Assertion models
│   ├── parser.py       - Parse natural language, YAML, Gherkin
│   └── builder.py      - Fluent Scene builder API
├── engine/
│   ├── planner.py      - Generate test code from scenes
│   ├── executor.py     - Execute generated tests
│   ├── explorer.py     - Autonomous edge case discovery
│   └── types.py        - Type definitions
├── judges/
│   ├── base.py         - Semantic judgment using Claude
│   └── quality.py      - API response quality evaluation
├── agents/
│   └── healer.py       - Self-healing and diagnosis
├── reporters/
│   └── console.py      - Rich console output
├── connection.py       - Connection configuration
├── runner.py           - Main RigourQA orchestrator
└── cli.py              - Typer CLI
```

## Environment Variables

```bash
export ANTHROPIC_API_KEY=sk-...
export TEST_BASE_URL=https://api.example.com
export TEST_AUTH_TYPE=bearer
export TEST_AUTH_TOKEN=token_xxx
export TEST_TIMEOUT=30
export TEST_DB_URL=postgresql://...
```

## Examples

See `examples/` directory for:
- `simple_api_test.py` - Basic API testing
- `edge_case_exploration.py` - Advanced edge case discovery
- `self_healing.py` - Healing failed tests
- `gherkin_scenarios.yaml` - BDD-style test definitions

## Contributing

Pull requests welcome! Areas for contribution:

- Additional assertion types
- More agent models support
- Integration with CI/CD systems
- Enhanced reporting (HTML, Allure, etc.)
- Performance optimizations

## License

MIT - See LICENSE file

## Support

- Documentation: https://docs.rigourlabs.com
- Issues: https://github.com/rigour-labs/rigour-qa/issues
- Community: https://slack.rigourlabs.com

## Roadmap

- Multi-user parallel test execution
- Historical trend analysis
- Machine learning for test prioritization
- Integration with bug tracking systems
- Web dashboard for test management
- Mobile app testing support
- Performance profiling integration
