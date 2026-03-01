import json, sys, math
from collections import defaultdict, deque

def sigmoid(x):
    if x < -30: return 0.0
    if x > 30:  return 1.0
    return 1.0/(1.0+math.exp(-x))

def featurize(tick):
    # match ai-goodjunk.js vector (bias + 13)
    planned = float(tick.get("plannedSec", 80) or 80)
    tLeft = float(tick.get("tLeft", 0) or 0)
    tp = max(0.0, min(1.0, 1.0 - (tLeft/planned if planned>0 else 0.0)))

    miss = float(tick.get("miss", 0) or 0)/20.0
    missG = float(tick.get("missGoodExpired", 0) or 0)/20.0
    missJ = float(tick.get("missJunkHit", 0) or 0)/20.0
    combo = max(0.0, min(1.0, float(tick.get("combo",0) or 0)/12.0))
    fever = max(0.0, min(1.0, float(tick.get("fever",0) or 0)/100.0))
    shield = max(0.0, min(1.0, float(tick.get("shield",0) or 0)/9.0))
    acc = max(0.0, min(1.0, float(tick.get("accPct",0) or 0)/100.0))
    targets = max(0.0, min(1.0, float(tick.get("targetsN",0) or 0)/18.0))

    storm = 1.0 if tick.get("stormOn") else 0.0
    rage  = 1.0 if tick.get("rageOn") else 0.0
    boss  = 1.0 if tick.get("bossActive") else 0.0
    bossPhase = float(tick.get("bossPhase",0) or 0)
    bossPhase = max(0.0, min(1.0, bossPhase/2.0))

    return [1.0, tp, miss, missG, missJ, combo, fever, shield, acc, targets, storm, rage, boss, bossPhase]

def load_jsonl(paths):
    rows = []
    for p in paths:
        with open(p, "r", encoding="utf-8") as f:
            for line in f:
                line=line.strip()
                if not line: continue
                rows.append(json.loads(line))
    return rows

def build_dataset(rows, horizon_ms=2000):
    # Label: y=1 if a MISS happens within next horizon after tick time
    ticks = []
    misses = []
    for r in rows:
        kind = r.get("kind")
        if kind == "tick":
            ticks.append(r)
        elif kind == "event" and r.get("type") == "miss":
            misses.append(r)

    misses.sort(key=lambda x: x.get("t",0))
    mQ = deque(misses)

    X, y = [], []
    for tk in sorted(ticks, key=lambda x: x.get("t",0)):
        t = tk.get("t",0)
        # drop misses older than t
        while mQ and mQ[0].get("t",0) < t:
            mQ.popleft()
        label = 0
        if mQ and (mQ[0].get("t",0) - t) <= horizon_ms:
            label = 1
        X.append(featurize(tk))
        y.append(label)
    return X, y

def train_logreg(X, y, lr=0.25, epochs=18, l2=1e-3):
    # simple batch GD
    n = len(X)
    d = len(X[0])
    w = [0.0]*d
    for ep in range(epochs):
        gw = [0.0]*d
        loss = 0.0
        for i in range(n):
            z = sum(w[j]*X[i][j] for j in range(d))
            p = sigmoid(z)
            yi = y[i]
            # logloss
            loss += -(yi*math.log(max(1e-9,p)) + (1-yi)*math.log(max(1e-9,1-p)))
            # grad
            dz = (p - yi)
            for j in range(d):
                gw[j] += dz * X[i][j]
        # L2
        for j in range(d):
            gw[j] = gw[j]/n + l2*w[j]
        for j in range(d):
            w[j] -= lr*gw[j]
        loss = loss/n
        print(f"epoch {ep+1}/{epochs} loss={loss:.4f}")
    return w

def export_js(w, out_path="goodjunk-model.js"):
    js = f"""// === goodjunk-model.js (AUTO-GENERATED) ===
'use strict';
(function(){{
  const W = {json.dumps([round(x,6) for x in w])};
  function sigmoid(x){{ if(x<-30) return 0; if(x>30) return 1; return 1/(1+Math.exp(-x)); }}
  function predictProba(vec){{
    let z=0;
    for(let i=0;i<W.length;i++) z += (W[i]||0) * (vec[i]||0);
    return sigmoid(z);
  }}
  window.HHA_GJ_MODEL = {{ predictProba, W }};
  console.log('[HHA_GJ_MODEL] loaded', W.length);
}})();
"""
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(js)
    print("Wrote", out_path)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python train_goodjunk.py file1.jsonl [file2.jsonl ...]")
        sys.exit(1)

    rows = load_jsonl(sys.argv[1:])
    X, y = build_dataset(rows, horizon_ms=2000)
    pos = sum(y); n=len(y)
    print("samples:", n, "pos:", pos, "pos_rate:", (pos/n if n else 0))

    w = train_logreg(X, y, lr=0.35, epochs=20, l2=2e-3)
    export_js(w, out_path="goodjunk-model.js")
