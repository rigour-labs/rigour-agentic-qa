"""Core Scene data model for Rigour QA."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class Priority(str, Enum):
    """Priority levels for scenes."""

    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AssertionType(str, Enum):
    """Types of assertions supported by Rigour QA."""

    STATUS_CODE = "status_code"
    BODY_CONTAINS = "body_contains"
    BODY_SCHEMA = "body_schema"
    DB_STATE = "db_state"
    RESPONSE_TIME = "response_time"
    HEADER_CONTAINS = "header_contains"
    SEMANTIC = "semantic"
    CUSTOM = "custom"


class AuthConfig(BaseModel):
    """Authentication configuration."""

    type: str = Field(
        description="Auth type: bearer, basic, api_key, oauth"
    )
    value: Optional[str] = Field(None, description="Auth token/key value")
    username: Optional[str] = None
    password: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None

    model_config = {
        "extra": "allow"
    }


class Actor(BaseModel):
    """Represents an actor (user/client) performing actions in a scene."""

    role: str = Field(description="Actor role: admin, user, anonymous, api_client")
    auth: Optional[AuthConfig] = Field(None, description="Authentication config")
    persona: Optional[str] = Field(
        None, description="Natural language description of this actor"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "use_enum_values": False
    }


class Step(BaseModel):
    """Represents a single step in a test scenario."""

    action: str = Field(
        description="Action to perform: HTTP request, UI interaction, or delay"
    )
    input: Optional[dict[str, Any]] = Field(
        None, description="Input data for this step (query params, body, etc.)"
    )
    expect: Optional[str] = Field(
        None, description="Expected outcome or assertion for this step"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "use_enum_values": False
    }


class Assertion(BaseModel):
    """Represents an expected assertion/outcome."""

    type: AssertionType = Field(description="Type of assertion")
    target: str = Field(description="Target of assertion: response, DB, header, etc.")
    expected: Any = Field(default=None, description="Expected value or condition")
    semantic_prompt: Optional[str] = Field(
        None, description="Custom agent prompt for semantic assertions"
    )
    tolerance: Optional[float] = Field(
        None, description="Tolerance for numeric assertions (e.g., response time)"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "use_enum_values": False
    }


class Scene(BaseModel):
    """Core Scene model - a test scenario described in natural or structured language."""

    id: str = Field(default_factory=lambda: str(uuid4()), description="Unique scene ID")
    title: str = Field(description="Short title for the scene")
    description: str = Field(
        description="Natural language or structured description of the test scenario"
    )
    actor: Optional[Actor] = Field(None, description="The actor performing actions")
    steps: Optional[list[Step]] = Field(
        default_factory=list, description="Explicit test steps (optional, can be auto-generated)"
    )
    assertions: Optional[list[Assertion]] = Field(
        default_factory=list, description="Expected outcomes"
    )
    edge_cases: Optional[list[str]] = Field(
        default_factory=list, description="Hints for edge case exploration"
    )
    tags: list[str] = Field(default_factory=list, description="Tags for filtering")
    priority: Priority = Field(
        default=Priority.MEDIUM, description="Priority level"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict, description="Arbitrary extra context")

    model_config = {
        "use_enum_values": False,
        "json_schema_extra": {
            "example": {
                "title": "Login with valid credentials",
                "description": "User logs in with valid credentials and sees dashboard",
                "actor": {
                    "role": "user",
                    "persona": "Regular registered user"
                },
                "assertions": [
                    {
                        "type": "status_code",
                        "target": "response",
                        "expected": 200
                    }
                ],
                "priority": "high",
                "tags": ["auth", "critical-path"]
            }
        }
    }

    def add_step(self, action: str, input_data: Optional[dict] = None, expect: Optional[str] = None) -> "Scene":
        """Fluent API to add a step."""
        step = Step(action=action, input=input_data, expect=expect)
        self.steps.append(step)
        return self

    def add_assertion(
        self,
        assertion_type: AssertionType,
        target: str,
        expected: Any,
        semantic_prompt: Optional[str] = None,
    ) -> "Scene":
        """Fluent API to add an assertion."""
        assertion = Assertion(
            type=assertion_type,
            target=target,
            expected=expected,
            semantic_prompt=semantic_prompt,
        )
        self.assertions.append(assertion)
        return self

    def add_edge_case(self, description: str) -> "Scene":
        """Fluent API to add an edge case hint."""
        self.edge_cases.append(description)
        return self
