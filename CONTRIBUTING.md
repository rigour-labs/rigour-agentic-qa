# Contributing to Rigour QA

We're excited you're interested in contributing to Rigour QA!

This document provides guidelines and instructions for contributing to our agent quality assurance framework. Whether you're fixing bugs, adding features, or improving documentation, your contributions help make Rigour QA better for everyone.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before participating.

## How to Contribute

### Reporting Issues

If you've found a bug or have a feature request:

1. Check existing [issues](https://github.com/rigour-labs/rigour-qa/issues) to avoid duplicates
2. Open a new issue with a clear title and description
3. Include relevant details: environment, steps to reproduce, expected vs. actual behavior
4. Use our issue templates when available

### Submitting Pull Requests

We welcome pull requests! Here's the process:

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your changes: `git checkout -b fix/issue-name` or `git checkout -b feat/feature-name`
4. **Make your changes** and commit with clear, conventional commit messages
5. **Push** to your fork
6. **Open a PR** with a clear description of your changes

## Development Setup

Get started developing locally in just a few steps:

```bash
git clone https://github.com/rigour-labs/rigour-qa.git
cd rigour-qa
pip install -e "packages/sdk-python[dev]"
```

This installs the Python SDK in editable mode with development dependencies, allowing you to test changes in real-time.

## Code Style

We maintain consistent code quality across the project using automated tools:

### Python

- **Code formatter**: [black](https://github.com/psf/black) — enforces consistent formatting
- **Linter**: [ruff](https://github.com/astral-sh/ruff) — catches style issues and potential bugs

Run before committing:

```bash
black packages/sdk-python/
ruff check --fix packages/sdk-python/
```

### Node.js

- **Code formatter**: [prettier](https://prettier.io/) — enforces consistent formatting

Run before committing:

```bash
prettier --write packages/sdk-node/
```

## Testing

All contributions should include appropriate tests. Run the test suite to ensure your changes don't break existing functionality:

```bash
pytest packages/sdk-python/tests/
```

For Node.js, use your configured test runner:

```bash
npm test --workspace packages/sdk-node
```

Aim for good test coverage on new or modified code.

## Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) for clear, semantic commit messages:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature for an agent or framework
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc.)
- **refactor**: Code refactoring without feature or bug changes
- **test**: Adding or updating tests
- **chore**: Build, CI, or dependency updates

### Examples

```
feat(sdk-python): add supervised execution mode for agentic workflows
fix(core): resolve race condition in agent checkpoint serialization
docs: update CONTRIBUTING guide with testing requirements
```

## Pull Request Process

1. **Update documentation** — keep README and relevant docs in sync with your changes
2. **Add tests** — include tests for new features or bug fixes
3. **Check code style** — run formatters and linters before pushing
4. **Write a clear PR description** — explain what you changed and why
5. **Reference related issues** — use "Fixes #123" to link related issues
6. **Be responsive** — address review feedback promptly

## Architecture & Agentic Patterns

Rigour QA is designed to support agent quality assurance and governance. When contributing:

- Use "agent" terminology rather than "LLM" to reflect our agentic framework
- Keep agentic patterns in mind: agent registration, task scopes, handoffs, checkpoints
- Document how your changes support agentic workflows
- Consider governance and quality gate implications

## License

By contributing to Rigour QA, you agree that your contributions will be licensed under the [MIT License](LICENSE).

## Questions?

Have questions about contributing? Open an issue or reach out to the Rigour Labs team. We're here to help!

Thank you for making Rigour QA better.
