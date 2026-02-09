"""Example: Autonomous edge case exploration."""

from rigour_qa import Connection, RigourQA, SceneBuilder, Priority
from rigour_qa.runner import RigourQAConfig

# Configure the target system
connection = Connection(
    base_url="https://api.example.com",
    auth_type="bearer",
    auth_token="token_xxx",
    timeout=30,
)

# Create a single test scenario
scene = (
    SceneBuilder("User Registration", "New user registers with email and password")
    .with_actor("anonymous")
    .with_priority(Priority.CRITICAL)
    .with_tags("auth", "registration", "critical-path")
    .with_step("POST /api/auth/register", {
        "email": "newuser@example.com",
        "password": "SecurePass123!",
        "name": "New User"
    })
    .with_assertion("status_code", "response", 201)
    .with_assertion("body_contains", "response", "user_id")
    .with_assertion("body_contains", "response", "access_token")
    .with_edge_case("Register with empty password")
    .with_edge_case("Register with SQL injection in email")
    .build()
)

# Configure with edge case exploration enabled
config = RigourQAConfig(
    enable_edge_case_exploration=True,
    enable_healing=True,
    enable_quality_judgment=True,
    max_edge_cases_per_scene=10,
)

# Create the Rigour QA instance
qa = RigourQA(connection, config)

# Run just this scene with full edge case exploration
print(f"Testing: {scene.title}")
print(f"Description: {scene.description}\n")

scene_result = qa.run_scene(scene)

# Display initial execution result
print(f"Initial Test: {'✓ PASSED' if scene_result.passed else '✗ FAILED'}")
print(f"Duration: {scene_result.execution_result.duration:.2f}s")

# Display edge case exploration results
if scene_result.edge_case_results:
    print(f"\nEdge Cases Generated: {len(scene_result.edge_case_results)}")
    print("\nEdge Case Results:")
    print("-" * 60)

    for i, result in enumerate(scene_result.edge_case_results, 1):
        status = "✓ PASS" if result.passed else "✗ FAIL"
        print(f"{i}. {status}")
        print(f"   Plan ID: {result.plan_id}")
        print(f"   Duration: {result.duration:.2f}s")
        if result.assertions_failed > 0:
            print(f"   Failed Assertions: {result.assertions_failed}")
        if result.error_message:
            print(f"   Error: {result.error_message[:100]}")

    edge_passed = sum(1 for r in scene_result.edge_case_results if r.passed)
    print(f"\nEdge Case Summary: {edge_passed}/{len(scene_result.edge_case_results)} passed")

    if edge_passed < len(scene_result.edge_case_results):
        print("\nFailed edge cases detected - these are potential bugs!")
        for result in scene_result.edge_case_results:
            if not result.passed:
                print(f"  - {result.plan_id}: {result.error_message}")

# Display healing results if applicable
if scene_result.healing_result and not scene_result.execution_result.passed:
    print(f"\nHealing Result: {'✓ FIXED' if scene_result.healing_result.passed else '✗ STILL BROKEN'}")
    print(f"Duration: {scene_result.healing_result.duration:.2f}s")
