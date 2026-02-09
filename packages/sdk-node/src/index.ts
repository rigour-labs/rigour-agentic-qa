/**
 * Rigour QA - Agentic QA SDK for autonomous test generation and execution
 * Public API exports
 */

// Scene exports
export {
  Scene,
  Actor,
  Step,
  Assertion,
  AssertionType,
  Priority,
  AuthConfig,
  SceneClass,
  Schemas as SceneSchemas,
} from "./scene/schema.js";

export {
  SceneBuilder,
  parseNaturalLanguage,
  parseYaml,
  parseGherkin,
} from "./scene/parser.js";

// Connection exports
export {
  Connection,
  ConnectionClass,
  Schemas as ConnectionSchemas,
} from "./connection.js";

// Engine exports
export {
  AgenticPlanner,
  TestPlan,
  TestCase,
} from "./engine/planner.js";

export {
  AgenticExecutor,
  ExecutionResult,
  AssertionResult,
  TestRunner,
} from "./engine/executor.js";

export {
  EdgeExplorer,
  ExplorationResult,
} from "./engine/explorer.js";

// Judge exports
export {
  SemanticJudge,
  JudgmentResult,
} from "./judges/semantic.js";

// Agent exports
export {
  SelfHealer,
  Diagnosis,
  HealingStrategy,
  AssertionMismatchHealer,
  TimeoutHealer,
  EnvironmentIssueHealer,
} from "./agents/healer.js";

// Reporter exports
export {
  ConsoleReporter,
  createConsoleReporter,
} from "./reporters/console.js";

// Main runner exports
export {
  RigourQA,
  RigourQAConfig,
  QAReport,
} from "./runners/rigour-qa.js";

// Version
export const VERSION = "0.1.0";

/**
 * Utility function to create RigourQA instances
 */
export async function createRigourQA(config: any): Promise<any> {
  const { RigourQA: RigourQAClass } = await import("./runners/rigour-qa.js");
  return new RigourQAClass(config);
}
