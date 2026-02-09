/**
 * Test executor - runs generated test code
 */

import { spawn } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { TestPlan } from "./planner.js";
import { Connection } from "../connection.js";

export interface ExecutionResult {
  plan_id: string;
  status: "passed" | "failed" | "skipped" | "error";
  passed_count: number;
  failed_count: number;
  skipped_count: number;
  total_count: number;
  duration_ms: number;
  error?: string;
  output: string;
  assertions: AssertionResult[];
  coverage?: Record<string, number>;
  timestamp: Date;
}

export interface AssertionResult {
  assertion: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  error?: string;
  duration_ms: number;
}

/**
 * Agentic executor that runs test code
 */
export class AgenticExecutor {
  private tempDir: string;

  constructor() {
    this.tempDir = tmpdir();
    mkdirSync(join(this.tempDir, "rigour-qa"), { recursive: true });
  }

  /**
   * Execute a test plan
   */
  async execute(
    plan: TestPlan,
    connection: Connection
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const testFile = this.createTestFile(plan, connection);

    try {
      const output = await this.runTestFile(testFile);
      const parsed = this.parseTestOutput(output);

      return {
        plan_id: plan.id,
        status: parsed.failed_count === 0 ? "passed" : "failed",
        passed_count: parsed.passed_count,
        failed_count: parsed.failed_count,
        skipped_count: parsed.skipped_count,
        total_count: parsed.total_count,
        duration_ms: Date.now() - startTime,
        output,
        assertions: parsed.assertions,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        plan_id: plan.id,
        status: "error",
        passed_count: 0,
        failed_count: 0,
        skipped_count: 0,
        total_count: 0,
        duration_ms: Date.now() - startTime,
        error: errorMessage,
        output: errorMessage,
        assertions: [],
        timestamp: new Date(),
      };
    } finally {
      try {
        unlinkSync(testFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Create a test file with proper imports and setup
   */
  private createTestFile(plan: TestPlan, connection: Connection): string {
    const testFileName = `test_${plan.id}_${Date.now()}.ts`;
    const testFilePath = join(this.tempDir, "rigour-qa", testFileName);

    const testContent = `
import { test, expect } from '@playwright/test';

${this.getEnvironmentSetup(connection)}

${plan.setup_code || "// No setup required"}

${plan.test_code}

${plan.teardown_code || "// No teardown required"}
`;

    writeFileSync(testFilePath, testContent, "utf-8");
    return testFilePath;
  }

  /**
   * Run a test file using Playwright
   */
  private async runTestFile(testFile: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn("npx", ["playwright", "test", testFile], {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      process.stdout?.on("data", (data) => {
        stdout += data.toString();
      });

      process.stderr?.on("data", (data) => {
        stderr += data.toString();
      });

      process.on("close", (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Test execution failed: ${stderr || stdout}`));
        }
      });

      process.on("error", (error) => {
        reject(error);
      });
    });
  }

  /**
   * Parse Playwright test output
   */
  private parseTestOutput(output: string): {
    passed_count: number;
    failed_count: number;
    skipped_count: number;
    total_count: number;
    assertions: AssertionResult[];
  } {
    const lines = output.split("\n");
    const assertions: AssertionResult[] = [];

    let passed_count = 0;
    let failed_count = 0;
    let skipped_count = 0;

    // Parse Playwright summary line
    // Example: 5 passed (2.3s)
    const summaryMatch = output.match(
      /(\d+)\s+(?:passed|failed|skipped).*?(\d+(?:\.\d+)?)\s*s/
    );
    if (summaryMatch) {
      const parts = output.match(/(\d+)\s+passed/);
      if (parts) passed_count = parseInt(parts[1], 10);
      const failedParts = output.match(/(\d+)\s+failed/);
      if (failedParts) failed_count = parseInt(failedParts[1], 10);
      const skippedParts = output.match(/(\d+)\s+skipped/);
      if (skippedParts) skipped_count = parseInt(skippedParts[1], 10);
    }

    // Parse individual test results
    for (const line of lines) {
      if (line.includes("✓") || line.includes("✔")) {
        assertions.push({
          assertion: line.trim(),
          passed: true,
          duration_ms: 0,
        });
      } else if (line.includes("✕") || line.includes("✖")) {
        assertions.push({
          assertion: line.trim(),
          passed: false,
          duration_ms: 0,
        });
      }
    }

    return {
      passed_count,
      failed_count,
      skipped_count,
      total_count: passed_count + failed_count + skipped_count,
      assertions,
    };
  }

  /**
   * Get environment setup code
   */
  private getEnvironmentSetup(connection: Connection): string {
    return `
// Environment setup
const BASE_URL = '${connection.base_url}';
const TIMEOUT = ${connection.timeout};
const HEADERS = ${JSON.stringify(connection.getHeaders())};

test.beforeEach(async ({ page }) => {
  if (page.context()) {
    await page.context().addInitScript(() => {
      (window as any).testEnvironment = {
        baseUrl: BASE_URL,
        timeout: TIMEOUT,
        headers: HEADERS
      };
    });
  }
});
`;
  }
}

/**
 * Simple test runner with hooks
 */
export class TestRunner {
  private beforeHooks: Array<() => Promise<void>> = [];
  private afterHooks: Array<() => Promise<void>> = [];

  beforeEach(fn: () => Promise<void>): void {
    this.beforeHooks.push(fn);
  }

  afterEach(fn: () => Promise<void>): void {
    this.afterHooks.push(fn);
  }

  async runBeforeHooks(): Promise<void> {
    for (const hook of this.beforeHooks) {
      await hook();
    }
  }

  async runAfterHooks(): Promise<void> {
    for (const hook of this.afterHooks) {
      await hook();
    }
  }
}
