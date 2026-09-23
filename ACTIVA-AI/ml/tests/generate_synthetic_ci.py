#!/usr/bin/env python3
"""Generate synthetic data ONLY for software/CI testing.

These records are not empirical evidence and must never be reported as study results.
"""
import json
from pathlib import Path
import numpy as np

rng = np.random.default_rng(2601)
rows = []
for person in range(80):
    participant = f"SYN_P{person:03d}"
    for event in range(3):
        qr = int(rng.random() > 0.05)
        identity = int(rng.random() > 0.04)
        checkin = int(rng.random() > 0.06)
        checkout = int(rng.random() > 0.14)
        staff = int(rng.random() > 0.12)
        signature = int(rng.random() > 0.7)
        ratio = float(np.clip(rng.normal(0.88, 0.18), 0, 1.2)) if checkin and checkout else None
        attempts = int(rng.integers(1, 5))
        review = (
            not qr
            or not identity
            or not checkin
            or not checkout
            or not staff
            or (ratio is not None and ratio < 0.65)
            or attempts >= 4
        )
        if rng.random() < 0.08:
            review = not review  # noise prevents a perfectly deterministic software test
        rows.append({
            "record_id": f"SYN_R{person:03d}_{event}",
            "participant_hash": participant,
            "event_id": f"SYN_E{event:02d}",
            "activity_type": ["ประชุม","พัฒนาบุคลากร","บริการวิชาการ"][event % 3],
            "qr_valid": qr,
            "identity_verified": identity,
            "checkin_present": checkin,
            "checkout_present": checkout,
            "scheduled_duration_minutes": [120, 360, 240][event % 3],
            "actual_duration_minutes": None if ratio is None else int([120,360,240][event % 3] * ratio),
            "duration_ratio": ratio,
            "checkin_offset_minutes": None if not checkin else int(rng.normal(0, 12)),
            "checkout_offset_minutes": None if not checkout else int(rng.normal(-5, 18)),
            "staff_verified": staff,
            "signature_verified": signature,
            "scan_attempts": attempts,
            "final_target": "REVIEW_REQUIRED" if review else "NO_REVIEW_REQUIRED",
            "reason_codes": ["SYNTHETIC_CI_ONLY"],
            "locked_at": "2099-01-01T00:00:00Z",
        })

out = Path("ml/tests/synthetic_locked_dataset.json")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps({
    "ok": True,
    "synthetic": True,
    "warning": "CI/software test only; not empirical research data.",
    "records": rows,
}, ensure_ascii=False, indent=2), encoding="utf-8")
print(out)
