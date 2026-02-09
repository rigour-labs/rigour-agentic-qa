"""Type definitions for the engine module."""

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


class ExecutionStatus(str, Enum):
    """Status of a test execution."""

    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"
    SKIPPED = "skipped"


class TestPlan(BaseModel):
    """A generated test plan ready for execution."""

    id: str = Field(description="Unique plan ID")
    scene_id: str = Field(description="Source scene ID")
    title: str = Field(description="Plan title")
    description: str = Field(description="Plan description")
    test_code: str = Field(description="Generated Python test code")
    steps_count: int = Field(description="Number of test steps")
    estimated_duration: float = Field(
        default=5.0, description="Estimated execution time in seconds"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "use_enum_values": False
    }


class ExecutionResult(BaseModel):
    """Result of executing a test."""

    plan_id: str = Field(description="Source plan ID")
    status: ExecutionStatus = Field(description="Execution status")
    passed: bool = Field(description="Whether test passed")
    duration: float = Field(default=0.0, description="Execution time in seconds")
    stdout: str = Field(default="", description="Standard output")
    stderr: str = Field(default="", description="Standard error")
    assertions_passed: int = Field(default=0, description="Count of passed assertions")
    assertions_failed: int = Field(default=0, description="Count of failed assertions")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    response_data: Optional[dict[str, Any]] = Field(None, description="Last response data")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "use_enum_values": False
    }


class JudgmentResult(BaseModel):
    """Result of a semantic judgment."""

    passed: bool = Field(description="Whether assertion passed")
    score: float = Field(description="Score from 0 to 1")
    reasoning: str = Field(description="Explanation of judgment")
    suggestions: list[str] = Field(default_factory=list, description="Suggestions for improvement")

    model_config = {
        "use_enum_values": False
    }


class Diagnosis(BaseModel):
    """Diagnosis of a test failure."""

    test_id: str = Field(description="Test ID")
    root_cause: str = Field(description="Identified root cause")
    failure_type: str = Field(
        description="Type of failure: assertion, timeout, network, etc."
    )
    is_flaky: bool = Field(
        default=False, description="Whether test is likely flaky"
    )
    suggested_fixes: list[str] = Field(description="Suggested fixes")
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "use_enum_values": False
    }


class EdgeCaseResult(BaseModel):
    """Result of exploring an edge case."""

    scene_id: str = Field(description="Original scene ID")
    edge_case_count: int = Field(description="Number of edge cases generated")
    generated_scenes: list[str] = Field(description="IDs of generated edge case scenes")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = {
        "use_enum_values": False
    }
