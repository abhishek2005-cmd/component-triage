#!/usr/bin/env python3
"""Evaluate expected catalog matches against the analysis service's top three."""

import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


EVALUATION_FILE = Path(__file__).with_name("requests.json")
ANALYSIS_URL = os.getenv("ANALYSIS_URL", "http://localhost:8000").rstrip("/")
REQUEST_TIMEOUT_SECONDS = float(os.getenv("EVALUATION_TIMEOUT_SECONDS", "60"))


def evaluate():
    cases = json.loads(EVALUATION_FILE.read_text(encoding="utf-8"))
    if not cases:
        raise ValueError("Evaluation fixture has no requests")

    correct = 0
    for index, case in enumerate(cases, start=1):
        request = Request(
            f"{ANALYSIS_URL}/analyze",
            data=json.dumps({"request_text": case["request"]}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
                result = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            raise RuntimeError(f"Request {index} returned HTTP {error.code}") from error
        except URLError as error:
            raise RuntimeError(f"Cannot reach analysis service at {ANALYSIS_URL}: {error.reason}") from error

        matches = result.get("matches")
        if not isinstance(matches, list):
            raise ValueError(f"Request {index} response has no matches list")

        expected = case["expectedPartNumber"]
        returned = [
            match.get("part", {}).get("partNumber")
            for match in matches[:3]
        ]
        if expected is None:
            is_correct = not returned and result.get("needsHumanReview") is True
        else:
            is_correct = expected in returned

        correct += int(is_correct)
        label = expected if expected is not None else "no match"
        print(f"{index:02d}. {'PASS' if is_correct else 'MISS'} expected={label}; top3={returned}")

    total = len(cases)
    accuracy = correct / total * 100
    summary = {
        "correctTop3Matches": correct,
        "totalRequests": total,
        "top3AccuracyPercent": round(accuracy, 2),
    }
    print(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    try:
        evaluate()
    except (OSError, ValueError, RuntimeError, KeyError, json.JSONDecodeError) as error:
        print(f"Evaluation failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
