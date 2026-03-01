# === /herohealth/ml/train_goodjunk.py ===
# Baseline trainer for GoodJunk risk prediction (hazard_label)
# v20260301

import argparse
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, classification_report
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
import joblib

FEATURES = [
  't_sec','t_left_sec',
  'diff_easy','diff_normal','diff_hard',
  'view_mobile','view_pc','view_vr','view_cvr',
  'score','miss_total','miss_good_expired','miss_junk_hit',
  'combo','combo_max','fever_pct','shield',
  'shots','hits','acc_pct','median_rt_good_ms',
  'storm_on','boss_active'
]

LABEL = 'hazard_label'

def main():
  ap = argparse.ArgumentParser()
  ap.add_argument('--csv', required=True, help='Path to dataset CSV with hazard_label')
  ap.add_argument('--out', default='goodjunk_risk_model.joblib', help='Output model file')
  args = ap.parse_args()

  df = pd.read_csv(args.csv)
  missing = [c for c in FEATURES+[LABEL] if c not in df.columns]
  if missing:
    raise SystemExit(f'Missing columns: {missing}')

  X = df[FEATURES].copy()
  y = df[LABEL].astype(int).copy()

  X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.25, random_state=42, stratify=y if y.nunique()>1 else None
  )

  pipe = Pipeline(steps=[
    ('imputer', SimpleImputer(strategy='median')),
    ('scaler', StandardScaler(with_mean=True, with_std=True)),
    ('clf', LogisticRegression(max_iter=500, class_weight='balanced'))
  ])

  pipe.fit(X_train, y_train)

  if y_test.nunique() > 1:
    p = pipe.predict_proba(X_test)[:,1]
    auc = roc_auc_score(y_test, p)
    print('ROC-AUC:', round(auc, 4))
  else:
    print('Test set has a single class; ROC-AUC not defined.')

  y_pred = pipe.predict(X_test)
  print(classification_report(y_test, y_pred, digits=4))

  joblib.dump({'pipeline': pipe, 'features': FEATURES}, args.out)
  print('Saved:', args.out)

if __name__ == '__main__':
  main()
