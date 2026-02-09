"""Typer CLI for Rigour QA."""

import json
from pathlib import Path
from typing import Optional

import typer
import yaml
from rich.console import Console

from rigour_qa import __version__
from rigour_qa.connection import Connection
from rigour_qa.runner import RigourQA, RigourQAConfig
from rigour_qa.scene.parser import SceneParser
from rigour_qa.scene.schema import Scene, Priority
from rigour_qa.scene.builder import SceneBuilder

app = typer.Typer(help="Rigour QA - Agentic test generation and execution")
console = Console()


def load_connection_config(connection_file: str) -> Connection:
    """Load connection config from YAML, handling both flat and multi-environment formats."""
    import os

    connection_path = Path(connection_file)
    if not connection_path.exists():
        console.print(f"[red]Error: {connection_file} not found[/red]")
        raise typer.Exit(1)

    with open(connection_path) as f:
        conn_data = yaml.safe_load(f)

    # Handle both flat format and multi-environment format
    # If conn_data has 'connections' key, extract the first/default connection
    if isinstance(conn_data, dict) and "connections" in conn_data:
        # Multi-environment format: extract first available connection
        env_key = list(conn_data["connections"].keys())[0] if conn_data["connections"] else None
        if env_key:
            conn_data = conn_data["connections"][env_key]
        else:
            console.print("[red]Error: No connections found in multi-environment format[/red]")
            raise typer.Exit(1)

    # Handle token_env references (environment variable references)
    if isinstance(conn_data, dict) and "auth_token" in conn_data:
        if isinstance(conn_data["auth_token"], str) and conn_data["auth_token"].startswith("$"):
            env_var = conn_data["auth_token"][1:]
            conn_data["auth_token"] = os.getenv(env_var)
            if not conn_data["auth_token"]:
                console.print(f"[yellow]Warning: Environment variable {env_var} not found[/yellow]")

    return Connection(**conn_data)


@app.command()
def version() -> None:
    """Show version."""
    console.print(f"Rigour QA {__version__}")


@app.command()
def run(
    scenes_file: str = typer.Argument("scenes.yaml", help="Scene definitions file"),
    connection_file: str = typer.Option(
        "connection.yaml", help="Connection config file"
    ),
    enable_exploration: bool = typer.Option(
        True, help="Enable edge case exploration"
    ),
    enable_healing: bool = typer.Option(True, help="Enable self-healing"),
) -> None:
    """Run test scenes against a target system."""

    console.print(f"[bold cyan]Rigour QA - Test Runner v{__version__}[/bold cyan]")

    scenes_path = Path(scenes_file)
    if not scenes_path.exists():
        console.print(f"[red]Error: {scenes_file} not found[/red]")
        raise typer.Exit(1)

    connection = load_connection_config(connection_file)

    parser = SceneParser()
    try:
        scenes = parser.parse_yaml(str(scenes_path))
        console.print(f"[green]✓ Loaded {len(scenes)} scenes[/green]")
    except Exception as e:
        console.print(f"[red]Error parsing scenes: {e}[/red]")
        raise typer.Exit(1)

    config = RigourQAConfig(
        enable_edge_case_exploration=enable_exploration,
        enable_healing=enable_healing,
    )

    qa = RigourQA(connection, config)
    result = qa.run(scenes)

    summary = qa.get_summary(result)
    console.print("\n[bold yellow]Test Summary[/bold yellow]")
    console.print(json.dumps(summary, indent=2))

    if result.failed > 0:
        raise typer.Exit(1)


@app.command()
def init(
    output_dir: str = typer.Option(".", help="Output directory"),
) -> None:
    """Initialize example scene and connection files."""

    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)

    scene = (
        SceneBuilder("Login Test", "User logs in with valid credentials")
        .with_actor("user", auth_type="basic")
        .with_priority(Priority.HIGH)
        .with_tags("auth", "critical-path")
        .with_step("POST /login", {"username": "test@example.com", "password": "password"})
        .with_assertion("status_code", "response", 200)
        .with_assertion("body_contains", "response", "access_token")
        .with_edge_case("Login with empty password")
        .with_edge_case("Login with invalid username")
        .build()
    )

    scenes_file = output_path / "scenes.yaml"
    with open(scenes_file, 'w') as f:
        yaml.dump([scene.model_dump(exclude_none=True)], f, default_flow_style=False)
    console.print(f"[green]✓ Created {scenes_file}[/green]")

    connection = Connection(
        base_url="http://localhost:8000",
        auth_type="bearer",
        timeout=30,
    )

    connection_file = output_path / "connection.yaml"
    with open(connection_file, 'w') as f:
        yaml.dump(connection.model_dump(exclude_none=True), f, default_flow_style=False)
    console.print(f"[green]✓ Created {connection_file}[/green]")

    console.print("\n[bold cyan]Next steps:[/bold cyan]")
    console.print(f"1. Edit {scenes_file} to define your test scenes")
    console.print(f"2. Edit {connection_file} with your target system URL")
    console.print(f"3. Run: rigour-qa run {scenes_file} --connection {connection_file}")


@app.command()
def explore(
    scene_file: str = typer.Argument("scene.yaml", help="Single scene file"),
    connection_file: str = typer.Option(
        "connection.yaml", help="Connection config file"
    ),
) -> None:
    """Run edge case exploration on a single scene."""

    scene_path = Path(scene_file)
    if not scene_path.exists():
        console.print(f"[red]Error: {scene_file} not found[/red]")
        raise typer.Exit(1)

    connection = load_connection_config(connection_file)

    parser = SceneParser()
    scenes = parser.parse_yaml(str(scene_path))

    if not scenes:
        console.print("[red]No scenes found[/red]")
        raise typer.Exit(1)

    scene = scenes[0]
    console.print(f"[bold cyan]Exploring edge cases for: {scene.title}[/bold cyan]")

    from rigour_qa.engine.explorer import EdgeExplorer
    from rigour_qa.engine.planner import AgenticPlanner
    from rigour_qa.engine.executor import AgenticExecutor

    planner = AgenticPlanner()
    executor = AgenticExecutor()
    explorer = EdgeExplorer()

    plan = planner.plan(scene, connection)
    result = executor.execute(plan)

    if result.passed:
        edge_cases = explorer.explore(scene, result, connection)
        console.print(f"[green]✓ Generated {len(edge_cases)} edge cases[/green]")

        for i, ec in enumerate(edge_cases, 1):
            console.print(f"\n[bold]{i}. {ec.title}[/bold]")
            console.print(ec.description[:200])
    else:
        console.print("[red]✗ Initial test failed, skipping edge case exploration[/red]")


@app.command()
def report(
    last: bool = typer.Option(False, help="Show last execution report"),
) -> None:
    """Show test execution reports."""

    if last:
        report_file = Path(".rigour_last_report.json")
        if not report_file.exists():
            console.print("[yellow]No recent report found[/yellow]")
            raise typer.Exit(1)

        with open(report_file) as f:
            report_data = json.load(f)
        console.print("[bold cyan]Last Execution Report[/bold cyan]")
        console.print(json.dumps(report_data, indent=2))
    else:
        console.print("[yellow]No report specified. Use --last flag.[/yellow]")


if __name__ == "__main__":
    app()
