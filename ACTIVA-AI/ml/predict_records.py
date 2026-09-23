#!/usr/bin/env python3
"""Generate ACTIVA-AI offline prediction + explanation bundle.

The output is intended for /api/predictions/import-batch after the model has
passed evaluation, approval and deployment governance gates.

Local explanations use single-feature reference perturbation. They are
predictive sensitivity explanations, not causal explanations.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

FEATURE_LABELS_TH = {
    "qr_valid": "ความถูกต้องของ QR",
    "identity_verified": "การยืนยันตัวตน",
    "checkin_present": "หลักฐาน Check-in",
    "checkout_present": "หลักฐาน Check-out",
    "scheduled_duration_minutes": "ระยะเวลากิจกรรมที่กำหนด",
    "actual_duration_minutes": "ระยะเวลาเข้าร่วมจริง",
    "duration_ratio": "สัดส่วนระยะเวลาเข้าร่วม",
    "checkin_offset_minutes": "ความต่างเวลา Check-in",
    "checkout_offset_minutes": "ความต่างเวลา Check-out",
    "staff_verified": "การยืนยันโดยเจ้าหน้าที่",
    "signature_verified": "การยืนยันลายเซ็น",
    "scan_attempts": "จำนวนครั้งที่สแกน",
    "activity_type": "ประเภทกิจกรรม",
}


def load_records(path: Path):
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        rows = payload.get("records", payload) if isinstance(payload, dict) else payload
        return pd.DataFrame(rows), payload if isinstance(payload, dict) else {}
    return pd.read_csv(path), {}


def py_value(value):
    if pd.isna(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    return value


def local_explanation(model, row_df, full_probability, features, references, top_n):
    impacts = []
    for feature in features:
        ref = references.get(feature)
        if ref is None:
            continue
        perturbed = row_df.copy()
        perturbed.loc[perturbed.index[0], feature] = ref
        ref_probability = float(model.predict_proba(perturbed[features])[:, 1][0])
        contribution = float(full_probability - ref_probability)
        observed = py_value(row_df.iloc[0][feature])
        impacts.append(
            {
                "feature": feature,
                "label": FEATURE_LABELS_TH.get(feature, feature),
                "contribution": contribution,
                "direction": "increases_risk" if contribution > 0 else "decreases_risk",
                "observed": observed,
                "reference": ref,
            }
        )

    impacts.sort(key=lambda x: abs(x["contribution"]), reverse=True)
    return {
        "method": "single_feature_reference_perturbation",
        "causal": False,
        "reasons": impacts[:top_n],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--top-n", type=int, default=5)
    args = parser.parse_args()

    df, source_meta = load_records(args.input)
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    model = joblib.load(args.model)

    features = manifest["features"]
    missing = sorted(set(["record_id", *features]) - set(df.columns))
    if missing:
        raise ValueError(f"Missing inference columns: {missing}")

    source_model = source_meta.get("deployedModel") if isinstance(source_meta, dict) else None
    if source_model and source_model.get("version") != manifest["model_version"]:
        raise ValueError(
            "Inference dataset deployed model version does not match model manifest."
        )

    probs = model.predict_proba(df[features])[:, 1]
    threshold = float(manifest["threshold"])
    predictions = []

    for idx, probability in enumerate(probs):
        row_df = df.iloc[[idx]].copy()
        explanation = local_explanation(
            model,
            row_df,
            float(probability),
            features,
            manifest.get("reference_values", {}),
            args.top_n,
        )
        explanation["threshold"] = threshold
        explanation["model_family"] = manifest["model_family"]

        predictions.append(
            {
                "attendanceId": str(df.iloc[idx]["record_id"]),
                "riskProbability": float(probability),
                "predictedLabel": (
                    "REVIEW_REQUIRED"
                    if probability >= threshold
                    else "NO_REVIEW_REQUIRED"
                ),
                "explanation": explanation,
            }
        )

    bundle = {
        "modelVersion": manifest["model_version"],
        "modelFamily": manifest["model_family"],
        "dataProvenance": manifest["data_provenance"],
        "threshold": threshold,
        "thresholdSelection": manifest.get("threshold_selection"),
        "decisionSupportOnly": True,
        "explanationMethod": "single_feature_reference_perturbation",
        "causalInterpretation": False,
        "warnings": [
            "Risk probability supports human review only.",
            "Local perturbation explanations are predictive, not causal.",
            "Prediction import must not change final evidence status automatically.",
        ],
        "predictions": predictions,
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(bundle, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Saved prediction bundle: {args.output}")
    print(f"Predictions: {len(predictions)}")


if __name__ == "__main__":
    main()
