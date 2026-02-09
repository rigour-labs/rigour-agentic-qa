# Rigour QA Node.js SDK - Architecture Guide

## Overview

The Rigour QA SDK is an agentic QA framework that automatically generates, executes, and explores test cases using Claude AI and Playwright. This document describes the architecture, design patterns, and component interactions.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Interface                            │
│                  (src/cli.ts)                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                   RigourQA Runner                            │
│              (src/runners/rigour-qa.ts)                      │
│          Orchestrates the testing pipeline                   │
└──────────────────┬────────────────────┬──────────────────────┘
                   │                    │
    ┌──────────────▼──────────┐   ┌────▼─────────────────────┐
    │   Scene Parsing Layer   │   │   Execution Pipeline     │
    │  (src/scene/parser.ts)  │   │                          │
    │                         │   │  1. Planning (Planner)   │
    │ • Natural Language      │   │  2. Execution (Executor) │
    │ • YAML                  │   │  3. Judging (Judge)      │
    │ • Gherkin               │   │  4. Exploration (Explorer)
    │                         │   │  5. Healing (Healer)     │
    └─────────────────────────┘   │                          │
                                  └────┬──────────────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
    ┌───────────▼──────┐   ┌──────────▼──────┐   ┌──────────▼──────┐
    │  Engine Module   │   │  Judges Module   │   │  Agents Module  │
    │  (src/engine/)   │   │  (src/judges/)   │   │  (src/agents/)  │
    │                  │   │                  │   │                 │
    │ • Planner        │   │ • SemanticJudge  │   │ • SelfHealer    │
    │ • Executor       │   │   (agent-based)  │   │ • Strategies    │
    │ • Explorer       │   │                  │   │                 │
    └──────────────────┘   └──────────────────┘   └─────────────────┘
                │
    ┌───────────┴──────────────┐
    │   Reporter Module        │
    │   (src/reporters/)       │
    │                          │
    │ • ConsoleReporter        │
    │ • HTML/Markdown/JSON     │
    └──────────────────────────┘
```

## Core Components

### 1. Scene Module (src/scene/)

**Purpose**: Define, parse, and build test scenarios.

**Components**:
- `schema.ts`: Zod-validated types for Scene, Actor, Step, Assertion
- `parser.ts`: Parsers for natural language, YAML, Gherkin, and SceneBuilder

**Key Classes**:
```typescript
class SceneClass {
  addStep(action, input?, expect?)
  addAssertion(type, target, expected, prompt?)
  addEdgeCase(description)
  validate()
}

class SceneBuilder {
  static create(title, description)
  addActor(role, persona?)
  addStep(...)
  build()
}
```

**Data Flow**:
```
Input (YAML/Natural/Gherkin)
  ↓
Parser converts to Scene object
  ↓
Zod validates against SceneSchema
  ↓
Returns validated Scene
```

### 2. Engine Module (src/engine/)

**Purpose**: Test planning, execution, and exploration.

#### 2.1 Planner (planner.ts)

**Responsibility**: Generate comprehensive test plans using Claude.

**Process**:
1. Receive Scene object
2. Build planning prompt with scene details, connection info
3. Call Claude API (claude-opus-4-6)
4. Parse response into TestPlan with test cases and code
5. Optionally generate Playwright test code
6. Explore edge cases

**Output**:
```typescript
interface TestPlan {
  id: string;
  test_code: string;  // Playwright code
  test_cases: TestCase[];
  setup_code?: string;
  teardown_code?: string;
  estimated_duration_ms: number;
}
```

#### 2.2 Executor (executor.ts)

**Responsibility**: Execute generated test code and capture results.

**Process**:
1. Write test code to temporary file
2. Spawn Playwright process
3. Capture stdout/stderr
4. Parse test output for results
5. Extract assertion outcomes
6. Return ExecutionResult

**Key Features**:
- Handles both passed and failed tests
- Captures timing information
- Parses Playwright assertion results
- Returns structured ExecutionResult

#### 2.3 Explorer (explorer.ts)

**Responsibility**: Identify and generate edge case test scenarios.

**Edge Case Categories**:
- Boundary values (min, max, zero, negative)
- Authentication/authorization scenarios
- Timing and race conditions
- Data validation and security
- State transitions
- Network failures
- Concurrent operations

**Process**:
1. Analyze original scene and execution results
2. Call Claude to identify edge cases
3. Generate new Scene objects for each edge case
4. Tag with edge case category
5. Return list of new scenes

### 3. Judges Module (src/judges/)

**Purpose**: Evaluate assertion results with semantic understanding.

**SemanticJudge**:
- Simple judgment: Direct comparison for standard types
- Semantic judgment: Agent-powered evaluation for custom assertions
- Supports schema validation and object comparison
- Returns confidence scores

**Assertion Types**:
```
- status_code: HTTP status code matching
- body_contains: Response body text search
- body_schema: JSON schema validation
- header_contains: Header value matching
- response_time: Timing assertions with tolerance
- db_state: Database state verification
- semantic: Custom agent-evaluated assertions
- custom: User-defined logic
```

**Output**:
```typescript
interface JudgmentResult {
  assertion: Assertion;
  passed: boolean;
  confidence: number;  // 0-1
  reasoning: string;
  remediation?: string;
}
```

### 4. Agents Module (src/agents/)

**Purpose**: Autonomous diagnosis and healing of failing tests.

**SelfHealer**:
1. `diagnose()`: Analyze failure to identify root cause
   - Issue types: assertion_mismatch, timeout, network_error, syntax_error, logic_error, environment_issue
   - Returns: Diagnosis with severity and recommendations

2. `heal()`: Generate fixed test code
   - Takes diagnosis and current test code
   - Uses Claude to generate repairs
   - Returns: Fixed Playwright code

3. `recover()`: Attempt automatic recovery
   - Evaluates if recovery is possible
   - Applies healing strategy
   - Returns: Recovered code or failure

**Healing Strategies** (Strategy pattern):
- `AssertionMismatchHealer`: Fix assertion expectations
- `TimeoutHealer`: Increase timeouts and add waits
- `EnvironmentIssueHealer`: Add env variable validation

### 5. Reporters Module (src/reporters/)

**Purpose**: Format and output test results.

**ConsoleReporter**:
- Color-coded output (chalk)
- Progress spinners (ora)
- Formatted tables
- Summary statistics
- Multiple report formats (JSON, Markdown, HTML)

**Methods**:
```typescript
reportTestStart(sceneId, title)
reportPhaseComplete(sceneId, phase, data)
reportTestComplete(result)
reportSummary(report)
reportTable(headers, rows)
```

### 6. Connection Module (src/connection.ts)

**Purpose**: Manage environment configuration with validation.

**ConnectionClass**:
- Zod-validated configuration
- Support for HTTP, WebSocket, GraphQL, gRPC, UI
- Authentication management (Bearer, Basic, API Key, OAuth)
- URL building with base_url
- Header management with auth injection
- Environment variable loading

### 7. Main Runner (src/runners/rigour-qa.ts)

**Purpose**: Orchestrate the entire testing pipeline.

**Pipeline Flow**:
```
Scene
  ↓
Parse (Parser) → Scene object
  ↓
Plan (Planner) → TestPlan
  ↓
Execute (Executor) → ExecutionResult
  ↓
Judge (SemanticJudge) → JudgmentResult[]
  ↓
[If Failed & Auto-heal enabled]
  Diagnose (SelfHealer) → Diagnosis
  Heal (SelfHealer) → Fixed TestPlan
  Re-execute (Executor) → ExecutionResult
  ↓
[If Passed & Edge-case exploration enabled]
  Explore (EdgeExplorer) → Edge Case Scenes
  ↓
Report (Reporter) → QA Report
```

**RigourQA Class**:
```typescript
class RigourQA extends EventEmitter {
  runScene(scene: Scene): Promise<ExecutionResult>
  runScenes(scenes: Scene[]): Promise<ExecutionResult[]>
  generateReport(): QAReport
  exportReport(format: string): string

  // Events
  onSceneStart()
  onPhaseStart()
  onPhaseComplete()
  onSceneComplete()
  onRunComplete()
}
```

## Data Models

### Scene Model
```typescript
interface Scene {
  id: string;
  title: string;
  description: string;
  actor?: Actor;
  steps?: Step[];
  assertions?: Assertion[];
  edge_cases?: string[];
  tags?: string[];
  priority?: Priority;
  metadata?: Record<string, unknown>;
}
```

### Assertion Model
```typescript
interface Assertion {
  type: AssertionType;
  target: string;
  expected: unknown;
  semantic_prompt?: string;
  tolerance?: number;
  metadata?: Record<string, unknown>;
}
```

### ExecutionResult Model
```typescript
interface ExecutionResult {
  plan_id: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  passed_count: number;
  failed_count: number;
  skipped_count: number;
  total_count: number;
  duration_ms: number;
  output: string;
  assertions: AssertionResult[];
  error?: string;
  timestamp: Date;
}
```

## Design Patterns

### 1. Builder Pattern
Used in SceneBuilder for fluent scene construction:
```typescript
SceneBuilder.create("title", "description")
  .addStep(...)
  .addAssertion(...)
  .build()
```

### 2. Strategy Pattern
Healing strategies implement HealingStrategy interface:
```typescript
interface HealingStrategy {
  canHandle(diagnosis): boolean
  apply(code, diagnosis): Promise<string>
}
```

### 3. Factory Pattern
Parser functions create Scene objects from various formats.

### 4. Observer Pattern
EventEmitter in RigourQA for event-driven progress reporting:
```typescript
rigour.on('scene_start', callback)
rigour.on('phase_complete', callback)
```

### 5. Zod Schema Validation
Runtime validation with TypeScript type inference:
```typescript
const schema = z.object({ ... })
type Scene = z.infer<typeof schema>
```

## Asynchronous Flow

All major operations are async:

```typescript
// Planning: calls Claude API
const plan = await planner.plan(scene, connection)

// Execution: spawns child process
const result = await executor.execute(plan, connection)

// Judging: Agent evaluation for semantic assertions
const judgment = await judge.judge(assertion, actual, context)

// Exploration: Claude identifies edge cases
const edgeCases = await explorer.explore(scene, result)

// Healing: Claude generates fixes
const fixed = await healer.heal(diagnosis, code)
```

## Error Handling

**Levels**:
1. **Zod Schema Validation**: Runtime validation of inputs
2. **API Errors**: Claude API failures caught and returned in results
3. **Execution Errors**: Test runtime errors captured in ExecutionResult
4. **Healing Fallback**: If healing fails, original result is returned
5. **Event Emission**: All errors emitted as events for monitoring

**Error Recovery**:
- Scene parsing: Falls back to raw description
- Test execution: Attempts auto-healing if configured
- API calls: Includes error message in results
- File I/O: Thrown explicitly for user action

## Performance Considerations

### 1. Parallelization
- `parallel_execution: true` runs multiple scenes concurrently
- Uses Promise.all() for parallel execution

### 2. Caching
- Test plans can be cached and reused
- Edge case generation cached per scene

### 3. Timeouts
- Configurable connection timeout
- Test execution timeout through Playwright
- Claude API timeout (built-in)

### 4. Resource Management
- Temporary test files cleaned up after execution
- Playwright browser contexts properly closed
- No memory leaks from long-running processes

## Extension Points

### Custom Reporters
```typescript
class MyReporter {
  onResult(result: ExecutionResult) { ... }
}
```

### Custom Healing Strategies
```typescript
class MyHealer implements HealingStrategy {
  canHandle(diagnosis) { ... }
  apply(code, diagnosis) { ... }
}
```

### Custom Judges
```typescript
class MyJudge {
  judge(assertion, actual, context) { ... }
}
```

### Custom Parsers
Implement scene parsing from custom formats by extending parser.ts.

## Dependencies

**Direct Dependencies**:
- `@anthropic-ai/sdk`: Claude API integration
- `playwright`: Browser automation
- `zod`: Schema validation
- `chalk`: Terminal colors
- `ora`: Loading spinners
- `commander`: CLI parsing
- `yaml`: YAML parsing
- `uuid`: Unique ID generation

**No external database or storage dependencies** - fully stateless.

## Configuration

Configuration flows through multiple layers:

1. **Default Configuration**: src/runners/rigour-qa.ts
2. **User Configuration**: connection.yaml, .rigour-qa.yaml
3. **Environment Variables**: RIGOUR_* prefix
4. **Runtime Arguments**: CLI options

## Testing Strategy

Recommendation for testing the SDK:

```typescript
// Unit tests: Individual components
test('SceneBuilder creates valid scene', async () => {
  const scene = SceneBuilder.create('Test', 'Desc').build()
  assert(scene.validate())
})

// Integration tests: Component interaction
test('Planner generates code from scene', async () => {
  const plan = await planner.plan(scene, connection)
  assert(plan.test_code.includes('test('))
})

// E2E tests: Full pipeline
test('Full pipeline from scene to report', async () => {
  const results = await rigour.runScenes(scenes)
  assert(results.every(r => r.status))
})
```

## Future Enhancements

Potential improvements:

1. **Distributed Execution**: Run tests across multiple machines
2. **Result Caching**: Cache execution results for deterministic tests
3. **Test Analytics**: Trend analysis and failure pattern detection
4. **Multi-Model Support**: Support other AI models beyond Claude
5. **Native Playwright Fixtures**: Deep Playwright integration
6. **Database Integration**: Native DB assertion support
7. **API Mocking**: Built-in mock server support
8. **Performance Profiling**: Automatic performance regression detection
