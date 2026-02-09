# Rigour QA - Node.js SDK

An agentic QA framework for autonomous test generation and execution using Claude AI. Mirror implementation of the Python SDK.

## Features

- **Agentic Test Planning**: Claude generates comprehensive test plans from natural language scenarios
- **Autonomous Execution**: Playwright-based test execution with built-in retry and recovery
- **Edge Case Exploration**: Automatically discovers and tests boundary conditions and edge cases
- **Semantic Judging**: Agent-powered assertion evaluation with context awareness
- **Self-Healing**: Automatic diagnosis and fixing of failing tests
- **Multi-Format Parsing**: YAML, Gherkin (Given/When/Then), and natural language scene parsing
- **Event-Driven Pipeline**: Observable test execution with real-time progress reporting

## Installation

```bash
npm install @rigour-labs/qa
```

## Quick Start

### 1. Create a Connection Config

`connection.yaml`:
```yaml
name: api-testing
type: http
base_url: https://api.example.com
timeout: 30000
headers:
  Content-Type: application/json
auth:
  type: bearer
  credentials:
    token: your-token-here
```

### 2. Define Test Scenarios

`scenes.yaml`:
```yaml
- title: User Authentication
  description: Test login with valid credentials
  actor:
    role: user
    persona: Regular registered user
  assertions:
    - type: status_code
      target: response
      expected: 200
    - type: body_contains
      target: response
      expected: "success"
  priority: critical
  tags:
    - auth
    - critical-path

- title: API Rate Limiting
  description: Test rate limit headers in response
  edge_cases:
    - Test with 1000+ requests per minute
    - Test with invalid rate limit headers
    - Test after rate limit reset
```

### 3. Run Tests

```bash
rigour-qa run scenes.yaml --connection connection.yaml
```

## API Usage

### Using the JavaScript API

```typescript
import { RigourQA, ConnectionClass, parseYaml, ConsoleReporter } from '@rigour-labs/qa';

// Load configuration
const connection = ConnectionClass.fromYaml('connection.yaml');
const scenes = await parseYaml('scenes.yaml');

// Create runner with configuration
const rigour = new RigourQA({
  connection,
  explore_edge_cases: true,
  auto_heal: true,
  parallel_execution: false,
  report_format: 'json'
});

// Setup event listeners
const reporter = new ConsoleReporter();

rigour.onSceneStart((data) => {
  reporter.reportTestStart(data.scene_id, data.title);
});

rigour.onPhaseComplete((data) => {
  reporter.reportPhaseComplete(data.scene_id, data.phase, data);
});

// Run all scenes
const results = await rigour.runScenes(scenes);

// Generate and export report
const report = rigour.generateReport(scenes, results, []);
const reportJson = rigour.exportReport(report);
```

### Building Scenes Programmatically

```typescript
import { SceneBuilder, Priority, AssertionType } from '@rigour-labs/qa';

const scene = SceneBuilder.create('Login Test', 'Test user login flow')
  .addActor('user', 'Regular user')
  .addStep('POST /login', { username: 'user@example.com', password: 'password' })
  .addAssertion(AssertionType.STATUS_CODE, 'response', 200)
  .addAssertion(AssertionType.BODY_CONTAINS, 'response', 'token')
  .addEdgeCase('Test with invalid password')
  .addEdgeCase('Test with non-existent user')
  .addTag('auth')
  .priority(Priority.CRITICAL)
  .build();
```

### Parsing Natural Language

```typescript
import { parseNaturalLanguage } from '@rigour-labs/qa';

const description = `
  Test that when a user logs in with valid credentials,
  they receive a 200 status code and a session token.
  Also test edge cases like invalid passwords and non-existent users.
`;

const scene = await parseNaturalLanguage(description);
```

### Parsing Gherkin Format

```typescript
import { parseGherkin } from '@rigour-labs/qa';

const gherkinText = `
  Feature: User Authentication

  Scenario: Successful login
    Given user is on login page
    When user enters valid credentials
    And user clicks login button
    Then user should see dashboard
    And user should have session token
`;

const scene = parseGherkin(gherkinText);
```

## CLI Commands

### Run Tests

```bash
rigour-qa run <scenes-file> [options]

Options:
  -c, --connection <path>    Connection config file (default: connection.yaml)
  -p, --parallel            Run tests in parallel
  --no-edge-cases           Skip edge case exploration
  --no-heal                 Skip automatic healing
  -o, --output <path>       Report output path (default: rigour-qa-report.json)
  -f, --format <format>     Report format: json|markdown|html (default: json)
```

Examples:
```bash
# Run with default settings
rigour-qa run scenes.yaml

# Run with custom connection and output
rigour-qa run scenes.yaml -c prod-connection.yaml -o results.json

# Run in parallel with HTML report
rigour-qa run scenes.yaml -p -f html -o report.html

# Skip edge cases and auto-healing
rigour-qa run scenes.yaml --no-edge-cases --no-heal
```

### Initialize Project

```bash
rigour-qa init [options]

Options:
  -d, --dir <path>   Target directory (default: .)
```

Creates template files:
- `scenes.yaml` - Example test scenarios
- `connection.yaml` - Connection configuration
- `.rigour-qa.yaml` - Framework configuration

### Explore Edge Cases

```bash
rigour-qa explore <scenes-file> [options]

Options:
  -c, --connection <path>   Connection config file
  -o, --output <path>       Output edge cases file
```

## Core Concepts

### Scene

A scene represents a test scenario in natural or structured language:

```typescript
interface Scene {
  id: string;                    // Unique identifier
  title: string;                 // Short title
  description: string;           // Full description
  actor?: Actor;                 // Who performs the test
  steps?: Step[];                // Test steps (optional, auto-generated)
  assertions?: Assertion[];      // Expected outcomes
  edge_cases?: string[];         // Edge case hints
  tags?: string[];               // Filter tags
  priority?: Priority;           // critical|high|medium|low
  created_at?: Date;
  metadata?: Record<string, any>;
}
```

### Test Plan

Generated by the planner, containing executable test code:

```typescript
interface TestPlan {
  id: string;
  scene_id: string;
  name: string;
  test_code: string;            // Playwright code
  test_cases: TestCase[];
  execution_order: string[];
  setup_code?: string;
  teardown_code?: string;
  estimated_duration_ms: number;
}
```

### Execution Result

Outcome of test execution:

```typescript
interface ExecutionResult {
  plan_id: string;
  status: 'passed' | 'failed' | 'skipped' | 'error';
  passed_count: number;
  failed_count: number;
  duration_ms: number;
  assertions: AssertionResult[];
  error?: string;
}
```

### Judgment Result

Agent evaluation of assertions:

```typescript
interface JudgmentResult {
  assertion: Assertion;
  passed: boolean;
  confidence: number;            // 0-1
  reasoning: string;
  remediation?: string;
}
```

## Architecture

The SDK follows a modular pipeline architecture:

```
Scene (Natural Language/YAML/Gherkin)
  ↓
[Parser] → Scene Object
  ↓
[Planner] → TestPlan (Playwright Code)
  ↓
[Executor] → ExecutionResult
  ↓
[Judge] → JudgmentResult
  ↓
[Explorer] → Edge Case Scenes
  ↓
[Healer] → Fixed Test Code (if failed)
  ↓
[Reporter] → QA Report
```

### Modules

- **scene/**: Scene definitions, parsing, and building
- **engine/**: Test planning, execution, and exploration
- **judges/**: Assertion evaluation with semantic understanding
- **agents/**: Self-healing and recovery mechanisms
- **reporters/**: Result formatting and reporting
- **runners/**: Main orchestration and pipeline coordination

## Configuration

### Connection Configuration

Supports multiple connection types:

```yaml
# HTTP API
type: http
base_url: https://api.example.com
headers:
  Content-Type: application/json

# WebSocket
type: websocket
base_url: ws://localhost:8080

# GraphQL
type: graphql
base_url: https://api.example.com/graphql

# UI/Playwright
type: ui
base_url: https://app.example.com

# gRPC
type: grpc
base_url: grpc://localhost:50051
```

### Authentication

Supported auth types:

```yaml
auth:
  type: bearer          # Bearer token
  credentials:
    token: "..."

auth:
  type: basic           # Basic auth
  credentials:
    username: "user"
    password: "pass"

auth:
  type: api_key         # API key
  credentials:
    key: "..."

auth:
  type: oauth           # OAuth
  credentials:
    client_id: "..."
    client_secret: "..."
```

## Assertion Types

- `status_code` - HTTP status code
- `body_contains` - Response body contains string
- `body_schema` - Response matches JSON schema
- `header_contains` - Response header contains value
- `response_time` - Response time within tolerance
- `db_state` - Database state matches expected
- `semantic` - Custom agent-evaluated assertion
- `custom` - Custom assertion logic

## Event Listeners

Monitor test execution with event listeners:

```typescript
rigour.onSceneStart((data) => {
  console.log(`Started: ${data.title}`);
});

rigour.onPhaseStart((data) => {
  console.log(`Phase: ${data.phase}`);
});

rigour.onPhaseComplete((data) => {
  console.log(`Complete: ${data.phase} - ${data.status}`);
});

rigour.onSceneComplete((data) => {
  console.log(`Scene ${data.scene_id}: ${data.status}`);
});

rigour.onRunComplete((data) => {
  console.log(`Execution: ${data.passed} passed, ${data.failed} failed`);
});
```

## Advanced Usage

### Custom Healing Strategies

```typescript
import { HealingStrategy, SelfHealer, Diagnosis } from '@rigour-labs/qa';

class CustomHealer implements HealingStrategy {
  canHandle(diagnosis: Diagnosis): boolean {
    return diagnosis.issue_type === 'custom_issue';
  }

  async apply(testCode: string, diagnosis: Diagnosis): Promise<string> {
    // Custom healing logic
    return fixedCode;
  }
}

const healer = new SelfHealer();
const fixed = await healer.heal(diagnosis, testCode);
```

### Edge Case Generation

```typescript
import { EdgeExplorer } from '@rigour-labs/qa';

const explorer = new EdgeExplorer();

// Generate specific types of edge cases
const boundaryTests = await explorer.generateBoundaryTests(scene);
const authTests = await explorer.generateAuthEdgeCases(scene);
const timingTests = await explorer.generateTimingTests(scene);
const validationTests = await explorer.generateDataValidationTests(scene);
const stateTests = await explorer.generateStateTransitionTests(scene);
```

### Custom Reporters

```typescript
import { RigourQA } from '@rigour-labs/qa';

class CustomReporter {
  onResult(result: ExecutionResult) {
    // Custom reporting logic
  }
}

const reporter = new CustomReporter();
// Integrate with RigourQA event emitter
```

## Environment Variables

Configure via environment variables with `RIGOUR_` prefix:

```bash
export RIGOUR_NAME=my-connection
export RIGOUR_TYPE=http
export RIGOUR_BASE_URL=https://api.example.com
export RIGOUR_TIMEOUT=30000
export RIGOUR_AUTH_TYPE=bearer
export RIGOUR_AUTH_TOKEN=my-token
export RIGOUR_HEADER_X_API_KEY=my-key
```

Load in code:
```typescript
const connection = ConnectionClass.fromEnv('RIGOUR');
```

## Testing

```bash
npm run build    # Build TypeScript
npm run lint     # Type check
npm test         # Run tests (configure in package.json)
npm run dev      # Watch mode
```

## Error Handling

The framework includes comprehensive error handling:

- **Planning Errors**: Scene parsing and test plan generation
- **Execution Errors**: Test runtime failures
- **Assertion Errors**: Failed assertions with detailed context
- **Healing Errors**: Recovery attempt failures

All errors emit events and are captured in execution results.

## Performance

- Parallel test execution for multiple scenes
- Efficient Playwright browser management
- Cached Claude responses where possible
- Configurable timeouts and retry logic

## License

MIT

## Support

For issues, questions, or contributions, please refer to the main Rigour Labs repository.
