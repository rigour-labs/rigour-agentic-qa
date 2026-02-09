"""Scene builder for fluent scene construction."""

from typing import Any, Optional

from rigour_qa.scene.schema import Actor, AssertionType, Priority, Scene


class SceneBuilder:
    """Fluent builder for constructing Scene objects."""

    def __init__(self, title: str, description: str):
        """Initialize builder with title and description."""
        self._scene = Scene(title=title, description=description)

    def with_actor(
        self,
        role: str,
        auth_type: Optional[str] = None,
        auth_value: Optional[str] = None,
        persona: Optional[str] = None,
    ) -> "SceneBuilder":
        """Add an actor to the scene."""
        auth = None
        if auth_type:
            from rigour_qa.scene.schema import AuthConfig
            auth = AuthConfig(type=auth_type, value=auth_value)

        self._scene.actor = Actor(role=role, auth=auth, persona=persona)
        return self

    def with_priority(self, priority: Priority) -> "SceneBuilder":
        """Set the priority level."""
        self._scene.priority = priority
        return self

    def with_tags(self, *tags: str) -> "SceneBuilder":
        """Add tags to the scene."""
        self._scene.tags.extend(tags)
        return self

    def with_step(
        self,
        action: str,
        input_data: Optional[dict[str, Any]] = None,
        expect: Optional[str] = None,
    ) -> "SceneBuilder":
        """Add a step to the scene."""
        self._scene.add_step(action, input_data, expect)
        return self

    def with_assertion(
        self,
        assertion_type: AssertionType,
        target: str,
        expected: Any,
        semantic_prompt: Optional[str] = None,
    ) -> "SceneBuilder":
        """Add an assertion to the scene."""
        self._scene.add_assertion(assertion_type, target, expected, semantic_prompt)
        return self

    def with_edge_case(self, description: str) -> "SceneBuilder":
        """Add an edge case hint."""
        self._scene.add_edge_case(description)
        return self

    def with_metadata(self, key: str, value: Any) -> "SceneBuilder":
        """Add metadata to the scene."""
        self._scene.metadata[key] = value
        return self

    def build(self) -> Scene:
        """Build and return the Scene object."""
        return self._scene
