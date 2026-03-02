# === /webxr-health-mobile/ml/train_goodjunk.py ===
# GoodJunk ML Trainer — PRODUCTION STARTER (logistic regression risk model)
# FULL v20260302-TRAIN-GOODJUNK
import json, math, os, sys, csv
from collections import defaultdict

def sigmoid(z: float) -> float:
    if z > 18: return 1.0
    if z < -18: return 0.0
    return 1.0 / (1.0 + math.exp(-z))

def clamp(x,a,b): return a if x<a else (b if x>b else x)

FEATURES = [
    "missRate","junkRate","rtMedSec","comboNorm","timeLeftNorm","feverNorm","shieldNorm","diffHard","diffEasy"
]

def safe_float(v, default=0.0):
    try:
        if v is None: return default
        s = str(v).strip()
        if s == "": return default
        return float(s)
    except:
        return default

def read_csv(path):
    rows = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append(r)
    return rows

def featurize_session(r):
    # Works with your hha-cloud-logger sessions (fields may differ)
    shots = max(0.0, safe_float(r.get("shots", r.get("nShots", 0)), 0.0))
    miss  = max(0.0, safe_float(r.get("miss", r.get("misses", 0)), 0.0))
    hitJunk = max(0.0, safe_float(r.get("hitsJunk", r.get("nHitJunk", 0)), 0.0))
    combo = max(0.0, safe_float(r.get("combo_max", r.get("comboMax", 0)), 0.0))

    timeLeftSec = max(0.0, safe_float(r.get("timeLeftSec", 0), 0.0))
    timeAllSec  = max(1.0, safe_float(r.get("session_time_sec_setting", r.get("durationPlannedSec", 80)), 80.0))

    rtMedMs = safe_float(r.get("medianRtGoodMs", r.get("rtMedMs", 0)), 0.0)
    feverPct = clamp(safe_float(r.get("feverEndPct", r.get("feverPct", 0)), 0.0), 0.0, 100.0)
    shield = clamp(safe_float(r.get("shieldEnd", r.get("shield", 0)), 0.0), 0.0, 3.0)

    missRate = (miss / shots) if shots > 0 else 0.0
    junkRate = (hitJunk / shots) if shots > 0 else 0.0

    rtMedSec = (rtMedMs/1000.0) if rtMedMs > 0 else 1.2
    comboNorm = min(1.0, combo / 25.0)

    timeLeftNorm = min(1.0, timeLeftSec / timeAllSec) if timeAllSec > 0 else 0.0
    feverNorm = feverPct / 100.0
    shieldNorm = shield / 3.0

    diff = str(r.get("difficulty", r.get("diff",""))).lower()
    diffHard = 1.0 if diff == "hard" else 0.0
    diffEasy = 1.0 if diff == "easy" else 0.0

    x = {
        "missRate": missRate,
        "junkRate": junkRate,
        "rtMedSec": rtMedSec,
        "comboNorm": comboNorm,
        "timeLeftNorm": timeLeftNorm,
        "feverNorm": feverNorm,
        "shieldNorm": shieldNorm,
        "diffHard": diffHard,
        "diffEasy": diffEasy
    }
    return x

def label_from_session(r):
    # Define "risk event" label:
    # 1 if high miss OR low score OR quit early (adjust later)
    miss = safe_float(r.get("miss", r.get("misses", 0)), 0.0)
    shots = safe_float(r.get("shots", r.get("nShots", 0)), 0.0)
    missRate = (miss/shots) if shots>0 else 0.0

    score = safe_float(r.get("score", r.get("scoreFinal", 0)), 0.0)
    completed = safe_float(r.get("completed", 1), 1.0)

    y = 1.0 if (missRate >= 0.28 or score < 180 or completed < 1) else 0.0
    return y

def to_vec(x, wkeys):
    return [float(x.get(k,0.0)) for k in wkeys]

def train_logreg_gd(X, y, lr=0.35, epochs=600, l2=0.10):
    # Simple gradient descent logistic regression
    w = {k:0.0 for k in FEATURES}
    b = -0.5

    n = len(X)
    if n == 0:
        return {"bias": -1.1}

    for ep in range(epochs):
        gb = 0.0
        gw = {k:0.0 for k in FEATURES}
        loss = 0.0

        for i in range(n):
            z = b
            for k in FEATURES:
                z += w[k] * X[i][k]
            p = sigmoid(z)
            yi = y[i]
            # logloss
            loss += -(yi*math.log(max(1e-9,p)) + (1-yi)*math.log(max(1e-9,1-p)))
            dz = (p - yi)
            gb += dz
            for k in FEATURES:
                gw[k] += dz * X[i][k]

        # avg + l2
        gb /= n
        for k in FEATURES:
            gw[k] = (gw[k]/n) + l2*w[k]

        b -= lr*gb
        for k in FEATURES:
            w[k] -= lr*gw[k]

        if ep % 100 == 0:
            loss /= n
            # print minimal progress
            print(f"epoch {ep:4d} loss={loss:.4f}")

    out = {"bias": b}
    out.update(w)
    return out

def main():
    if len(sys.argv) < 2:
        print("Usage: python train_goodjunk.py sessions.csv [out.json]")
        sys.exit(1)

    sessions_path = sys.argv[1]
    out_path = sys.argv[2] if len(sys.argv) >= 3 else "goodjunk_weights.json"

    rows = read_csv(sessions_path)

    X = []
    y = []
    for r in rows:
        x = featurize_session(r)
        X.append(x)
        y.append(label_from_session(r))

    print(f"Loaded sessions: {len(rows)}")

    # train
    w = train_logreg_gd(X, y)

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(w, f, ensure_ascii=False, indent=2)

    print("Saved:", out_path)
    print("Tip: paste JSON into localStorage key HHA_GJ_MODEL_W in browser.")

if __name__ == "__main__":
    main()