"""Example: Simple API test with Rigour QA."""

from rigour_qa import Connection, RigourQA, Scene, SceneBuilder, Priority, AssertionType

# Configure the target system
connection = Connection(
    base_url="https://jsonplaceholder.typicode.com",
    timeout=30,
)

# Define test scenarios using the fluent builder API
scenes = [
    SceneBuilder("Fetch Post", "Retrieve a post by ID")
    .with_actor("user")
    .with_priority(Priority.HIGH)
    .with_tags("api", "get", "critical")
    .with_step("GET /posts/1")
    .with_assertion(AssertionType.STATUS_CODE, "response", 200)
    .with_assertion(AssertionType.BODY_CONTAINS, "response", "userId")
    .with_edge_case("Fetch with invalid post ID")
    .with_edge_case("Fetch with missing required parameter")
    .build(),

    SceneBuilder("List Posts", "Retrieve list of posts")
    .with_actor("user")
    .with_priority(Priority.MEDIUM)
    .with_tags("api", "list")
    .with_step("GET /posts", {"_limit": "10"})
    .with_assertion(AssertionType.STATUS_CODE, "response", 200)
    .with_assertion(AssertionType.BODY_CONTAINS, "response", "userId")
    .with_edge_case("List with limit of 0")
    .with_edge_case("List with extremely large limit")
    .build(),
]

# Create the Rigour QA instance
qa = RigourQA(connection)

# Run the full agentic pipeline
print("Starting Rigour QA pipeline...")
result = qa.run(scenes)

# Display results
summary = qa.get_summary(result)
print("\n=== Test Summary ===")
print(f"Total Scenes: {summary['total_scenes']}")
print(f"Passed: {summary['passed']}")
print(f"Failed: {summary['failed']}")
print(f"Pass Rate: {summary['pass_rate']:.1f}%")
print(f"Edge Cases Found: {summary['edge_cases_found']}")
print(f"Total Duration: {summary['total_duration']:.2f}s")

# Detailed results
print("\n=== Detailed Results ===")
for scene_result in result.scene_results:
    status = "✓ PASS" if scene_result.passed else "✗ FAIL"
    print(f"\n{status} {scene_result.scene_title}")
    print(f"  Duration: {scene_result.execution_result.duration:.2f}s")
    if scene_result.edge_case_results:
        passed_edge = sum(1 for r in scene_result.edge_case_results if r.passed)
        print(f"  Edge Cases: {passed_edge}/{len(scene_result.edge_case_results)} passed")
