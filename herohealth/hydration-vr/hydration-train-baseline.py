# === /herohealth/hydration-vr/hydration-train-baseline.py ===
# Hydration Baseline Training Pipeline
# PATCH v20260315-HYD-TRAIN-BASELINE

from __future__ import annotations

import argparse
import json
import math
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


NUMERIC_FEATURES = [
    "bossLevel",
    "score",
    "missBadHit",
    "missGoodExpired",
    "combo",
    "bestCombo",
    "waterPct",
    "shield",
    "blockCount",
    "timeLeft",
    "feverOn",
    "inDangerPhase",
    "inCorrectZone",
    "missRateRecent",
    "goodHitRateRecent",
    "badHitRateRecent",
    "expireRateRecent",
    "hitQualityRatio",
    "comboStability",
    "waterRecoverySlope",
    "shieldUsageEfficiency",
    "stormSurvivalQuality",
    "bossPhasePerformance",
    "fatigueProxy",
    "frustrationProxy",
]

CATEGORICAL_FEATURES = [
    "phase",
]

SUPPORTED_LABELS = [
    "assistance_needed",
    "high_miss_segment",
    "fail_soon_5s",
]

DEFAULT_LABEL = "assistance_needed"


@dataclass
class TrainConfig:
    label: str
    threshold: float
    test_size: float
    random_state: int
    max_iter: int
    class_weight: str | None


def safe_json_load(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def is_dataset_file(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() == ".json"


def discover_json_files(input_path: Path) -> List[Path]:
    if input_path.is_file():
      return [input_path]

    if input_path.is_dir():
        return sorted([p for p in input_path.rglob("*.json") if p.is_file()])

    raise FileNotFoundError(f"Input path not found: {input_path}")


def normalize_feature_rows(packet: Dict[str, Any]) -> pd.DataFrame:
    """
    รองรับ 2 รูปแบบหลัก:
    1) packet["ai"]["featureRows"] + packet["ai"]["labelRows"]
    2) packet["featureRows"] + packet["labelRows"]
    """
    ai = packet.get("ai") or {}
    feature_rows = ai.get("featureRows") or packet.get("featureRows") or []
    label_rows = ai.get("labelRows") or packet.get("labelRows") or []

    if not feature_rows:
        return pd.DataFrame()

    fdf = pd.DataFrame(feature_rows)

    if label_rows:
        ldf = pd.DataFrame(label_rows)
        if "ts" in fdf.columns and "ts" in ldf.columns:
            df = fdf.merge(ldf, on=["ts", "phase"], how="left", suffixes=("", "_label"))
        else:
            # fallback: merge by index
            ldf = ldf.add_prefix("label_")
            df = pd.concat([fdf.reset_index(drop=True), ldf.reset_index(drop=True)], axis=1)
    else:
        df = fdf.copy()

    summary = packet.get("summary") or {}
    meta = (packet.get("ai") or {}).get("sessionMeta") or {}

    df["pid"] = packet.get("pid") or meta.get("pid") or summary.get("pid") or ""
    df["seed"] = packet.get("seed") or meta.get("seed") or summary.get("seed") or ""
    df["diff"] = packet.get("diff") or meta.get("diff") or summary.get("diff") or ""
    df["runMode"] = packet.get("runMode") or meta.get("runMode") or summary.get("runMode") or ""
    df["view"] = packet.get("view") or meta.get("view") or summary.get("view") or ""
    df["game"] = packet.get("game") or meta.get("game") or "hydration"
    df["zone"] = packet.get("zone") or meta.get("zone") or "nutrition"
    df["sessionOutcome"] = summary.get("reason") or meta.get("outcome") or ""

    # fallback labels if schema merge missed
    if "assistance_needed" not in df.columns and "label_assistance_needed" in df.columns:
        df["assistance_needed"] = df["label_assistance_needed"]
    if "high_miss_segment" not in df.columns and "label_high_miss_segment" in df.columns:
        df["high_miss_segment"] = df["label_high_miss_segment"]
    if "fail_soon_5s" not in df.columns and "label_fail_soon_5s" in df.columns:
        df["fail_soon_5s"] = df["label_fail_soon_5s"]

    return df


def load_dataset(input_path: Path) -> pd.DataFrame:
    rows: List[pd.DataFrame] = []

    for file_path in discover_json_files(input_path):
        try:
            packet = safe_json_load(file_path)
        except Exception as e:
            print(f"[WARN] skip invalid json: {file_path} ({e})")
            continue

        try:
            df = normalize_feature_rows(packet)
        except Exception as e:
            print(f"[WARN] skip malformed packet: {file_path} ({e})")
            continue

        if not df.empty:
            df["source_file"] = str(file_path)
            rows.append(df)

    if not rows:
        return pd.DataFrame()

    return pd.concat(rows, axis=0, ignore_index=True)


def ensure_schema(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    for col in NUMERIC_FEATURES:
        if col not in out.columns:
            out[col] = np.nan

    for col in CATEGORICAL_FEATURES:
        if col not in out.columns:
            out[col] = ""

    for label in SUPPORTED_LABELS:
        if label not in out.columns:
            out[label] = np.nan

    out["phase"] = out["phase"].astype(str).fillna("")
    return out


def clean_binary_target(series: pd.Series) -> pd.Series:
    s = pd.to_numeric(series, errors="coerce")
    s = s.fillna(0).astype(int)
    s = s.clip(0, 1)
    return s


def build_pipeline(config: TrainConfig) -> Pipeline:
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )

    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, NUMERIC_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES),
        ]
    )

    model = LogisticRegression(
        max_iter=config.max_iter,
        class_weight=config.class_weight,
        solver="liblinear",
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("model", model),
        ]
    )


def find_best_threshold(y_true: np.ndarray, y_prob: np.ndarray) -> Tuple[float, float]:
    """
    ใช้ F1 เป็นเกณฑ์เลือก threshold เบื้องต้น
    """
    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)
    if len(thresholds) == 0:
        return 0.5, 0.0

    best_threshold = 0.5
    best_f1 = -1.0

    for thr in thresholds:
        pred = (y_prob >= thr).astype(int)
        score = f1_score(y_true, pred, zero_division=0)
        if score > best_f1:
            best_f1 = score
            best_threshold = float(thr)

    return best_threshold, float(best_f1)


def evaluate_model(
    pipe: Pipeline,
    x_test: pd.DataFrame,
    y_test: pd.Series,
    threshold: float,
) -> Dict[str, Any]:
    y_prob = pipe.predict_proba(x_test)[:, 1]
    y_pred = (y_prob >= threshold).astype(int)

    result: Dict[str, Any] = {
        "threshold": threshold,
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "classification_report": classification_report(
            y_test, y_pred, output_dict=True, zero_division=0
        ),
    }

    try:
        result["roc_auc"] = float(roc_auc_score(y_test, y_prob))
    except Exception:
        result["roc_auc"] = None

    return result


def feature_importance_from_logreg(pipe: Pipeline) -> List[Dict[str, Any]]:
    """
    สำหรับ LogisticRegression + ColumnTransformer
    """
    pre = pipe.named_steps["preprocessor"]
    model = pipe.named_steps["model"]

    try:
        feature_names = pre.get_feature_names_out()
        coef = model.coef_[0]
    except Exception:
        return []

    pairs = []
    for name, weight in zip(feature_names, coef):
        pairs.append({
            "feature": str(name),
            "weight": float(weight),
            "abs_weight": float(abs(weight)),
        })

    pairs.sort(key=lambda x: x["abs_weight"], reverse=True)
    return pairs


def train_one_label(df: pd.DataFrame, config: TrainConfig, out_dir: Path) -> Dict[str, Any]:
    if config.label not in df.columns:
        raise ValueError(f"Label not found in dataset: {config.label}")

    data = df.copy()
    data = ensure_schema(data)
    data = data.dropna(subset=[config.label]).copy()

    if data.empty:
        raise ValueError("Dataset empty after dropping missing labels")

    data[config.label] = clean_binary_target(data[config.label])

    if data[config.label].nunique() < 2:
        raise ValueError(f"Label has only one class: {config.label}")

    x = data[NUMERIC_FEATURES + CATEGORICAL_FEATURES].copy()
    y = data[config.label].copy()

    x_train, x_test, y_train, y_test = train_test_split(
        x,
        y,
        test_size=config.test_size,
        random_state=config.random_state,
        stratify=y,
    )

    pipe = build_pipeline(config)
    pipe.fit(x_train, y_train)

    y_prob_valid = pipe.predict_proba(x_test)[:, 1]
    best_thr, best_f1 = find_best_threshold(y_test.to_numpy(), y_prob_valid)

    chosen_threshold = config.threshold if config.threshold >= 0 else best_thr
    metrics = evaluate_model(pipe, x_test, y_test, chosen_threshold)
    metrics["best_f1_from_search"] = best_f1
    metrics["best_threshold_from_search"] = best_thr

    importance = feature_importance_from_logreg(pipe)

    model_path = out_dir / f"{config.label}.joblib"
    report_path = out_dir / f"{config.label}.report.json"
    preview_csv = out_dir / f"{config.label}.preview.csv"

    joblib.dump(pipe, model_path)

    preview = x_test.copy()
    preview["y_true"] = y_test.values
    preview["y_prob"] = y_prob_valid
    preview["y_pred"] = (y_prob_valid >= chosen_threshold).astype(int)
    preview.head(500).to_csv(preview_csv, index=False)

    report = {
        "task": config.label,
        "config": asdict(config),
        "n_rows": int(len(data)),
        "class_balance": data[config.label].value_counts(dropna=False).to_dict(),
        "metrics": metrics,
        "top_feature_weights": importance[:30],
        "model_path": str(model_path),
        "preview_csv": str(preview_csv),
    }

    with report_path.open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    return report


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Train baseline Hydration model")
    p.add_argument("--input", required=True, help="JSON file or folder of exported packets")
    p.add_argument("--output", required=True, help="Output directory for models/reports")
    p.add_argument(
        "--label",
        default=DEFAULT_LABEL,
        choices=SUPPORTED_LABELS + ["all"],
        help="Target label to train",
    )
    p.add_argument(
        "--threshold",
        type=float,
        default=-1.0,
        help="Decision threshold. Use negative value to auto-search by F1",
    )
    p.add_argument("--test-size", type=float, default=0.25)
    p.add_argument("--random-state", type=int, default=42)
    p.add_argument("--max-iter", type=int, default=400)
    p.add_argument(
        "--class-weight",
        default="balanced",
        choices=["balanced", "none"],
        help="Class weight strategy",
    )
    return p


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    out_dir = Path(args.output).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    df = load_dataset(input_path)

    if df.empty:
        raise SystemExit("No usable rows found in dataset")

    class_weight = None if args.class_weight == "none" else args.class_weight

    labels = SUPPORTED_LABELS if args.label == "all" else [args.label]

    summary = {
        "input": str(input_path),
        "output": str(out_dir),
        "rows_loaded": int(len(df)),
        "labels_requested": labels,
        "reports": [],
    }

    for label in labels:
        print(f"[INFO] training label = {label}")

        config = TrainConfig(
            label=label,
            threshold=args.threshold,
            test_size=args.test_size,
            random_state=args.random_state,
            max_iter=args.max_iter,
            class_weight=class_weight,
        )

        try:
            report = train_one_label(df, config, out_dir)
            summary["reports"].append(report)
            print(f"[OK] finished {label}")
            print(f"     F1={report['metrics']['f1']:.4f}  ACC={report['metrics']['accuracy']:.4f}")
            if report["metrics"].get("roc_auc") is not None:
                print(f"     AUC={report['metrics']['roc_auc']:.4f}")
            print(f"     threshold={report['metrics']['threshold']:.4f}")
        except Exception as e:
            fail = {
                "task": label,
                "error": str(e),
            }
            summary["reports"].append(fail)
            print(f"[FAIL] {label}: {e}")

    summary_path = out_dir / "train-summary.json"
    with summary_path.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\n[INFO] summary saved to: {summary_path}")


if __name__ == "__main__":
    main()