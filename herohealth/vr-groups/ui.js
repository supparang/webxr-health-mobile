// === /herohealth/vr-groups/ui.js ===
// Food Groups VR — HUD / UI Controller (2025-12-04)

'use strict';

window.GAME_MODULES = window.GAME_MODULES || {};
const ns = window.GAME_MODULES;

export class FoodGroupsUI {
  constructor() {
    this.elScore = document.getElementById('hud-score');
    this.elDiff = document.getElementById('hud-diff-label');
    this.elTime = document.getElementById('hud-time-label');
    this.elCoach = document.getElementById('coach-text');
    this.elCoachBubble = document.getElementById('coach-bubble');
    this.elEndToast = document.getElementById('end-toast');
    this.elEndScore = document.getElementById('end-score');
    this.elEndQuest = document.getElementById('end-quest');

    // สร้าง progress panel เพิ่มสำหรับ Goal / Mini
    this.panel = this.ensurePanel();
    this.goalListEl = this.panel.querySelector('.fg-goals');
    this.miniListEl = this.panel.querySelector('.fg-minis');

    this.score = 0;
    this.lastCoachTimeout = null;

    this.handleQuestProgress = this.handleQuestProgress.bind(this);
    window.addEventListener('fg-quest-progress', this.handleQuestProgress);
  }

  ensurePanel() {
    let wrap = document.querySelector('.fg-quest-panel');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.className = 'fg-quest-panel';
    wrap.style.position = 'fixed';
    wrap.style.top = '80px';
    wrap.style.left = '10px';
    wrap.style.zIndex = '651';
    wrap.style.background = 'rgba(15,23,42,0.85)';
    wrap.style.border = '1px solid rgba(52,211,153,0.45)';
    wrap.style.borderRadius = '14px';
    wrap.style.padding = '8px 10px';
    wrap.style.color = '#e5e7eb';
    wrap.style.fontFamily = 'system-ui,Segoe UI,Inter';
    wrap.style.fontSize = '12px';
    wrap.style.width = '220px';
    wrap.style.backdropFilter = 'blur(6px)';
    wrap.innerHTML = `
      <div style="font-size:13px;font-weight:700;margin-bottom:6px;color:#6ee7b7;">🎯 เป้าหมาย</div>
      <div class="fg-goals" style="display:flex;flex-direction:column;gap:4px;margin-bottom:6px;"></div>
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;color:#fde68a;">⭐ Mini Quest</div>
      <div class="fg-minis" style="display:flex;flex-direction:column;gap:4px;"></div>
    `;
    document.body.appendChild(wrap);
    return wrap;
  }

  setScore(value) {
    this.score = value;
    if (this.elScore) this.elScore.textContent = value;
  }

  setCoach(text) {
    if (!text) return;
    this.elCoach.textContent = text;
    this.elCoachBubble.classList.add('show');
    if (this.lastCoachTimeout) clearTimeout(this.lastCoachTimeout);
    this.lastCoachTimeout = setTimeout(() => {
      this.elCoachBubble.classList.remove('show');
    }, 4000);
  }

  showSummary(data) {
    if (!data) return;
    this.elEndScore.textContent = data.score || 0;
    this.elEndQuest.textContent = `${data.goalDone} / ${data.goalTotal}`;
    this.elEndToast.classList.add('show');
  }

  renderQuestList(goals, minis) {
    if (!Array.isArray(goals) || !Array.isArray(minis)) return;

    this.goalListEl.innerHTML = '';
    this.miniListEl.innerHTML = '';

    goals.forEach(g => {
      const el = document.createElement('div');
      el.className = 'fg-qrow';
      el.dataset.id = g.id;
      el.innerHTML = `
        <div>${g.label}</div>
        <div class="bar" style="height:4px;border-radius:999px;background:#0f172a;margin-top:2px;overflow:hidden;">
          <div class="fill" style="width:0%;height:100%;background:linear-gradient(90deg,#22c55e,#86efac);transition:width .2s;"></div>
        </div>
      `;
      this.goalListEl.appendChild(el);
    });

    minis.forEach(m => {
      const el = document.createElement('div');
      el.className = 'fg-qrow';
      el.dataset.id = m.id;
      el.innerHTML = `
        <div>${m.label}</div>
        <div class="bar" style="height:4px;border-radius:999px;background:#0f172a;margin-top:2px;overflow:hidden;">
          <div class="fill" style="width:0%;height:100%;background:linear-gradient(90deg,#facc15,#fbbf24);transition:width .2s;"></div>
        </div>
      `;
      this.miniListEl.appendChild(el);
    });
  }

  handleQuestProgress(e) {
    const d = e.detail || {};
    const id = d.id;
    const val = d.value || 0;
    const need = d.need || 1;

    const el = this.panel.querySelector(`.fg-qrow[data-id="${id}"] .fill`);
    if (!el) return;

    const pct = Math.min(100, Math.round((val / need) * 100));
    el.style.width = pct + '%';
    if (pct >= 100) {
      el.style.background = 'linear-gradient(90deg,#4ade80,#22c55e)';
      this.setCoach(`🎉 ภารกิจ "${d.label}" สำเร็จแล้ว!`);
    }
  }
}

ns.foodGroupsUI = FoodGroupsUI;