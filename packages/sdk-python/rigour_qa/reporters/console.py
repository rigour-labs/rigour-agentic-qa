"""Console reporter for execution results using Rich."""

from typing import Optional

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from rigour_qa.engine.types import ExecutionResult, ExecutionStatus


class ConsoleReporter:
    """Pretty-prints test execution results to console."""

    def __init__(self, console: Optional[Console] = None):
        """Initialize reporter."""
        self.console = console or Console()

    def report_execution(self, result: ExecutionResult) -> None:
        """Report a single execution result."""

        status_text = self._status_text(result.status)
        title = f"Test Execution: {status_text}"

        info_table = Table(show_header=False, box=None)
        info_table.add_row("Plan ID", result.plan_id)
        info_table.add_row("Status", self._status_badge(result.status))
        info_table.add_row("Duration", f"{result.duration:.2f}s")
        info_table.add_row("Assertions", f"✓ {result.assertions_passed} | ✗ {result.assertions_failed}")

        if result.error_message:
            info_table.add_row("Error", result.error_message)

        panel = Panel(info_table, title=title, expand=False)
        self.console.print(panel)

        if result.stdout:
            self.console.print("\n[bold cyan]Output:[/bold cyan]")
            self.console.print(result.stdout[:500])

        if result.stderr:
            self.console.print("\n[bold red]Errors:[/bold red]")
            self.console.print(result.stderr[:500])

    def report_batch(self, results: list[ExecutionResult]) -> None:
        """Report multiple execution results as a table."""

        table = Table(title="Execution Results", show_lines=False)
        table.add_column("Plan ID", style="cyan")
        table.add_column("Status", style="magenta")
        table.add_column("Duration", justify="right")
        table.add_column("Pass/Fail", justify="right")

        total_passed = 0
        total_duration = 0.0

        for result in results:
            status_badge = self._status_badge(result.status)
            duration_str = f"{result.duration:.2f}s"
            assertions_str = f"{result.assertions_passed}/{result.assertions_passed + result.assertions_failed}"

            table.add_row(
                result.plan_id[:8],
                status_badge,
                duration_str,
                assertions_str,
            )

            if result.passed:
                total_passed += 1
            total_duration += result.duration

        self.console.print(table)

        summary = (
            f"\nTotal: {len(results)} | "
            f"Passed: {total_passed} | "
            f"Failed: {len(results) - total_passed} | "
            f"Duration: {total_duration:.2f}s"
        )
        self.console.print(Text(summary, style="bold"))

    def report_edge_cases(
        self,
        original_result: ExecutionResult,
        edge_case_results: list[ExecutionResult],
    ) -> None:
        """Report edge case exploration results."""

        self.console.print("\n[bold green]Edge Case Exploration[/bold green]")

        edge_table = Table(title="Edge Cases Found", show_header=True)
        edge_table.add_column("Edge Case", style="cyan")
        edge_table.add_column("Result", style="magenta")
        edge_table.add_column("Issues", style="red")

        for result in edge_case_results:
            result_text = "✓ PASS" if result.passed else "✗ FAIL"
            issues = str(result.assertions_failed) if result.assertions_failed > 0 else "None"

            edge_table.add_row(
                result.plan_id[:16],
                result_text,
                issues,
            )

        self.console.print(edge_table)

        edge_passed = sum(1 for r in edge_case_results if r.passed)
        self.console.print(
            f"\nEdge Cases: {edge_passed}/{len(edge_case_results)} passed"
        )

    def report_healing(self, original_result: ExecutionResult, healed_result: ExecutionResult) -> None:
        """Report healing attempt."""

        self.console.print("\n[bold yellow]Self-Healing Report[/bold yellow]")

        heal_table = Table(show_header=False, box=None)
        heal_table.add_row("Original Result", self._status_badge(original_result.status))
        heal_table.add_row("Healed Result", self._status_badge(healed_result.status))
        heal_table.add_row("Duration", f"{healed_result.duration:.2f}s")

        if healed_result.passed and not original_result.passed:
            heal_table.add_row("Status", "[bold green]✓ Fixed[/bold green]")
        elif healed_result.passed:
            heal_table.add_row("Status", "[bold cyan]~ Still passing[/bold cyan]")
        else:
            heal_table.add_row("Status", "[bold red]✗ Still failing[/bold red]")

        panel = Panel(heal_table, title="Healing Attempt", expand=False)
        self.console.print(panel)

    def _status_badge(self, status: ExecutionStatus) -> str:
        """Generate status badge."""
        if status == ExecutionStatus.PASSED:
            return "[bold green]✓ PASSED[/bold green]"
        elif status == ExecutionStatus.FAILED:
            return "[bold red]✗ FAILED[/bold red]"
        elif status == ExecutionStatus.ERROR:
            return "[bold red]✗ ERROR[/bold red]"
        else:
            return "[dim]~ SKIPPED[/dim]"

    def _status_text(self, status: ExecutionStatus) -> str:
        """Generate status text."""
        status_map = {
            ExecutionStatus.PASSED: "Passed",
            ExecutionStatus.FAILED: "Failed",
            ExecutionStatus.ERROR: "Error",
            ExecutionStatus.SKIPPED: "Skipped",
        }
        return status_map.get(status, "Unknown")
