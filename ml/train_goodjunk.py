# === /webxr-health-mobile/ml/train_goodjunk_dl.py ===
# Baseline trainer from seq dataset -> exports thresholds model.json for web predictor

import json
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score

ROOT = Path(__file__).resolve().parent
ART  = ROOT / "artifacts"

def main():
    ds = np.load(ART / "goodjunk_seq_dataset.npz", allow_pickle=True)
    X = ds["X"]      # (N, W, F)
    y = ds["y_risk"] # (N,)

    if X.shape[0] < 50:
        raise SystemExit("Need more samples. Play more sessions or export more events.")

    # summarize sequence -> fixed vector: mean, max of rt + mean good/junk flags
    x_mean = X.mean(axis=1)
    x_max  = X.max(axis=1)
    feats = np.concatenate([x_mean, x_max], axis=1)

    Xtr, Xte, ytr, yte = train_test_split(feats, y, test_size=0.2, random_state=42, stratify=y)

    clf = LogisticRegression(max_iter=200)
    clf.fit(Xtr, ytr)
    p = clf.predict_proba(Xte)[:,1]
    auc = roc_auc_score(yte, p)
    print("AUC:", auc)

    # export a simple JSON model for web (thresholds-based wrapper)
    # Here we convert classifier into "risk score" only; web uses hint mapping.
    model = {
        "type": "logreg_seq_v1",
        "feat": "mean+max over window",
        "coef": clf.coef_.tolist(),
        "intercept": clf.intercept_.tolist(),
        "note": "Use server-side for full prob; web can still use heuristic hints."
    }
    (ART / "goodjunk_model.json").write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding="utf-8")
    print("OK ->", ART / "goodjunk_model.json")

if __name__ == "__main__":
    main()
