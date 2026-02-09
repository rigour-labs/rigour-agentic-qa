"""Rigour QA - Agentic QA SDK for autonomous test generation and execution."""

__version__ = "0.1.0"

from rigour_qa.scene.schema import (
    Actor,
    Assertion,
    AssertionType,
    Priority,
    Scene,
    Step,
)
from rigour_qa.scene.builder import SceneBuilder
from rigour_qa.connection import Connection
from rigour_qa.engine.executor import AgenticExecutor
from rigour_qa.runner import RigourQA

__all__ = [
    "Scene",
    "SceneBuilder",
    "Actor",
    "Step",
    "Assertion",
    "AssertionType",
    "Priority",
    "Connection",
    "AgenticExecutor",
    "RigourQA",
    "__version__",
]
