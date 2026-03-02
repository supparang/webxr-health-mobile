# === /webxr-health-mobile/herohealth/ml/train_goodjunk.py ===
# Train baseline risk model from goodjunk dataset CSV
# v20260302-TRAIN
import json
import argparse
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, classification_report

FEATURES = [
    "miss","hitJunk","accPct","medianRtGoodMs","combo","feverPct","timeLeftSec","bossOn"
]
LABEL = "y_errorSoon"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, help="Path to goodjunk-dataset.csv")
    ap.add_argument("--out", default="goodjunk_weights.json", help="Output weights json")
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    df = df.dropna(subset=FEATURES + [LABEL]).copy()

    X = df[FEATURES].astype(float).values
    y = df[LABEL].astype(int).values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    clf = LogisticRegression(max_iter=200)
    clf.fit(X_train_s, y_train)

    p = clf.predict_proba(X_test_s)[:,1]
    auc = roc_auc_score(y_test, p)
    print("AUC:", auc)
    print(classification_report(y_test, (p>=0.5).astype(int)))

    # Export weights in a friendly json
    w = clf.coef_[0].tolist()
    b = float(clf.intercept_[0])

    payload = {
        "schema": "goodjunk-weights-v1",
        "features": FEATURES,
        "bias": b,
        "weights": w,
        "scaler": {
            "mean": scaler.mean_.tolist(),
            "scale": scaler.scale_.tolist()
        },
        "metrics": {"auc": float(auc)},
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print("Saved:", args.out)

if __name__ == "__main__":
    main()