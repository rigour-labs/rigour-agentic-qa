"""Parser for converting natural language and structured formats into Scene objects."""

import json
from typing import Any, Optional

import yaml
from anthropic import Anthropic
from pydantic import ValidationError

from rigour_qa.scene.schema import Scene


class SceneParser:
    """Parse scenes from various formats: natural language, YAML, Gherkin."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize parser with optional Anthropic API key."""
        self.client = Anthropic(api_key=api_key)

    def parse_natural_language(self, text: str) -> Scene:
        """Parse natural language test description into a structured Scene."""
        prompt = f"""You are a test scenario parser. Convert the following natural language test description
into a JSON object matching this schema:

{{
    "title": "string - short title",
    "description": "string - the original description",
    "actor": {{
        "role": "string - admin|user|anonymous|api_client",
        "persona": "string - optional description"
    }},
    "steps": [
        {{
            "action": "string - HTTP verb + endpoint OR UI action",
            "input": {{"key": "value"}},
            "expect": "string - expected outcome"
        }}
    ],
    "assertions": [
        {{
            "type": "status_code|body_contains|body_schema|db_state|response_time|header_contains|semantic|custom",
            "target": "string",
            "expected": "any"
        }}
    ],
    "edge_cases": ["string - edge case description"],
    "tags": ["string - tag"],
    "priority": "critical|high|medium|low"
}}

Test description:
{text}

Return ONLY valid JSON, no markdown or explanation."""

        message = self.client.messages.create(
            model="claude-opus-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text
        try:
            scene_dict = json.loads(response_text)
            return Scene(**scene_dict)
        except (json.JSONDecodeError, ValidationError) as e:
            raise ValueError(f"Failed to parse natural language into Scene: {e}")

    def parse_yaml(self, path: str) -> list[Scene]:
        """Parse YAML file containing scene definitions.

        Supports multiple formats:
        - List of scene dicts: [{ title: ..., description: ... }, ...]
        - Single scene dict: { title: ..., description: ... }
        - Wrapped format: { scenes: [{ title: ..., description: ... }, ...] }
        """
        with open(path, 'r') as f:
            data = yaml.safe_load(f)

        # Handle wrapped format: { scenes: [...] }
        if isinstance(data, dict) and "scenes" in data:
            data = data["scenes"]

        if isinstance(data, list):
            scenes = [Scene(**item) for item in data]
        elif isinstance(data, dict):
            scenes = [Scene(**data)]
        else:
            raise ValueError("YAML must contain dict or list of dicts")

        return scenes

    def parse_gherkin(self, text: str) -> Scene:
        """Parse Given/When/Then format into Scene."""
        lines = [line.strip() for line in text.strip().split('\n') if line.strip()]

        title = ""
        description_parts = []
        given_parts = []
        when_parts = []
        then_parts = []
        current_section = None

        for line in lines:
            if line.startswith("Feature:"):
                title = line.replace("Feature:", "").strip()
            elif line.startswith("Scenario:"):
                title = line.replace("Scenario:", "").strip()
            elif line.startswith("Given"):
                current_section = "given"
                given_parts.append(line.replace("Given", "").strip())
            elif line.startswith("When"):
                current_section = "when"
                when_parts.append(line.replace("When", "").strip())
            elif line.startswith("Then"):
                current_section = "then"
                then_parts.append(line.replace("Then", "").strip())
            elif line.startswith("And"):
                if current_section == "given":
                    given_parts.append(line.replace("And", "").strip())
                elif current_section == "when":
                    when_parts.append(line.replace("And", "").strip())
                elif current_section == "then":
                    then_parts.append(line.replace("And", "").strip())

        description = " ".join(given_parts + when_parts + then_parts)

        scene = Scene(
            title=title,
            description=description,
        )

        for when_stmt in when_parts:
            scene.add_step(action=when_stmt)

        for then_stmt in then_parts:
            scene.add_assertion(
                assertion_type="semantic",
                target="response",
                expected=then_stmt,
                semantic_prompt=then_stmt
            )

        return scene

    def parse_dict(self, data: dict[str, Any]) -> Scene:
        """Parse a dictionary into a Scene object."""
        return Scene(**data)
