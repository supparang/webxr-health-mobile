# === dl-train.py ===
# Multi-task GRU model (3 heads):
# 1) miss_spike  (next 5s misses increase >= 2)
# 2) mini_fail   (within next 10s mini ends AND cleared did NOT increase)
# 3) score_drop  (next 5s score delta <= -25)
#
# Input: groups.csv (from GroupsVR.AIHooks.toCSV())
# Output: model.keras

import pandas as pd
import numpy as np
from pathlib import Path

from tensorflow import keras
from tensorflow.keras import layers

CSV_PATH = Path("groups.csv")
SEQ = 12
H_MISS = 5
H_SCORE = 5
H_MINI  = 10
TEST_SPLIT = 0.2

FEAT_KEYS = [
    "acc", "missN", "comboN", "pressure",
    "storm", "mini", "targetsN", "powerN",
    "goalProg", "leftN",
    "dScoreN", "dMissN", "dAccN", "dTargetsN",
    "miniProg", "miniLeftN"
]

def load_csv():
    df = pd.read_csv(CSV_PATH)

    # keep play only
    df["runMode"] = df["runMode"].astype(str).str.lower()
    df = df[df["runMode"] == "play"].copy()

    df["ts"] = pd.to_numeric(df["ts"], errors="coerce").fillna(0)
    df["seed"] = df["seed"].astype(str)

    # sort per session
    df = df.sort_values(["seed", "ts"]).reset_index(drop=True)
    return df

def build_features(df):
    acc = np.clip(df["accGoodPct"].values, 0, 100) / 100.0
    missN = np.clip(df["misses"].values, 0, 99) / 25.0
    comboN = np.clip(df["combo"].values, 0, 99) / 25.0
    pressure = np.clip(df["pressure"].values, 0, 3) / 3.0

    storm = (df["stormOn"].values > 0).astype(np.float32)
    mini  = (df["miniOn"].values > 0).astype(np.float32)

    targetsN = np.clip(df["targetsOnScreen"].values, 0, 30) / 30.0
    powerN   = np.clip(df["powerCharge"].values, 0, 99) / 12.0

    goalNeed = np.clip(df["goalNeed"].values, 1, 999)
    goalNow  = np.clip(df["goalNow"].values, 0, 999)
    goalProg = np.clip(goalNow / goalNeed, 0, 1)

    leftN = np.clip(df["leftSec"].values, 0, 180) / 180.0

    dScoreN  = np.clip(df["dScore"].values, -200, 200) / 200.0
    dMissN   = np.clip(df["dMisses"].values, 0, 6) / 6.0
    dAccN    = np.clip(df["dAcc"].values, -30, 30) / 30.0
    dTargetsN= np.clip(df["dTargets"].values, -15, 15) / 15.0

    miniNeed = np.clip(df["miniNeed"].values, 1, 999)
    miniNow  = np.clip(df["miniNow"].values, 0, 999)
    miniProg = np.where(df["miniOn"].values > 0, np.clip(miniNow / miniNeed, 0, 1), 0.0)
    miniLeftN = np.where(df["miniOn"].values > 0, np.clip(df["miniLeftSec"].values, 0, 15)/15.0, 0.0)

    X = np.stack([
        acc, missN, comboN, pressure,
        storm, mini, targetsN, powerN,
        goalProg, leftN,
        dScoreN, dMissN, dAccN, dTargetsN,
        miniProg, miniLeftN
    ], axis=1).astype(np.float32)

    return X

def build_labels(df):
    # future values (shift within each seed)
    g = df.groupby("seed", group_keys=False)

    misses_f = g["misses"].shift(-H_MISS)
    score_f  = g["score"].shift(-H_SCORE)

    # 1) MISS spike: misses increase >=2 in next 5s
    y1 = ((misses_f - df["misses"]) >= 2).astype(np.float32)

    # 3) SCORE drop: score change <= -25 in next 5s
    y3 = ((score_f - df["score"]) <= -25).astype(np.float32)

    # 2) MINI fail:
    # if currently miniOn=1 and within next 10s miniTotal increases,
    # but miniCleared does NOT increase => fail
    miniTotal_f = g["miniTotal"].shift(-H_MINI)
    miniCleared_f = g["miniCleared"].shift(-H_MINI)

    mini_total_inc = (miniTotal_f - df["miniTotal"]).fillna(0)
    mini_clear_inc = (miniCleared_f - df["miniCleared"]).fillna(0)

    y2 = np.zeros(len(df), dtype=np.float32)
    cond = (df["miniOn"].values > 0) & (mini_total_inc.values >= 1) & (mini_clear_inc.values < 1)
    y2[cond] = 1.0

    # drop rows with NaN futures for y1/y3
    valid = (~misses_f.isna()) & (~score_f.isna())
    return y1[valid].values, y2[valid], y3[valid].values, valid.values

def build_sequences(df, X, y1, y2, y3, valid_mask):
    # apply valid_mask first
    dfv = df[valid_mask].copy().reset_index(drop=True)
    Xv  = X[valid_mask]
    y1v = y1
    y2v = y2[valid_mask]
    y3v = y3

    seeds = dfv["seed"].astype(str).values
    idx_by_seed = {}
    for i,s in enumerate(seeds):
        idx_by_seed.setdefault(s, []).append(i)

    Xs, Y1, Y2, Y3 = [], [], [], []
    for s, idxs in idx_by_seed.items():
        for j in range(SEQ-1, len(idxs)):
            win = idxs[j-SEQ+1:j+1]
            Xs.append(Xv[win])
            Y1.append(y1v[idxs[j]])
            Y2.append(y2v[idxs[j]])
            Y3.append(y3v[idxs[j]])

    return (
        np.array(Xs, dtype=np.float32),
        np.array(Y1, dtype=np.float32),
        np.array(Y2, dtype=np.float32),
        np.array(Y3, dtype=np.float32),
    )

def main():
    df = load_csv()
    X = build_features(df)
    y1, y2, y3, valid = build_labels(df)
    Xseq, Y1, Y2, Y3 = build_sequences(df, X, y1, y2, y3, valid)

    if len(Xseq) < 400:
        raise SystemExit(f"ข้อมูลยังน้อย: sequences={len(Xseq)} (แนะนำเล่นเก็บเพิ่ม)")

    rng = np.random.default_rng(42)
    p = rng.permutation(len(Xseq))
    Xseq, Y1, Y2, Y3 = Xseq[p], Y1[p], Y2[p], Y3[p]

    n_test = int(len(Xseq)*TEST_SPLIT)
    X_test, X_train = Xseq[:n_test], Xseq[n_test:]
    y1_test, y1_train = Y1[:n_test], Y1[n_test:]
    y2_test, y2_train = Y2[:n_test], Y2[n_test:]
    y3_test, y3_train = Y3[:n_test], Y3[n_test:]

    inp = layers.Input(shape=(SEQ, Xseq.shape[-1]))
    x = layers.GRU(48)(inp)
    x = layers.Dropout(0.25)(x)
    x = layers.Dense(24, activation="relu")(x)

    out1 = layers.Dense(1, activation="sigmoid", name="miss_spike")(x)
    out2 = layers.Dense(1, activation="sigmoid", name="mini_fail")(x)
    out3 = layers.Dense(1, activation="sigmoid", name="score_drop")(x)

    model = keras.Model(inp, [out1,out2,out3])

    model.compile(
        optimizer=keras.optimizers.Adam(1e-3),
        loss={
            "miss_spike": "binary_crossentropy",
            "mini_fail": "binary_crossentropy",
            "score_drop": "binary_crossentropy"
        },
        metrics={
            "miss_spike": [keras.metrics.AUC(name="auc"), keras.metrics.BinaryAccuracy(name="acc")],
            "mini_fail":  [keras.metrics.AUC(name="auc"), keras.metrics.BinaryAccuracy(name="acc")],
            "score_drop": [keras.metrics.AUC(name="auc"), keras.metrics.BinaryAccuracy(name="acc")]
        }
    )

    cb = [
        keras.callbacks.EarlyStopping(patience=4, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(patience=2, factor=0.5)
    ]

    model.fit(
        X_train,
        {"miss_spike": y1_train, "mini_fail": y2_train, "score_drop": y3_train},
        validation_split=0.2,
        epochs=35,
        batch_size=64,
        callbacks=cb,
        verbose=2
    )

    print("EVAL:", model.evaluate(
        X_test,
        {"miss_spike": y1_test, "mini_fail": y2_test, "score_drop": y3_test},
        verbose=0
    ))

    model.save("model.keras")
    print("Saved: model.keras")

if __name__ == "__main__":
    main()