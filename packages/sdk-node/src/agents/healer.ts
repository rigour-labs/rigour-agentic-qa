/**
 * Self-healer agent - diagnoses and fixes failing tests
 */

import { Anthropic } from "@anthropic-ai/sdk";
import { ExecutionResult } from "../engine/executor.js";

export interface Diagnosis {
  issue_type:
    | "assertion_mismatch"
    | "timeout"
    | "network_error"
    | "syntax_error"
    | "logic_error"
    | "environment_issue"
    | "unknown";
  severity: "critical" | "high" | "medium" | "low";
  root_cause: string;
  affected_assertions: string[];
  recommendations: string[];
}

const client = new Anthropic();

/**
 * Self-healing agent that diagnoses and fixes test failures
 */
export class SelfHealer {
  /**
   * Diagnose a test failure
   */
  async diagnose(failure: ExecutionResult): Promise<Diagnosis> {
    const diagnosisPrompt = this.buildDiagnosisPrompt(failure);

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: diagnosisPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const diagnosis = JSON.parse(content.text);

    return {
      issue_type: diagnosis.issue_type,
      severity: diagnosis.severity,
      root_cause: diagnosis.root_cause,
      affected_assertions: diagnosis.affected_assertions,
      recommendations: diagnosis.recommendations,
    };
  }

  /**
   * Heal a failing test by generating fixed code
   */
  async heal(diagnosis: Diagnosis, testCode: string): Promise<string> {
    const healingPrompt = this.buildHealingPrompt(diagnosis, testCode);

    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: healingPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    // Extract code from markdown if present
    const text = content.text;
    const codeMatch = text.match(/```(?:typescript|javascript)?\n([\s\S]*?)\n```/);
    return codeMatch ? codeMatch[1] : text;
  }

  /**
   * Attempt automatic recovery
   */
  async recover(failure: ExecutionResult): Promise<{ recovered: boolean; fixedCode?: string }> {
    try {
      const diagnosis = await this.diagnose(failure);

      // Don't attempt recovery for critical issues
      if (diagnosis.severity === "critical") {
        return { recovered: false };
      }

      // Check if we have an original test code reference
      // In a real implementation, this would be tracked separately
      if (!failure.output) {
        return { recovered: false };
      }

      // Only attempt recovery for specific recoverable issues
      const recoverableIssues = [
        "assertion_mismatch",
        "timeout",
        "logic_error",
      ];

      if (!recoverableIssues.includes(diagnosis.issue_type)) {
        return { recovered: false };
      }

      // Attempt to generate fixed code
      const fixedCode = await this.heal(diagnosis, failure.output);

      return { recovered: true, fixedCode };
    } catch (error) {
      return { recovered: false };
    }
  }

  /**
   * Build diagnosis prompt
   */
  private buildDiagnosisPrompt(failure: ExecutionResult): string {
    return `Diagnose the following test failure:

EXECUTION STATUS: ${failure.status}
ASSERTIONS PASSED: ${failure.passed_count}
ASSERTIONS FAILED: ${failure.failed_count}
DURATION: ${failure.duration_ms}ms

TEST OUTPUT:
${failure.output}

${failure.error ? `ERROR MESSAGE:\n${failure.error}` : ""}

FAILED ASSERTIONS:
${failure.assertions
  .filter((a) => !a.passed)
  .map((a) => `- ${a.assertion}: ${a.error || "assertion failed"}`)
  .join("\n")}

Analyze the failure and return JSON diagnosis:
{
  "issue_type": "assertion_mismatch|timeout|network_error|syntax_error|logic_error|environment_issue|unknown",
  "severity": "critical|high|medium|low",
  "root_cause": "Detailed explanation of what went wrong",
  "affected_assertions": ["list of affected assertion IDs"],
  "recommendations": [
    "First recommendation to fix the issue",
    "Second recommendation",
    "..."
  ]
}`;
  }

  /**
   * Build healing prompt
   */
  private buildHealingPrompt(diagnosis: Diagnosis, testCode: string): string {
    return `Fix the following failing test code based on the diagnosis:

DIAGNOSIS:
Issue Type: ${diagnosis.issue_type}
Severity: ${diagnosis.severity}
Root Cause: ${diagnosis.root_cause}

RECOMMENDATIONS:
${diagnosis.recommendations.map((r, i) => `${i + 1}. ${r}`).join("\n")}

ORIGINAL TEST CODE:
\`\`\`typescript
${testCode}
\`\`\`

FAILING ASSERTIONS:
${diagnosis.affected_assertions.join("\n")}

Generate fixed test code that:
1. Addresses the root cause
2. Implements the recommendations
3. Maintains all original test intent
4. Includes improved error handling
5. Adds appropriate logging/debugging

Return ONLY the complete, fixed Playwright test code in a TypeScript code block.`;
  }

  /**
   * Suggest alternative test approaches
   */
  async suggestAlternatives(
    failure: ExecutionResult
  ): Promise<string[]> {
    const prompt = `Given this test failure, suggest alternative testing approaches:

STATUS: ${failure.status}
ERROR: ${failure.error}
OUTPUT: ${failure.output}

Return a JSON array of alternative approaches:
["Approach 1", "Approach 2", "Approach 3"]`;

    try {
      const response = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 1024,
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

      const alternatives = JSON.parse(content.text);
      return Array.isArray(alternatives) ? alternatives : [];
    } catch {
      return [];
    }
  }
}

/**
 * Healing strategy pattern
 */
export interface HealingStrategy {
  canHandle(diagnosis: Diagnosis): boolean;
  apply(testCode: string, diagnosis: Diagnosis): Promise<string>;
}

/**
 * Assertion mismatch healing strategy
 */
export class AssertionMismatchHealer implements HealingStrategy {
  canHandle(diagnosis: Diagnosis): boolean {
    return diagnosis.issue_type === "assertion_mismatch";
  }

  async apply(testCode: string, diagnosis: Diagnosis): Promise<string> {
    const prompt = `Fix assertion mismatches in this test code:

ROOT CAUSE: ${diagnosis.root_cause}

TEST CODE:
\`\`\`typescript
${testCode}
\`\`\`

Update the assertions to match the actual behavior. Return fixed code.`;

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
      return testCode;
    }

    const match = content.text.match(/```(?:typescript)?\n([\s\S]*?)\n```/);
    return match ? match[1] : testCode;
  }
}

/**
 * Timeout healing strategy
 */
export class TimeoutHealer implements HealingStrategy {
  canHandle(diagnosis: Diagnosis): boolean {
    return diagnosis.issue_type === "timeout";
  }

  async apply(testCode: string, diagnosis: Diagnosis): Promise<string> {
    // Add longer timeouts and wait strategies
    let fixed = testCode;

    // Increase test timeout
    fixed = fixed.replace(/test\.setTimeout\(\d+\)/, "test.setTimeout(60000)");
    if (!fixed.includes("test.setTimeout")) {
      fixed = `test.setTimeout(60000);\n\n${fixed}`;
    }

    // Add explicit waits
    fixed = fixed.replace(
      /expect\(/g,
      "await page.waitForLoadState('networkidle');\nexpect("
    );

    return fixed;
  }
}

/**
 * Environment issue healing strategy
 */
export class EnvironmentIssueHealer implements HealingStrategy {
  canHandle(diagnosis: Diagnosis): boolean {
    return diagnosis.issue_type === "environment_issue";
  }

  async apply(testCode: string, diagnosis: Diagnosis): Promise<string> {
    const prompt = `Fix environment-related issues in this test:

ISSUES: ${diagnosis.root_cause}

TEST CODE:
\`\`\`typescript
${testCode}
\`\`\`

Add environment variable validation, retry logic, and fallback values. Return fixed code.`;

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
      return testCode;
    }

    const match = content.text.match(/```(?:typescript)?\n([\s\S]*?)\n```/);
    return match ? match[1] : testCode;
  }
}
