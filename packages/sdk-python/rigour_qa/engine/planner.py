"""Agentic planner for generating test plans from scenes."""

import json
from typing import Optional
from uuid import uuid4

from anthropic import Anthropic

from rigour_qa.connection import Connection
from rigour_qa.engine.types import TestPlan
from rigour_qa.scene.schema import Scene


class AgenticPlanner:
    """Plan generator that uses Claude to understand scenes and generate executable test code."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize planner with optional Anthropic API key."""
        self.client = Anthropic(api_key=api_key)

    def plan(self, scene: Scene, connection: Connection) -> TestPlan:
        """Generate a test plan from a scene."""
        prompt = self._build_planning_prompt(scene, connection)

        message = self.client.messages.create(
            model="claude-opus-4-6",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text
        test_code = self._extract_code(response_text)

        if not test_code:
            test_code = self._generate_fallback_code(scene, connection)

        plan = TestPlan(
            id=str(uuid4()),
            scene_id=scene.id,
            title=scene.title,
            description=scene.description,
            test_code=test_code,
            steps_count=len(scene.steps) if scene.steps else 1,
        )

        return plan

    def _build_planning_prompt(self, scene: Scene, connection: Connection) -> str:
        """Build the prompt for test code generation."""
        steps_desc = ""
        if scene.steps:
            steps_desc = "Steps:\n"
            for i, step in enumerate(scene.steps, 1):
                steps_desc += f"  {i}. {step.action}"
                if step.expect:
                    steps_desc += f" (expect: {step.expect})"
                steps_desc += "\n"

        assertions_desc = ""
        if scene.assertions:
            assertions_desc = "Assertions:\n"
            for assertion in scene.assertions:
                assertions_desc += f"  - {assertion.type}: {assertion.target} == {assertion.expected}\n"

        return f"""Generate a Python pytest test function for this test scenario.

Test Title: {scene.title}
Description: {scene.description}
Base URL: {connection.base_url}
{steps_desc}
{assertions_desc}

Requirements:
1. Use httpx for HTTP requests
2. Include all assertions from the description
3. Use pytest conventions (assert statements)
4. Handle both success and error cases
5. Make it production-quality, not a stub
6. Name function: test_{scene.id.replace('-', '_')[:20]}
7. Return bare Python code (no markdown, no explanation)
8. Include proper error handling and logging

Generate the test function now:"""

    def generate_test_code(self, plan: TestPlan) -> str:
        """Return the test code from a plan."""
        return plan.test_code

    def explore_edge_cases(
        self, scene: Scene, plan: TestPlan, connection: Connection
    ) -> list[TestPlan]:
        """Autonomously generate edge case variants of a test plan."""
        prompt = f"""Given this test scenario:
Title: {scene.title}
Description: {scene.description}

Generate 5 edge case variations of this test. For each, provide:
1. Edge case name
2. What makes it an edge case
3. Expected behavior

Focus on:
- Boundary values (empty, max length, special characters)
- Authentication edge cases (invalid token, expired, wrong role)
- Timing edge cases (concurrent requests, slow responses)
- Data edge cases (null fields, duplicates, unicode)
- Network edge cases (timeouts, connection errors)

Return JSON array: [{{"name": "...", "description": "...", "focus": "..."}}]"""

        message = self.client.messages.create(
            model="claude-opus-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text

        try:
            import re
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                edge_cases_data = json.loads(json_match.group())
            else:
                edge_cases_data = json.loads(response_text)
        except json.JSONDecodeError:
            edge_cases_data = []

        plans = []
        for i, edge_case in enumerate(edge_cases_data[:5]):
            edge_scene = Scene(
                id=str(uuid4()),
                title=f"{scene.title} - {edge_case.get('name', f'Edge Case {i+1}')}",
                description=f"{scene.description}\nEdge case: {edge_case.get('description', '')}",
                actor=scene.actor,
                tags=(scene.tags or []) + ["edge-case"],
                priority=scene.priority,
            )

            edge_plan = self.plan(edge_scene, connection)
            plans.append(edge_plan)

        return plans

    def _extract_code(self, response: str) -> Optional[str]:
        """Extract Python code from response."""
        import re
        code_match = re.search(
            r'```python\n(.*?)\n```',
            response,
            re.DOTALL
        )
        if code_match:
            return code_match.group(1)

        if response.strip().startswith("def test_"):
            return response.strip()

        return None

    def _generate_fallback_code(self, scene: Scene, connection: Connection) -> str:
        """Generate a fallback test when Claude fails - creates actual HTTP calls."""
        test_name = scene.id.replace('-', '_')[:20]

        # Build step descriptions
        steps_code = ""
        if scene.steps:
            for i, step in enumerate(scene.steps, 1):
                # Parse action as HTTP method and path
                parts = step.action.split(' ', 1)
                method = parts[0] if len(parts) > 0 else "GET"
                path = parts[1] if len(parts) > 1 else "/"

                steps_code += f"\n    # Step {i}: {step.action}\n"
                if method.upper() in ["GET", "DELETE", "HEAD"]:
                    steps_code += f'    response = client.{method.lower()}("{path}")\n'
                else:
                    json_str = json.dumps(step.input or {})
                    steps_code += f'    response = client.{method.lower()}("{path}", json={json_str})\n'

                if step.expect:
                    steps_code += f'    # Expected: {step.expect}\n'

        # Build assertions
        assertions_code = ""
        if scene.assertions:
            for assertion in scene.assertions:
                if assertion.type.value == "status_code":
                    assertions_code += f'\n    assert response.status_code == {assertion.expected}, "Status code should be {assertion.expected}"\n'
                elif assertion.type.value == "body_contains":
                    assertions_code += f'\n    assert "{assertion.expected}" in response.text, "Response should contain {assertion.expected}"\n'
        else:
            # Default: assert not a 5xx error
            assertions_code = '\n    assert response.status_code < 500, "Should not return server error"'

        code = f'''import httpx
import pytest

def test_{test_name}():
    """Test: {scene.title}
    {scene.description}
    """
    client = httpx.Client(base_url="{connection.base_url}")
{steps_code}
{assertions_code}
'''
        return code
