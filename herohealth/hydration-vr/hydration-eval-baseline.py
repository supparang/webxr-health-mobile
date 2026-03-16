# === /herohealth/hydration-vr/hydration-eval-baseline.py ===
# Hydration Baseline Evaluation Pipeline
# PATCH v20260315-HYD-EVAL-BASELINE

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

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
from sklearn.model_selection import GroupShuffleSplit
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


@dataclass
class EvalConfig:
    labels: List[str]
    val_size: float
    test_size: float
    random_state: int
    max_iter: int
    class_weight: str | None
    threshold_mode: str  # fixed | search
    fixed_threshold: float


def safe_json_load(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def discover_json_files(input_path: Path) -> List[Path]:
    if input_path.is_file():
        return [input_path]
    if input_path.is_dir():
        return sorted([p for p in input_path.rglob("*.json") if p.is_file()])
    raise FileNotFoundError(f"Input path not found: {input_path}")


def normalize_feature_rows(packet: Dict[str, Any]) -> pd.DataFrame:
    ai = packet.get("ai") or {}
    feature_rows = ai.get("featureRows") or packet.get("featureRows") or []
    label_rows = ai.get("labelRows") or packet.get("labelRows") or []

    if not feature_rows:
        return pd.DataFrame()

    fdf = pd.DataFrame(feature_rows)

    if label_rows:
        ldf = pd.DataFrame(label_rows)
        if "ts" in fdf.columns and "ts" in ldf.columns and "phase" in fdf.columns and "phase" in ldf.columns:
            df = fdf.merge(ldf, on=["ts", "phase"], how="left", suffixes=("", "_label"))
        else:
            ldf = ldf.add_prefix("label_")
            df = pd.concat([fdf.reset_index(drop=True), ldf.reset_index(drop=True)], axis=1)
    else:
        df = fdf.copy()

    summary = packet.get("summary") or {}
    meta = ai.get("sessionMeta") or {}

    df["pid"] = packet.get("pid") or meta.get("pid") or summary.get("pid") or ""
    df["seed"] = packet.get("seed") or meta.get("seed") or summary.get("seed") or ""
    df["diff"] = packet.get("diff") or meta.get("diff") or summary.get("diff") or ""
    df["runMode"] = packet.get("runMode") or meta.get("runMode") or summary.get("runMode") or ""
    df["view"] = packet.get("view") or meta.get("view") or summary.get("view") or ""
    df["game"] = packet.get("game") or meta.get("game") or "hydration"
    df["zone"] = packet.get("zone") or meta.get("zone") or "nutrition"
    df["sessionOutcome"] = summary.get("reason") or meta.get("outcome") or ""
    df["sessionKey"] = (
        df["pid"].astype(str) + "|" +
        df["seed"].astype(str) + "|" +
        df["diff"].astype(str) + "|" +
        df["runMode"].astype(str)
    )

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
            df = normalize_feature_rows(packet)
            if not df.empty:
                df["source_file"] = str(file_path)
                rows.append(df)
        except Exception as e:
            print(f"[WARN] skip {file_path}: {e}")

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

    if "pid" not in out.columns:
        out["pid"] = ""
    if "sessionKey" not in out.columns:
        out["sessionKey"] = ""

    out["phase"] = out["phase"].astype(str).fillna("")
    out["pid"] = out["pid"].astype(str).fillna("")
    out["sessionKey"] = out["sessionKey"].astype(str).fillna("")
    return out


def clean_binary_target(series: pd.Series) -> pd.Series:
    s = pd.to_numeric(series, errors="coerce").fillna(0).astype(int)
    return s.clip(0, 1)


def build_pipeline(config: EvalConfig) -> Pipeline:
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


def grouped_split(
    x: pd.DataFrame,
    y: pd.Series,
    groups: pd.Series,
    test_size: float,
    random_state: int,
) -> Tuple[np.ndarray, np.ndarray]:
    gss = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    train_idx, test_idx = next(gss.split(x, y, groups=groups))
    return train_idx, test_idx


def find_best_threshold(y_true: np.ndarray, y_prob: np.ndarray) -> Tuple[float, float]:
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


def evaluate_predictions(y_true: np.ndarray, y_prob: np.ndarray, threshold: float) -> Dict[str, Any]:
    y_pred = (y_prob >= threshold).astype(int)

    result: Dict[str, Any] = {
        "threshold": float(threshold),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        "classification_report": classification_report(
            y_true, y_pred, output_dict=True, zero_division=0
        ),
    }

    try:
        result["roc_auc"] = float(roc_auc_score(y_true, y_prob))
    except Exception:
        result["roc_auc"] = None

    return result


def feature_importance_from_logreg(pipe: Pipeline) -> List[Dict[str, Any]]:
    try:
        pre = pipe.named_steps["preprocessor"]
        model = pipe.named_steps["model"]
        feature_names = pre.get_feature_names_out()
        coef = model.coef_[0]
    except Exception:
        return []

    rows = []
    for name, weight in zip(feature_names, coef):
        rows.append({
            "feature": str(name),
            "weight": float(weight),
            "abs_weight": float(abs(weight)),
        })
    rows.sort(key=lambda x: x["abs_weight"], reverse=True)
    return rows


def run_eval_for_label(
    df: pd.DataFrame,
    label: str,
    config: EvalConfig,
    out_dir: Path,
) -> Dict[str, Any]:
    if label not in df.columns:
        raise ValueError(f"Label not found: {label}")

    data = ensure_schema(df).copy()
    data = data.dropna(subset=[label]).copy()

    if data.empty:
        raise ValueError("No rows left after dropping missing labels")

    data[label] = clean_binary_target(data[label])

    if data[label].nunique() < 2:
        raise ValueError(f"Label has only one class: {label}")

    x = data[NUMERIC_FEATURES + CATEGORICAL_FEATURES].copy()
    y = data[label].copy()
    groups = data["pid"].replace("", np.nan).fillna(data["sessionKey"])

    trainval_idx, test_idx = grouped_split(
        x=x,
        y=y,
        groups=groups,
        test_size=config.test_size,
        random_state=config.random_state,
    )

    x_trainval = x.iloc[trainval_idx].reset_index(drop=True)
    y_trainval = y.iloc[trainval_idx].reset_index(drop=True)
    g_trainval = groups.iloc[trainval_idx].reset_index(drop=True)

    x_test = x.iloc[test_idx].reset_index(drop=True)
    y_test = y.iloc[test_idx].reset_index(drop=True)

    train_idx, val_idx = grouped_split(
        x=x_trainval,
        y=y_trainval,
        groups=g_trainval,
        test_size=config.val_size,
        random_state=config.random_state + 1,
    )

    x_train = x_trainval.iloc[train_idx].reset_index(drop=True)
    y_train = y_trainval.iloc[train_idx].reset_index(drop=True)

    x_val = x_trainval.iloc[val_idx].reset_index(drop=True)
    y_val = y_trainval.iloc[val_idx].reset_index(drop=True)

    pipe = build_pipeline(config)
    pipe.fit(x_train, y_train)

    val_prob = pipe.predict_proba(x_val)[:, 1]
    if config.threshold_mode == "fixed":
      threshold = float(config.fixed_threshold)
      best_f1 = None
      best_thr = None
    else:
      best_thr, best_f1 = find_best_threshold(y_val.to_numpy(), val_prob)
      threshold = best_thr

    test_prob = pipe.predict_proba(x_test)[:, 1]
    test_metrics = evaluate_predictions(y_test.to_numpy(), test_prob, threshold)

    val_metrics = evaluate_predictions(y_val.to_numpy(), val_prob, threshold)

    importance = feature_importance_from_logreg(pipe)

    pred_df = x_test.copy()
    pred_df["y_true"] = y_test.values
    pred_df["y_prob"] = test_prob
    pred_df["y_pred"] = (test_prob >= threshold).astype(int)

    pred_csv = out_dir / f"{label}.grouped_eval_predictions.csv"
    pred_df.to_csv(pred_csv, index=False)

    report = {
        "task": label,
        "label": label,
        "config": asdict(config),
        "rows_total": int(len(data)),
        "rows_train": int(len(x_train)),
        "rows_val": int(len(x_val)),
        "rows_test": int(len(x_test)),
        "pid_unique_total": int(data["pid"].nunique()),
        "pid_unique_train": int(data.iloc[trainval_idx].iloc[train_idx]["pid"].nunique()),
        "pid_unique_val": int(data.iloc[trainval_idx].iloc[val_idx]["pid"].nunique()),
        "pid_unique_test": int(data.iloc[test_idx]["pid"].nunique()),
        "class_balance": data[label].value_counts(dropna=False).to_dict(),
        "threshold_selected": float(threshold),
        "threshold_search_best_f1": best_f1,
        "threshold_search_best_threshold": best_thr,
        "validation_metrics": val_metrics,
        "test_metrics": test_metrics,
        "top_feature_weights": importance[:30],
        "prediction_csv": str(pred_csv),
    }

    report_path = out_dir / f"{label}.grouped_eval_report.json"
    with report_path.open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    return report


def build_summary_table(reports: List[Dict[str, Any]]) -> pd.DataFrame:
    rows = []
    for r in reports:
        if "test_metrics" not in r:
            rows.append({
                "label": r.get("task", ""),
                "status": "fail",
                "error": r.get("error", ""),
            })
            continue

        tm = r["test_metrics"]
        rows.append({
            "label": r["label"],
            "status": "ok",
            "threshold": r["threshold_selected"],
            "rows_total": r["rows_total"],
            "rows_train": r["rows_train"],
            "rows_val": r["rows_val"],
            "rows_test": r["rows_test"],
            "pid_unique_total": r["pid_unique_total"],
            "pid_unique_test": r["pid_unique_test"],
            "accuracy_test": tm["accuracy"],
            "f1_test": tm["f1"],
            "roc_auc_test": tm.get("roc_auc"),
        })
    return pd.DataFrame(rows)


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Evaluate baseline Hydration model with grouped split")
    p.add_argument("--input", required=True, help="JSON file or folder of exported packets")
    p.add_argument("--output", required=True, help="Output directory")
    p.add_argument(
        "--label",
        default="all",
        choices=SUPPORTED_LABELS + ["all"],
        help="Target label to evaluate",
    )
    p.add_argument("--val-size", type=float, default=0.25)
    p.add_argument("--test-size", type=float, default=0.25)
    p.add_argument("--random-state", type=int, default=42)
    p.add_argument("--max-iter", type=int, default=400)
    p.add_argument(
        "--class-weight",
        default="balanced",
        choices=["balanced", "none"],
        help="Class weight strategy",
    )
    p.add_argument(
        "--threshold-mode",
        default="search",
        choices=["search", "fixed"],
        help="Use searched threshold from validation or fixed threshold",
    )
    p.add_argument(
        "--fixed-threshold",
        type=float,
        default=0.5,
        help="Used when --threshold-mode fixed",
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

    config = EvalConfig(
        labels=labels,
        val_size=args.val_size,
        test_size=args.test_size,
        random_state=args.random_state,
        max_iter=args.max_iter,
        class_weight=class_weight,
        threshold_mode=args.threshold_mode,
        fixed_threshold=args.fixed_threshold,
    )

    reports: List[Dict[str, Any]] = []
    for label in labels:
        print(f"[INFO] evaluating label = {label}")
        try:
            report = run_eval_for_label(df, label, config, out_dir)
            reports.append(report)
            print(
                f"[OK] {label} | F1(test)={report['test_metrics']['f1']:.4f} "
                f"| ACC(test)={report['test_metrics']['accuracy']:.4f} "
                f"| THR={report['threshold_selected']:.4f}"
            )
        except Exception as e:
            fail = {"task": label, "error": str(e)}
            reports.append(fail)
            print(f"[FAIL] {label}: {e}")

    summary = {
        "input": str(input_path),
        "output": str(out_dir),
        "rows_loaded": int(len(df)),
        "config": asdict(config),
        "reports": reports,
    }

    summary_json = out_dir / "grouped-eval-summary.json"
    with summary_json.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    summary_table = build_summary_table(reports)
    summary_csv = out_dir / "grouped-eval-summary.csv"
    summary_table.to_csv(summary_csv, index=False)

    print(f"\n[INFO] grouped evaluation saved to:")
    print(f"  - {summary_json}")
    print(f"  - {summary_csv}")


if __name__ == "__main__":
    main()