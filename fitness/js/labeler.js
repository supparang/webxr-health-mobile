// === /fitness/js/labeler.js ===
// Shadow Breaker — Window labeling (A-18)
// Output: label + intensity_hint

'use strict';

export function labelWindow(feat, pred){
  // feat: { hitRate, missRate, avgRt, rtJitter, lowHpRatio, feverRatio, bombRate, parryRate }
  // pred: { fatigue_prob, flow_score }

  const miss = feat.missRate ?? 0;
  const rt = feat.avgRt ?? 420;
  const jit = feat.rtJitter ?? 0.3;
  const low = feat.lowHpRatio ?? 0;
  const fever = feat.feverRatio ?? 0;
  const fat = pred?.fatigue_prob ?? 0.25;
  const flow = pred?.flow_score ?? 0.5;

  // ---- rule-based label (for supervised pretraining / baseline) ----
  // overload = many misses OR very slow + jitter OR lowhp high
  const overload =
    (miss > 0.38) ||
    (rt > 680 && jit > 0.55) ||
    (low > 0.42 && miss > 0.26);

  // fatigue = high fatigue prob or lowhp/time strain, but not overload
  const fatigue =
    !overload && (
      fat > 0.70 ||
      (rt > 560 && miss > 0.22) ||
      (low > 0.32 && fever < 0.08)
    );

  // flow = high flow score + good hit/miss + stable rt, not fatigue/overload
  const flowState =
    !overload && !fatigue && (
      flow > 0.72 &&
      miss < 0.18 &&
      rt < 520 &&
      jit < 0.45
    );

  let label = 'steady';
  if (overload) label = 'overload';
  else if (fatigue) label = 'fatigue';
  else if (flowState) label = 'flow';

  // intensity hint for director (optional)
  // +1 harder, 0 keep, -1 easier
  let intensity_hint = 0;
  if (label === 'flow' && fever < 0.35) intensity_hint = +1;
  if (label === 'fatigue') intensity_hint = -1;
  if (label === 'overload') intensity_hint = -1;

  return { label, intensity_hint };
}