/**
 * Agentic test planner - generates comprehensive test plans
 */

import { Anthropic } from "@anthropic-ai/sdk";
import { Scene, Step, Assertion, AssertionType } from "../scene/schema.js";
import { Connection } from "../connection.js";

export interface TestPlan {
  id: string;
  scene_id: string;
  name: string;
  description: string;
  test_code: string;
  test_cases: TestCase[];
  execution_order: string[];
  environment: Record<string, unknown>;
  setup_code?: string;
  teardown_code?: string;
  dependencies: string[];
  estimated_duration_ms: number;
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  steps: string[];
  assertions: string[];
  variables: Record<string, unknown>;
  timeout_ms: number;
}

const client = new Anthropic();

/**
 * Agentic planner that generates test cases and Playwright code
 */
export class AgenticPlanner {
  /**
   * Generate a comprehensive test plan from a scene
   */
  async plan(scene: Scene, connection: Connection): Promise<TestPlan> {
    const planningPrompt = this.buildPlanningPrompt(scene, connection);

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: planningPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const planData = JSON.parse(content.text);

    return {
      id: `plan_${Date.now()}`,
      scene_id: scene.id,
      name: scene.title,
      description: scene.description,
      test_code: planData.test_code,
      test_cases: planData.test_cases,
      execution_order: planData.execution_order,
      environment: planData.environment || {},
      setup_code: planData.setup_code,
      teardown_code: planData.teardown_code,
      dependencies: planData.dependencies || [],
      estimated_duration_ms: planData.estimated_duration_ms || 0,
    };
  }

  /**
   * Generate actual Playwright test code from a plan
   */
  async generateTestCode(plan: TestPlan): Promise<string> {
    const codeGenPrompt = this.buildCodeGenPrompt(plan);

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: codeGenPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Extract code block if wrapped in markdown
    const text = content.text;
    const codeMatch = text.match(/```(?:typescript|javascript)?\n([\s\S]*?)\n```/);
    return codeMatch ? codeMatch[1] : text;
  }

  /**
   * Explore edge cases and generate additional test plans
   */
  async exploreEdgeCases(
    scene: Scene,
    plan: TestPlan
  ): Promise<TestPlan[]> {
    const edgeExplorationPrompt = this.buildEdgeExplorationPrompt(
      scene,
      plan
    );

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 6144,
      messages: [
        {
          role: "user",
          content: edgeExplorationPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const edgeCases = JSON.parse(content.text);
    return edgeCases.plans.map(
      (
        edgePlan: Record<string, unknown>,
        index: number
      ): TestPlan => ({
        id: `edge_${plan.id}_${index}`,
        scene_id: plan.scene_id,
        name: edgePlan.name as string,
        description: edgePlan.description as string,
        test_code: edgePlan.test_code as string,
        test_cases: (edgePlan.test_cases as TestCase[]) || [],
        execution_order: (edgePlan.execution_order as string[]) || [],
        environment: (edgePlan.environment as Record<string, unknown>) || {},
        setup_code: edgePlan.setup_code as string | undefined,
        teardown_code: edgePlan.teardown_code as string | undefined,
        dependencies: [plan.id, ...(edgePlan.dependencies as string[])],
        estimated_duration_ms:
          (edgePlan.estimated_duration_ms as number) || 0,
      })
    );
  }

  /**
   * Build the planning prompt for Claude
   */
  private buildPlanningPrompt(scene: Scene, connection: Connection): string {
    return `You are an expert QA engineer. Generate a comprehensive test plan for the following scenario.

SCENARIO:
Title: ${scene.title}
Description: ${scene.description}
Priority: ${scene.priority}
Actor: ${scene.actor ? JSON.stringify(scene.actor) : "Not specified"}

STEPS:
${scene.steps.map((s, i) => `${i + 1}. ${s.action} ${s.input ? `with ${JSON.stringify(s.input)}` : ""}`).join("\n")}

ASSERTIONS:
${scene.assertions.map((a) => `- ${a.type} on ${a.target}: expect ${JSON.stringify(a.expected)}`).join("\n")}

CONNECTION:
Type: ${connection.type}
Base URL: ${connection.base_url}
Timeout: ${connection.timeout}ms

Return a JSON object with the following structure:
{
  "test_cases": [
    {
      "id": "test_1",
      "name": "Test case name",
      "description": "What it tests",
      "steps": ["Step 1", "Step 2"],
      "assertions": ["Assert X", "Assert Y"],
      "variables": {},
      "timeout_ms": 30000
    }
  ],
  "execution_order": ["test_1", "test_2"],
  "environment": {},
  "setup_code": "// setup steps",
  "teardown_code": "// cleanup",
  "dependencies": [],
  "estimated_duration_ms": 30000,
  "test_code": "// Playwright test code will be generated separately"
}

Generate realistic, executable test cases that cover the scenario.`;
  }

  /**
   * Build the code generation prompt
   */
  private buildCodeGenPrompt(plan: TestPlan): string {
    return `Generate production-quality Playwright test code for the following test plan:

Test Plan Name: ${plan.name}
Description: ${plan.description}

Test Cases:
${plan.test_cases.map((tc) => `- ${tc.name}: ${tc.description}`).join("\n")}

Requirements:
1. Use Playwright with TypeScript
2. Import from '@playwright/test'
3. Use test.describe() for grouping
4. Include proper error handling
5. Use assertions from expect()
6. Add meaningful comments
7. Handle async/await correctly
8. Include timeout configuration
9. Support the environment variables: ${Object.keys(plan.environment).join(", ")}

Return ONLY the complete, executable Playwright test code in a TypeScript code block.`;
  }

  /**
   * Build the edge case exploration prompt
   */
  private buildEdgeExplorationPrompt(scene: Scene, plan: TestPlan): string {
    return `As a QA expert, identify edge cases and boundary conditions for this scenario and generate additional test plans.

Original Scenario: ${scene.title}
${scene.description}

Current Test Plan Covers:
${plan.test_cases.map((tc) => `- ${tc.name}`).join("\n")}

Suggested Edge Cases from Scenario:
${scene.edge_cases.map((ec) => `- ${ec}`).join("\n")}

Generate test plans for these categories:
1. Boundary values (min, max, zero, negative)
2. Authentication/authorization edge cases
3. Timing and race conditions
4. Data validation edge cases
5. Network/connectivity failures
6. Concurrent operations
7. Invalid inputs and malformed data
8. State transition edge cases

Return a JSON object with structure:
{
  "plans": [
    {
      "name": "Edge case name",
      "description": "What the edge case tests",
      "test_code": "Playwright code",
      "test_cases": [],
      "execution_order": [],
      "environment": {},
      "dependencies": [],
      "estimated_duration_ms": 30000
    }
  ]
}`;
  }
}
