#!/usr/bin/env python3
"""ACTIVA-AI baseline ML training pipeline.

Research design safeguards:
- Uses only LOCKED ground truth exported by /api/ml/dataset.
- Selects model on validation data only.
- Keeps final test split untouched until final evaluation.
- Defaults to participant-group splitting to reduce repeated-person leakage.
- Reports predictive association/importance, not causality.
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


def load_dataset(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".json":
        payload = json.loads(path.read_text(encoding="utf-8"))
        rows = payload.get("records", payload) if isinstance(payload, dict) else payload
        df = pd.DataFrame(rows)
    else:
        df = pd.read_csv(path)

    required = {"record_id", "participant_hash", "event_id", "final_target", *FEATURES}
    missing = sorted(required - set(df.columns))
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = df[df["final_target"].isin(TARGET_MAP)].copy()
    df["target"] = df["final_target"].map(TARGET_MAP).astype(int)
    if df.empty:
        raise ValueError("No locked binary ground-truth records found.")
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
        "gradient_boosting": GradientBoostingClassifier(
            random_state=RANDOM_STATE,
        ),
    }


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


def bootstrap_ci(y, p, groups, n_boot=1000):
    rng = np.random.default_rng(RANDOM_STATE)
    frame = pd.DataFrame({"y": np.asarray(y), "p": np.asarray(p), "g": np.asarray(groups).astype(str)})
    unique_groups = frame["g"].unique()
    collected = {k: [] for k in ["precision", "recall_sensitivity", "specificity", "f1", "roc_auc", "pr_auc", "brier_score"]}

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
        m = metrics(boot["y"].to_numpy(), boot["p"].to_numpy())
        for key in collected:
            value = m[key]
            if value is not None and np.isfinite(value):
                collected[key].append(value)

    out = {}
    for key, values in collected.items():
        if values:
            out[key] = {
                "low_95": float(np.percentile(values, 2.5)),
                "high_95": float(np.percentile(values, 97.5)),
                "bootstrap_replicates": len(values),
            }
        else:
            out[key] = None
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output-dir", default=Path("ml/out"), type=Path)
    parser.add_argument("--group-column", default="participant_hash")
    parser.add_argument("--bootstrap", type=int, default=1000)
    args = parser.parse_args()

    df = load_dataset(args.input)
    train, val, test = group_split(df, args.group_column)

    X_train, y_train = train[FEATURES], train["target"].to_numpy()
    X_val, y_val = val[FEATURES], val["target"].to_numpy()
    X_test, y_test = test[FEATURES], test["target"].to_numpy()

    validation = {}
    fitted = {}
    for name, estimator in candidates().items():
        pipe = Pipeline([("preprocess", preprocessor()), ("model", estimator)])
        pipe.fit(X_train, y_train)
        val_prob = pipe.predict_proba(X_val)[:, 1]
        validation[name] = metrics(y_val, val_prob)
        fitted[name] = pipe

    # Model selection is based on validation PR-AUC only; test data remain untouched.
    selected_name = max(
        validation,
        key=lambda n: (-1 if validation[n]["pr_auc"] is None else validation[n]["pr_auc"]),
    )

    # Refit/calibrate selected family using train+validation only.
    development = pd.concat([train, val], ignore_index=True)
    base = Pipeline([("preprocess", preprocessor()), ("model", clone(candidates()[selected_name]))])
    calibrated = CalibratedClassifierCV(base, method="sigmoid", cv=3)
    calibrated.fit(development[FEATURES], development["target"].to_numpy())

    test_prob = calibrated.predict_proba(X_test)[:, 1]
    test_metrics = metrics(y_test, test_prob)
    cis = bootstrap_ci(
        y_test,
        test_prob,
        test[args.group_column].astype(str).to_numpy(),
        n_boot=args.bootstrap,
    )

    frac_pos, mean_pred = calibration_curve(y_test, test_prob, n_bins=5, strategy="quantile")

    importance = permutation_importance(
        calibrated,
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
            for feature, mean, std in zip(FEATURES, importance.importances_mean, importance.importances_std)
        ],
        key=lambda x: x["mean_importance"],
        reverse=True,
    )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    model_path = args.output_dir / "activa_ai_baseline.joblib"
    results_path = args.output_dir / "evaluation.json"
    joblib.dump(calibrated, model_path)

    result = {
        "research_status": "BASELINE_MODEL_NOT_YET_DEPLOYED",
        "target": "REVIEW_REQUIRED",
        "selected_model_family": selected_name,
        "selection_metric": "validation_pr_auc",
        "group_split_column": args.group_column,
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
        "final_test_metrics": test_metrics,
        "final_test_cluster_bootstrap_95ci": cis,
        "calibration_curve": {
            "mean_predicted_probability": [float(x) for x in mean_pred],
            "fraction_positive": [float(x) for x in frac_pos],
        },
        "permutation_importance": importance_rows,
        "warnings": [
            "Model family was selected on validation data only.",
            "Final test metrics must not be used for further tuning.",
            "Permutation importance is predictive, not causal.",
            "Sample adequacy and the final split strategy require protocol-level justification.",
        ],
    }
    results_path.write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print(f"Saved model: {model_path}")
    print(f"Saved evaluation: {results_path}")


if __name__ == "__main__":
    main()
