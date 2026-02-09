/**
 * Console reporter - terminal output with chalk and ora
 */

import chalk from "chalk";
import ora, { Ora } from "ora";
import { ExecutionResult } from "../engine/executor.js";
import { JudgmentResult } from "../judges/semantic.js";
import { QAReport } from "../runners/rigour-qa.js";

/**
 * Console reporter for terminal output
 */
export class ConsoleReporter {
  private spinners: Map<string, Ora> = new Map();
  private colors = {
    passed: chalk.green,
    failed: chalk.red,
    warning: chalk.yellow,
    info: chalk.blue,
    muted: chalk.gray,
  };

  /**
   * Report test start
   */
  reportTestStart(sceneId: string, title: string): void {
    const spinner = ora({
      text: chalk.blue(`Testing: ${title}`),
      prefixText: chalk.gray(`[${sceneId}]`),
    }).start();

    this.spinners.set(sceneId, spinner);
  }

  /**
   * Report phase start
   */
  reportPhaseStart(sceneId: string, phase: string): void {
    const spinner = this.spinners.get(sceneId);
    if (spinner) {
      spinner.text = chalk.blue(`${phase.toUpperCase()}: In Progress...`);
    }
  }

  /**
   * Report phase complete
   */
  reportPhaseComplete(
    sceneId: string,
    phase: string,
    data: Record<string, unknown>
  ): void {
    const spinner = this.spinners.get(sceneId);
    if (spinner) {
      const details = this.formatPhaseDetails(phase, data);
      spinner.text = chalk.blue(`${phase.toUpperCase()}: ${details}`);
    }
  }

  /**
   * Report test complete
   */
  reportTestComplete(result: ExecutionResult): void {
    const spinner = this.spinners.get(result.plan_id);

    if (spinner) {
      if (result.status === "passed") {
        spinner.succeed(
          chalk.green(
            `PASSED: ${result.passed_count}/${result.total_count} assertions (${result.duration_ms}ms)`
          )
        );
      } else if (result.status === "failed") {
        spinner.fail(
          chalk.red(
            `FAILED: ${result.failed_count} failed, ${result.passed_count} passed (${result.duration_ms}ms)`
          )
        );
      } else {
        spinner.warn(chalk.yellow(`ERROR: ${result.error || "Unknown error"}`));
      }

      this.spinners.delete(result.plan_id);
    }
  }

  /**
   * Report execution results
   */
  reportExecutionResult(result: ExecutionResult): void {
    console.log("");
    console.log(chalk.bold("Execution Result:"));
    console.log(`  Status: ${this.statusColor(result.status)(result.status)}`);
    console.log(`  Plan ID: ${chalk.gray(result.plan_id)}`);
    console.log(`  Passed: ${this.colors.passed(result.passed_count)}`);
    console.log(`  Failed: ${this.colors.failed(result.failed_count)}`);
    console.log(`  Duration: ${chalk.cyan(result.duration_ms + "ms")}`);

    if (result.error) {
      console.log(`  Error: ${this.colors.failed(result.error)}`);
    }

    if (result.assertions.length > 0) {
      console.log("  Assertions:");
      for (const assertion of result.assertions.slice(0, 5)) {
        const icon = assertion.passed ? chalk.green("✓") : chalk.red("✕");
        console.log(`    ${icon} ${assertion.assertion}`);
      }
      if (result.assertions.length > 5) {
        console.log(
          `    ${chalk.gray(`... and ${result.assertions.length - 5} more`)}`
        );
      }
    }
  }

  /**
   * Report judgments
   */
  reportJudgments(judgments: JudgmentResult[]): void {
    console.log("");
    console.log(chalk.bold("Judgment Results:"));

    const summary = {
      passed: judgments.filter((j) => j.passed).length,
      failed: judgments.filter((j) => !j.passed).length,
      avgConfidence:
        judgments.reduce((sum, j) => sum + j.confidence, 0) / judgments.length,
    };

    console.log(`  Passed: ${this.colors.passed(summary.passed)}`);
    console.log(`  Failed: ${this.colors.failed(summary.failed)}`);
    console.log(
      `  Avg Confidence: ${chalk.cyan((summary.avgConfidence * 100).toFixed(1) + "%")}`
    );

    console.log("  Details:");
    for (const judgment of judgments) {
      const icon = judgment.passed ? chalk.green("✓") : chalk.red("✕");
      const confidence = chalk.yellow(
        (judgment.confidence * 100).toFixed(0) + "%"
      );
      console.log(
        `    ${icon} ${judgment.assertion.target} [${confidence}] - ${judgment.reasoning}`
      );
    }
  }

  /**
   * Report summary
   */
  reportSummary(report: QAReport): void {
    console.log("");
    console.log(chalk.bold.cyan("═══════════════════════════════════════════════════════════"));
    console.log(chalk.bold("RIGOUR QA EXECUTION SUMMARY"));
    console.log(chalk.bold.cyan("═══════════════════════════════════════════════════════════"));

    console.log("");
    console.log(`Report ID:         ${chalk.gray(report.id)}`);
    console.log(`Timestamp:         ${chalk.gray(report.timestamp.toISOString())}`);
    console.log(`Scenes Tested:     ${chalk.cyan(report.scenes_tested)}`);
    console.log(`Total Plans:       ${chalk.cyan(report.total_plans)}`);
    console.log(
      `Passed Plans:      ${this.colors.passed(report.passed_plans)} / ${report.total_plans}`
    );
    console.log(
      `Failed Plans:      ${this.colors.failed(report.failed_plans)} / ${report.total_plans}`
    );
    console.log(`Edge Cases Found:  ${chalk.cyan(report.edge_cases_explored)}`);
    console.log(
      `Healed Tests:      ${chalk.yellow(report.healed_tests)}`
    );
    console.log(`Total Duration:    ${chalk.cyan(report.total_duration_ms + "ms")}`);

    const passRate = (
      (report.passed_plans / report.total_plans) * 100
    ).toFixed(1);
    const passRateColor =
      parseFloat(passRate) >= 90
        ? this.colors.passed
        : parseFloat(passRate) >= 70
          ? this.colors.warning
          : this.colors.failed;

    console.log(
      `Pass Rate:         ${passRateColor(passRate + "%")}`
    );

    console.log(chalk.bold.cyan("═══════════════════════════════════════════════════════════"));
  }

  /**
   * Report error
   */
  reportError(error: Error, context?: string): void {
    console.error("");
    console.error(chalk.bold.red("ERROR"));
    if (context) {
      console.error(chalk.gray(`Context: ${context}`));
    }
    console.error(chalk.red(error.message));
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
  }

  /**
   * Report progress
   */
  reportProgress(current: number, total: number, label?: string): void {
    const percentage = ((current / total) * 100).toFixed(0);
    const barLength = 30;
    const filledLength = Math.round((barLength * current) / total);
    const bar =
      "█".repeat(filledLength) + "░".repeat(barLength - filledLength);

    const message = label ? ` ${label}` : "";
    console.log(
      `Progress: [${bar}] ${percentage}% (${current}/${total})${message}`
    );
  }

  /**
   * Report table
   */
  reportTable(
    headers: string[],
    rows: Array<Array<string | number>>
  ): void {
    const colWidths = headers.map((h) =>
      Math.max(
        h.length,
        ...rows.map((r) => String(r[headers.indexOf(h)]).length)
      )
    );

    // Print header
    console.log("");
    const headerRow = headers
      .map((h, i) => h.padEnd(colWidths[i]))
      .join(" | ");
    console.log(chalk.bold(headerRow));
    console.log(
      chalk.gray(
        colWidths.map((w) => "─".repeat(w)).join("─┼─")
      )
    );

    // Print rows
    for (const row of rows) {
      const dataRow = row
        .map((v, i) => String(v).padEnd(colWidths[i]))
        .join(" | ");
      console.log(dataRow);
    }
    console.log("");
  }

  /**
   * Get status color function
   */
  private statusColor(
    status: string
  ): (text: string) => string {
    switch (status) {
      case "passed":
        return this.colors.passed;
      case "failed":
        return this.colors.failed;
      case "skipped":
        return this.colors.warning;
      case "error":
        return this.colors.failed;
      default:
        return this.colors.info;
    }
  }

  /**
   * Format phase details
   */
  private formatPhaseDetails(
    phase: string,
    data: Record<string, unknown>
  ): string {
    switch (phase.toLowerCase()) {
      case "planning":
        return chalk.cyan(`plan_${data.plan_id}`);
      case "execution":
        return chalk.cyan(data.status);
      case "judging":
        return chalk.cyan(
          `${data.passed}/${data.total} assertions passed`
        );
      case "healing":
        return data.recovered
          ? chalk.green("Recovered")
          : chalk.yellow("Could not recover");
      case "exploration":
        return chalk.cyan(
          `${data.edge_cases_found} edge cases found`
        );
      default:
        return chalk.gray("In progress");
    }
  }

  /**
   * Clear spinners
   */
  clearSpinners(): void {
    for (const spinner of this.spinners.values()) {
      spinner.stop();
    }
    this.spinners.clear();
  }
}

/**
 * Create and return a console reporter instance
 */
export function createConsoleReporter(): ConsoleReporter {
  return new ConsoleReporter();
}
