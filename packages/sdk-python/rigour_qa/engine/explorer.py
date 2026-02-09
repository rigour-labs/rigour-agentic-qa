"""Edge case explorer - THE KEY DIFFERENTIATOR for autonomous test generation."""

import json
from typing import Optional
from uuid import uuid4

from anthropic import Anthropic

from rigour_qa.connection import Connection
from rigour_qa.engine.types import ExecutionResult
from rigour_qa.scene.schema import Scene


class EdgeExplorer:
    """Autonomously explores edge cases relevant to a test scenario."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize explorer with Anthropic client."""
        self.client = Anthropic(api_key=api_key)

    def explore(
        self,
        scene: Scene,
        initial_result: ExecutionResult,
        connection: Connection,
    ) -> list[Scene]:
        """Generate edge case variants based on initial test execution."""

        if not initial_result.passed:
            return []

        edge_case_suggestions = self._suggest_edge_cases(scene, connection)
        generated_scenes = []

        for suggestion in edge_case_suggestions:
            edge_scene = self._create_edge_case_scene(scene, suggestion)
            generated_scenes.append(edge_scene)

        return generated_scenes

    def _suggest_edge_cases(self, scene: Scene, connection: Connection) -> list[dict]:
        """Use Claude to suggest relevant edge cases."""

        prompt = f"""Analyze this test scenario and suggest specific, actionable edge cases:

Title: {scene.title}
Description: {scene.description}
Target: {connection.base_url}
{f'Actor Role: {scene.actor.role}' if scene.actor else ''}

Generate 8 specific edge cases covering:
1. Boundary values (empty strings, max lengths, special characters)
2. Authentication issues (invalid tokens, expired tokens, wrong role/permissions)
3. Timing/concurrency issues (rapid repeated requests, slow network, timeouts)
4. Data edge cases (null/undefined fields, duplicate entries, unicode/emoji)
5. State machine edge cases (operations in wrong order, resource conflicts)
6. Business logic edge cases (limits exceeded, invalid transitions)
7. Input validation edge cases (SQL injection, XSS, command injection)
8. Integration edge cases (dependent services down, race conditions)

For each edge case, provide:
- name: Edge case name
- description: What the edge case tests
- strategy: How to trigger it (e.g., send empty string, use expired token)
- expected_behavior: What should happen
- priority: critical|high|medium|low

Return JSON array. Be SPECIFIC with actual values and payloads."""

        message = self.client.messages.create(
            model="claude-opus-4-6",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text

        try:
            import re
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                edge_cases = json.loads(json_match.group())
            else:
                edge_cases = json.loads(response_text)
        except json.JSONDecodeError:
            edge_cases = []

        return edge_cases[:8]

    def _create_edge_case_scene(self, original_scene: Scene, edge_case_spec: dict) -> Scene:
        """Create a new Scene from an edge case specification."""

        edge_scene = Scene(
            id=str(uuid4()),
            title=f"{original_scene.title} - {edge_case_spec.get('name', 'Edge Case')}",
            description=(
                f"Original: {original_scene.description}\n\n"
                f"Edge Case: {edge_case_spec.get('description', '')}\n"
                f"Strategy: {edge_case_spec.get('strategy', '')}\n"
                f"Expected: {edge_case_spec.get('expected_behavior', '')}"
            ),
            actor=original_scene.actor,
            tags=original_scene.tags + ["edge-case", f"priority-{edge_case_spec.get('priority', 'medium')}"],
            priority=original_scene.priority,
        )

        if original_scene.steps:
            edge_scene.steps = list(original_scene.steps)

        if original_scene.assertions:
            edge_scene.assertions = list(original_scene.assertions)

        edge_scene.metadata.update({
            "edge_case_type": edge_case_spec.get('name', 'unknown'),
            "strategy": edge_case_spec.get('strategy', ''),
            "original_scene_id": original_scene.id,
        })

        return edge_scene

    def prioritize_exploration(
        self, initial_results: list[ExecutionResult]
    ) -> list[str]:
        """Prioritize which edge case areas to explore based on initial results."""
        priority_areas = []

        all_passed = all(r.passed for r in initial_results)
        if all_passed:
            priority_areas.extend([
                "boundary_values",
                "authentication",
                "concurrency",
                "data_edge_cases",
            ])

        failed_results = [r for r in initial_results if not r.passed]
        for result in failed_results:
            if "timeout" in (result.error_message or "").lower():
                priority_areas.append("concurrency")
            elif "auth" in (result.error_message or "").lower():
                priority_areas.append("authentication")
            elif "validation" in (result.error_message or "").lower():
                priority_areas.append("input_validation")

        return list(set(priority_areas))
