# === /herohealth/hydration-vr/hydration-compare-models.py ===
# Hydration Model Comparison
# PATCH v20260315-HYD-COMPARE-MODELS

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
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier


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

CATEGORICAL_FEATURES = ["phase"]

SUPPORTED_LABELS = [
    "assistance_needed",
    "high_miss_segment",
    "fail_soon_5s",
]


@dataclass
class CompareConfig:
    label: str
    val_size: float
    test_size: float
    random_state: int
    threshold_mode: str
    fixed_threshold: float
    class_weight: str | None


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
    df["sessionOutcome"] = summary.get("reason") or meta.get("outcome") or ""
    df["sessionKey"] = (
        df["pid"].astype(str) + "|" +
        df["seed"].astype(str) + "|" +
        df["diff"].astype(str) + "|" +
        df["runMode"].astype(str)
    )

    for label in SUPPORTED_LABELS:
        label_key = f"label_{label}"
        if label not in df.columns and label_key in df.columns:
            df[label] = df[label_key]

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
    for col in SUPPORTED_LABELS:
        if col not in out.columns:
            out[col] = np.nan
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

    out: Dict[str, Any] = {
        "threshold": float(threshold),
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        "classification_report": classification_report(
            y_true, y_pred, output_dict=True, zero_division=0
        ),
    }
    try:
        out["roc_auc"] = float(roc_auc_score(y_true, y_prob))
    except Exception:
        out["roc_auc"] = None
    return out


def build_preprocessor() -> ColumnTransformer:
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

    return ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, NUMERIC_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES),
        ]
    )


def build_models(class_weight: str | None) -> Dict[str, Any]:
    return {
        "logreg": LogisticRegression(
            max_iter=400,
            class_weight=class_weight,
            solver="liblinear",
        ),
        "tree": DecisionTreeClassifier(
            max_depth=6,
            min_samples_leaf=20,
            random_state=42,
            class_weight=class_weight,
        ),
        "rf": RandomForestClassifier(
            n_estimators=160,
            max_depth=8,
            min_samples_leaf=10,
            random_state=42,
            class_weight=class_weight,
            n_jobs=-1,
        ),
        "gb": GradientBoostingClassifier(
            random_state=42,
            n_estimators=120,
            learning_rate=0.08,
            max_depth=3,
        ),
    }


def supports_predict_proba(pipe: Pipeline) -> bool:
    return hasattr(pipe.named_steps["model"], "predict_proba")


def fit_and_score_model(
    model_name: str,
    estimator: Any,
    x_train: pd.DataFrame,
    y_train: pd.Series,
    x_val: pd.DataFrame,
    y_val: pd.Series,
    x_test: pd.DataFrame,
    y_test: pd.Series,
    threshold_mode: str,
    fixed_threshold: float,
) -> Dict[str, Any]:
    pipe = Pipeline(
        steps=[
            ("preprocessor", build_preprocessor()),
            ("model", estimator),
        ]
    )
    pipe.fit(x_train, y_train)

    if not supports_predict_proba(pipe):
        raise ValueError(f"Model does not support predict_proba: {model_name}")

    val_prob = pipe.predict_proba(x_val)[:, 1]
    if threshold_mode == "fixed":
        threshold = float(fixed_threshold)
        best_thr = None
        best_f1 = None
    else:
        best_thr, best_f1 = find_best_threshold(y_val.to_numpy(), val_prob)
        threshold = best_thr

    test_prob = pipe.predict_proba(x_test)[:, 1]
    val_metrics = evaluate_predictions(y_val.to_numpy(), val_prob, threshold)
    test_metrics = evaluate_predictions(y_test.to_numpy(), test_prob, threshold)

    preview = x_test.copy()
    preview["y_true"] = y_test.values
    preview["y_prob"] = test_prob
    preview["y_pred"] = (test_prob >= threshold).astype(int)

    return {
        "model_name": model_name,
        "pipeline": pipe,
        "threshold": float(threshold),
        "threshold_best_f1_val": best_f1,
        "threshold_best_val": best_thr,
        "val_metrics": val_metrics,
        "test_metrics": test_metrics,
        "preview": preview,
    }


def run_compare(
    df: pd.DataFrame,
    label: str,
    config: CompareConfig,
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

    results = []
    models = build_models(config.class_weight)

    best_name = None
    best_f1 = -1.0
    best_pipe = None

    for model_name, estimator in models.items():
        try:
            result = fit_and_score_model(
                model_name=model_name,
                estimator=estimator,
                x_train=x_train,
                y_train=y_train,
                x_val=x_val,
                y_val=y_val,
                x_test=x_test,
                y_test=y_test,
                threshold_mode=config.threshold_mode,
                fixed_threshold=config.fixed_threshold,
            )

            preview_csv = out_dir / f"{label}.{model_name}.predictions.csv"
            result["preview"].to_csv(preview_csv, index=False)

            row = {
                "model_name": model_name,
                "threshold": result["threshold"],
                "threshold_best_f1_val": result["threshold_best_f1_val"],
                "threshold_best_val": result["threshold_best_val"],
                "val_metrics": result["val_metrics"],
                "test_metrics": result["test_metrics"],
                "preview_csv": str(preview_csv),
            }
            results.append(row)

            score = result["test_metrics"]["f1"]
            if score > best_f1:
                best_f1 = score
                best_name = model_name
                best_pipe = result["pipeline"]

        except Exception as e:
            results.append({
                "model_name": model_name,
                "error": str(e),
            })

    if best_pipe is not None:
        import joblib
        best_model_path = out_dir / f"{label}.best-model.joblib"
        joblib.dump(best_pipe, best_model_path)
    else:
        best_model_path = None

    results_sorted = sorted(
        results,
        key=lambda r: r.get("test_metrics", {}).get("f1", -1),
        reverse=True,
    )

    report = {
        "label": label,
        "config": asdict(config),
        "rows_total": int(len(data)),
        "pid_unique_total": int(data["pid"].nunique()),
        "rows_train": int(len(x_train)),
        "rows_val": int(len(x_val)),
        "rows_test": int(len(x_test)),
        "class_balance": data[label].value_counts(dropna=False).to_dict(),
        "models": results_sorted,
        "best_model_name": best_name,
        "best_model_path": str(best_model_path) if best_model_path else None,
    }

    report_json = out_dir / f"{label}.compare-report.json"
    with report_json.open("w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    table_rows = []
    for r in results_sorted:
        if "test_metrics" not in r:
            table_rows.append({
                "label": label,
                "model_name": r["model_name"],
                "status": "fail",
                "error": r.get("error", ""),
            })
            continue

        table_rows.append({
            "label": label,
            "model_name": r["model_name"],
            "status": "ok",
            "threshold": r["threshold"],
            "f1_val": r["val_metrics"]["f1"],
            "acc_val": r["val_metrics"]["accuracy"],
            "auc_val": r["val_metrics"].get("roc_auc"),
            "f1_test": r["test_metrics"]["f1"],
            "acc_test": r["test_metrics"]["accuracy"],
            "auc_test": r["test_metrics"].get("roc_auc"),
        })

    pd.DataFrame(table_rows).to_csv(out_dir / f"{label}.compare-summary.csv", index=False)
    return report


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Compare multiple baseline models for Hydration")
    p.add_argument("--input", required=True, help="JSON file or folder of exported packets")
    p.add_argument("--output", required=True, help="Output directory")
    p.add_argument("--label", default="assistance_needed", choices=SUPPORTED_LABELS)
    p.add_argument("--val-size", type=float, default=0.25)
    p.add_argument("--test-size", type=float, default=0.25)
    p.add_argument("--random-state", type=int, default=42)
    p.add_argument("--threshold-mode", default="search", choices=["search", "fixed"])
    p.add_argument("--fixed-threshold", type=float, default=0.5)
    p.add_argument("--class-weight", default="balanced", choices=["balanced", "none"])
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

    config = CompareConfig(
        label=args.label,
        val_size=args.val_size,
        test_size=args.test_size,
        random_state=args.random_state,
        threshold_mode=args.threshold_mode,
        fixed_threshold=args.fixed_threshold,
        class_weight=None if args.class_weight == "none" else args.class_weight,
    )

    report = run_compare(df, args.label, config, out_dir)

    print(f"[INFO] compare done for label={args.label}")
    print(f"[INFO] best model = {report['best_model_name']}")
    print(f"[INFO] output dir = {out_dir}")


if __name__ == "__main__":
    main()