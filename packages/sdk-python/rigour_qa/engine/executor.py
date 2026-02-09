"""Test executor for running generated test code."""

import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Optional

from rigour_qa.engine.types import ExecutionResult, ExecutionStatus, TestPlan


class AgenticExecutor:
    """Executes generated test code in a sandboxed subprocess."""

    def __init__(self, timeout: int = 60):
        """Initialize executor."""
        self.timeout = timeout

    def execute(self, plan: TestPlan, parallel: bool = False) -> ExecutionResult:
        """Execute a test plan and return results."""
        start_time = time.time()
        result = ExecutionResult(
            plan_id=plan.id,
            status=ExecutionStatus.PASSED,
            passed=True,
        )

        try:
            with tempfile.NamedTemporaryFile(
                mode='w',
                suffix='.py',
                delete=False,
                dir=tempfile.gettempdir()
            ) as f:
                f.write(plan.test_code)
                f.flush()
                test_file = f.name

            cmd = [sys.executable, '-m', 'pytest', test_file, '-v', '--tb=short']

            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=self.timeout,
            )

            result.stdout = proc.stdout
            result.stderr = proc.stderr
            result.passed = proc.returncode == 0
            result.status = (
                ExecutionStatus.PASSED if proc.returncode == 0
                else ExecutionStatus.FAILED
            )

            self._parse_pytest_output(result, proc.stdout)

            Path(test_file).unlink(missing_ok=True)

        except subprocess.TimeoutExpired:
            result.status = ExecutionStatus.ERROR
            result.passed = False
            result.error_message = f"Test timed out after {self.timeout} seconds"
        except Exception as e:
            result.status = ExecutionStatus.ERROR
            result.passed = False
            result.error_message = str(e)

        result.duration = time.time() - start_time
        return result

    def execute_batch(
        self, plans: list[TestPlan], parallel: bool = True
    ) -> list[ExecutionResult]:
        """Execute multiple test plans."""
        if parallel:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                results = list(executor.map(self.execute, plans))
            return results
        else:
            return [self.execute(plan) for plan in plans]

    def _parse_pytest_output(self, result: ExecutionResult, output: str) -> None:
        """Parse pytest output to extract assertion counts."""
        import re

        passed_match = re.search(r'(\d+) passed', output)
        failed_match = re.search(r'(\d+) failed', output)
        error_match = re.search(r'(\d+) error', output)

        if passed_match:
            result.assertions_passed = int(passed_match.group(1))
        if failed_match:
            result.assertions_failed = int(failed_match.group(1))

        if error_match or 'error' in output.lower():
            result.status = ExecutionStatus.ERROR
            result.passed = False

        lines = output.split('\n')
        for line in lines:
            if 'FAILED' in line or 'ERROR' in line:
                result.error_message = line.strip()
                break
