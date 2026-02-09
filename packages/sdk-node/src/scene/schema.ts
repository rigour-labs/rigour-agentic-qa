/**
 * Core Scene data model for Rigour QA.
 * Matches the Python SDK structure with Zod validation.
 */

import { z } from "zod";
import { v4 as uuidv4 } from "uuid";

/**
 * Priority levels for scenes
 */
export enum Priority {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
}

/**
 * Types of assertions supported by Rigour QA
 */
export enum AssertionType {
  STATUS_CODE = "status_code",
  BODY_CONTAINS = "body_contains",
  BODY_SCHEMA = "body_schema",
  DB_STATE = "db_state",
  RESPONSE_TIME = "response_time",
  HEADER_CONTAINS = "header_contains",
  SEMANTIC = "semantic",
  CUSTOM = "custom",
}

/**
 * Authentication configuration schema
 */
const AuthConfigSchema = z.object({
  type: z.enum(["bearer", "basic", "api_key", "oauth"]),
  value: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  client_id: z.string().optional(),
  client_secret: z.string().optional(),
  extra: z.record(z.unknown()).optional(),
});

export type AuthConfig = z.infer<typeof AuthConfigSchema>;

/**
 * Actor schema - represents a user/client performing actions
 */
const ActorSchema = z.object({
  role: z.enum(["admin", "user", "anonymous", "api_client"]),
  auth: AuthConfigSchema.optional(),
  persona: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type Actor = z.infer<typeof ActorSchema>;

/**
 * Step schema - represents a single action in a test scenario
 */
const StepSchema = z.object({
  action: z.string(),
  input: z.record(z.unknown()).optional(),
  expect: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type Step = z.infer<typeof StepSchema>;

/**
 * Assertion schema - represents an expected outcome
 */
const AssertionSchema = z.object({
  type: z.nativeEnum(AssertionType),
  target: z.string(),
  expected: z.unknown(),
  semantic_prompt: z.string().optional(),
  tolerance: z.number().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export type Assertion = z.infer<typeof AssertionSchema>;

/**
 * Scene schema - core model for a test scenario
 */
const SceneSchema = z.object({
  id: z.string().default(() => uuidv4()),
  title: z.string(),
  description: z.string(),
  actor: ActorSchema.optional(),
  steps: z.array(StepSchema).default([]),
  assertions: z.array(AssertionSchema).default([]),
  edge_cases: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  priority: z.nativeEnum(Priority).default(Priority.MEDIUM),
  created_at: z.date().default(() => new Date()),
  metadata: z.record(z.unknown()).default({}),
});

export type Scene = z.infer<typeof SceneSchema>;

/**
 * Scene class with fluent builder API matching Python SDK
 */
export class SceneClass implements Scene {
  id: string;
  title: string;
  description: string;
  actor?: Actor;
  steps: Step[];
  assertions: Assertion[];
  edge_cases: string[];
  tags: string[];
  priority: Priority;
  created_at: Date;
  metadata: Record<string, unknown>;

  constructor(data: Partial<Scene> & { title: string; description: string }) {
    const validated = SceneSchema.parse(data);
    this.id = validated.id;
    this.title = validated.title;
    this.description = validated.description;
    this.actor = validated.actor;
    this.steps = validated.steps;
    this.assertions = validated.assertions;
    this.edge_cases = validated.edge_cases;
    this.tags = validated.tags;
    this.priority = validated.priority;
    this.created_at = validated.created_at;
    this.metadata = validated.metadata;
  }

  /**
   * Fluent API to add a step
   */
  addStep(
    action: string,
    input?: Record<string, unknown>,
    expect?: string
  ): this {
    const step = StepSchema.parse({ action, input, expect });
    this.steps.push(step);
    return this;
  }

  /**
   * Fluent API to add an assertion
   */
  addAssertion(
    type: AssertionType,
    target: string,
    expected: unknown,
    semanticPrompt?: string
  ): this {
    const assertion = AssertionSchema.parse({
      type,
      target,
      expected,
      semantic_prompt: semanticPrompt,
    });
    this.assertions.push(assertion);
    return this;
  }

  /**
   * Fluent API to add an edge case hint
   */
  addEdgeCase(description: string): this {
    this.edge_cases.push(description);
    return this;
  }

  /**
   * Fluent API to add a tag
   */
  addTag(tag: string): this {
    this.tags.push(tag);
    return this;
  }

  /**
   * Fluent API to set priority
   */
  setPriority(priority: Priority): this {
    this.priority = priority;
    return this;
  }

  /**
   * Fluent API to set actor
   */
  setActor(actor: Actor): this {
    this.actor = actor;
    return this;
  }

  /**
   * Validate the scene
   */
  validate(): boolean {
    SceneSchema.parse(this);
    return true;
  }

  /**
   * Convert to plain object
   */
  toJSON(): Scene {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      actor: this.actor,
      steps: this.steps,
      assertions: this.assertions,
      edge_cases: this.edge_cases,
      tags: this.tags,
      priority: this.priority,
      created_at: this.created_at,
      metadata: this.metadata,
    };
  }
}

/**
 * Export Zod schemas for runtime validation
 */
export const Schemas = {
  AuthConfig: AuthConfigSchema,
  Actor: ActorSchema,
  Step: StepSchema,
  Assertion: AssertionSchema,
  Scene: SceneSchema,
};
