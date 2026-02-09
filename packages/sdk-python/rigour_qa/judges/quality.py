"""Quality judge for evaluating API response quality."""

from typing import Any, Optional

from anthropic import Anthropic

from rigour_qa.engine.types import JudgmentResult
from rigour_qa.judges.base import SemanticJudge


class QualityJudge(SemanticJudge):
    """Evaluates API response quality: schema, consistency, error messages."""

    def judge_response_quality(
        self, response: dict[str, Any], context: Optional[dict[str, Any]] = None
    ) -> JudgmentResult:
        """Evaluate overall response quality."""

        checks = [
            self._check_schema_correctness(response),
            self._check_data_consistency(response),
            self._check_error_clarity(response),
            self._check_performance(response),
        ]

        passed = all(check["passed"] for check in checks)
        score = sum(check["score"] for check in checks) / len(checks)

        reasoning = "; ".join([check["reasoning"] for check in checks])
        suggestions = []
        for check in checks:
            suggestions.extend(check.get("suggestions", []))

        return JudgmentResult(
            passed=passed,
            score=score,
            reasoning=reasoning,
            suggestions=suggestions[:5],
        )

    def _check_schema_correctness(self, response: dict[str, Any]) -> dict:
        """Check if response matches expected schema."""
        import json
        import re

        client = Anthropic(api_key=self.api_key)

        prompt = f"""Evaluate the schema correctness of this API response:

{str(response)[:1500]}

Check for:
1. Required fields present
2. Field types correct
3. No extra unexpected fields
4. Proper nesting/structure

Response: {{"passed": bool, "score": float, "reasoning": "...", "suggestions": ["..."]}}"""

        try:
            message = client.messages.create(
                model="claude-opus-4-6",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}]
            )

            response_text = message.content[0].text

            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return {"passed": False, "score": 0.0, "reasoning": "Could not parse schema check response"}
        except Exception as e:
            # Return error result instead of silently passing
            return {"passed": False, "score": 0.0, "reasoning": f"Schema check failed: {str(e)}"}

    def _check_data_consistency(self, response: dict[str, Any]) -> dict:
        """Check for data consistency issues."""
        import json
        import re

        client = Anthropic(api_key=self.api_key)

        prompt = f"""Check data consistency in this API response:

{str(response)[:1500]}

Look for:
1. IDs consistent across records
2. Dates in correct order
3. No contradictory values
4. References valid

Response: {{"passed": bool, "score": float, "reasoning": "...", "suggestions": ["..."]}}"""

        try:
            message = client.messages.create(
                model="claude-opus-4-6",
                max_tokens=400,
                messages=[{"role": "user", "content": prompt}]
            )

            response_text = message.content[0].text

            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            return {"passed": False, "score": 0.0, "reasoning": "Could not parse consistency check response"}
        except Exception as e:
            # Return error result instead of silently passing
            return {"passed": False, "score": 0.0, "reasoning": f"Consistency check failed: {str(e)}"}

    def _check_error_clarity(self, response: dict[str, Any]) -> dict:
        """Check if error messages are clear and helpful."""
        import json
        import re

        if response.get("status", 200) >= 400:
            client = Anthropic(api_key=self.api_key)
            error_msg = response.get("body", {}).get("error", "") if isinstance(response.get("body"), dict) else ""

            prompt = f"""Evaluate the clarity of this error message:

{error_msg}

Is it:
1. Clear and specific?
2. Actionable?
3. Not generic?
4. Helpful to fix the issue?

Response: {{"passed": bool, "score": float, "reasoning": "...", "suggestions": ["..."]}}"""

            try:
                message = client.messages.create(
                    model="claude-opus-4-6",
                    max_tokens=300,
                    messages=[{"role": "user", "content": prompt}]
                )

                response_text = message.content[0].text

                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group())
                return {"passed": False, "score": 0.0, "reasoning": "Could not parse error clarity check response"}
            except Exception as e:
                # Return error result instead of silently passing
                return {"passed": False, "score": 0.0, "reasoning": f"Error clarity check failed: {str(e)}"}

        return {"passed": True, "score": 1.0, "reasoning": "No errors"}

    def _check_performance(self, response: dict[str, Any]) -> dict:
        """Check performance metrics."""
        duration = response.get("duration", 0)
        size = len(str(response))

        passed = duration < 5.0
        score = 1.0 if passed else max(0.5, 1.0 - (duration / 10.0))

        reasoning = f"Response time: {duration:.2f}s, Size: {size} bytes"
        suggestions = []
        if duration > 2.0:
            suggestions.append("Consider adding caching or optimization")
        if size > 100000:
            suggestions.append("Consider pagination for large responses")

        return {
            "passed": passed,
            "score": score,
            "reasoning": reasoning,
            "suggestions": suggestions,
        }
