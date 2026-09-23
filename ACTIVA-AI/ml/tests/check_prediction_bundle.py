#!/usr/bin/env python3
import json
from pathlib import Path

path = Path("ml/tests/out/prediction_bundle.json")
payload = json.loads(path.read_text(encoding="utf-8"))

assert payload["modelVersion"] == "ACTIVA-CI-PY-001"
assert payload["decisionSupportOnly"] is True
assert 0 < float(payload["threshold"]) < 1
assert payload["causalInterpretation"] is False
assert len(payload["predictions"]) > 0

for row in payload["predictions"]:
    p = float(row["riskProbability"])
    assert 0 <= p <= 1
    assert row["predictedLabel"] in {"REVIEW_REQUIRED", "NO_REVIEW_REQUIRED"}
    assert row["attendanceId"]
    exp = row["explanation"]
    assert exp["causal"] is False
    assert exp["method"] == "single_feature_reference_perturbation"

print("ACTIVA-AI V0.3.3 prediction bundle validation passed")
