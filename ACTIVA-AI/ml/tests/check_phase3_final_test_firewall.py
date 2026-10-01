#!/usr/bin/env python3
import json
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "ml"))

from train_baselines import empirical_temporal_group_split, validate_empirical_export

CUTOFF = "2026-09-30T12:00:00Z"

rows = []
# Planning/development participants: all existed at or before cutoff.
for p in range(12):
    for j in range(2):
        rows.append({
            "record_id": f"DEV-{p}-{j}",
            "participant_hash": f"DEV-P{p}",
            "event_id": f"E{j % 3}",
            "locked_at": "2026-09-30T11:00:00Z" if j == 0 else "2026-10-01T01:00:00Z",
            "final_target": "REVIEW_REQUIRED" if (p + j) % 2 else "NO_REVIEW_REQUIRED",
            "target": 1 if (p + j) % 2 else 0,
        })

# Prospective unseen participants: eligible final test only.
for p in range(10):
    for j in range(2):
        rows.append({
            "record_id": f"TEST-{p}-{j}",
            "participant_hash": f"TEST-P{p}",
            "event_id": f"F{j % 2}",
            "locked_at": "2026-10-02T01:00:00Z",
            "final_target": "REVIEW_REQUIRED" if (p + j) % 2 else "NO_REVIEW_REQUIRED",
            "target": 1 if (p + j) % 2 else 0,
        })

df = pd.DataFrame(rows)
plan = {
    "protocolId": "ACTIVA-P3-RP-001",
    "status": "APPROVED",
    "planningSnapshot": {
        "cutoffUtc": CUTOFF,
        "developmentOnly": True,
    },
    "finalTestMinimums": {
        "records": 20,
        "reviewRequired": 10,
        "noReviewRequired": 10,
    },
}

train, val, test, info = empirical_temporal_group_split(df, "participant_hash", plan)

dev_groups = set(train["participant_hash"]).union(set(val["participant_hash"]))
test_groups = set(test["participant_hash"])
assert not dev_groups.intersection(test_groups)
assert all(pd.to_datetime(test["locked_at"], utc=True) > pd.Timestamp(CUTOFF))
assert all(x.startswith("TEST-P") for x in test["participant_hash"])
assert all(x.startswith("DEV-P") for x in dev_groups)
assert len(test) == 20
assert int((test["target"] == 1).sum()) == 10
assert int((test["target"] == 0).sum()) == 10
assert info["participant_group_overlap"] == 0
assert info["planning_records_in_final_test"] == 0

# Later records from a participant already present in the planning cohort
# must stay development-only.
assert "DEV-P0" in dev_groups
assert "DEV-P0" not in test_groups

bad_plan = json.loads(json.dumps(plan))
bad_plan["finalTestMinimums"]["records"] = 21
try:
    empirical_temporal_group_split(df, "participant_hash", bad_plan)
    raise AssertionError("final-test minimum guard did not fail")
except ValueError as exc:
    assert "FINAL_TEST_MIN_RECORDS_NOT_MET" in str(exc)

print("ACTIVA-AI Phase 3 final-test firewall tests passed")


# Verify empirical trainer rejects mislabeled, synthetic and QA exports before fitting.
from tempfile import TemporaryDirectory

with TemporaryDirectory() as directory:
    source = Path(directory) / "export.json"
    metadata = {
        "dataProvenance": "EMPIRICAL_LOCKED_GROUND_TRUTH",
        "scope": "EMPIRICAL_ONLY",
        "datasetStatus": "LOCKED_GROUND_TRUTH_ONLY",
        "aiPredictionsIncluded": False,
        "syntheticDemo": False,
        "deidentified": True,
        "records": [{"record_id":"TEST-1","data_classification":"EMPIRICAL"}],
    }
    source.write_text(json.dumps(metadata), encoding="utf-8")
    validate_empirical_export(source)

    for mutation in (
        {"scope":"UNCLASSIFIED"},
        {"syntheticDemo":True},
        {"records":[{"record_id":"QA-1","data_classification":"QA_TEST"}]},
        {"records":[{"record_id":"OLD-1"}]},
    ):
        payload = {**metadata, **mutation}
        source.write_text(json.dumps(payload), encoding="utf-8")
        try:
            validate_empirical_export(source)
            raise AssertionError("Empirical provenance guard accepted unsafe dataset")
        except ValueError:
            pass

print("ACTIVA-AI Phase 3 empirical provenance guard passed")
