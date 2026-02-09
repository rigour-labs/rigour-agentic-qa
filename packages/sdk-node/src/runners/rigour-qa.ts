/**
 * Main RigourQA orchestrator - coordinates the full testing pipeline
 */

import EventEmitter from "events";
import { Scene } from "../scene/schema.js";
import { Connection } from "../connection.js";
import { AgenticPlanner, TestPlan } from "../engine/planner.js";
import { AgenticExecutor, ExecutionResult } from "../engine/executor.js";
import { EdgeExplorer } from "../engine/explorer.js";
import { SemanticJudge, JudgmentResult } from "../judges/semantic.js";
import { SelfHealer } from "../agents/healer.js";

export interface RigourQAConfig {
  connection: Connection;
  max_iterations?: number;
  explore_edge_cases?: boolean;
  auto_heal?: boolean;
  report_format?: "json" | "html" | "markdown";
  parallel_execution?: boolean;
}

export interface QAReport {
  id: string;
  timestamp: Date;
  scenes_tested: number;
  total_plans: number;
  passed_plans: number;
  failed_plans: number;
  edge_cases_explored: number;
  total_duration_ms: number;
  executions: ExecutionResult[];
  judgments: JudgmentResult[];
  healed_tests: number;
}

/**
 * Main RigourQA class - orchestrates the full pipeline
 */
export class RigourQA extends EventEmitter {
  private config: RigourQAConfig;
  private planner: AgenticPlanner;
  private executor: AgenticExecutor;
  private explorer: EdgeExplorer;
  private judge: SemanticJudge;
  private healer: SelfHealer;

  constructor(config: RigourQAConfig) {
    super();
    this.config = {
      max_iterations: config.max_iterations || 3,
      explore_edge_cases: config.explore_edge_cases ?? true,
      auto_heal: config.auto_heal ?? true,
      report_format: config.report_format || "json",
      parallel_execution: config.parallel_execution ?? false,
      ...config,
    };

    this.planner = new AgenticPlanner();
    this.executor = new AgenticExecutor();
    this.explorer = new EdgeExplorer();
    this.judge = new SemanticJudge();
    this.healer = new SelfHealer();
  }

  /**
   * Run a single scene through the entire pipeline
   */
  async runScene(scene: Scene): Promise<ExecutionResult> {
    this.emit("scene_start", { scene_id: scene.id, title: scene.title });

    try {
      // Phase 1: Plan
      this.emit("phase_start", { phase: "planning" });
      const plan = await this.planner.plan(scene, this.config.connection);
      this.emit("phase_complete", {
        phase: "planning",
        plan_id: plan.id,
      });

      // Phase 2: Execute
      this.emit("phase_start", { phase: "execution" });
      let result = await this.executor.execute(plan, this.config.connection);
      this.emit("phase_complete", {
        phase: "execution",
        status: result.status,
      });

      // Phase 3: Judge
      this.emit("phase_start", { phase: "judging" });
      const judgments = await this.judge.judgeBatch(
        scene.assertions,
        new Map(
          result.assertions.map((a) => [
            a.assertion,
            a.actual || a.expected,
          ])
        ),
        {
          scene_id: scene.id,
          execution_result: result,
        }
      );
      this.emit("phase_complete", {
        phase: "judging",
        passed: judgments.filter((j) => j.passed).length,
        total: judgments.length,
      });

      // Phase 4: Auto-heal if configured
      if (
        this.config.auto_heal &&
        result.status === "failed"
      ) {
        this.emit("phase_start", { phase: "healing" });
        const diagnosis = await this.healer.diagnose(result);
        const healed = await this.healer.heal(diagnosis, plan.test_code);

        // Re-run with healed code
        const healedPlan: TestPlan = {
          ...plan,
          test_code: healed,
        };
        result = await this.executor.execute(healedPlan, this.config.connection);
        this.emit("phase_complete", {
          phase: "healing",
          recovered: result.status === "passed",
        });
      }

      // Phase 5: Explore edge cases if configured
      if (this.config.explore_edge_cases && result.status === "passed") {
        this.emit("phase_start", { phase: "exploration" });
        const exploration = await this.explorer.explore(scene, result);
        this.emit("phase_complete", {
          phase: "exploration",
          edge_cases_found: exploration.edge_cases_found,
        });
      }

      this.emit("scene_complete", {
        scene_id: scene.id,
        status: result.status,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit("scene_error", {
        scene_id: scene.id,
        error: errorMessage,
      });

      return {
        plan_id: "error",
        status: "error",
        passed_count: 0,
        failed_count: 0,
        skipped_count: 0,
        total_count: 0,
        duration_ms: 0,
        error: errorMessage,
        output: errorMessage,
        assertions: [],
        timestamp: new Date(),
      };
    }
  }

  /**
   * Run multiple scenes with optional parallelization
   */
  async runScenes(scenes: Scene[]): Promise<ExecutionResult[]> {
    const startTime = Date.now();
    this.emit("run_start", { total_scenes: scenes.length });

    const results: ExecutionResult[] = [];

    if (this.config.parallel_execution) {
      const results_parallel = await Promise.all(scenes.map((s) => this.runScene(s)));
      results.push(...results_parallel);
    } else {
      for (const scene of scenes) {
        const result = await this.runScene(scene);
        results.push(result);
      }
    }

    const duration = Date.now() - startTime;
    this.emit("run_complete", {
      total_scenes: scenes.length,
      duration_ms: duration,
      passed: results.filter((r) => r.status === "passed").length,
      failed: results.filter((r) => r.status === "failed").length,
    });

    return results;
  }

  /**
   * Generate comprehensive QA report
   */
  generateReport(
    scenes: Scene[],
    results: ExecutionResult[],
    judgments: JudgmentResult[]
  ): QAReport {
    const passedPlans = results.filter(
      (r) => r.status === "passed"
    ).length;
    const failedPlans = results.filter(
      (r) => r.status === "failed"
    ).length;
    const totalDuration = results.reduce((sum, r) => sum + r.duration_ms, 0);

    return {
      id: `report_${Date.now()}`,
      timestamp: new Date(),
      scenes_tested: scenes.length,
      total_plans: results.length,
      passed_plans: passedPlans,
      failed_plans: failedPlans,
      edge_cases_explored: judgments.length,
      total_duration_ms: totalDuration,
      executions: results,
      judgments: judgments,
      healed_tests: results.filter(
        (r) => r.output?.includes("healed")
      ).length,
    };
  }

  /**
   * Export report in specified format
   */
  exportReport(report: QAReport): string {
    switch (this.config.report_format) {
      case "json":
        return JSON.stringify(report, null, 2);

      case "markdown":
        return this.generateMarkdownReport(report);

      case "html":
        return this.generateHtmlReport(report);

      default:
        return JSON.stringify(report, null, 2);
    }
  }

  /**
   * Generate markdown report
   */
  private generateMarkdownReport(report: QAReport): string {
    return `# Rigour QA Report

**ID:** ${report.id}
**Timestamp:** ${report.timestamp.toISOString()}

## Summary

- **Scenes Tested:** ${report.scenes_tested}
- **Test Plans:** ${report.total_plans}
- **Passed:** ${report.passed_plans}
- **Failed:** ${report.failed_plans}
- **Total Duration:** ${report.total_duration_ms}ms

## Execution Results

${report.executions
  .map(
    (e) => `
### Plan ${e.plan_id}
- Status: ${e.status}
- Passed: ${e.passed_count}
- Failed: ${e.failed_count}
- Duration: ${e.duration_ms}ms
${e.error ? `- Error: ${e.error}` : ""}
`
  )
  .join("\n")}

## Judgments

${report.judgments
  .map(
    (j) => `
### ${j.assertion.target}
- Type: ${j.assertion.type}
- Result: ${j.passed ? "PASSED" : "FAILED"}
- Confidence: ${(j.confidence * 100).toFixed(1)}%
- Reasoning: ${j.reasoning}
`
  )
  .join("\n")}
`;
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: QAReport): string {
    return `<!DOCTYPE html>
<html>
<head>
  <title>Rigour QA Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1 { color: #333; }
    .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .passed { color: green; }
    .failed { color: red; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
  </style>
</head>
<body>
  <h1>Rigour QA Report</h1>
  <div class="summary">
    <p><strong>ID:</strong> ${report.id}</p>
    <p><strong>Timestamp:</strong> ${report.timestamp.toISOString()}</p>
    <p><strong>Scenes Tested:</strong> ${report.scenes_tested}</p>
    <p><strong>Passed:</strong> <span class="passed">${report.passed_plans}</span></p>
    <p><strong>Failed:</strong> <span class="failed">${report.failed_plans}</span></p>
    <p><strong>Total Duration:</strong> ${report.total_duration_ms}ms</p>
  </div>

  <h2>Execution Results</h2>
  <table>
    <tr>
      <th>Plan ID</th>
      <th>Status</th>
      <th>Passed</th>
      <th>Failed</th>
      <th>Duration</th>
    </tr>
    ${report.executions
      .map(
        (e) => `
    <tr>
      <td>${e.plan_id}</td>
      <td class="${e.status === "passed" ? "passed" : "failed"}">${e.status}</td>
      <td>${e.passed_count}</td>
      <td>${e.failed_count}</td>
      <td>${e.duration_ms}ms</td>
    </tr>
    `
      )
      .join("")}
  </table>
</body>
</html>`;
  }

  /**
   * Get event listeners
   */
  onSceneStart(callback: (data: any) => void): this {
    return this.on("scene_start", callback);
  }

  onPhaseStart(callback: (data: any) => void): this {
    return this.on("phase_start", callback);
  }

  onPhaseComplete(callback: (data: any) => void): this {
    return this.on("phase_complete", callback);
  }

  onSceneComplete(callback: (data: any) => void): this {
    return this.on("scene_complete", callback);
  }

  onRunComplete(callback: (data: any) => void): this {
    return this.on("run_complete", callback);
  }
}
