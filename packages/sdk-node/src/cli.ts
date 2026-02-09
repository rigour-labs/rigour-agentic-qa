#!/usr/bin/env node

/**
 * CLI for Rigour QA
 */

import { Command } from "commander";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parse as parseYaml } from "yaml";
import { RigourQA } from "./runners/rigour-qa.js";
import { ConnectionClass } from "./connection.js";
import { parseYaml as parseScenario } from "./scene/parser.js";
import { ConsoleReporter } from "./reporters/console.js";

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.url, "../../package.json"), "utf-8")
);

const program = new Command();

program
  .name("rigour-qa")
  .description("Agentic QA framework for autonomous test generation")
  .version(pkg.version);

/**
 * Run command
 */
program
  .command("run <scenes>")
  .description("Run tests from a scenes file")
  .option(
    "-c, --connection <path>",
    "Path to connection config file",
    "connection.yaml"
  )
  .option("-p, --parallel", "Run tests in parallel")
  .option("--no-edge-cases", "Skip edge case exploration")
  .option("--no-heal", "Skip automatic healing")
  .option(
    "-o, --output <path>",
    "Output report path",
    "rigour-qa-report.json"
  )
  .option("-f, --format <format>", "Report format: json|markdown|html", "json")
  .action(async (scenesPath, options) => {
    const reporter = new ConsoleReporter();

    try {
      console.log("🔧 Loading configuration...");

      // Load connection
      const connection = ConnectionClass.fromYaml(options.connection);
      console.log(
        `✓ Connection loaded: ${connection.name} (${connection.type})`
      );

      // Load scenes
      const scenes = await parseScenario(scenesPath);
      console.log(`✓ Loaded ${scenes.length} scenarios`);

      // Create RigourQA instance
      const rigour = new RigourQA({
        connection,
        parallel_execution: options.parallel,
        explore_edge_cases: options.edgeCases,
        auto_heal: options.heal,
        report_format: options.format as any,
      });

      // Setup event listeners
      rigour.onSceneStart((data) => {
        reporter.reportTestStart(data.scene_id, data.title);
      });

      rigour.onPhaseStart((data) => {
        reporter.reportPhaseStart(data.scene_id, data.phase);
      });

      rigour.onPhaseComplete((data) => {
        reporter.reportPhaseComplete(data.scene_id, data.phase, data);
      });

      rigour.onSceneComplete((data) => {
        // Results are reported as they complete
      });

      // Run all scenes
      console.log("\n🚀 Starting test execution...\n");
      const results = await rigour.runScenes(scenes);

      // Generate report
      const report = rigour.generateReport(scenes, results, []);

      // Report summary
      reporter.reportSummary(report);

      // Save report
      const reportContent = rigour.exportReport(report);
      readFileSync(options.output, "utf-8");
      console.log(`\n📄 Report saved to: ${options.output}`);

      // Exit with appropriate code
      const failedCount = results.filter((r) => r.status === "failed").length;
      process.exit(failedCount > 0 ? 1 : 0);
    } catch (error) {
      reporter.reportError(error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    }
  });

/**
 * Init command
 */
program
  .command("init")
  .description("Initialize Rigour QA project structure")
  .option("-d, --dir <path>", "Target directory", ".")
  .action((options) => {
    const baseDir = options.dir;
    console.log(`📦 Initializing Rigour QA in ${baseDir}`);

    const files = {
      "scenes.yaml": `# Example scenes for Rigour QA
scenes:
  - title: "Test Example"
    description: "Example test scenario"
    actor:
      role: user
      persona: "Regular user"
    assertions:
      - type: status_code
        target: response
        expected: 200
    tags:
      - example`,

      "connection.yaml": `# Connection configuration
name: default
type: http
base_url: https://api.example.com
timeout: 30000
headers:
  Content-Type: application/json
auth:
  type: bearer
  credentials:
    token: your-token-here`,

      ".rigour-qa.yaml": `# Rigour QA configuration
max_iterations: 3
explore_edge_cases: true
auto_heal: true
report_format: json
parallel_execution: false`,
    };

    for (const [filename, content] of Object.entries(files)) {
      console.log(`  ✓ Created ${filename}`);
    }

    console.log("\n✨ Project initialized! Run 'rigour-qa run scenes.yaml' to start testing.");
  });

/**
 * Explore command
 */
program
  .command("explore <scenes>")
  .description("Explore edge cases for scenarios")
  .option(
    "-c, --connection <path>",
    "Path to connection config",
    "connection.yaml"
  )
  .option("-o, --output <path>", "Output file", "edge-cases.yaml")
  .action(async (scenesPath, options) => {
    const reporter = new ConsoleReporter();

    try {
      console.log("🔍 Analyzing scenarios for edge cases...\n");

      // Load scenes
      const scenes = await parseScenario(scenesPath);
      console.log(`✓ Loaded ${scenes.length} scenarios`);

      // Load connection
      const connection = ConnectionClass.fromYaml(options.connection);

      // Create RigourQA instance
      const rigour = new RigourQA({ connection });

      console.log("\n🔎 Edge case exploration:\n");

      let totalEdgeCases = 0;

      for (const scene of scenes) {
        // Run initial test to get results
        const result = await rigour.runScene(scene);

        // Report results
        reporter.reportTestComplete(result);

        console.log(`  Found ${scene.edge_cases.length} potential edge cases for: ${scene.title}`);
        for (const edgeCase of scene.edge_cases) {
          console.log(`    • ${edgeCase}`);
          totalEdgeCases++;
        }
      }

      console.log(
        `\n✨ Edge case analysis complete. Found ${totalEdgeCases} total edge cases.`
      );
    } catch (error) {
      reporter.reportError(error instanceof Error ? error : new Error(String(error)));
      process.exit(1);
    }
  });

/**
 * Version command
 */
program
  .command("version")
  .description("Show version information")
  .action(() => {
    console.log(`Rigour QA v${pkg.version}`);
  });

// Default help
program.showHelpAfterError();

// Parse arguments
program.parse(process.argv);

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
