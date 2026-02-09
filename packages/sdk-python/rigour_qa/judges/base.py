"""Base judge for semantic assertion evaluation using Claude agent."""

from typing import Any, Optional

from anthropic import Anthropic
from pydantic import BaseModel

from rigour_qa.engine.types import JudgmentResult
from rigour_qa.scene.schema import Assertion


class SemanticJudge(BaseModel):
    """Evaluates assertions using Claude for semantic understanding."""

    api_key: Optional[str] = None

    model_config = {
        "arbitrary_types_allowed": True
    }

    def judge(
        self,
        assertion: Assertion,
        actual_response: Any,
        context: Optional[dict[str, Any]] = None,
    ) -> JudgmentResult:
        """Judge whether an assertion passes based on actual response."""

        if assertion.type.value == "status_code":
            return self._judge_status_code(assertion, actual_response)
        elif assertion.type.value == "body_contains":
            return self._judge_body_contains(assertion, actual_response)
        elif assertion.type.value == "response_time":
            return self._judge_response_time(assertion, actual_response)
        elif assertion.type.value == "semantic":
            return self._judge_semantic(assertion, actual_response, context or {})
        else:
            return self._judge_semantic(assertion, actual_response, context or {})

    def _judge_status_code(
        self, assertion: Assertion, actual_response: Any
    ) -> JudgmentResult:
        """Judge HTTP status code assertion."""
        actual = actual_response.get("status_code") if isinstance(actual_response, dict) else actual_response

        passed = actual == assertion.expected
        score = 1.0 if passed else 0.0

        return JudgmentResult(
            passed=passed,
            score=score,
            reasoning=f"Status code: expected {assertion.expected}, got {actual}",
        )

    def _judge_body_contains(
        self, assertion: Assertion, actual_response: Any
    ) -> JudgmentResult:
        """Judge response body contains assertion."""
        body = (
            actual_response.get("body", "")
            if isinstance(actual_response, dict)
            else str(actual_response)
        )
        body_str = str(body)

        expected_str = str(assertion.expected)
        passed = expected_str in body_str

        score = 1.0 if passed else 0.0

        return JudgmentResult(
            passed=passed,
            score=score,
            reasoning=f"Body contains check: looking for '{expected_str}'",
        )

    def _judge_response_time(
        self, assertion: Assertion, actual_response: Any
    ) -> JudgmentResult:
        """Judge response time assertion."""
        duration = (
            actual_response.get("duration")
            if isinstance(actual_response, dict)
            else actual_response
        )

        expected = float(assertion.expected)
        tolerance = assertion.tolerance or 0.1

        passed = duration <= expected * (1 + tolerance)
        score = 1.0 if passed else max(0.0, 1.0 - (duration / (expected * 2)))

        return JudgmentResult(
            passed=passed,
            score=score,
            reasoning=f"Response time: {duration:.2f}s (expected <= {expected:.2f}s)",
        )

    def _judge_semantic(
        self,
        assertion: Assertion,
        actual_response: Any,
        context: dict[str, Any],
    ) -> JudgmentResult:
        """Use Claude to judge semantic assertions."""
        import json
        import re

        client = Anthropic(api_key=self.api_key)

        actual_str = (
            str(actual_response) if not isinstance(actual_response, str)
            else actual_response
        )

        prompt = f"""Evaluate whether this assertion passes:

Assertion Type: {assertion.type}
Target: {assertion.target}
Expected: {assertion.expected}
Semantic Prompt: {assertion.semantic_prompt or 'N/A'}

Actual Response:
{actual_str[:2000]}

Additional Context:
{json.dumps(context, indent=2)[:1000]}

Determine if the assertion PASSES based on the expected and actual values.
Respond with JSON: {{"passed": true/false, "score": 0.0-1.0, "reasoning": "...", "suggestions": ["...", "..."]}}
"""

        try:
            message = client.messages.create(
                model="claude-opus-4-6",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )

            response_text = message.content[0].text

            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                judgment_dict = json.loads(json_match.group())
            else:
                judgment_dict = json.loads(response_text)

            return JudgmentResult(
                passed=judgment_dict.get("passed", False),
                score=float(judgment_dict.get("score", 0.0)),
                reasoning=judgment_dict.get("reasoning", "No reasoning provided"),
                suggestions=judgment_dict.get("suggestions", []),
            )
        except Exception as e:
            # Propagate error instead of silently passing
            raise RuntimeError(f"Failed to judge semantically: {str(e)}") from e
