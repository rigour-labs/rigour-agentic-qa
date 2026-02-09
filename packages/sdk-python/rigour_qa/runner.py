"""Main RigourQA orchestrator - the public API."""

from dataclasses import dataclass, field
from typing import Optional

from rigour_qa.agents.healer import SelfHealer
from rigour_qa.connection import Connection
from rigour_qa.engine.executor import AgenticExecutor
from rigour_qa.engine.explorer import EdgeExplorer
from rigour_qa.engine.planner import AgenticPlanner
from rigour_qa.engine.types import ExecutionResult
from rigour_qa.judges.quality import QualityJudge
from rigour_qa.reporters.console import ConsoleReporter
from rigour_qa.scene.schema import Scene


@dataclass
class RigourQAConfig:
    """Configuration for RigourQA runner."""

    enable_edge_case_exploration: bool = True
    enable_healing: bool = True
    enable_quality_judgment: bool = True
    enable_console_reporting: bool = True
    max_edge_cases_per_scene: int = 8
    executor_timeout: int = 60
    anthropic_api_key: Optional[str] = None


@dataclass
class SceneResult:
    """Result of running a single scene."""

    scene_id: str
    scene_title: str
    passed: bool
    execution_result: ExecutionResult
    edge_case_results: list[ExecutionResult] = field(default_factory=list)
    healing_result: Optional[ExecutionResult] = None
    edge_cases_count: int = 0


@dataclass
class RunResult:
    """Final result of running a batch of scenes."""

    total_scenes: int
    passed: int
    failed: int
    edge_cases_found: int
    scene_results: list[SceneResult] = field(default_factory=list)
    total_duration: float = 0.0


class RigourQA:
    """Main orchestrator for the agentic QA pipeline."""

    def __init__(
        self,
        connection: Connection,
        config: Optional[RigourQAConfig] = None,
    ):
        """Initialize RigourQA."""
        self.connection = connection
        self.config = config or RigourQAConfig()

        self.planner = AgenticPlanner(api_key=self.config.anthropic_api_key)
        self.executor = AgenticExecutor(timeout=self.config.executor_timeout)
        self.explorer = EdgeExplorer(api_key=self.config.anthropic_api_key)
        self.healer = SelfHealer(api_key=self.config.anthropic_api_key)
        self.judge = QualityJudge(api_key=self.config.anthropic_api_key)
        self.reporter = (
            ConsoleReporter() if self.config.enable_console_reporting else None
        )

        self.test_codes: dict[str, str] = {}

    def run(self, scenes: list[Scene]) -> RunResult:
        """Run the full agentic pipeline on a list of scenes."""
        import time
        start_time = time.time()

        result = RunResult(
            total_scenes=len(scenes),
            passed=0,
            failed=0,
            edge_cases_found=0,
        )

        for scene in scenes:
            scene_result = self.run_scene(scene)
            result.scene_results.append(scene_result)

            if scene_result.passed:
                result.passed += 1
            else:
                result.failed += 1

            result.edge_cases_found += scene_result.edge_cases_count

        result.total_duration = time.time() - start_time
        return result

    def run_scene(self, scene: Scene) -> SceneResult:
        """Run the full pipeline on a single scene."""

        # Initialize with a placeholder that will be overwritten
        from rigour_qa.engine.types import ExecutionResult, ExecutionStatus
        placeholder_result = ExecutionResult(
            plan_id="",
            status=ExecutionStatus.ERROR,
            passed=False,
            duration=0.0,
        )

        scene_result = SceneResult(
            scene_id=scene.id,
            scene_title=scene.title,
            passed=False,
            execution_result=placeholder_result,
        )

        plan = self.planner.plan(scene, self.connection)
        self.test_codes[plan.id] = plan.test_code

        result = self.executor.execute(plan)
        scene_result.execution_result = result
        scene_result.passed = result.passed

        if self.reporter:
            self.reporter.report_execution(result)

        if self.config.enable_edge_case_exploration and result.passed:
            edge_cases = self.explorer.explore(scene, result, self.connection)
            scene_result.edge_cases_count = len(edge_cases)

            edge_plans = [self.planner.plan(ec, self.connection) for ec in edge_cases]
            edge_results = self.executor.execute_batch(edge_plans, parallel=True)

            scene_result.edge_case_results = edge_results

            if self.reporter:
                self.reporter.report_edge_cases(result, edge_results)

        if self.config.enable_healing and not result.passed:
            diagnosis = self.healer.diagnose(result)
            healed_code = self.healer.heal(diagnosis, self.test_codes[plan.id])

            from rigour_qa.engine.types import TestPlan
            healed_plan = TestPlan(
                id=plan.id + "_healed",
                scene_id=plan.scene_id,
                title=plan.title,
                description=plan.description,
                test_code=healed_code,
                steps_count=plan.steps_count,
            )

            healed_result = self.executor.execute(healed_plan)
            scene_result.healing_result = healed_result

            if healed_result.passed:
                scene_result.passed = True

            if self.reporter:
                self.reporter.report_healing(result, healed_result)

        if self.config.enable_quality_judgment:
            # Only judge quality if we have actual response data from the test
            if result.response_data:
                quality = self.judge.judge_response_quality(result.response_data)
                scene_result.execution_result.metadata["quality_score"] = quality.score
            else:
                # If no response data available, skip quality judgment
                scene_result.execution_result.metadata["quality_score"] = None

        return scene_result

    def get_summary(self, run_result: RunResult) -> dict:
        """Get a summary of the run results."""
        return {
            "total_scenes": run_result.total_scenes,
            "passed": run_result.passed,
            "failed": run_result.failed,
            "pass_rate": (
                run_result.passed / run_result.total_scenes * 100
                if run_result.total_scenes > 0 else 0
            ),
            "edge_cases_found": run_result.edge_cases_found,
            "total_duration": run_result.total_duration,
        }
