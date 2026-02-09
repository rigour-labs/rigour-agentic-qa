"""Example: Parse natural language test descriptions."""

from rigour_qa.scene.parser import SceneParser
from rigour_qa import Connection, RigourQA
from rigour_qa.runner import RigourQAConfig

# Initialize the parser
parser = SceneParser()

# Parse natural language descriptions
test_descriptions = [
    "User should be able to log in with valid email and password and receive an access token",
    "When a user tries to create an account with an email that's already registered, the API should return a 409 error with message 'Email already exists'",
    "The API should handle concurrent requests gracefully without race conditions or data corruption",
    "Users with admin role can delete other users, but regular users cannot",
]

print("Parsing natural language test descriptions...\n")

scenes = []
for description in test_descriptions:
    print(f"Parsing: {description[:60]}...")
    try:
        scene = parser.parse_natural_language(description)
        scenes.append(scene)
        print(f"✓ Generated scene: {scene.title}")
        print(f"  ID: {scene.id}")
        print(f"  Priority: {scene.priority}")
        if scene.steps:
            print(f"  Steps: {len(scene.steps)}")
        if scene.assertions:
            print(f"  Assertions: {len(scene.assertions)}")
        print()
    except Exception as e:
        print(f"✗ Failed to parse: {e}\n")

# Configure and run tests
if scenes:
    connection = Connection(
        base_url="https://api.example.com",
        auth_type="bearer",
        auth_token="token_xxx",
    )

    config = RigourQAConfig(
        enable_edge_case_exploration=False,
        enable_healing=False,
    )

    qa = RigourQA(connection, config)

    print(f"Running {len(scenes)} autonomously generated test scenarios...\n")
    result = qa.run(scenes)

    summary = qa.get_summary(result)
    print(f"\n=== Summary ===")
    print(f"Total: {summary['total_scenes']}")
    print(f"Passed: {summary['passed']}")
    print(f"Failed: {summary['failed']}")
    print(f"Pass Rate: {summary['pass_rate']:.1f}%")
