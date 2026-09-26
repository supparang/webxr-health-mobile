#!/usr/bin/env python3
"""ACTIVA-AI baseline ML training pipeline.

Research safeguards:
- Uses only LOCKED ground truth exported by /api/ml/dataset.
- Model family selection uses validation data only.
- Threshold is selected/locked from validation data only.
- Final test set is untouched until final evaluation.
- Group-aware splitting reduces repeated-person leakage.
- Synthetic data are software tests only and must never be reported as empirical results.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.base import clone
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

RANDOM_STATE = 2601
TARGET_MAP = {"NO_REVIEW_REQUIRED": 0, "REVIEW_REQUIRED": 1}

NUMERIC_FEATURES = [
    "qr_valid",
    "identity_verified",
    "checkin_present",
    "checkout_present",
    "scheduled_duration_minutes",
    "actual_duration_minutes",
    "duration_ratio",
    "checkin_offset_minutes",
    "checkout_offset_minutes",
    "staff_verified",
    "signature_verified",
    "scan_attempts",
]
CATEGORICAL_FEATURES = ["activity_type"]
FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES


def load_records(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        rows = payload.get("records", payload) if isinstance(payload, dict) else payload
        return pd.DataFrame(rows)
    return pd.read_csv(path)


def load_dataset(path: Path) -> pd.DataFrame:
    df = load_records(path)
    required = {"record_id", "participant_hash", "event_id", "final_target", *FEATURES}
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = df[df["final_target"].isin(TARGET_MAP)].copy()
    df["target"] = df["final_target"].map(TARGET_MAP).astype(int)
    if df.empty:
        raise ValueError("No locked binary ground-truth records found.")
    if df["target"].nunique() < 2:
        raise ValueError("Both REVIEW_REQUIRED and NO_REVIEW_REQUIRED are required.")

    # Dataset quality gate: fail before model fitting when exported evidence is unsafe.
    if df["record_id"].astype(str).duplicated().any():
        raise ValueError("Duplicate record_id values found in locked ML dataset.")

    binary_features = [
        "qr_valid", "identity_verified", "checkin_present", "checkout_present",
        "staff_verified", "signature_verified",
    ]
    for feature in binary_features:
        values = pd.to_numeric(df[feature], errors="coerce")
        invalid = values.notna() & ~values.isin([0, 1])
        if invalid.any():
            raise ValueError(f"{feature} must contain only 0/1/null values.")

    ratio = pd.to_numeric(df["duration_ratio"], errors="coerce")
    invalid_ratio = ratio.notna() & ((ratio < 0) | (ratio > 1))
    if invalid_ratio.any():
        bad = df.loc[invalid_ratio, ["record_id", "duration_ratio"]].to_dict("records")
        raise ValueError(
            "duration_ratio must represent participation coverage in [0,1]. "
            f"Invalid rows: {bad[:10]}"
        )

    attempts = pd.to_numeric(df["scan_attempts"], errors="coerce")
    if (attempts.dropna() < 0).any():
        raise ValueError("scan_attempts cannot be negative.")

    # These columns may be exported for provenance/audit, but are intentionally
    # excluded from FEATURES to prevent target or identity leakage.
    leakage_columns = {
        "final_target", "reason_codes", "locked_at", "record_id",
        "participant_hash", "event_id",
    }
    leaked = sorted(leakage_columns.intersection(FEATURES))
    if leaked:
        raise ValueError(f"Target/identity leakage detected in model FEATURES: {leaked}")

    return df


def group_split(df: pd.DataFrame, group_col: str):
    if group_col not in df.columns:
        raise ValueError(f"Group column not found: {group_col}")

    groups = df[group_col].astype(str)
    if groups.nunique() < 5:
        raise ValueError(
            f"Only {groups.nunique()} unique groups in {group_col}; "
            "not enough for a stable train/validation/test group split."
        )

    first = GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=RANDOM_STATE)
    train_val_idx, test_idx = next(first.split(df, df["target"], groups=groups))
    train_val = df.iloc[train_val_idx].copy()
    test = df.iloc[test_idx].copy()

    second = GroupShuffleSplit(n_splits=1, test_size=0.25, random_state=RANDOM_STATE + 1)
    tv_groups = train_val[group_col].astype(str)
    train_idx, val_idx = next(second.split(train_val, train_val["target"], groups=tv_groups))
    train = train_val.iloc[train_idx].copy()
    val = train_val.iloc[val_idx].copy()

    for name, part in [("train", train), ("validation", val), ("test", test)]:
        if part["target"].nunique() < 2:
            raise ValueError(
                f"{name} split contains only one class. "
                "Collect more locked ground truth or revise the pre-specified split strategy."
            )
    return train, val, test


def preprocessor():
    numeric = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="median")),
            ("scale", StandardScaler()),
        ]
    )
    categorical = Pipeline(
        steps=[
            ("impute", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", numeric, NUMERIC_FEATURES),
            ("cat", categorical, CATEGORICAL_FEATURES),
        ]
    )


def candidates():
    return {
        "logistic_regression": LogisticRegression(
            max_iter=2000,
            class_weight="balanced",
            random_state=RANDOM_STATE,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=400,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingClassifier(random_state=RANDOM_STATE),
    }


def calibrated_pipeline(estimator):
    pipe = Pipeline([("preprocess", preprocessor()), ("model", estimator)])
    return CalibratedClassifierCV(pipe, method="sigmoid", cv=3)


def safe_auc(metric_fn, y, p):
    return float(metric_fn(y, p)) if len(np.unique(y)) == 2 else None


def metrics(y, p, threshold=0.5):
    pred = (p >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    specificity = tn / (tn + fp) if (tn + fp) else math.nan
    return {
        "precision": float(precision_score(y, pred, zero_division=0)),
        "recall_sensitivity": float(recall_score(y, pred, zero_division=0)),
        "specificity": float(specificity),
        "f1": float(f1_score(y, pred, zero_division=0)),
        "roc_auc": safe_auc(roc_auc_score, y, p),
        "pr_auc": safe_auc(average_precision_score, y, p),
        "brier_score": float(brier_score_loss(y, p)),
        "threshold": float(threshold),
        "confusion_matrix": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def choose_threshold(y, p, strategy, fixed_threshold):
    if strategy == "fixed":
        if not 0 < fixed_threshold < 1:
            raise ValueError("--fixed-threshold must be between 0 and 1.")
        return float(fixed_threshold), {"strategy": "fixed", "validation_f1": None}

    if strategy != "f1_validation":
        raise ValueError(f"Unsupported threshold strategy: {strategy}")

    grid = np.linspace(0.05, 0.95, 181)
    scored = []
    for t in grid:
        score = f1_score(y, (p >= t).astype(int), zero_division=0)
        scored.append((float(score), float(t)))

    best_f1 = max(x[0] for x in scored)
    ties = [x for x in scored if abs(x[0] - best_f1) < 1e-12]
    _, threshold = min(ties, key=lambda x: abs(x[1] - 0.5))
    return threshold, {
        "strategy": "f1_validation",
        "validation_f1": best_f1,
        "tie_break": "closest_to_0.5",
    }


def bootstrap_ci(y, p, groups, threshold, n_boot=1000):
    rng = np.random.default_rng(RANDOM_STATE)
    frame = pd.DataFrame({"y": np.asarray(y), "p": np.asarray(p), "g": np.asarray(groups).astype(str)})
    unique_groups = frame["g"].unique()
    keys = ["precision", "recall_sensitivity", "specificity", "f1", "roc_auc", "pr_auc", "brier_score"]
    collected = {k: [] for k in keys}

    for _ in range(n_boot):
        sampled = rng.choice(unique_groups, size=len(unique_groups), replace=True)
        parts = []
        for i, group in enumerate(sampled):
            block = frame[frame["g"] == group].copy()
            block["g"] = block["g"] + f"__boot{i}"
            parts.append(block)
        boot = pd.concat(parts, ignore_index=True)
        if boot["y"].nunique() < 2:
            continue
        m = metrics(boot["y"].to_numpy(), boot["p"].to_numpy(), threshold)
        for key in keys:
            value = m[key]
            if value is not None and np.isfinite(value):
                collected[key].append(value)

    out = {}
    for key, values in collected.items():
        out[key] = (
            {
                "low_95": float(np.percentile(values, 2.5)),
                "high_95": float(np.percentile(values, 97.5)),
                "bootstrap_replicates": len(values),
            }
            if values
            else None
        )
    return out


def reference_values(df: pd.DataFrame):
    refs = {}
    for feature in NUMERIC_FEATURES:
        series = pd.to_numeric(df[feature], errors="coerce")
        refs[feature] = None if series.dropna().empty else float(series.median())
    for feature in CATEGORICAL_FEATURES:
        mode = df[feature].dropna().astype(str).mode()
        refs[feature] = None if mode.empty else str(mode.iloc[0])
    return refs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", default=Path("ml/out"), type=Path)
    parser.add_argument("--group-column", default="participant_hash")
    parser.add_argument("--bootstrap", type=int, default=1000)
    parser.add_argument("--model-version", required=True)
    parser.add_argument(
        "--data-provenance",
        choices=["EMPIRICAL_LOCKED_GROUND_TRUTH", "SYNTHETIC_CI_ONLY"],
        required=True,
    )
    parser.add_argument(
        "--threshold-strategy",
        choices=["f1_validation", "fixed"],
        default="f1_validation",
    )
    parser.add_argument("--fixed-threshold", type=float, default=0.5)
    args = parser.parse_args()

    df = load_dataset(args.input)
    train, val, test = group_split(df, args.group_column)

    min_train_class = int(train["target"].value_counts().min())
    if min_train_class < 3:
        raise ValueError(
            "Training split needs at least 3 records in each class for 3-fold calibration."
        )

    X_train, y_train = train[FEATURES], train["target"].to_numpy()
    X_val, y_val = val[FEATURES], val["target"].to_numpy()
    X_test, y_test = test[FEATURES], test["target"].to_numpy()

    validation = {}
    fitted = {}
    val_probs = {}
    for name, estimator in candidates().items():
        model = calibrated_pipeline(estimator)
        model.fit(X_train, y_train)
        val_prob = model.predict_proba(X_val)[:, 1]
        validation[name] = metrics(y_val, val_prob, 0.5)
        fitted[name] = model
        val_probs[name] = val_prob

    selected_name = max(
        validation,
        key=lambda n: (-1 if validation[n]["pr_auc"] is None else validation[n]["pr_auc"]),
    )

    threshold, threshold_info = choose_threshold(
        y_val,
        val_probs[selected_name],
        args.threshold_strategy,
        args.fixed_threshold,
    )
    validation_selected_locked = metrics(y_val, val_probs[selected_name], threshold)

    development = pd.concat([train, val], ignore_index=True)
    min_dev_class = int(development["target"].value_counts().min())
    if min_dev_class < 3:
        raise ValueError(
            "Development data need at least 3 records in each class for final calibration."
        )

    final_model = calibrated_pipeline(clone(candidates()[selected_name]))
    final_model.fit(development[FEATURES], development["target"].to_numpy())

    test_prob = final_model.predict_proba(X_test)[:, 1]
    test_metrics = metrics(y_test, test_prob, threshold)
    cis = bootstrap_ci(
        y_test,
        test_prob,
        test[args.group_column].astype(str).to_numpy(),
        threshold,
        n_boot=args.bootstrap,
    )

    frac_pos, mean_pred = calibration_curve(
        y_test, test_prob, n_bins=min(5, len(test)), strategy="quantile"
    )

    importance = permutation_importance(
        final_model,
        X_test,
        y_test,
        scoring="average_precision",
        n_repeats=20,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    importance_rows = sorted(
        [
            {
                "feature": feature,
                "mean_importance": float(mean),
                "std_importance": float(std),
            }
            for feature, mean, std in zip(
                FEATURES, importance.importances_mean, importance.importances_std
            )
        ],
        key=lambda x: x["mean_importance"],
        reverse=True,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    model_path = args.output_dir / "activa_ai_model.joblib"
    evaluation_path = args.output_dir / "evaluation.json"
    manifest_path = args.output_dir / "model_manifest.json"
    registry_path = args.output_dir / "model_registry_payload.json"

    joblib.dump(final_model, model_path)

    manifest = {
        "model_version": args.model_version,
        "model_family": selected_name,
        "target": "REVIEW_REQUIRED",
        "data_provenance": args.data_provenance,
        "features": FEATURES,
        "numeric_features": NUMERIC_FEATURES,
        "categorical_features": CATEGORICAL_FEATURES,
        "threshold": threshold,
        "threshold_selection": threshold_info,
        "calibration_method": "sigmoid_cv3",
        "group_split_column": args.group_column,
        "reference_values": reference_values(development),
        "decision_support_only": True,
        "warnings": [
            "Threshold was locked using validation data only.",
            "Final test data must not be used for further tuning.",
            "Predictions support human review and never make autonomous personnel decisions.",
        ],
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")

    result = {
        "research_status": "EVALUATED_OFFLINE_NOT_YET_APPROVED_OR_DEPLOYED",
        "model_version": args.model_version,
        "data_provenance": args.data_provenance,
        "target": "REVIEW_REQUIRED",
        "selected_model_family": selected_name,
        "selection_metric": "validation_pr_auc",
        "selected_metric_value": validation[selected_name]["pr_auc"],
        "group_split_column": args.group_column,
        "threshold": threshold,
        "threshold_selection": threshold_info,
        "counts": {
            "total": int(len(df)),
            "train": int(len(train)),
            "validation": int(len(val)),
            "test": int(len(test)),
            "positive_total": int(df["target"].sum()),
            "negative_total": int((1 - df["target"]).sum()),
            "unique_groups_total": int(df[args.group_column].nunique()),
        },
        "validation_metrics_by_model": validation,
        "selected_model_validation_metrics_at_locked_threshold": validation_selected_locked,
        "final_test_metrics": test_metrics,
        "final_test_cluster_bootstrap_95ci": cis,
        "calibration_curve": {
            "mean_predicted_probability": [float(x) for x in mean_pred],
            "fraction_positive": [float(x) for x in frac_pos],
        },
        "permutation_importance": importance_rows,
        "warnings": manifest["warnings"] + [
            "Permutation importance is predictive, not causal.",
            "Sample adequacy and final analysis plan require protocol-level justification.",
        ],
    }
    evaluation_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")

    registry_payload = {
        "version": args.model_version,
        "modelFamily": selected_name,
        "dataProvenance": args.data_provenance,
        "selectedMetric": "validation_pr_auc",
        "selectedMetricValue": validation[selected_name]["pr_auc"],
        "validationMetrics": {
            "all_models": validation,
            "selected_model_locked_threshold": validation_selected_locked,
            "threshold_selection": threshold_info,
        },
        "testMetrics": test_metrics,
        "calibration": {
            "method": "sigmoid_cv3",
            "curve": result["calibration_curve"],
            "brier_score": test_metrics["brier_score"],
        },
        "explainability": {
            "global_method": "permutation_importance",
            "global_importance": importance_rows,
            "causal_interpretation": False,
        },
        "notes": (
            "Offline evaluation package. Approval and deployment are separate governance gates. "
            "Final test metrics must not be used for additional tuning."
        ),
    }
    registry_path.write_text(
        json.dumps(registry_payload, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Saved model: {model_path}")
    print(f"Saved manifest: {manifest_path}")
    print(f"Saved evaluation: {evaluation_path}")
    print(f"Saved registry payload: {registry_path}")


if __name__ == "__main__":
    main()
