/**
 * Basic usage example of Rigour QA SDK
 */

import {
  RigourQA,
  ConnectionClass,
  parseYaml,
  SceneBuilder,
  Priority,
  AssertionType,
  ConsoleReporter,
} from "@rigour-labs/qa";

// Example 1: Using YAML files
async function exampleWithYamlFiles() {
  console.log("Example 1: Using YAML files\n");

  // Load configuration
  const connection = ConnectionClass.fromYaml("connection.yaml");
  const scenes = await parseYaml("scenes.yaml");

  // Create RigourQA runner
  const rigour = new RigourQA({
    connection,
    explore_edge_cases: true,
    auto_heal: true,
    report_format: "json",
  });

  // Setup reporting
  const reporter = new ConsoleReporter();

  rigour.onSceneStart((data) => {
    reporter.reportTestStart(data.scene_id, data.title);
  });

  rigour.onPhaseComplete((data) => {
    reporter.reportPhaseComplete(data.scene_id, data.phase, data);
  });

  // Run tests
  const results = await rigour.runScenes(scenes);

  // Generate report
  const report = rigour.generateReport(scenes, results, []);
  reporter.reportSummary(report);

  console.log(`\nTests completed: ${results.length} total`);
  console.log(
    `Passed: ${results.filter((r) => r.status === "passed").length}`
  );
  console.log(`Failed: ${results.filter((r) => r.status === "failed").length}`);
}

// Example 2: Building scenes programmatically
async function exampleWithProgrammaticScenes() {
  console.log("\nExample 2: Building scenes programmatically\n");

  // Build a scene using fluent API
  const loginScene = SceneBuilder.create(
    "User Login",
    "Test user authentication with valid credentials"
  )
    .addActor("user", "A regular registered user")
    .addStep("POST /auth/login", {
      email: "user@example.com",
      password: "password123",
    })
    .addAssertion(AssertionType.STATUS_CODE, "response", 200)
    .addAssertion(
      AssertionType.BODY_CONTAINS,
      "response",
      "access_token"
    )
    .addAssertion(AssertionType.RESPONSE_TIME, "response", 1000)
    .addEdgeCase("Test with invalid password")
    .addEdgeCase("Test with non-existent user")
    .addTag("auth")
    .addTag("critical")
    .priority(Priority.CRITICAL)
    .build();

  // Load connection
  const connection = new ConnectionClass({
    name: "test-api",
    type: "http",
    base_url: "https://api.example.com",
    timeout: 30000,
  });

  // Create runner
  const rigour = new RigourQA({ connection });

  // Run single scene
  const result = await rigour.runScene(loginScene);

  console.log(`Test result: ${result.status}`);
  console.log(`Passed: ${result.passed_count}/${result.total_count}`);
  console.log(`Duration: ${result.duration_ms}ms`);

  if (result.error) {
    console.log(`Error: ${result.error}`);
  }
}

// Example 3: Using natural language parsing
async function exampleWithNaturalLanguage() {
  console.log("\nExample 3: Using natural language parsing\n");

  const { parseNaturalLanguage } = await import("@rigour-labs/qa");

  const description = `
    Test that when a user submits a form with invalid email,
    the API returns a 400 status code with an error message
    saying "Invalid email format". Also test edge cases like
    empty email, very long email addresses, and special characters.
  `;

  const scene = await parseNaturalLanguage(description);

  console.log(`Scene created: ${scene.title}`);
  console.log(`Steps: ${scene.steps.length}`);
  console.log(`Assertions: ${scene.assertions.length}`);
  console.log(`Edge cases: ${scene.edge_cases.length}`);
}

// Example 4: Custom connection from environment
async function exampleWithEnvironmentConfig() {
  console.log("\nExample 4: Using environment variables\n");

  // Set environment variables:
  // RIGOUR_NAME=my-api
  // RIGOUR_TYPE=http
  // RIGOUR_BASE_URL=https://api.example.com
  // RIGOUR_TIMEOUT=30000
  // RIGOUR_AUTH_TYPE=bearer
  // RIGOUR_AUTH_TOKEN=my-secret-token

  const connection = ConnectionClass.fromEnv("RIGOUR");

  console.log(`Connection name: ${connection.name}`);
  console.log(`Connection type: ${connection.type}`);
  console.log(`Base URL: ${connection.base_url}`);
  console.log(`Timeout: ${connection.timeout}ms`);
}

// Example 5: Event-driven execution with custom reporting
async function exampleWithCustomReporting() {
  console.log("\nExample 5: Event-driven execution\n");

  const connection = new ConnectionClass({
    name: "example",
    type: "http",
    base_url: "https://api.example.com",
  });

  const rigour = new RigourQA({ connection });
  const reporter = new ConsoleReporter();

  // Track progress
  let processedScenes = 0;
  const totalScenes = 3;

  rigour.on("scene_start", (data) => {
    reporter.reportTestStart(data.scene_id, data.title);
  });

  rigour.on("phase_start", (data) => {
    console.log(`  → ${data.phase.toUpperCase()}`);
  });

  rigour.on("phase_complete", (data) => {
    console.log(`  ✓ ${data.phase} completed`);
  });

  rigour.on("scene_complete", (data) => {
    processedScenes++;
    reporter.reportProgress(processedScenes, totalScenes, data.title);
  });

  rigour.on("run_complete", (data) => {
    console.log(`\nAll tests completed!`);
    console.log(`Total: ${data.total_scenes}`);
    console.log(`Passed: ${data.passed}`);
    console.log(`Failed: ${data.failed}`);
    console.log(`Duration: ${data.duration_ms}ms`);
  });

  // Create example scenes
  const scenes = [
    SceneBuilder.create("Test 1", "First test").build(),
    SceneBuilder.create("Test 2", "Second test").build(),
    SceneBuilder.create("Test 3", "Third test").build(),
  ];

  // Run with event tracking
  const results = await rigour.runScenes(scenes);
}

// Example 6: Gherkin format parsing
async function exampleWithGherkin() {
  console.log("\nExample 6: Gherkin format parsing\n");

  const { parseGherkin } = await import("@rigour-labs/qa");

  const gherkinText = `
Feature: API Authentication

Scenario: Successful login with valid credentials
  Given user is on the login endpoint
  When user submits valid email and password
  Then response status should be 200
  And response should contain access token

Scenario: Failed login with invalid password
  Given user is on the login endpoint
  When user submits valid email and invalid password
  Then response status should be 401
  And response should contain error message
  `;

  const scene = parseGherkin(gherkinText);

  console.log(`Scene created from Gherkin: ${scene.title}`);
  console.log(`Steps: ${scene.steps.length}`);
  console.log(`Tags: ${scene.tags.join(", ")}`);
}

// Run examples
async function main() {
  try {
    // Uncomment the example you want to run:

    // await exampleWithYamlFiles();
    // await exampleWithProgrammaticScenes();
    // await exampleWithNaturalLanguage();
    // await exampleWithEnvironmentConfig();
    // await exampleWithCustomReporting();
    // await exampleWithGherkin();

    console.log("Examples available. Uncomment in main() to run them.");
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
