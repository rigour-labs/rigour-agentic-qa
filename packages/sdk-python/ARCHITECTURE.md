# Rigour QA Architecture & Design

## Overview

Rigour QA is an agentic QA SDK that autonomously generates, executes, and explores test scenarios using Claude AI. The system transforms natural language test descriptions into executable Python code, runs comprehensive tests, discovers edge cases, and self-heals failures.

## Core Innovation: The Agentic Pipeline

The key innovation is the autonomous test generation and edge case exploration pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rigour QA Orchestrator                       │
│                        (runner.py)                              │
└─────────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
          ┌─────────┐    ┌──────────┐    ┌──────────┐
          │  Parse  │    │  Plan    │    │ Execute  │
          │ (Scene) │───▶│ (Code)   │───▶│ (Test)   │
          └─────────┘    └──────────┘    └──────────┘
                                               │
                                               ▼
                                         ┌──────────────┐
                                         │   Explore    │
                                         │ (Edge Cases) │
                                         └──────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    ▼                          ▼                          ▼
             ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
             │    Judge    │           │    Heal     │           │   Report    │
             │(Semantic)   │           │(Self-Heal)  │           │(Results)    │
             └─────────────┘           └─────────────┘           └─────────────┘
```

## Module Architecture

### 1. Scene Module (`scene/`)

**Purpose**: Define and parse test scenarios

#### `schema.py`
- **Scene**: Core model representing a test scenario
  - Supports natural language or structured format
  - Contains steps, assertions, edge cases, metadata
  - Fluent API for building scenarios

- **Actor**: Represents who performs the test
  - Role: user, admin, api_client, anonymous
  - Authentication configuration
  - Optional persona description

- **Step**: Single action in a test
  - action: HTTP verb/endpoint or UI interaction
  - input: parameters or payload
  - expect: expected outcome

- **Assertion**: Expected outcome verification
  - type: status_code, body_contains, response_time, semantic, etc.
  - target: what to check (response, header, DB, etc.)
  - expected: expected value
  - semantic_prompt: for agent-judged assertions

#### `builder.py`
- **SceneBuilder**: Fluent API for constructing scenes
- Enables readable, chainable scene construction
- Methods: with_actor(), with_priority(), with_step(), with_assertion(), etc.

#### `parser.py`
- **SceneParser**: Converts various formats to Scene objects
- parse_natural_language(): Uses Claude to parse free text
- parse_yaml(): Load scene files
- parse_gherkin(): Support BDD format (Given/When/Then)
- parse_dict(): Convert dictionaries to scenes

### 2. Engine Module (`engine/`)

**Purpose**: Test planning, execution, and exploration

#### `types.py`
- **TestPlan**: Generated test code ready for execution
- **ExecutionResult**: Outcome of test execution
- **JudgmentResult**: Result of semantic evaluation
- **Diagnosis**: Analysis of test failures
- **EdgeCaseResult**: Results of edge case exploration

#### `planner.py`
- **AgenticPlanner**: Generates test code from scenes
- plan(): Converts Scene → TestPlan
- Uses Claude to understand scene semantically
- generate_test_code(): Returns executable pytest code
- explore_edge_cases(): Generates edge case variants

Key innovation: Generates ACTUAL runnable test code, not just suggestions

#### `executor.py`
- **AgenticExecutor**: Runs test code in sandboxed subprocess
- execute(): Run single TestPlan
- execute_batch(): Run multiple plans in parallel
- Captures stdout, stderr, execution time
- Parses pytest output to extract assertion counts

#### `explorer.py`
- **EdgeExplorer**: THE DIFFERENTIATOR - Autonomous edge case discovery
- explore(): Generates edge case variants after successful test
- Uses Claude to suggest relevant edge cases:
  - Boundary values (empty, max length, special chars)
  - Auth edge cases (invalid/expired token, wrong role)
  - Timing edge cases (concurrent, slow network)
  - Data edge cases (null, duplicates, unicode)
  - Business logic edge cases
  - Security edge cases (injection payloads)
- Returns list of new Scene objects for exploration
- Prioritizes edge cases by relevance

### 3. Judges Module (`judges/`)

**Purpose**: Evaluate test results with semantic understanding

#### `base.py`
- **SemanticJudge**: Uses Claude for intelligent assertion evaluation
- judge(): Main method - evaluates assertions
- _judge_status_code(): Simple status code checks
- _judge_body_contains(): String matching
- _judge_response_time(): Performance checks
- _judge_semantic(): Uses Claude for nuanced evaluation

#### `quality.py`
- **QualityJudge(SemanticJudge)**: Higher-level response quality evaluation
- judge_response_quality(): Overall quality assessment
- _check_schema_correctness(): Validates response schema
- _check_data_consistency(): Checks for data contradictions
- _check_error_clarity(): Evaluates error message quality
- _check_performance(): Assesses response time and size

### 4. Agents Module (`agents/`)

**Purpose**: Autonomous failure diagnosis and healing

#### `healer.py`
- **SelfHealer**: Autonomous test failure diagnosis and repair
- diagnose(): Analyzes failure, identifies root cause
  - Uses Claude to understand why test failed
  - Classifies failure type: assertion, timeout, network, syntax, etc.
  - Detects if test is flaky (intermittent)
  - Suggests fixes
- heal(): Generates corrected test code
  - Takes diagnosis and original code
  - Uses Claude to generate fixed code
  - Addresses root cause
  - Adds retries if flaky
- is_flaky(): Determines test flakiness from history
- generate_healing_plan(): Batch healing for multiple failures

### 5. Connection Module (`connection.py`)

**Purpose**: Configuration for target system

- **Connection**: Pydantic model for system configuration
- base_url: Target system URL
- auth_type: bearer, basic, api_key, oauth
- headers: Custom HTTP headers
- timeout, verify_ssl: HTTP configuration
- db_url: Optional database for DB assertions
- proxy: Optional HTTP proxy
- Utility methods: get_auth_header(), get_headers(), from_env()

### 6. Runner Module (`runner.py`)

**Purpose**: Main orchestrator - the public API users interact with

- **RigourQAConfig**: Configuration options
  - enable_edge_case_exploration: Boolean
  - enable_healing: Boolean
  - enable_quality_judgment: Boolean
  - max_edge_cases_per_scene: int
  - executor_timeout: int

- **RigourQA**: Main class
  - __init__(connection, config)
  - run(scenes): Execute full pipeline
  - run_scene(scene): Single scene execution
  - Pipeline: Plan → Execute → Explore → Judge → Heal → Report

- **SceneResult**: Result of running one scene
- **RunResult**: Result of running batch of scenes

### 7. Reporters Module (`reporters/`)

**Purpose**: Beautiful output formatting

#### `console.py`
- **ConsoleReporter**: Rich terminal output
- report_execution(): Single test result
- report_batch(): Multiple test results table
- report_edge_cases(): Edge case exploration results
- report_healing(): Self-healing results
- Uses Rich library for formatting

### 8. CLI Module (`cli.py`)

**Purpose**: Typer-based command-line interface

Commands:
- `rigour-qa run`: Execute tests
- `rigour-qa init`: Create example files
- `rigour-qa explore`: Edge case exploration
- `rigour-qa report`: Show results
- `rigour-qa version`: Show version

## Data Flow

### Single Scene Execution

```
Scene Input
    │
    ▼
┌──────────────┐
│   Planner    │  Scene → Prompt → Claude → Code
│   (Plan)     │
└──────────────┘
    │
    ▼ TestPlan
┌──────────────┐
│  Executor    │  Code → Subprocess → pytest → Result
│  (Execute)   │
└──────────────┘
    │
    ▼ ExecutionResult
┌──────────────┐
│   Explorer   │  (if passed) ExecutionResult → Claude → EdgeCases
│ (Explore)    │
└──────────────┘
    │
    ▼ list[Scene]
┌──────────────┐
│ Execute      │  (Parallel) EdgeCases → Results
│ EdgeCases    │
└──────────────┘
    │
    ▼
┌──────────────┐
│    Judge     │  (if enabled) Results → Quality Scores
│   (Judge)    │
└──────────────┘
    │
    ▼
┌──────────────┐
│    Healer    │  (if failed) Failure → Diagnosis → Fixed Code
│   (Heal)     │
└──────────────┘
    │
    ▼
SceneResult
```

## Key Design Decisions

### 1. Autonomous Code Generation
- Generates ACTUAL executable test code, not stubs
- Uses Claude's Opus 4 model for semantic understanding
- Produces production-quality pytest code
- Handles error cases and assertions properly

### 2. Edge Case as First-Class Citizen
- After passing initial test, explore edge cases autonomously
- Not just variations - semantically relevant edge cases
- Prioritizes by relevance to specific scenario
- Each edge case is a full Scene ready for execution

### 3. Agent-Powered Semantic Judgment
- Beyond simple assertions (status code, string matching)
- Use Claude agent to evaluate complex conditions semantically
- "Does the error message help the user?" (qualitative)
- Enables testing of nuanced API behavior

### 4. Self-Healing Through Diagnosis
- Don't just retry failures
- Use Claude to diagnose root cause
- Detect flakiness vs. real failures
- Generate specific fixes
- Suggest improvements

### 5. Fluent Builder API
- SceneBuilder for readable scene construction
- Chainable methods return self
- More readable than nested dicts
- Type-safe (IDE autocompletion)

### 6. Pydantic v2 for Validation
- Strong type validation at boundaries
- Automatic serialization/deserialization
- JSON schema support
- Configuration validation

### 7. Subprocess Isolation
- Tests run in isolated subprocess
- Prevents test code from affecting test runner
- Clean environment for each test
- Easy to implement parallel execution

### 8. Parallel Execution Support
- concurrent.futures for thread pool
- Multiple tests run simultaneously
- Configurable worker count
- Batch reporting aggregates results

## Extension Points

### Custom Assertion Types
- Implement new AssertionType enum values
- Add handling in SemanticJudge._judge_*() methods
- Claude handles semantic assertions automatically

### Custom Judges
- Inherit from SemanticJudge
- Implement judge() method
- Add domain-specific evaluation logic

### Custom Edge Case Strategies
- Extend EdgeExplorer
- Modify _suggest_edge_cases() logic
- Use domain-specific prompts

### Custom Reporters
- Implement Reporter interface
- report_execution(), report_batch(), etc.
- Format output as needed (HTML, JSON, Allure, etc.)

## Performance Considerations

### Parallelization
- Edge case execution runs in parallel by default
- Adjustable worker count (default: 4)
- Batch execution is much faster than sequential

### Caching
- Test plans can be cached (TestPlan objects)
- Reduces re-planning for similar scenarios
- Avoid re-generating same test multiple times

### Timeout Configuration
- Configurable per-test timeout (default: 60s)
- Prevents hanging tests from blocking pipeline
- Subprocess model enables easy timeout enforcement

### Agent Cost Optimization
- Claude agent calls for: plan, explore, judge, heal
- Caching scene plans reduces calls
- Edge case exploration optional (disable if needed)
- Healing optional (disable for faster runs)

## Testing

### Unit Tests
- `tests/test_scene.py`: Scene models and builder
- `tests/test_connection.py`: Connection configuration

### Integration Tests
- Full pipeline with real Claude API
- Can be slow - use mock for CI/CD
- Examples provide integration test patterns

### Mocking Strategy
- Mock Anthropic client for fast tests
- Mock subprocess for deterministic results
- Use fixtures for common test data

## Deployment

### Package Installation
```bash
pip install rigour-qa
```

### Docker
```dockerfile
FROM python:3.11
RUN pip install rigour-qa
COPY scenes.yaml connection.yaml ./
CMD ["rigour-qa", "run", "scenes.yaml"]
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Run Rigour QA tests
  run: |
    pip install rigour-qa
    rigour-qa run scenes.yaml --connection connection.yaml
```

## Future Enhancements

1. **Multi-User Parallel Execution**: Distributed test execution
2. **Historical Trend Analysis**: Track test quality over time
3. **ML-Based Prioritization**: Learn which edge cases are most likely to fail
4. **Web Dashboard**: Visual test management and results
5. **Mobile App Testing**: Playwright support for mobile
6. **Performance Profiling**: Integrate APM tools
7. **Bug Tracking Integration**: Auto-create issues for failures
8. **Visual Regression Testing**: Screenshot comparison
