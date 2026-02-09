# Rigour QA Node.js SDK - Public API Exports

## Overview

Complete list of all publicly exported types, classes, and functions from the `@rigour-labs/qa` package.

## Main Entry Point: `@rigour-labs/qa`

### Scene Types & Classes

```typescript
// Types (inferred from Zod schemas)
import type { Scene, Actor, Step, Assertion, AuthConfig } from '@rigour-labs/qa'

// Enums
import { Priority, AssertionType } from '@rigour-labs/qa'

// Classes
import { SceneClass } from '@rigour-labs/qa'

// Builder
import { SceneBuilder } from '@rigour-labs/qa'

// Parsers
import { parseNaturalLanguage, parseYaml, parseGherkin } from '@rigour-labs/qa'

// Schemas
import { Schemas as SceneSchemas } from '@rigour-labs/qa'
```

### Connection Types & Classes

```typescript
// Type
import type { Connection } from '@rigour-labs/qa'

// Class
import { ConnectionClass } from '@rigour-labs/qa'

// Schemas
import { Schemas as ConnectionSchemas } from '@rigour-labs/qa'
```

### Engine Module

```typescript
// Planner
import { AgenticPlanner } from '@rigour-labs/qa'
import type { TestPlan, TestCase } from '@rigour-labs/qa'

// Executor
import { AgenticExecutor, TestRunner } from '@rigour-labs/qa'
import type { ExecutionResult, AssertionResult } from '@rigour-labs/qa'

// Explorer
import { EdgeExplorer } from '@rigour-labs/qa'
import type { ExplorationResult } from '@rigour-labs/qa'
```

### Judges Module

```typescript
// Judge
import { SemanticJudge } from '@rigour-labs/qa'
import type { JudgmentResult } from '@rigour-labs/qa'
```

### Agents Module

```typescript
// Healer
import { SelfHealer } from '@rigour-labs/qa'
import type { Diagnosis } from '@rigour-labs/qa'

// Healing Strategies
import {
  HealingStrategy,
  AssertionMismatchHealer,
  TimeoutHealer,
  EnvironmentIssueHealer
} from '@rigour-labs/qa'
```

### Reporters Module

```typescript
// Console Reporter
import { ConsoleReporter, createConsoleReporter } from '@rigour-labs/qa'
```

### Main Runner

```typescript
// RigourQA
import { RigourQA } from '@rigour-labs/qa'
import type { RigourQAConfig, QAReport } from '@rigour-labs/qa'

// Utility
import { createRigourQA } from '@rigour-labs/qa'
```

### Metadata

```typescript
// Version
import { VERSION } from '@rigour-labs/qa'
```

## Usage Examples

### Basic Import

```typescript
import {
  RigourQA,
  ConnectionClass,
  parseYaml,
  SceneBuilder,
  Priority,
  AssertionType,
  ConsoleReporter
} from '@rigour-labs/qa'
```

### With Types

```typescript
import type {
  Scene,
  ExecutionResult,
  JudgmentResult,
  TestPlan,
  QAReport
} from '@rigour-labs/qa'

import {
  RigourQA,
  AgenticPlanner,
  AgenticExecutor,
  SemanticJudge,
  SelfHealer
} from '@rigour-labs/qa'
```

### Destructuring Specific Modules

```typescript
// Scene module
import { SceneBuilder, parseNaturalLanguage, parseYaml } from '@rigour-labs/qa'

// Engine module
import { AgenticPlanner, AgenticExecutor, EdgeExplorer } from '@rigour-labs/qa'

// All modules
import * as RigourQA from '@rigour-labs/qa'
```

## Type Definitions

### Priority Enum
```typescript
enum Priority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low"
}
```

### AssertionType Enum
```typescript
enum AssertionType {
  STATUS_CODE = "status_code",
  BODY_CONTAINS = "body_contains",
  BODY_SCHEMA = "body_schema",
  DB_STATE = "db_state",
  RESPONSE_TIME = "response_time",
  HEADER_CONTAINS = "header_contains",
  SEMANTIC = "semantic",
  CUSTOM = "custom"
}
```

### Scene Interface
```typescript
interface Scene {
  id: string
  title: string
  description: string
  actor?: Actor
  steps?: Step[]
  assertions?: Assertion[]
  edge_cases?: string[]
  tags?: string[]
  priority?: Priority
  created_at?: Date
  metadata?: Record<string, unknown>
}
```

### Actor Interface
```typescript
interface Actor {
  role: "admin" | "user" | "anonymous" | "api_client"
  auth?: AuthConfig
  persona?: string
  metadata?: Record<string, unknown>
}
```

### Assertion Interface
```typescript
interface Assertion {
  type: AssertionType
  target: string
  expected: unknown
  semantic_prompt?: string
  tolerance?: number
  metadata?: Record<string, unknown>
}
```

### AuthConfig Interface
```typescript
interface AuthConfig {
  type: "bearer" | "basic" | "api_key" | "oauth"
  value?: string
  username?: string
  password?: string
  client_id?: string
  client_secret?: string
}
```

### Connection Interface
```typescript
interface Connection {
  name: string
  type: "http" | "websocket" | "graphql" | "grpc" | "ui"
  base_url?: string
  headers?: Record<string, string>
  timeout: number
  retry?: { max_attempts: number; backoff_ms: number }
  auth?: { type: string; credentials: Record<string, unknown> }
  tls?: {
    enabled: boolean
    verify: boolean
    cert_path?: string
    key_path?: string
    ca_path?: string
  }
  proxy?: { url: string; username?: string; password?: string }
  metadata?: Record<string, unknown>
}
```

### TestPlan Interface
```typescript
interface TestPlan {
  id: string
  scene_id: string
  name: string
  description: string
  test_code: string
  test_cases: TestCase[]
  execution_order: string[]
  environment: Record<string, unknown>
  setup_code?: string
  teardown_code?: string
  dependencies: string[]
  estimated_duration_ms: number
}
```

### ExecutionResult Interface
```typescript
interface ExecutionResult {
  plan_id: string
  status: "passed" | "failed" | "skipped" | "error"
  passed_count: number
  failed_count: number
  skipped_count: number
  total_count: number
  duration_ms: number
  error?: string
  output: string
  assertions: AssertionResult[]
  coverage?: Record<string, number>
  timestamp: Date
}
```

### JudgmentResult Interface
```typescript
interface JudgmentResult {
  assertion: Assertion
  passed: boolean
  confidence: number
  reasoning: string
  expected?: unknown
  actual?: unknown
  remediation?: string
}
```

### Diagnosis Interface
```typescript
interface Diagnosis {
  issue_type:
    | "assertion_mismatch"
    | "timeout"
    | "network_error"
    | "syntax_error"
    | "logic_error"
    | "environment_issue"
    | "unknown"
  severity: "critical" | "high" | "medium" | "low"
  root_cause: string
  affected_assertions: string[]
  recommendations: string[]
}
```

### QAReport Interface
```typescript
interface QAReport {
  id: string
  timestamp: Date
  scenes_tested: number
  total_plans: number
  passed_plans: number
  failed_plans: number
  edge_cases_explored: number
  total_duration_ms: number
  executions: ExecutionResult[]
  judgments: JudgmentResult[]
  healed_tests: number
}
```

### RigourQAConfig Interface
```typescript
interface RigourQAConfig {
  connection: Connection
  max_iterations?: number
  explore_edge_cases?: boolean
  auto_heal?: boolean
  report_format?: "json" | "html" | "markdown"
  parallel_execution?: boolean
}
```

## Zod Schemas

Exported for custom validation:

```typescript
import { Schemas as SceneSchemas } from '@rigour-labs/qa'
import { Schemas as ConnectionSchemas } from '@rigour-labs/qa'

// Usage
SceneSchemas.Scene.parse(sceneData)
ConnectionSchemas.Connection.parse(connectionData)
```

## Main Classes

### SceneClass
```typescript
class SceneClass implements Scene {
  addStep(action, input?, expect?): this
  addAssertion(type, target, expected, semanticPrompt?): this
  addEdgeCase(description): this
  addTag(tag): this
  setPriority(priority): this
  setActor(actor): this
  validate(): boolean
  toJSON(): Scene
}
```

### SceneBuilder
```typescript
class SceneBuilder {
  static create(title, description): SceneBuilder
  addActor(role, persona?): this
  addStep(action, input?, expect?): this
  addAssertion(type, target, expected, semanticPrompt?): this
  addEdgeCase(description): this
  addTag(tag): this
  priority(priority): this
  metadata(key, value): this
  build(): Scene
}
```

### ConnectionClass
```typescript
class ConnectionClass implements Connection {
  static fromYaml(path): ConnectionClass
  static fromEnv(prefix?): ConnectionClass
  getUrl(endpoint): string
  getHeaders(): Record<string, string>
  validate(): boolean
  toJSON(): Connection
}
```

### AgenticPlanner
```typescript
class AgenticPlanner {
  plan(scene, connection): Promise<TestPlan>
  generateTestCode(plan): Promise<string>
  exploreEdgeCases(scene, plan): Promise<TestPlan[]>
}
```

### AgenticExecutor
```typescript
class AgenticExecutor {
  execute(plan, connection): Promise<ExecutionResult>
}
```

### EdgeExplorer
```typescript
class EdgeExplorer {
  explore(scene, results): Promise<ExplorationResult>
  generateBoundaryTests(scene): Promise<Scene[]>
  generateAuthEdgeCases(scene): Promise<Scene[]>
  generateTimingTests(scene): Promise<Scene[]>
  generateDataValidationTests(scene): Promise<Scene[]>
  generateStateTransitionTests(scene): Promise<Scene[]>
}
```

### SemanticJudge
```typescript
class SemanticJudge {
  judge(assertion, actual, context): Promise<JudgmentResult>
  judgeBatch(assertions, actuals, context): Promise<JudgmentResult[]>
  summarizeJudgments(results): {
    total: number
    passed: number
    failed: number
    passRate: number
    averageConfidence: number
  }
}
```

### SelfHealer
```typescript
class SelfHealer {
  diagnose(failure): Promise<Diagnosis>
  heal(diagnosis, testCode): Promise<string>
  recover(failure): Promise<{ recovered: boolean; fixedCode?: string }>
  suggestAlternatives(failure): Promise<string[]>
}
```

### RigourQA (extends EventEmitter)
```typescript
class RigourQA extends EventEmitter {
  runScene(scene): Promise<ExecutionResult>
  runScenes(scenes): Promise<ExecutionResult[]>
  generateReport(scenes, results, judgments): QAReport
  exportReport(report): string

  // Event listeners
  onSceneStart(callback): this
  onPhaseStart(callback): this
  onPhaseComplete(callback): this
  onSceneComplete(callback): this
  onRunComplete(callback): this
}
```

### ConsoleReporter
```typescript
class ConsoleReporter {
  reportTestStart(sceneId, title): void
  reportPhaseStart(sceneId, phase): void
  reportPhaseComplete(sceneId, phase, data): void
  reportTestComplete(result): void
  reportExecutionResult(result): void
  reportJudgments(judgments): void
  reportSummary(report): void
  reportError(error, context?): void
  reportProgress(current, total, label?): void
  reportTable(headers, rows): void
  clearSpinners(): void
}
```

## Functions

### Parsers
```typescript
parseNaturalLanguage(text: string): Promise<Scene>
parseYaml(path: string): Promise<Scene[]>
parseGherkin(text: string): Scene
```

### Utilities
```typescript
createConsoleReporter(): ConsoleReporter
createRigourQA(config: RigourQAConfig): Promise<RigourQA>
```

## Module Exports

### Scene Module
```typescript
export * from './scene/schema'
export * from './scene/parser'
```

### Engine Module
```typescript
export * from './engine/planner'
export * from './engine/executor'
export * from './engine/explorer'
```

### Judges Module
```typescript
export * from './judges/semantic'
```

### Agents Module
```typescript
export * from './agents/healer'
```

### Reporters Module
```typescript
export * from './reporters/console'
```

## Summary

**Total Exports**: 50+ types, classes, interfaces, functions, and constants

The API is designed to be intuitive and type-safe with full TypeScript support. All major classes are exported for extending and customizing behavior.
