"""Self-healing agent for diagnosing and fixing test failures."""

from typing import Optional

from anthropic import Anthropic

from rigour_qa.engine.types import Diagnosis, ExecutionResult


class SelfHealer:
    """Diagnoses test failures and generates healing suggestions."""

    def __init__(self, api_key: Optional[str] = None):
        """Initialize healer with Anthropic client."""
        self.client = Anthropic(api_key=api_key)
        self.failure_history: dict[str, list[ExecutionResult]] = {}

    def diagnose(self, failure: ExecutionResult) -> Diagnosis:
        """Analyze a test failure and provide diagnosis."""

        prompt = f"""Analyze this test failure and provide a root cause diagnosis:

Test ID: {failure.plan_id}
Status: {failure.status}
Error: {failure.error_message}
Stderr: {failure.stderr[:500]}

Determine:
1. Root cause (what went wrong)
2. Failure type (assertion, timeout, network, syntax, other)
3. Is it likely flaky? (intermittent/timing-dependent)
4. Suggested fixes

Return JSON: {{
    "root_cause": "...",
    "failure_type": "...",
    "is_flaky": bool,
    "suggested_fixes": ["fix1", "fix2", "fix3"]
}}"""

        message = self.client.messages.create(
            model="claude-opus-4-6",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text

        try:
            import json
            import re
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                diagnosis_dict = json.loads(json_match.group())
            else:
                diagnosis_dict = json.loads(response_text)
        except json.JSONDecodeError:
            diagnosis_dict = {
                "root_cause": "Unknown",
                "failure_type": "error",
                "is_flaky": False,
                "suggested_fixes": ["Review test code and error message"],
            }

        return Diagnosis(
            test_id=failure.plan_id,
            root_cause=diagnosis_dict.get("root_cause", "Unknown"),
            failure_type=diagnosis_dict.get("failure_type", "error"),
            is_flaky=diagnosis_dict.get("is_flaky", False),
            suggested_fixes=diagnosis_dict.get("suggested_fixes", []),
        )

    def heal(self, diagnosis: Diagnosis, test_code: str) -> str:
        """Generate healed test code based on diagnosis."""

        prompt = f"""Fix this test code based on the diagnosis:

Root Cause: {diagnosis.root_cause}
Failure Type: {diagnosis.failure_type}
Is Flaky: {diagnosis.is_flaky}
Suggested Fixes: {', '.join(diagnosis.suggested_fixes)}

Original Test Code:
```python
{test_code}
```

Generate corrected test code that:
1. Addresses the identified root cause
2. Adds error handling if needed
3. Adds retries if test is flaky
4. Improves assertions
5. Is production-quality

Return ONLY the corrected Python code (no markdown, no explanation)."""

        message = self.client.messages.create(
            model="claude-opus-4-6",
            max_tokens=3000,
            messages=[{"role": "user", "content": prompt}]
        )

        response_text = message.content[0].text
        healed_code = response_text.strip()

        if healed_code.startswith("```"):
            import re
            code_match = re.search(r'```python\n(.*?)\n```', healed_code, re.DOTALL)
            if code_match:
                healed_code = code_match.group(1)

        return healed_code

    def is_flaky(self, test_id: str, history: list[ExecutionResult]) -> bool:
        """Determine if a test is flaky based on execution history."""

        if test_id not in self.failure_history:
            self.failure_history[test_id] = []

        self.failure_history[test_id].extend(history)
        recent = self.failure_history[test_id][-10:]

        if len(recent) < 3:
            return False

        passed_count = sum(1 for r in recent if r.passed)
        failed_count = len(recent) - passed_count

        if failed_count == 0 or passed_count == 0:
            return False

        pass_rate = passed_count / len(recent)
        flaky = 0.3 <= pass_rate <= 0.7

        if flaky and failed_count >= 2:
            return True

        return False

    def generate_healing_plan(
        self,
        failures: list[ExecutionResult],
        test_codes: dict[str, str],
    ) -> dict[str, str]:
        """Generate healing code for multiple failures."""

        healed = {}

        for failure in failures:
            if failure.plan_id not in test_codes:
                continue

            diagnosis = self.diagnose(failure)
            original_code = test_codes[failure.plan_id]
            healed_code = self.heal(diagnosis, original_code)
            healed[failure.plan_id] = healed_code

        return healed
