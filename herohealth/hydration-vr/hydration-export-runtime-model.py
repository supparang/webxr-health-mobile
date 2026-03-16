# === /herohealth/hydration-vr/hydration-export-runtime-model.py ===
# Export sklearn logistic regression pipeline to Hydration runtime JSON
# PATCH v20260315-HYD-EXPORT-RUNTIME-MODEL

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np


def load_model(path: Path):
    return joblib.load(path)


def safe_float(v: Any, default: float = 0.0) -> float:
    try:
        out = float(v)
        if np.isnan(out) or np.isinf(out):
            return default
        return out
    except Exception:
        return default


def extract_pipeline_parts(pipe):
    if not hasattr(pipe, "named_steps"):
        raise ValueError("Expected sklearn Pipeline with named_steps")

    if "preprocessor" not in pipe.named_steps:
        raise ValueError("Pipeline missing 'preprocessor' step")

    if "model" not in pipe.named_steps:
        raise ValueError("Pipeline missing 'model' step")

    pre = pipe.named_steps["preprocessor"]
    model = pipe.named_steps["model"]
    return pre, model


def ensure_logistic_model(model):
    cls_name = model.__class__.__name__.lower()
    if "logisticregression" not in cls_name:
        raise ValueError(
            f"Only LogisticRegression export supported for now, got: {model.__class__.__name__}"
        )

    if not hasattr(model, "coef_") or not hasattr(model, "intercept_"):
        raise ValueError("Model missing coef_ / intercept_")


def get_feature_names(preprocessor) -> List[str]:
    if hasattr(preprocessor, "get_feature_names_out"):
        return list(preprocessor.get_feature_names_out())
    raise ValueError("Preprocessor does not support get_feature_names_out()")


def split_runtime_weights(feature_names: List[str], coef: np.ndarray) -> Tuple[Dict[str, float], Dict[str, float]]:
    """
    แปลงชื่อ feature ของ ColumnTransformer/OneHotEncoder เป็น runtime format

    ตัวอย่างชื่อจาก sklearn:
      num__waterPct
      num__missRateRecent
      cat__phase_storm
      cat__phase_boss1

    export เป็น:
      numericWeights: { waterPct: ..., missRateRecent: ... }
      categoricalWeights: { "phase=storm": ..., "phase=boss1": ... }
    """
    numeric_weights: Dict[str, float] = {}
    categorical_weights: Dict[str, float] = {}

    for raw_name, raw_weight in zip(feature_names, coef):
        name = str(raw_name)
        weight = safe_float(raw_weight)

        if name.startswith("num__"):
            key = name.replace("num__", "", 1)
            numeric_weights[key] = weight
            continue

        if name.startswith("cat__"):
            # expected pattern after onehot like: cat__phase_storm
            body = name.replace("cat__", "", 1)

            # split only first underscore => field, value
            if "_" in body:
                field, value = body.split("_", 1)
                categorical_weights[f"{field}={value}"] = weight
            else:
                categorical_weights[body] = weight
            continue

        # fallback: try to keep as numeric if simple
        numeric_weights[name] = weight

    return numeric_weights, categorical_weights


def build_model_spec(
    pipe,
    label: str,
    version: str,
    threshold: float,
    source_report_path: str = "",
) -> Dict[str, Any]:
    pre, model = extract_pipeline_parts(pipe)
    ensure_logistic_model(model)

    feature_names = get_feature_names(pre)
    coef = np.asarray(model.coef_[0], dtype=float)
    intercept = safe_float(model.intercept_[0] if np.ndim(model.intercept_) else model.intercept_)

    if len(feature_names) != len(coef):
        raise ValueError(
            f"Feature names length {len(feature_names)} != coef length {len(coef)}"
        )

    numeric_weights, categorical_weights = split_runtime_weights(feature_names, coef)

    spec = {
        "version": version,
        "label": label,
        "intercept": intercept,
        "threshold": threshold,
        "numericWeights": numeric_weights,
        "categoricalWeights": categorical_weights,
        "meta": {
            "exporter": "hydration-export-runtime-model.py",
            "sourceReport": source_report_path,
            "nNumericWeights": len(numeric_weights),
            "nCategoricalWeights": len(categorical_weights),
            "featureCount": len(feature_names),
        },
    }
    return spec


def infer_label_from_model_path(model_path: Path) -> str:
    name = model_path.stem.lower()
    for candidate in ["assistance_needed", "high_miss_segment", "fail_soon_5s"]:
        if candidate in name:
            return candidate
    return "assistance_needed"


def load_threshold_from_report(report_path: Path | None, fallback: float = 0.5) -> float:
    if report_path is None or not report_path.exists():
        return fallback

    try:
        with report_path.open("r", encoding="utf-8") as f:
            report = json.load(f)
    except Exception:
        return fallback

    if "threshold_selected" in report:
        return safe_float(report["threshold_selected"], fallback)

    if "metrics" in report and isinstance(report["metrics"], dict):
        if "threshold" in report["metrics"]:
            return safe_float(report["metrics"]["threshold"], fallback)

    return fallback


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Export sklearn logistic model to Hydration runtime JSON")
    p.add_argument("--model", required=True, help="Path to .joblib sklearn pipeline")
    p.add_argument("--output", required=True, help="Path to output modelSpec.json")
    p.add_argument("--label", default="", help="Label name override")
    p.add_argument("--version", default="hyd-runtime-logreg-v1", help="Runtime model version")
    p.add_argument("--threshold", type=float, default=-1.0, help="Override threshold. If < 0, try report/fallback")
    p.add_argument("--report", default="", help="Optional report JSON to read threshold_selected from")
    return p


def main() -> None:
    parser = build_arg_parser()
    args = parser.parse_args()

    model_path = Path(args.model).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    report_path = Path(args.report).expanduser().resolve() if args.report else None

    if not model_path.exists():
        raise SystemExit(f"Model file not found: {model_path}")

    label = args.label.strip() or infer_label_from_model_path(model_path)
    threshold = (
        safe_float(args.threshold)
        if args.threshold >= 0
        else load_threshold_from_report(report_path, fallback=0.5)
    )

    pipe = load_model(model_path)
    spec = build_model_spec(
        pipe=pipe,
        label=label,
        version=args.version,
        threshold=threshold,
        source_report_path=str(report_path) if report_path else "",
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8") as f:
        json.dump(spec, f, ensure_ascii=False, indent=2)

    print("[INFO] runtime model exported")
    print(f"  model   : {model_path}")
    print(f"  output  : {output_path}")
    print(f"  label   : {label}")
    print(f"  version : {args.version}")
    print(f"  thr     : {threshold:.4f}")
    print(f"  numeric : {len(spec['numericWeights'])}")
    print(f"  cat     : {len(spec['categoricalWeights'])}")


if __name__ == "__main__":
    main()