# === /webxr-health-mobile/herohealth/ml/train_goodjunk.py ===
# Train GoodJunk risk model (baseline) from exported CSV
# Output: weights to paste into /herohealth/vr/goodjunk-model.js
# v20260301

import json
import numpy as np
import pandas as pd

def sigmoid(z):
    return 1.0 / (1.0 + np.exp(-z))

def build_features(df):
    # Expect columns from logger event rows (best effort)
    # We'll aggregate per session_id if present; else treat rows as stream.
    sid = 'session_id' if 'session_id' in df.columns else None
    if sid:
        g = df.groupby(sid)
        agg = g.apply(lambda x: pd.Series({
            'diff': (x['difficulty'].iloc[0] if 'difficulty' in x.columns else 'normal'),
            'view': (x['view_mode'].iloc[0] if 'view_mode' in x.columns else 'mobile'),
            'shots': len(x),
            'miss': float(x['miss'].fillna(0).max() if 'miss' in x.columns else 0),
            'hitJunk': float(x['nHitJunk'].fillna(0).max() if 'nHitJunk' in x.columns else 0),
            'hitGood': float(x['nHitGood'].fillna(0).max() if 'nHitGood' in x.columns else 0),
            'combo': float(x['combo'].fillna(0).max() if 'combo' in x.columns else 0),
            'rtGood': float(x['rt_ms'].fillna('').replace('', np.nan).dropna().median() if 'rt_ms' in x.columns else np.nan),
            'fever': float(x.get('feverPct', pd.Series([0])).fillna(0).max() if 'feverPct' in x.columns else 0),
            'timeLeft': float(x.get('timeLeftSec', pd.Series([0])).fillna(0).min() if 'timeLeftSec' in x.columns else 0),
            'timeAll': float(x.get('timeAllSec', pd.Series([80])).fillna(80).max() if 'timeAllSec' in x.columns else 80),
            # label: "bad outcome" — you can refine this
            # For baseline: high miss OR high junk rate
            'label': float(((x['miss'].fillna(0).max() if 'miss' in x.columns else 0) >= 6) or
                           (((x.get('nHitJunk', pd.Series([0])).fillna(0).max()) / max(1,len(x))) > 0.18))
        }))
        df2 = agg.reset_index(drop=True)
    else:
        df2 = pd.DataFrame()

    # Fill missing
    df2['diff'] = df2['diff'].fillna('normal')
    df2['view'] = df2['view'].fillna('mobile')
    df2['rtGood'] = df2['rtGood'].fillna(600)

    shots = df2['shots'].clip(lower=1).astype(float)
    miss_rate = (df2['miss'].astype(float) / shots).clip(0,1)
    junk_rate = (df2['hitJunk'].astype(float) / shots).clip(0,1)

    combo_norm = (df2['combo'].astype(float) / 25.0).clip(0,1)
    rt = df2['rtGood'].astype(float).clip(120,2000)
    rt_norm = ((rt - 250.0) / (1200.0 - 250.0)).clip(0,1)

    time_all = df2['timeAll'].astype(float).clip(20,300)
    time_left = df2['timeLeft'].astype(float).clip(0,999)
    time_left_norm = (time_left / time_all).clip(0,1)

    fever_norm = (df2['fever'].astype(float).clip(0,100) / 100.0).clip(0,1)

    # one-hot diff/view
    diff_easy = (df2['diff'].str.lower()=='easy').astype(float)
    diff_normal = (df2['diff'].str.lower()=='normal').astype(float)
    diff_hard = (df2['diff'].str.lower()=='hard').astype(float)
    view_mobile = (df2['view'].str.lower().str.contains('mob')).astype(float)
    view_pc = (df2['view'].str.lower().str.contains('pc')).astype(float)

    X = np.stack([
        np.ones(len(df2)),        # bias
        diff_easy,
        diff_normal,
        diff_hard,
        view_mobile,
        view_pc,
        time_left_norm,
        miss_rate,
        junk_rate,
        combo_norm,
        rt_norm,
        fever_norm
    ], axis=1).astype(np.float64)

    y = df2['label'].astype(int).values
    return X, y

def train_logreg(X, y, lr=0.3, steps=1200, l2=1e-3):
    w = np.zeros(X.shape[1], dtype=np.float64)
    for i in range(steps):
        z = X @ w
        p = sigmoid(z)
        grad = (X.T @ (p - y)) / len(y) + l2*w
        w -= lr * grad
    return w

def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument('--csv', required=True, help='Exported CSV from GoodJunk (events)')
    ap.add_argument('--out', default='goodjunk_weights.json')
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    X, y = build_features(df)
    if len(y) < 30:
        print('Not enough data (need >= 30 sessions). Got:', len(y))
        return

    w = train_logreg(X, y)
    out = {
        "version":"goodjunk-logreg-v1",
        "features":[
            "bias","diff_easy","diff_normal","diff_hard","view_mobile","view_pc",
            "time_left_norm","miss_rate","junk_rate","combo_norm","rt_good_norm","fever_norm"
        ],
        "weights":[float(x) for x in w]
    }
    with open(args.out,'w',encoding='utf-8') as f:
        json.dump(out,f,ensure_ascii=False,indent=2)
    print('Saved:', args.out)
    print('Paste weights into /herohealth/vr/goodjunk-model.js -> GOODJUNK_MODEL_V1.weights')

if __name__ == '__main__':
    main()