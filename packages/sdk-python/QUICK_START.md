# Rigour QA Quick Start Guide

## Installation

```bash
pip install rigour-qa
```

## 5-Minute Tutorial

### Step 1: Initialize Your Project

```bash
rigour-qa init
```

This creates:
- `scenes.yaml` - Example test scenarios
- `connection.yaml` - Target system configuration

### Step 2: Edit Your Test Scenarios

Edit `scenes.yaml`:

```yaml
- title: Get User
  description: Retrieve user by ID and verify response structure
  steps:
    - action: GET /api/users/123
  assertions:
    - type: status_code
      target: response
      expected: 200
    - type: body_contains
      target: response
      expected: id
  priority: high
  tags: [users, api]
```

### Step 3: Configure Your Target System

Edit `connection.yaml`:

```yaml
base_url: https://jsonplaceholder.typicode.com
timeout: 30
verify_ssl: true
```

### Step 4: Run Tests

```bash
rigour-qa run scenes.yaml --connection connection.yaml
```

Output:
```
Test Execution: ✓ PASSED
  Plan ID    | 7a9c8f...
  Status     | ✓ PASSED
  Duration   | 0.45s
  Assertions | ✓ 2 | ✗ 0

Edge Case Exploration
Edge Cases Found: 5
  1. ✓ PASS - Get User with Invalid ID
  2. ✓ PASS - Get User with Missing Fields
  3. ✗ FAIL - Get User with SQL Injection
  4. ✓ PASS - Get User with Special Characters
  5. ✓ PASS - Get User with Concurrent Requests

Edge Cases: 4/5 passed
```

## Python API Quick Reference

### Basic Usage

```python
from rigour_qa import RigourQA, Connection, SceneBuilder, Priority

# Configure connection
conn = Connection(base_url="https://api.example.com")

# Create scenes
scene = (
    SceneBuilder("Create User", "API creates new user")
    .with_actor("admin")
    .with_priority(Priority.HIGH)
    .with_step("POST /users", {"name": "John", "email": "john@example.com"})
    .with_assertion("status_code", "response", 201)
    .with_edge_case("Create with duplicate email")
    .build()
)

# Run pipeline
qa = RigourQA(conn)
result = qa.run([scene])

print(f"Passed: {result.passed}/{result.total_scenes}")
print(f"Edge cases: {result.edge_cases_found}")
```

### Advanced: Natural Language Parsing

```python
from rigour_qa.scene.parser import SceneParser
from rigour_qa import RigourQA, Connection

parser = SceneParser()

# Parse natural language
scene = parser.parse_natural_language(
    "User logs in with valid email and password and receives access token"
)

# Execute
conn = Connection(base_url="https://api.example.com")
qa = RigourQA(conn)
result = qa.run_scene(scene)
```

### Advanced: Edge Case Exploration Only

```python
from rigour_qa.engine.explorer import EdgeExplorer
from rigour_qa.engine.planner import AgenticPlanner
from rigour_qa.engine.executor import AgenticExecutor

planner = AgenticPlanner()
executor = AgenticExecutor()
explorer = EdgeExplorer()

# Plan and execute initial test
plan = planner.plan(scene, conn)
result = executor.execute(plan)

# Explore edge cases
if result.passed:
    edge_cases = explorer.explore(scene, result, conn)
    print(f"Generated {len(edge_cases)} edge cases")
```

## Common Scenarios

### Test Authentication

```yaml
- title: Login
  description: User authenticates with credentials
  actor:
    role: user
    auth:
      type: basic
      username: test@example.com
      password: password
  steps:
    - action: POST /api/auth/login
      input:
        email: test@example.com
        password: password
  assertions:
    - type: status_code
      target: response
      expected: 200
    - type: body_contains
      target: response
      expected: access_token
  edge_cases:
    - Login with invalid password
    - Login with non-existent email
    - Login with empty password
```

### Test with Database Assertions

```python
connection = Connection(
    base_url="https://api.example.com",
    db_url="postgresql://localhost/testdb"
)

scene = (
    SceneBuilder("Delete User", "User is deleted from DB")
    .with_step("DELETE /users/123")
    .with_assertion("status_code", "response", 204)
    .with_assertion("db_state", "users table", "user 123 not found")
    .build()
)
```

### Test with Semantic Assertions

```python
from rigour_qa.scene.schema import AssertionType

scene = (
    SceneBuilder("User Profile", "User data is complete")
    .with_step("GET /api/me")
    .with_assertion(
        AssertionType.SEMANTIC,
        "response",
        "user object is valid",
        semantic_prompt="Does the response have all required user fields?"
    )
    .build()
)
```

## Troubleshooting

### ModuleNotFoundError

Make sure all dependencies are installed:
```bash
pip install rigour-qa
pip install pydantic anthropic httpx rich typer pyyaml pytest
```

### Claude API Error

Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-...
```

Or pass it programmatically:
```python
from rigour_qa.scene.parser import SceneParser
parser = SceneParser(api_key="sk-...")
```

### Test Timeout

Increase the timeout:
```python
from rigour_qa.runner import RigourQAConfig

config = RigourQAConfig(executor_timeout=120)
qa = RigourQA(conn, config)
```

### Disable Edge Case Exploration

For faster runs without edge case exploration:
```python
config = RigourQAConfig(enable_edge_case_exploration=False)
qa = RigourQA(conn, config)
```

## What Happens Under the Hood

### When you run `rigour-qa run scenes.yaml`:

1. **Parse** - Scenes loaded from YAML
2. **Plan** - Claude generates pytest code for each scene
3. **Execute** - Tests run in subprocess
4. **Explore** - Claude suggests edge cases
5. **Execute Edge Cases** - Edge cases run in parallel
6. **Judge** - Claude evaluates response quality
7. **Heal** - Failed tests diagnosed and fixed (optional)
8. **Report** - Beautiful results printed

### Example: Login Scene

```
Scene: "User logs in"
    ↓
[Plan] Claude generates:
    import httpx
    def test_login():
        r = httpx.post("https://api.example.com/login", json={...})
        assert r.status_code == 200
    ↓
[Execute] Pytest runs the code
    ✓ PASSED
    ↓
[Explore] Claude suggests edge cases:
    - Login with empty password
    - Login with SQL injection
    - Login with non-existent email
    - Login with expired token
    - Login with concurrent requests
    ↓
[Execute] Run 5 edge case tests in parallel
    ✓ 4 passed, ✗ 1 failed (SQL injection detected!)
    ↓
[Report] Display results
```

## Next Steps

1. Review full documentation: [README.md](README.md)
2. Understand architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
3. Explore examples: [examples/](examples/)
4. Read implementation: [SDK_SUMMARY.md](SDK_SUMMARY.md)

## Common CLI Commands

```bash
# Initialize project
rigour-qa init

# Run all tests
rigour-qa run scenes.yaml --connection connection.yaml

# Run with all features
rigour-qa run scenes.yaml \
    --connection connection.yaml \
    --enable-exploration \
    --enable-healing

# Explore edge cases only
rigour-qa explore scene.yaml --connection connection.yaml

# Show last report
rigour-qa report --last

# Show version
rigour-qa version
```

## Key Concepts

**Scene** - A test scenario (what to test)
**Plan** - Generated test code (how to test)
**Result** - Execution outcome (pass/fail)
**Edge Case** - Variation for robustness testing
**Judge** - Semantic assertion evaluator
**Healer** - Failure diagnosis and repair

## Getting Help

- Run `rigour-qa --help` for CLI help
- Check examples in `examples/` directory
- Read docstrings in source code
- Review test files in `tests/` for usage patterns
