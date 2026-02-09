/**
 * Edge case explorer - generates boundary and edge case test scenarios
 */

import { Anthropic } from "@anthropic-ai/sdk";
import { Scene, SceneClass, Priority, AssertionType } from "../scene/schema.js";
import { ExecutionResult } from "./executor.js";

export interface ExplorationResult {
  original_scene_id: string;
  edge_cases_found: number;
  new_scenes: Scene[];
  reasoning: string;
}

const client = new Anthropic();

/**
 * Edge case explorer using Claude
 */
export class EdgeExplorer {
  /**
   * Explore edge cases based on execution results and scene
   */
  async explore(
    scene: Scene,
    results: ExecutionResult
  ): Promise<ExplorationResult> {
    const explorationPrompt = this.buildExplorationPrompt(scene, results);

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: explorationPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const exploration = JSON.parse(content.text);

    const newScenes = exploration.edge_cases.map(
      (
        edgeCase: Record<string, unknown>,
        index: number
      ): Scene => {
        const edgeScene = new SceneClass({
          title: `${scene.title} - ${edgeCase.name}`,
          description: edgeCase.description as string,
          actor: scene.actor,
          steps: edgeCase.steps as any,
          assertions: edgeCase.assertions as any,
          edge_cases: [],
          tags: [...scene.tags, "edge-case", edgeCase.category as string],
          priority:
            (edgeCase.priority as Priority) || Priority.MEDIUM,
          metadata: {
            ...scene.metadata,
            edge_case_type: edgeCase.category,
            parent_scene_id: scene.id,
            index,
          },
        });
        return edgeScene.toJSON();
      }
    );

    return {
      original_scene_id: scene.id,
      edge_cases_found: newScenes.length,
      new_scenes: newScenes,
      reasoning: exploration.reasoning,
    };
  }

  /**
   * Generate boundary value test scenes
   */
  async generateBoundaryTests(scene: Scene): Promise<Scene[]> {
    const boundaryPrompt = `Generate boundary value test scenarios for this test case:

Title: ${scene.title}
Description: ${scene.description}

Focus on:
1. Minimum and maximum valid values
2. Just below and just above boundary values
3. Off-by-one errors
4. Zero and negative numbers
5. Empty strings and collections
6. Very large inputs

Return a JSON array of Scene objects with the following structure:
[
  {
    "title": "Boundary test name",
    "description": "What boundary is being tested",
    "steps": [],
    "assertions": [],
    "edge_cases": [],
    "tags": ["boundary"],
    "priority": "medium"
  }
]`;

    return this.generateScenesFromPrompt(scene, boundaryPrompt);
  }

  /**
   * Generate authentication/authorization edge cases
   */
  async generateAuthEdgeCases(scene: Scene): Promise<Scene[]> {
    const authPrompt = `Generate authentication and authorization edge case tests:

Title: ${scene.title}
Description: ${scene.description}

Focus on:
1. Invalid credentials
2. Expired tokens
3. Missing authentication
4. Wrong permission levels
5. Privilege escalation attempts
6. Token refresh scenarios
7. Cross-origin issues
8. Session hijacking attempts

Return a JSON array of Scene objects.`;

    return this.generateScenesFromPrompt(scene, authPrompt);
  }

  /**
   * Generate timing and race condition tests
   */
  async generateTimingTests(scene: Scene): Promise<Scene[]> {
    const timingPrompt = `Generate timing and race condition test scenarios:

Title: ${scene.title}
Description: ${scene.description}

Focus on:
1. Timeout scenarios
2. Concurrent requests
3. Race conditions between operations
4. Delayed responses
5. Network latency simulation
6. Slow operations
7. Rapid sequential operations
8. Cascading operation failures

Return a JSON array of Scene objects.`;

    return this.generateScenesFromPrompt(scene, timingPrompt);
  }

  /**
   * Generate data validation edge cases
   */
  async generateDataValidationTests(scene: Scene): Promise<Scene[]> {
    const validationPrompt = `Generate data validation test scenarios:

Title: ${scene.title}
Description: ${scene.description}

Focus on:
1. SQL injection patterns
2. XSS payloads
3. Invalid JSON/XML
4. Oversized payloads
5. Special characters
6. Unicode and encoding issues
7. Type mismatches
8. Missing required fields
9. Invalid field combinations

Return a JSON array of Scene objects.`;

    return this.generateScenesFromPrompt(scene, validationPrompt);
  }

  /**
   * Generate state transition edge cases
   */
  async generateStateTransitionTests(scene: Scene): Promise<Scene[]> {
    const statePrompt = `Generate state transition and workflow edge case tests:

Title: ${scene.title}
Description: ${scene.description}

Focus on:
1. Invalid state transitions
2. Skipping required states
3. Going back to previous states
4. Concurrent state changes
5. Idempotency issues
6. Partial transaction failures
7. Rollback scenarios
8. State recovery situations

Return a JSON array of Scene objects.`;

    return this.generateScenesFromPrompt(scene, statePrompt);
  }

  /**
   * Internal method to generate scenes from a prompt
   */
  private async generateScenesFromPrompt(
    scene: Scene,
    prompt: string
  ): Promise<Scene[]> {
    try {
      const response = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        return [];
      }

      const scenesData = JSON.parse(content.text);
      const scenesList = Array.isArray(scenesData) ? scenesData : [scenesData];

      return scenesList.map((sceneData: Record<string, unknown>) => {
        const newScene = new SceneClass({
          title: sceneData.title as string,
          description: sceneData.description as string,
          steps: (sceneData.steps as any) || [],
          assertions: (sceneData.assertions as any) || [],
          edge_cases: (sceneData.edge_cases as string[]) || [],
          tags: [
            ...scene.tags,
            ...(sceneData.tags as string[]),
            "generated",
          ],
          priority: (sceneData.priority as Priority) || Priority.MEDIUM,
          metadata: {
            ...scene.metadata,
            parent_scene_id: scene.id,
          },
        });
        return newScene.toJSON();
      });
    } catch (error) {
      console.error("Failed to generate scenes from prompt:", error);
      return [];
    }
  }

  /**
   * Build the exploration prompt
   */
  private buildExplorationPrompt(
    scene: Scene,
    results: ExecutionResult
  ): string {
    return `Analyze the test execution and identify edge cases that should be tested:

ORIGINAL SCENARIO:
Title: ${scene.title}
Description: ${scene.description}
Priority: ${scene.priority}

EXECUTION RESULTS:
Status: ${results.status}
Passed: ${results.passed_count}
Failed: ${results.failed_count}
Duration: ${results.duration_ms}ms

ASSERTIONS TESTED:
${scene.assertions.map((a) => `- ${a.type} on ${a.target}: expect ${JSON.stringify(a.expected)}`).join("\n")}

SUGGESTED EDGE CASES:
${scene.edge_cases.map((ec) => `- ${ec}`).join("\n")}

Generate comprehensive edge case scenarios that should be tested. Return JSON:
{
  "reasoning": "Summary of edge cases identified",
  "edge_cases": [
    {
      "name": "Edge case name",
      "category": "boundary|auth|timing|validation|state",
      "description": "What this edge case tests",
      "priority": "critical|high|medium|low",
      "steps": [
        { "action": "...", "input": {}, "expect": "..." }
      ],
      "assertions": [
        { "type": "...", "target": "...", "expected": ... }
      ]
    }
  ]
}`;
  }
}
