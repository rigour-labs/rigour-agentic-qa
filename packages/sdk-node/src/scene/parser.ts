/**
 * Scene parser - handles natural language, YAML, and Gherkin parsing
 */

import { readFileSync } from "fs";
import { parse as parseYaml } from "yaml";
import { Anthropic } from "@anthropic-ai/sdk";
import { Scene, SceneClass, Priority, AssertionType } from "./schema.js";

const client = new Anthropic();

/**
 * Parse natural language description into a Scene
 */
export async function parseNaturalLanguage(text: string): Promise<Scene> {
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `Parse the following test scenario description and extract the scene structure. Return a JSON object with the following fields:
- title: string (short title)
- description: string (the description)
- actor: { role: string, persona?: string } (extracted actor info)
- steps: array of { action: string, input?: object, expect?: string }
- assertions: array of { type: enum(status_code|body_contains|body_schema|db_state|response_time|header_contains|semantic|custom), target: string, expected: unknown }
- edge_cases: array of strings (potential edge cases to test)
- tags: array of strings (relevant tags)
- priority: enum(critical|high|medium|low)

Scenario description:
${text}

Return ONLY a valid JSON object, no markdown formatting.`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  const parsed = JSON.parse(content.text);

  return new SceneClass({
    title: parsed.title,
    description: parsed.description,
    actor: parsed.actor,
    steps: parsed.steps || [],
    assertions: parsed.assertions || [],
    edge_cases: parsed.edge_cases || [],
    tags: parsed.tags || [],
    priority: parsed.priority || Priority.MEDIUM,
  });
}

/**
 * Parse YAML file containing scenes
 */
export async function parseYaml(path: string): Promise<Scene[]> {
  try {
    const content = readFileSync(path, "utf-8");
    const data = parseYaml(content);

    if (!data) {
      return [];
    }

    // Handle both array and single scene
    const scenes = Array.isArray(data) ? data : [data];

    return scenes.map(
      (sceneData: Record<string, unknown>) =>
        new SceneClass({
          title: sceneData.title as string,
          description: sceneData.description as string,
          actor: sceneData.actor as any,
          steps: (sceneData.steps as any) || [],
          assertions: (sceneData.assertions as any) || [],
          edge_cases: (sceneData.edge_cases as any) || [],
          tags: (sceneData.tags as any) || [],
          priority: (sceneData.priority as Priority) || Priority.MEDIUM,
          metadata: (sceneData.metadata as Record<string, unknown>) || {},
        })
    );
  } catch (error) {
    throw new Error(`Failed to parse YAML file ${path}: ${error}`);
  }
}

/**
 * Parse Gherkin (Given/When/Then) format into a Scene
 */
export function parseGherkin(text: string): Scene {
  const lines = text.split("\n").filter((line) => line.trim());

  let title = "Gherkin Scenario";
  let description = "";
  const steps: Array<{
    action: string;
    input?: Record<string, unknown>;
    expect?: string;
  }> = [];
  let currentPhase = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("Scenario:")) {
      title = trimmed.replace("Scenario:", "").trim();
    } else if (trimmed.startsWith("Feature:")) {
      description = trimmed.replace("Feature:", "").trim();
    } else if (trimmed.startsWith("Given")) {
      currentPhase = "given";
      const action = trimmed.replace(/^Given\s+/, "");
      steps.push({ action, expect: "setup" });
    } else if (trimmed.startsWith("When")) {
      currentPhase = "when";
      const action = trimmed.replace(/^When\s+/, "");
      steps.push({ action });
    } else if (trimmed.startsWith("Then")) {
      const expect = trimmed.replace(/^Then\s+/, "");
      if (steps.length > 0) {
        steps[steps.length - 1].expect = expect;
      } else {
        steps.push({ action: "assertion", expect });
      }
    } else if (trimmed.startsWith("And")) {
      const action = trimmed.replace(/^And\s+/, "");
      if (currentPhase === "given") {
        steps.push({ action, expect: "setup" });
      } else {
        steps.push({ action });
      }
    }
  }

  return new SceneClass({
    title,
    description,
    steps,
    edge_cases: [],
    tags: ["gherkin"],
  });
}

/**
 * Scene builder for fluent API
 */
export class SceneBuilder {
  private scene: SceneClass;

  constructor(title: string, description: string) {
    this.scene = new SceneClass({ title, description });
  }

  static create(title: string, description: string): SceneBuilder {
    return new SceneBuilder(title, description);
  }

  addActor(role: string, persona?: string): this {
    this.scene.actor = { role: role as any, persona };
    return this;
  }

  addStep(
    action: string,
    input?: Record<string, unknown>,
    expect?: string
  ): this {
    this.scene.addStep(action, input, expect);
    return this;
  }

  addAssertion(
    type: AssertionType,
    target: string,
    expected: unknown,
    semanticPrompt?: string
  ): this {
    this.scene.addAssertion(type, target, expected, semanticPrompt);
    return this;
  }

  addEdgeCase(description: string): this {
    this.scene.addEdgeCase(description);
    return this;
  }

  addTag(tag: string): this {
    this.scene.addTag(tag);
    return this;
  }

  priority(priority: Priority): this {
    this.scene.setPriority(priority);
    return this;
  }

  metadata(key: string, value: unknown): this {
    this.scene.metadata[key] = value;
    return this;
  }

  build(): Scene {
    this.scene.validate();
    return this.scene.toJSON();
  }
}
