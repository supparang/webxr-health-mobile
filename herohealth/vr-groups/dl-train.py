# === /herohealth/vr-groups/dl-train.py ===
# Train GRU risk predictor from GroupsVR CSV dataset
# Input: groups.csv (from Copy CSV)
# Output: model.keras

import pandas as pd
import numpy as np
from pathlib import Path

from tensorflow import keras
from tensorflow.keras import layers

CSV_PATH = Path("groups.csv")
SEQ = 12  # seconds window
TEST_SPLIT = 0.2

def load_csv():
    df = pd.read_csv(CSV_PATH)
    # keep only play mode
    df = df[df["runMode"].astype(str).str.lower() == "play"].copy()

    # sort by seed + time to build sequences per session
    df["ts"] = pd.to_numeric(df["ts"], errors="coerce").fillna(0)
    df = df.sort_values(["seed", "ts"]).reset_index(drop=True)

    # build label: risk future (next 5s miss increase OR acc drop)
    # simple supervised label: if misses increases in next 5 rows -> y=1 else 0
    df["misses_n5"] = df.groupby("seed")["misses"].shift(-5)
    df["acc_n5"]    = df.groupby("seed")["accGoodPct"].shift(-5)

    df["y"] = 0
    df.loc[(df["misses_n5"] - df["misses"]) >= 1, "y"] = 1
    df.loc[(df["accGoodPct"] - df["acc_n5"]) >= 10, "y"] = 1

    # drop tail rows with no future
    df = df.dropna(subset=["misses_n5","acc_n5"]).copy()

    return df

def make_features(df):
    # normalize features (match ai-hooks buildFeat)
    acc = np.clip(df["accGoodPct"].values, 0, 100) / 100.0
    misses = np.clip(df["misses"].values, 0, 99) / 20.0
    combo  = np.clip(df["combo"].values, 0, 99) / 20.0
    pressure = np.clip(df["pressure"].values, 0, 3) / 3.0
    storm = (df["stormOn"].values > 0).astype(np.float32)
    mini  = (df["miniOn"].values > 0).astype(np.float32)
    targets = np.clip(df["targetsOnScreen"].values, 0, 30) / 30.0
    power   = np.clip(df["powerCharge"].values, 0, 99) / 12.0
    goalProg = np.where(df["goalNeed"].values > 0,
                        np.clip(df["goalNow"].values / df["goalNeed"].values, 0, 1),
                        0.0)
    leftN = np.clip(df["leftSec"].values, 0, 180) / 180.0

    X = np.stack([acc, misses, combo, pressure, storm, mini, targets, power, goalProg, leftN], axis=1)
    y = df["y"].values.astype(np.float32)
    return X, y

def build_sequences(df, X, y):
    # group by seed session
    Xs, ys = [], []
    seeds = df["seed"].astype(str).values
    idx_by_seed = {}
    for i,s in enumerate(seeds):
        idx_by_seed.setdefault(s, []).append(i)

    for s, idxs in idx_by_seed.items():
        # sliding windows
        for j in range(SEQ-1, len(idxs)):
            win = idxs[j-SEQ+1:j+1]
            Xs.append(X[win])
            ys.append(y[idxs[j]])  # label at current time
    return np.array(Xs, dtype=np.float32), np.array(ys, dtype=np.float32)

def main():
    df = load_csv()
    X, y = make_features(df)
    Xseq, yseq = build_sequences(df, X, y)

    if len(Xseq) < 200:
        raise SystemExit(f"Not enough sequences: {len(Xseq)} (เล่นเก็บข้อมูลอีกหน่อย)")

    # shuffle
    rng = np.random.default_rng(42)
    p = rng.permutation(len(Xseq))
    Xseq, yseq = Xseq[p], yseq[p]

    n_test = int(len(Xseq) * TEST_SPLIT)
    X_test, y_test = Xseq[:n_test], yseq[:n_test]
    X_train, y_train = Xseq[n_test:], yseq[n_test:]

    model = keras.Sequential([
        layers.Input(shape=(SEQ, Xseq.shape[-1])),
        layers.GRU(32, return_sequences=False),
        layers.Dropout(0.2),
        layers.Dense(16, activation="relu"),
        layers.Dense(1, activation="sigmoid")
    ])

    model.compile(
        optimizer=keras.optimizers.Adam(1e-3),
        loss="binary_crossentropy",
        metrics=[keras.metrics.AUC(name="auc"), keras.metrics.BinaryAccuracy(name="acc")]
    )

    cb = [
        keras.callbacks.EarlyStopping(patience=4, restore_best_weights=True),
        keras.callbacks.ReduceLROnPlateau(patience=2, factor=0.5)
    ]

    model.fit(
        X_train, y_train,
        validation_split=0.2,
        epochs=30,
        batch_size=64,
        callbacks=cb,
        verbose=2
    )

    print("Test:", model.evaluate(X_test, y_test, verbose=0))
    model.save("model.keras")
    print("Saved: model.keras")

if __name__ == "__main__":
    main()