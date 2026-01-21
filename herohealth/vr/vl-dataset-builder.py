# HeroHealth — Deep Learning Dataset Builder (v1)
# Build sequence windows for GRU/LSTM from ticks + events
#
# Input (CSV):
#   sessions.csv : 1 row per session (optional for filtering/metadata)
#   ticks.csv    : 1Hz state rows (recommended)
#   events.csv   : event log (optional; used to enrich labels or features)
#
# Output:
#   dataset_windows.npz  (X, y_bin, y_count, meta)
#   dataset_windows.csv  (flat metadata + window start indices) [optional]
#
# Notes:
# - Works offline, no external deps besides numpy + pandas.
# - Keep deterministic: sorting by (sessionId, sec).
#
# Usage:
#   python dl-dataset-builder.py --ticks ticks.csv --events events.csv --out dataset_windows.npz
#
# Windowing:
#   W = 20 sec (history length), H = 10 sec (future horizon)
#   For each timestep t where t+H exists:
#     X = ticks[t-W+1 ... t]  shape (W, F)
#     y_bin = 1 if miss[t+H] - miss[t] >= 1 else 0
#     y_count = miss[t+H] - miss[t]
#
# Authoring intent: "แพ็คแฟร์" — ใช้ data ที่เกมมีจริง, ไม่ hallucinate

import argparse
import json
from dataclasses import dataclass
from typing import List, Optional, Tuple, Dict

import numpy as np
import pandas as pd


@dataclass
class Config:
    window_sec: int = 20
    horizon_sec: int = 10
    min_session_len: int = 40  # seconds
    normalize: bool = True


DEFAULT_FEATURES = [
    # time
    "timeLeftNorm",
    # state
    "score",
    "miss",
    "combo",
    "fever",
    "shield",
    "spawnRate",
    # phases
    "bossOn",
    "bossPhase",
    "bossHpNorm",
    "stormOn",
    "rageOn",
    # per-sec counts
    "goodHit_1s",
    "junkHit_1s",
    "expireGood_1s",
    "starHit_1s",
    "shieldHit_1s",
    "diamondHit_1s",
    # rolling
    "rtAvg_5s",
    # deltas
    "scoreDelta_1s",
    "missDelta_1s",
]


def safe_div(a: float, b: float, default: float = 0.0) -> float:
    try:
        b = float(b)
        if b == 0:
            return default
        return float(a) / b
    except Exception:
        return default


def ensure_columns(df: pd.DataFrame, cols: List[str]) -> pd.DataFrame:
    for c in cols:
        if c not in df.columns:
            df[c] = 0
    return df


def compute_deltas(df: pd.DataFrame) -> pd.DataFrame:
    # group-wise diff
    df["scoreDelta_1s"] = df.groupby("sessionId")["score"].diff().fillna(0)
    df["missDelta_1s"] = df.groupby("sessionId")["miss"].diff().fillna(0)
    return df


def rolling_mean_by_session(df: pd.DataFrame, col: str, win: int, out_col: str) -> pd.DataFrame:
    df[out_col] = (
        df.groupby("sessionId")[col]
          .rolling(window=win, min_periods=1)
          .mean()
          .reset_index(level=0, drop=True)
    )
    return df


def normalize_features(df: pd.DataFrame, feature_cols: List[str]) -> Tuple[pd.DataFrame, Dict[str, Dict[str, float]]]:
    stats: Dict[str, Dict[str, float]] = {}
    # normalize per feature globally (simple baseline). For stronger, do train-only fit.
    for c in feature_cols:
        x = df[c].astype(float)
        mu = float(x.mean())
        sd = float(x.std(ddof=0)) if float(x.std(ddof=0)) > 1e-9 else 1.0
        df[c] = (x - mu) / sd
        stats[c] = {"mean": mu, "std": sd}
    return df, stats


def build_from_ticks(
    ticks: pd.DataFrame,
    sessions: Optional[pd.DataFrame],
    cfg: Config,
    feature_cols: List[str]
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[dict], dict]:
    """
    Returns:
      X: (N, W, F)
      y_bin: (N,)
      y_count: (N,)
      meta: list[dict]
      norm_stats: dict
    """

    # required cols
    ticks = ticks.copy()
    ticks = ensure_columns(ticks, [
        "sessionId", "sec", "tLeftSec",
        "score", "miss", "combo", "fever", "shield", "spawnRate",
        "bossOn", "bossPhase", "bossHp", "bossHpMax", "stormOn", "rageOn",
        "goodHit_1s", "junkHit_1s", "expireGood_1s", "starHit_1s", "shieldHit_1s", "diamondHit_1s",
        "rtAvg_5s",
        "durationPlannedSec",
    ])

    # derived norms
    ticks["timeLeftNorm"] = ticks.apply(lambda r: safe_div(r["tLeftSec"], r["durationPlannedSec"], 0.0), axis=1)
    ticks["bossHpNorm"] = ticks.apply(lambda r: safe_div(r["bossHp"], r["bossHpMax"], 0.0), axis=1)

    # deltas + rolling (if rtAvg_5s missing, we keep it 0)
    ticks = compute_deltas(ticks)
    if "rtAvg_5s" not in ticks.columns or ticks["rtAvg_5s"].isna().all():
        ticks["rtAvg_5s"] = 0.0

    # sort stable
    ticks["sec"] = ticks["sec"].astype(int)
    ticks = ticks.sort_values(["sessionId", "sec"]).reset_index(drop=True)

    # filter by session length
    lens = ticks.groupby("sessionId")["sec"].max().fillna(0).astype(int) + 1
    keep_ids = lens[lens >= cfg.min_session_len].index.tolist()
    ticks = ticks[ticks["sessionId"].isin(keep_ids)].reset_index(drop=True)

    # normalization
    norm_stats = {}
    if cfg.normalize:
        ticks, norm_stats = normalize_features(ticks, feature_cols)

    W = cfg.window_sec
    H = cfg.horizon_sec

    X_list = []
    yb_list = []
    yc_list = []
    meta_list: List[dict] = []

    # group windowing
    for sid, g in ticks.groupby("sessionId", sort=False):
        g = g.sort_values("sec")
        # ensure consecutive seconds? if gaps, you can reindex; here we assume contiguous
        secs = g["sec"].to_numpy()
        miss = g["miss"].to_numpy()

        # we will index by row
        g_feat = g[feature_cols].to_numpy(dtype=np.float32)

        n = len(g)
        # last index t must satisfy t+H < n, and t-(W-1) >= 0
        for t in range(W - 1, n - H):
            x = g_feat[t - (W - 1): t + 1]  # shape (W, F)
            miss_t = miss[t]
            miss_f = miss[t + H]
            yc = float(miss_f - miss_t)
            yb = 1.0 if yc >= 1.0 else 0.0

            X_list.append(x)
            yb_list.append(yb)
            yc_list.append(yc)

            meta = {
                "sessionId": str(sid),
                "sec_t": int(secs[t]),
                "sec_tH": int(secs[t + H]),
                "miss_t": float(miss_t),
                "miss_tH": float(miss_f),
            }
            # attach session context if provided
            if sessions is not None and "sessionId" in sessions.columns:
                row = sessions[sessions["sessionId"] == sid]
                if len(row) == 1:
                    r = row.iloc[0].to_dict()
                    # keep only a few useful keys
                    for k in ["runMode", "diff", "view", "seed", "studyId", "phase", "conditionGroup", "gameVersion"]:
                        if k in r and r[k] == r[k]:
                            meta[k] = r[k]
            meta_list.append(meta)

    X = np.stack(X_list, axis=0) if X_list else np.zeros((0, W, len(feature_cols)), dtype=np.float32)
    y_bin = np.array(yb_list, dtype=np.float32)
    y_count = np.array(yc_list, dtype=np.float32)
    return X, y_bin, y_count, meta_list, norm_stats


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ticks", required=True, help="ticks.csv")
    ap.add_argument("--events", required=False, default=None, help="events.csv (optional)")
    ap.add_argument("--sessions", required=False, default=None, help="sessions.csv (optional)")
    ap.add_argument("--out", required=True, help="output .npz")
    ap.add_argument("--window", type=int, default=20)
    ap.add_argument("--horizon", type=int, default=10)
    ap.add_argument("--minlen", type=int, default=40)
    ap.add_argument("--no-normalize", action="store_true")
    ap.add_argument("--features", default="",
                    help="comma-separated feature cols; empty => default list")
    args = ap.parse_args()

    cfg = Config(
        window_sec=args.window,
        horizon_sec=args.horizon,
        min_session_len=args.minlen,
        normalize=(not args.no_normalize),
    )

    ticks = pd.read_csv(args.ticks)
    sessions = pd.read_csv(args.sessions) if args.sessions else None

    feat_cols = DEFAULT_FEATURES if not args.features.strip() else [c.strip() for c in args.features.split(",") if c.strip()]
    ticks = ensure_columns(ticks, feat_cols + ["sessionId", "sec", "tLeftSec", "durationPlannedSec"])
    X, yb, yc, meta, norm_stats = build_from_ticks(ticks, sessions, cfg, feat_cols)

    meta_json = json.dumps(meta, ensure_ascii=False)
    norm_json = json.dumps(norm_stats, ensure_ascii=False)

    np.savez_compressed(
        args.out,
        X=X,
        y_bin=yb,
        y_count=yc,
        feature_cols=np.array(feat_cols, dtype=object),
        meta_json=np.array([meta_json], dtype=object),
        norm_stats_json=np.array([norm_json], dtype=object),
        window=np.array([cfg.window_sec], dtype=np.int32),
        horizon=np.array([cfg.horizon_sec], dtype=np.int32),
    )

    print("OK")
    print("X:", X.shape)
    print("y_bin:", yb.shape, "pos_rate:", (yb.mean() if len(yb) else 0))
    print("y_count:", yc.shape, "avg:", (yc.mean() if len(yc) else 0))
    print("features:", len(feat_cols))


if __name__ == "__main__":
    main()