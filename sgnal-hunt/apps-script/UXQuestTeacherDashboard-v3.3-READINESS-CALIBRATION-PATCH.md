# UX Quest Teacher Dashboard v3.3 — Calibrated Mission Readiness

## Why this is the next important change

The current Dashboard correctly shows `Verified %` and the Anti-Guess cards, but the **Mission readiness** cards still draw only the green pass-rate bar. A mission can therefore look fully ready at `100% ผ่าน` while its verified reasoning is only `50%`.

This patch keeps both facts visible:

- **Game pass** = completed at least 2★; useful for progression.
- **Evidence readiness** = Reason Check performance; useful for teaching decisions.

It changes no data, scoring, stars, receipt, receiver, or filters.

---

## 1) Add these CSS rules after the existing `.bar.risk i` rule

```css
.readiness-pair{display:grid;gap:8px;margin-top:10px}
.readiness-line{display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:10px;font-weight:850;letter-spacing:.03em}
.readiness-line b{color:#e8efff;font-size:10px}
.bar.pass i{background:linear-gradient(90deg,var(--cyan),var(--mint))}
.bar.verified-good i{background:linear-gradient(90deg,#78e8b0,#56d6ee)}
.bar.verified-review i{background:linear-gradient(90deg,var(--gold),#ff9b80)}
.bar.verified-risk i{background:linear-gradient(90deg,var(--rose),#e36b96)}
.readiness-status{margin-top:10px}
```

---

## 2) Replace the entire `renderMissionCards(rows)` function

```javascript
function renderMissionCards(rows) {
  $('missions').innerHTML = missionOrder
    .map((id) => {
      const data = missionData(rows, id);

      if (!data.list.length) {
        return `
          <article class="mission-card">
            <b>${esc(missionNames[id] || id)}</b>
            <span>ยังไม่มีผลในตัวกรอง</span>
          </article>
        `;
      }

      const hasReasoning = data.verifiedAverage !== null;
      const verified = hasReasoning ? data.verifiedAverage : 0;
      const verifiedClass = !hasReasoning
        ? 'verified-review'
        : verified >= 70 && data.review === 0
          ? 'verified-good'
          : verified >= 55
            ? 'verified-review'
            : 'verified-risk';

      const status = !hasReasoning
        ? { label: 'รอ Reason Check รอบใหม่', className: 'muted' }
        : verified >= 70 && data.review === 0
          ? { label: 'Evidence ready', className: 'good' }
          : verified >= 55
            ? { label: 'ทบทวน Reason Check', className: 'warn' }
            : { label: 'ควรสอนซ่อม Reason Check', className: 'rose' };

      return `
        <article class="mission-card">
          <b>${esc(missionNames[id] || id)}</b>
          <span>${data.list.length} attempts • ${data.avgAccuracy}% accuracy</span>

          <div class="readiness-pair">
            <div>
              <div class="readiness-line">
                <span>GAME PASS</span>
                <b>${data.rate}%</b>
              </div>
              <div class="bar pass"><i style="width:${data.rate}%"></i></div>
            </div>

            <div>
              <div class="readiness-line">
                <span>EVIDENCE / VERIFIED</span>
                <b>${hasReasoning ? `${verified}%` : 'N/A'}</b>
              </div>
              <div class="bar ${verifiedClass}"><i style="width:${hasReasoning ? verified : 0}%"></i></div>
            </div>
          </div>

          <div class="readiness-status">
            <span class="tag ${status.className}">${esc(status.label)}</span>
            ${hasReasoning ? `<span>${data.review} รอบต้องทบทวน / ตรวจเพิ่ม</span>` : ''}
          </div>
        </article>
      `;
    })
    .join('');
}
```

---

## Expected live result with the current classroom evidence

| Mission | Game pass | Evidence result | Dashboard signal |
|---|---:|---:|---|
| W1 | 100% | 91% | Evidence ready |
| W2 | 100% | 50% | ควรสอนซ่อม Reason Check |
| W3 | 100% | 50% | ควรสอนซ่อม Reason Check |
| B1 | 100% | 61% | ทบทวน Reason Check |

The student can remain `4/4 cleared` for progression while the teacher sees clearly that W2, W3, and B1 are not yet evidence-ready.

---

## Deploy

Save the updated `UXQuestTeacherDashboard.html`, then deploy a **New version** of the teacher-only Apps Script web app. The Student Receiver and GitHub Pages game do not need redeployment.
