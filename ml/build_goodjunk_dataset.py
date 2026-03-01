# === /webxr-health-mobile/ml/build_goodjunk_dataset.py ===
# Build DL dataset from GoodJunk events CSV (Google Sheet export)
# Output: artifacts/goodjunk_seq_dataset.npz

import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
ART  = ROOT / "artifacts"
ART.mkdir(parents=True, exist_ok=True)

# -------- config --------
WINDOW_EVENTS = 20     # W
HORIZON_SEC   = 4.0    # H seconds ahead

def main():
    ev_path = DATA / "goodjunk_events.csv"
    if not ev_path.exists():
        raise SystemExit(f"Missing {ev_path}. Export events tab as CSV -> put here.")

    df = pd.read_csv(ev_path)

    # Map columns (adjust if your sheet headers differ)
    # We assume your client sends:
    # - session_id, ts_ms, event_name/event_type, target_type, rt_ms, miss, accuracy_pct, totalScore (packed)
    def pick(*names):
        for n in names:
            if n in df.columns:
                return n
        return None

    c_sid = pick("session_id","sessionId")
    c_ts  = pick("ts_ms","timestampMs","timestamp")
    c_name= pick("event_name","eventName")
    c_type= pick("event_type","eventType")
    c_ttype=pick("target_type","itemType","targetType")
    c_rt  = pick("rt_ms","rtMs")

    if not all([c_sid, c_ts]):
        raise SystemExit(f"Need session+time columns. Have: {list(df.columns)[:40]}")

    df[c_ts] = pd.to_numeric(df[c_ts], errors="coerce").fillna(0).astype(np.int64)
    df[c_sid] = df[c_sid].astype(str)

    # define "error events" (ตามนิยาม miss)
    # - junk hit  OR good expired
    def is_error(row):
        n = str(row.get(c_name, "")).lower()
        t = str(row.get(c_ttype, "")).lower()
        # accept multiple naming styles
        if "expire" in n and ("good" in n or t=="good"):
            return "good_expire"
        if ("hit" in n or "touch" in n or "click" in n) and ("junk" in n or t=="junk"):
            return "junk_hit"
        return "none"

    df["err_type"] = df.apply(is_error, axis=1)

    # Features per event (simple, expandable)
    # You can add: score_delta, combo, fever, shield, x/y, etc.
    feat_cols = []
    # one-hot target_type (good/junk/other)
    df["tt_good"] = (df[c_ttype].astype(str).str.lower() == "good").astype(np.float32) if c_ttype else 0.0
    df["tt_junk"] = (df[c_ttype].astype(str).str.lower() == "junk").astype(np.float32) if c_ttype else 0.0
    df["rt"] = pd.to_numeric(df[c_rt], errors="coerce").fillna(0).astype(np.float32) if c_rt else 0.0

    feat_cols = ["tt_good","tt_junk","rt"]

    # Build sequences
    X = []
    y_risk = []
    y_next = []  # 0 none, 1 junk_hit, 2 good_expire

    df = df.sort_values([c_sid, c_ts]).reset_index(drop=True)

    for sid, g in df.groupby(c_sid, sort=False):
        g = g.reset_index(drop=True)
        times = g[c_ts].values.astype(np.int64)

        # precompute next error index for each position
        err_idx = np.where(g["err_type"].values != "none")[0]
        for i in range(len(g) - WINDOW_EVENTS):
            w_start = i
            w_end = i + WINDOW_EVENTS

            # horizon window in time
            t0 = times[w_end - 1]
            tH = t0 + int(HORIZON_SEC * 1000)

            # find first error after w_end-1 within horizon
            nxt = err_idx[err_idx >= w_end]
            label_type = 0
            label_risk = 0
            if len(nxt) > 0:
                j = nxt[0]
                if times[j] <= tH:
                    label_risk = 1
                    et = g.loc[j, "err_type"]
                    label_type = 1 if et == "junk_hit" else 2 if et == "good_expire" else 0

            x = g.loc[w_start:w_end-1, feat_cols].values.astype(np.float32)
            X.append(x)
            y_risk.append(label_risk)
            y_next.append(label_type)

    X = np.stack(X, axis=0) if X else np.zeros((0, WINDOW_EVENTS, len(feat_cols)), dtype=np.float32)
    y_risk = np.array(y_risk, dtype=np.int64)
    y_next = np.array(y_next, dtype=np.int64)

    out = ART / "goodjunk_seq_dataset.npz"
    np.savez_compressed(out, X=X, y_risk=y_risk, y_next=y_next,
                        window_events=WINDOW_EVENTS, horizon_sec=HORIZON_SEC,
                        feat_cols=np.array(feat_cols, dtype=object))
    print("OK ->", out, "samples:", X.shape[0])

if __name__ == "__main__":
    main()
