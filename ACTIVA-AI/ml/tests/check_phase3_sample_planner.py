#!/usr/bin/env python3
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml"))

from plan_phase3_sample import compute_plan

plan = json.loads((ROOT / "ml/tests/phase3_sample_plan_ci.json").read_text(encoding="utf-8"))
report = compute_plan(plan)

assert report["method"] == "Riley_et_al_2018_via_pmsampsize_python_0.1.0"
assert report["rileyDevelopmentMinimum"]["records"] > 0
assert report["collectionMinimumAfterInternalTestHoldoutInflation"]["records"] >= report["rileyDevelopmentMinimum"]["records"]
assert report["recommendedDatasetGateMinimums"]["reviewRequired"] > 0
assert report["recommendedDatasetGateMinimums"]["noReviewRequired"] > 0
assert report["simulationStressTestRequired"] is False
assert report["approvalReadyFromSampleSizeMethod"] is True

print("ACTIVA-AI Phase 3 sample-planner CI tool check passed")
