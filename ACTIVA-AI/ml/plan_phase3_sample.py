#!/usr/bin/env python3
"""Plan ACTIVA-AI Phase 3 sample size using pmsampsize (Riley et al. framework).

This script is a planning tool, not an automatic approval mechanism.
It reads the version-controlled Phase 3 sample plan, checks that all
pre-specified assumptions are present, computes a binary-outcome model
development minimum, inflates for the pre-specified internal test holdout,
and emits a machine-readable planning result.

Important:
- It never inspects final-test performance.
- It never changes an APPROVED plan.
- It does not infer prevalence or model strength from the empirical dataset.
- High anticipated discrimination (C-statistic >= 0.80) triggers a required
  simulation stress-test flag before the plan can be considered approval-ready.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any

from pmsampsize.pmsampsize import pmsampsize

PROTOCOL_ID = "ACTIVA-P3-RP-001"
SAMPLE_PLAN_ID = "ACTIVA-P3-SP-001"
TOOL_VERSION = "ACTIVA-P3-SAMPLE-PLANNER-1.0"


def _is_num(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def _require_probability(value: Any, field: str) -> float:
    if not _is_num(value) or not (0 < float(value) < 1):
        raise ValueError(f"{field} must be a numeric value strictly between 0 and 1")
    return float(value)


def _require_positive_int(value: Any, field: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise ValueError(f"{field} must be a positive integer")
    return int(value)


def _model_strength_args(assumptions: dict[str, Any]) -> tuple[dict[str, float], str, float]:
    strength = assumptions.get("anticipatedModelStrength") or {}
    metric = strength.get("metric")
    value = strength.get("value")
    if metric not in {"cstatistic", "csrsquared", "nagrsquared"}:
        raise ValueError("anticipatedModelStrength.metric must be cstatistic, csrsquared, or nagrsquared")
    value = _require_probability(value, f"anticipatedModelStrength.{metric}")
    return {metric: value}, metric, value


def _candidate_parameters(plan: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    design = plan.get("design") or {}
    explicit = design.get("candidatePredictorParameters")
    if explicit is not None:
        p = _require_positive_int(explicit, "design.candidatePredictorParameters")
        return p, {"method": "explicit", "candidatePredictorParameters": p}

    numeric_count = design.get("numericPredictorParameters")
    activity_levels = design.get("anticipatedActivityTypeLevels")
    numeric_count = _require_positive_int(numeric_count, "design.numericPredictorParameters")
    activity_levels = _require_positive_int(activity_levels, "design.anticipatedActivityTypeLevels")
    if activity_levels < 2:
        raise ValueError("design.anticipatedActivityTypeLevels must be at least 2 when activity_type is used")
    p = numeric_count + (activity_levels - 1)
    return p, {
        "method": "numeric_plus_activity_type_dummy_parameters",
        "numericPredictorParameters": numeric_count,
        "anticipatedActivityTypeLevels": activity_levels,
        "activityTypeDummyParameters": activity_levels - 1,
        "candidatePredictorParameters": p,
    }


def compute_plan(plan: dict[str, Any]) -> dict[str, Any]:
    if plan.get("protocolId") != PROTOCOL_ID:
        raise ValueError(f"protocolId must be {PROTOCOL_ID}")
    if plan.get("samplePlanId") != SAMPLE_PLAN_ID:
        raise ValueError(f"samplePlanId must be {SAMPLE_PLAN_ID}")
    if plan.get("status") == "APPROVED":
        raise ValueError("Refusing to recalculate an APPROVED sample plan; create a documented amendment instead")

    assumptions = plan.get("assumptions") or {}
    prevalence = _require_probability(
        assumptions.get("anticipatedReviewRequiredPrevalence"),
        "assumptions.anticipatedReviewRequiredPrevalence",
    )
    if not str(assumptions.get("prevalenceSource") or "").strip():
        raise ValueError("assumptions.prevalenceSource is required before calculation")

    params, parameter_detail = _candidate_parameters(plan)
    strength_args, strength_metric, strength_value = _model_strength_args(assumptions)
    strength_source = str((assumptions.get("anticipatedModelStrength") or {}).get("source") or "").strip()
    if not strength_source:
        raise ValueError("assumptions.anticipatedModelStrength.source is required before calculation")

    shrinkage = float((plan.get("design") or {}).get("targetShrinkage", 0.90))
    if not (0 < shrinkage < 1):
        raise ValueError("design.targetShrinkage must be between 0 and 1")

    holdout = float((plan.get("design") or {}).get("finalTestHoldoutFraction", 0.20))
    if not (0 < holdout < 0.5):
        raise ValueError("design.finalTestHoldoutFraction must be >0 and <0.5")

    result = pmsampsize(
        type="b",
        parameters=params,
        prevalence=prevalence,
        shrinkage=shrinkage,
        noprint=True,
        **strength_args,
    )

    development_n = int(result["sample_size"])
    expected_development_positive = int(math.ceil(float(result["events"])))
    expected_development_negative = max(0, development_n - expected_development_positive)

    # The existing pipeline reserves an internal final test holdout. Riley's
    # model-development minimum is therefore required within the remaining
    # development fraction rather than across the whole collected cohort.
    total_n = int(math.ceil(development_n / (1.0 - holdout)))
    expected_total_positive = int(math.ceil(total_n * prevalence))
    expected_total_negative = total_n - expected_total_positive
    expected_test_n = total_n - development_n
    expected_test_positive = max(1, int(math.ceil(expected_test_n * prevalence)))
    expected_test_negative = max(1, expected_test_n - expected_test_positive)

    high_discrimination = strength_metric == "cstatistic" and strength_value >= 0.80
    stress = plan.get("simulationStressTest") or {}
    stress_pass = str(stress.get("status") or "").upper() == "PASS"
    stress_required = high_discrimination
    approval_ready = (not stress_required) or stress_pass

    criterion_rows = []
    for row in result.get("results_table", []):
        if not row or row[0] == "----":
            continue
        criterion_rows.append({
            "criterion": row[0],
            "sampleSize": row[1],
            "shrinkage": row[2],
            "parameters": row[3],
            "coxSnellR2": row[4],
            "maxR2": row[5],
            "nagelkerkeR2": row[6],
            "epp": row[7],
        })

    return {
        "toolVersion": TOOL_VERSION,
        "protocolId": PROTOCOL_ID,
        "samplePlanId": SAMPLE_PLAN_ID,
        "method": "Riley_et_al_2018_via_pmsampsize_python_0.1.0",
        "planningOnly": True,
        "inputAssumptions": {
            "anticipatedReviewRequiredPrevalence": prevalence,
            "prevalenceSource": assumptions.get("prevalenceSource"),
            "modelStrength": {
                "metric": strength_metric,
                "value": strength_value,
                "source": strength_source,
            },
            "targetShrinkage": shrinkage,
            "finalTestHoldoutFraction": holdout,
            "candidateParameterDetail": parameter_detail,
        },
        "rileyDevelopmentMinimum": {
            "records": development_n,
            "expectedReviewRequired": expected_development_positive,
            "expectedNoReviewRequired": expected_development_negative,
            "eventsPerPredictorParameter": result.get("EPP"),
            "criteria": criterion_rows,
        },
        "collectionMinimumAfterInternalTestHoldoutInflation": {
            "records": total_n,
            "expectedReviewRequired": expected_total_positive,
            "expectedNoReviewRequired": expected_total_negative,
            "expectedFinalTestRecords": expected_test_n,
            "expectedFinalTestReviewRequired": expected_test_positive,
            "expectedFinalTestNoReviewRequired": expected_test_negative,
        },
        "recommendedDatasetGateMinimums": {
            "records": total_n,
            "uniqueParticipants": None,
            "uniqueEvents": None,
            "reviewRequired": expected_total_positive,
            "noReviewRequired": expected_total_negative,
        },
        "simulationStressTestRequired": stress_required,
        "simulationStressTestStatus": stress.get("status") or "NOT_REQUIRED" if not stress_required else stress.get("status") or "PENDING",
        "approvalReadyFromSampleSizeMethod": approval_ready,
        "limitations": [
            "Unique-participant and unique-event minimums must be justified separately because pmsampsize addresses record/event counts, not clustering adequacy.",
            "Expected class counts are planning expectations; observed empirical counts must satisfy the approved dataset gate.",
            "This internal holdout inflation is not an external-validation sample-size calculation.",
            "If model strength is high or uncertain, simulation-based stress testing should be used before approval.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    plan = json.loads(args.plan.read_text(encoding="utf-8"))
    try:
        report = compute_plan(plan)
        ok = True
    except Exception as exc:
        report = {
            "toolVersion": TOOL_VERSION,
            "protocolId": PROTOCOL_ID,
            "samplePlanId": SAMPLE_PLAN_ID,
            "planningOnly": True,
            "ok": False,
            "status": "HOLD",
            "error": type(exc).__name__,
            "message": str(exc),
        }
        ok = False

    report["ok"] = ok
    report["status"] = "CALCULATED_PENDING_APPROVAL" if ok else "HOLD"

    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    print(rendered)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered + "\n", encoding="utf-8")

    if not ok:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
