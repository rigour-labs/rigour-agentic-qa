"""Tests for Scene module."""

import pytest
from rigour_qa.scene.schema import (
    Scene,
    Actor,
    Step,
    Assertion,
    AssertionType,
    Priority,
    AuthConfig,
)
from rigour_qa.scene.builder import SceneBuilder


def test_scene_creation():
    """Test basic Scene creation."""
    scene = Scene(
        title="Test Scene",
        description="A test scenario",
    )
    assert scene.title == "Test Scene"
    assert scene.description == "A test scenario"
    assert scene.id is not None
    assert scene.priority == Priority.MEDIUM


def test_scene_with_actor():
    """Test Scene with Actor."""
    actor = Actor(role="user", persona="Regular user")
    scene = Scene(
        title="Test",
        description="Test",
        actor=actor,
    )
    assert scene.actor.role == "user"
    assert scene.actor.persona == "Regular user"


def test_scene_builder():
    """Test SceneBuilder fluent API."""
    scene = (
        SceneBuilder("Login", "User logs in")
        .with_actor("user", persona="Regular user")
        .with_priority(Priority.HIGH)
        .with_tags("auth", "critical")
        .with_step("POST /login", {"email": "test@example.com"})
        .with_assertion(AssertionType.STATUS_CODE, "response", 200)
        .with_edge_case("Login with empty password")
        .build()
    )

    assert scene.title == "Login"
    assert scene.priority == Priority.HIGH
    assert "auth" in scene.tags
    assert len(scene.steps) == 1
    assert len(scene.assertions) == 1
    assert len(scene.edge_cases) == 1


def test_scene_add_methods():
    """Test Scene fluent add methods."""
    scene = Scene(title="Test", description="Test")

    result = (
        scene
        .add_step("GET /api/users")
        .add_assertion(AssertionType.STATUS_CODE, "response", 200)
        .add_edge_case("Invalid ID")
    )

    assert result is scene  # Fluent API returns self
    assert len(scene.steps) == 1
    assert len(scene.assertions) == 1
    assert len(scene.edge_cases) == 1


def test_actor_with_auth():
    """Test Actor with authentication."""
    auth = AuthConfig(type="bearer", value="token_xyz")
    actor = Actor(role="api_client", auth=auth)

    assert actor.auth.type == "bearer"
    assert actor.auth.value == "token_xyz"


def test_step_creation():
    """Test Step creation."""
    step = Step(
        action="POST /users",
        input={"name": "John", "email": "john@example.com"},
        expect="Returns 201 with user ID"
    )

    assert step.action == "POST /users"
    assert step.input["email"] == "john@example.com"
    assert "201" in step.expect


def test_assertion_creation():
    """Test Assertion creation."""
    assertion = Assertion(
        type=AssertionType.STATUS_CODE,
        target="response",
        expected=200,
    )

    assert assertion.type == AssertionType.STATUS_CODE
    assert assertion.expected == 200


def test_semantic_assertion():
    """Test Semantic assertion."""
    assertion = Assertion(
        type=AssertionType.SEMANTIC,
        target="response",
        expected="user data is complete",
        semantic_prompt="Does response contain all user fields?",
    )

    assert assertion.type == AssertionType.SEMANTIC
    assert assertion.semantic_prompt is not None


def test_scene_priority_enum():
    """Test Priority enum values."""
    assert Priority.CRITICAL.value == "critical"
    assert Priority.HIGH.value == "high"
    assert Priority.MEDIUM.value == "medium"
    assert Priority.LOW.value == "low"


def test_assertion_type_enum():
    """Test AssertionType enum values."""
    assert AssertionType.STATUS_CODE.value == "status_code"
    assert AssertionType.BODY_CONTAINS.value == "body_contains"
    assert AssertionType.SEMANTIC.value == "semantic"


def test_scene_with_metadata():
    """Test Scene with metadata."""
    scene = Scene(
        title="Test",
        description="Test",
        metadata={"feature": "users", "version": "1.0"}
    )

    assert scene.metadata["feature"] == "users"
    assert scene.metadata["version"] == "1.0"


def test_scene_json_schema():
    """Test Scene can be serialized."""
    scene = (
        SceneBuilder("API Test", "Test API endpoint")
        .with_actor("user")
        .with_priority(Priority.HIGH)
        .with_tags("api", "test")
        .build()
    )

    scene_dict = scene.dict(exclude_none=True)
    assert "id" in scene_dict
    assert scene_dict["title"] == "API Test"
    assert scene_dict["priority"] == "high"  # Enum value


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
