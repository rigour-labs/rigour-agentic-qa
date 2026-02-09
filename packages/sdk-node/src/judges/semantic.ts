/**
 * Semantic agent judge for evaluating assertion results
 */

import { Anthropic } from "@anthropic-ai/sdk";
import { Assertion } from "../scene/schema.js";

export interface JudgmentResult {
  assertion: Assertion;
  passed: boolean;
  confidence: number; // 0-1
  reasoning: string;
  expected?: unknown;
  actual?: unknown;
  remediation?: string;
}

const client = new Anthropic();

/**
 * Semantic judge using Claude for intelligent assertion evaluation
 */
export class SemanticJudge {
  /**
   * Judge an assertion using semantic understanding
   */
  async judge(
    assertion: Assertion,
    actual: unknown,
    context: Record<string, unknown>
  ): Promise<JudgmentResult> {
    if (assertion.type !== "semantic" && assertion.type !== "custom") {
      return this.simpleJudge(assertion, actual);
    }

    return this.semanticJudge(assertion, actual, context);
  }

  /**
   * Simple judgment for standard assertion types
   */
  private simpleJudge(
    assertion: Assertion,
    actual: unknown
  ): JudgmentResult {
    let passed = false;
    let reasoning = "";

    switch (assertion.type) {
      case "status_code":
        passed = actual === assertion.expected;
        reasoning = `Status code ${actual} ${passed ? "matches" : "does not match"} expected ${assertion.expected}`;
        break;

      case "body_contains":
        const bodyStr = String(actual);
        passed = bodyStr.includes(String(assertion.expected));
        reasoning = `Response body ${passed ? "contains" : "does not contain"} "${assertion.expected}"`;
        break;

      case "header_contains":
        const headerVal = String(actual);
        passed = headerVal.includes(String(assertion.expected));
        reasoning = `Header ${passed ? "contains" : "does not contain"} "${assertion.expected}"`;
        break;

      case "response_time":
        const actualTime = actual as number;
        const expectedTime = assertion.expected as number;
        const tolerance = assertion.tolerance || 0.1; // 10% default tolerance
        const margin = expectedTime * tolerance;
        passed = Math.abs(actualTime - expectedTime) <= margin;
        reasoning = `Response time ${actualTime}ms ${passed ? "is within" : "exceeds"} ${expectedTime}ms ±${margin}ms`;
        break;

      case "body_schema":
        passed = this.validateSchema(actual, assertion.expected);
        reasoning = passed
          ? "Response matches expected schema"
          : "Response does not match expected schema";
        break;

      case "db_state":
        passed = this.compareObjects(actual, assertion.expected);
        reasoning = passed
          ? "Database state matches expected"
          : "Database state does not match expected";
        break;

      default:
        passed = actual === assertion.expected;
        reasoning = "Custom assertion evaluation";
    }

    return {
      assertion,
      passed,
      confidence: passed ? 1.0 : 0.0,
      reasoning,
      expected: assertion.expected,
      actual,
    };
  }

  /**
   * Semantic judgment using Claude
   */
  private async semanticJudge(
    assertion: Assertion,
    actual: unknown,
    context: Record<string, unknown>
  ): Promise<JudgmentResult> {
    const judgmentPrompt = `Evaluate whether the actual result meets the assertion requirement.

ASSERTION:
Type: ${assertion.type}
Target: ${assertion.target}
Expected: ${JSON.stringify(assertion.expected)}
Custom Prompt: ${assertion.semantic_prompt}

ACTUAL RESULT:
${JSON.stringify(actual, null, 2)}

CONTEXT:
${JSON.stringify(context, null, 2)}

Evaluate whether the assertion passes. Return JSON:
{
  "passed": boolean,
  "confidence": 0-1,
  "reasoning": "Explanation of judgment",
  "remediation": "How to fix if failed"
}`;

    try {
      const response = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: judgmentPrompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected response type");
      }

      const judgment = JSON.parse(content.text);

      return {
        assertion,
        passed: judgment.passed,
        confidence: judgment.confidence,
        reasoning: judgment.reasoning,
        remediation: judgment.remediation,
        expected: assertion.expected,
        actual,
      };
    } catch (error) {
      return {
        assertion,
        passed: false,
        confidence: 0,
        reasoning: `Failed to evaluate assertion: ${error}`,
        expected: assertion.expected,
        actual,
      };
    }
  }

  /**
   * Simple schema validation
   */
  private validateSchema(actual: unknown, schema: unknown): boolean {
    if (typeof schema !== "object" || schema === null) {
      return actual === schema;
    }

    if (typeof actual !== "object" || actual === null) {
      return false;
    }

    const schemaObj = schema as Record<string, unknown>;
    const actualObj = actual as Record<string, unknown>;

    for (const key in schemaObj) {
      if (!(key in actualObj)) {
        return false;
      }

      const expectedType = typeof schemaObj[key];
      const actualType = typeof actualObj[key];

      if (expectedType === "object" && schemaObj[key] !== null) {
        if (!this.validateSchema(actualObj[key], schemaObj[key])) {
          return false;
        }
      } else if (expectedType !== actualType && expectedType !== "undefined") {
        return false;
      }
    }

    return true;
  }

  /**
   * Deep object comparison
   */
  private compareObjects(actual: unknown, expected: unknown): boolean {
    if (actual === expected) {
      return true;
    }

    if (typeof actual !== typeof expected) {
      return false;
    }

    if (typeof actual !== "object" || actual === null || expected === null) {
      return actual === expected;
    }

    const actualObj = actual as Record<string, unknown>;
    const expectedObj = expected as Record<string, unknown>;

    const actualKeys = Object.keys(actualObj).sort();
    const expectedKeys = Object.keys(expectedObj).sort();

    if (actualKeys.length !== expectedKeys.length) {
      return false;
    }

    for (let i = 0; i < actualKeys.length; i++) {
      if (actualKeys[i] !== expectedKeys[i]) {
        return false;
      }

      if (!this.compareObjects(actualObj[actualKeys[i]], expectedObj[expectedKeys[i]])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Batch judge multiple assertions
   */
  async judgeBatch(
    assertions: Assertion[],
    actuals: Map<string, unknown>,
    context: Record<string, unknown>
  ): Promise<JudgmentResult[]> {
    const results: JudgmentResult[] = [];

    for (const assertion of assertions) {
      const actual = actuals.get(assertion.target);
      const result = await this.judge(assertion, actual, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Get verdict summary
   */
  summarizeJudgments(results: JudgmentResult[]): {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    averageConfidence: number;
  } {
    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;
    const avgConfidence =
      results.reduce((sum, r) => sum + r.confidence, 0) / total;

    return {
      total,
      passed,
      failed,
      passRate: total > 0 ? passed / total : 0,
      averageConfidence: avgConfidence,
    };
  }
}
