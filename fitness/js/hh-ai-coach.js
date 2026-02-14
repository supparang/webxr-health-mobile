/* ===================================================
   HEROHEALTH — AI Coach (Explainable)
   - Listens to hh:result (planner/boss/any game)
   - Generates child-friendly feedback + next-plan suggestion
   - Rate-limited + stores history for research
=================================================== */
(function (global) {
  'use strict';

  const LS_HISTORY = 'HHA_AI_COACH_HISTORY';
  const LS_LAST_SHOWN = 'HHA_AI_COACH_LAST_SHOWN_AT';

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const now = () => (global.performance ? performance.now() : Date.now());

  function safeJSON(s, fallback) {
    try { return JSON.parse(s); } catch { return fallback; }
  }
  function saveHistory(entry) {
    const hist = safeJSON(localStorage.getItem(LS_HISTORY) || '[]', []);
    hist.push(entry);
    // keep last 200
    while (hist.length > 200) hist.shift();
    localStorage.setItem(LS_HISTORY, JSON.stringify(hist));
  }

  function ensureCoachUI() {
    let el = document.getElementById('hhCoachPanel');
    if (el) return el;

    const style = document.createElement('style');
    style.id = 'hhCoachStyle';
    style.textContent = `
      #hhCoachPanel{
        position:fixed; right:12px;
        top: calc(12px + env(safe-area-inset-top, 0px));
        width:min(420px, calc(100vw - 24px));
        z-index: 99997;
        pointer-events:auto;
        border-radius: 22px;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.86);
        box-shadow: 0 18px 40px rgba(0,0,0,.45);
        padding: 12px 12px;
        display:none;
      }
      #hhCoachPanel.show{ display:block; animation: hhCoachIn 220ms ease; }
      @keyframes hhCoachIn{ from{ transform:translateY(-8px); opacity:.5;} to{ transform:translateY(0); opacity:1;} }

      #hhCoachPanel .top{ display:flex; justify-content:space-between; gap:10px; align-items:center; }
      #hhCoachPanel .title{ font-weight: 900; }
      #hhCoachPanel .pill{
        border-radius:999px; border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.55);
        padding: 6px 10px;
        font-weight: 900;
        color:#e5e7eb;
        font-size:12px;
      }
      #hhCoachPanel .msg{ margin-top:10px; line-height:1.35; color:#e5e7eb; }
      #hhCoachPanel .explain{
        margin-top:10px;
        border-radius: 16px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.55);
        padding: 10px;
        color:#cbd5e1;
        font-size: 12px;
      }
      #hhCoachPanel .actions{ display:flex; gap:10px; margin-top:10px; flex-wrap:wrap; }
      #hhCoachPanel button{
        border-radius: 14px;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.55);
        color:#e5e7eb;
        padding: 9px 10px;
        font-weight: 900;
        cursor:pointer;
        flex: 1 1 150px;
      }
      #hhCoachPanel button.primary{
        border-color: rgba(34,197,94,.35);
        background: rgba(34,197,94,.12);
      }
      #hhCoachPanel .small{
        margin-top:8px;
        color:#94a3b8;
        font-size: 11px;
      }
    `;
    document.head.appendChild(style);

    el = document.createElement('div');
    el.id = 'hhCoachPanel';
    el.innerHTML = `
      <div class="top">
        <div class="title">🤖 Coach</div>
        <div class="pill" id="hhCoachTag">TIP</div>
      </div>
      <div class="msg" id="hhCoachMsg">—</div>
      <div class="explain" id="hhCoachExplain">—</div>
      <div class="actions">
        <button class="primary" id="hhCoachApply">ทำตามแผนที่แนะนำ</button>
        <button id="hhCoachClose">ปิด</button>
      </div>
      <div class="small" id="hhCoachSmall">คำแนะนำนี้อิงจากผลการเล่นล่าสุด</div>
    `;
    document.body.appendChild(el);

    el.querySelector('#hhCoachClose')?.addEventListener('click', () => hide());
    el.querySelector('#hhCoachApply')?.addEventListener('click', () => {
      // emit "apply suggestion" so planner can auto-build next plan
      const sug = el.__suggestion || null;
      global.dispatchEvent(new CustomEvent('hh:coach_apply', { detail: sug }));
      hide();
      global.HHRewards?.toast?.('จัดแผนใหม่!', 'ทำตามคำแนะนำของ Coach ✅', 'good');
    });

    return el;
  }

  function show(payload) {
    const el = ensureCoachUI();
    el.classList.add('show');
    el.__suggestion = payload?.suggestion || null;

    const tag = el.querySelector('#hhCoachTag');
    const msg = el.querySelector('#hhCoachMsg');
    const ex = el.querySelector('#hhCoachExplain');

    if (tag) tag.textContent = payload.tag || 'TIP';
    if (msg) msg.textContent = payload.message || '—';
    if (ex) ex.textContent = payload.explain || '—';
  }

  function hide() {
    const el = document.getElementById('hhCoachPanel');
    if (el) el.classList.remove('show');
  }

  // ===== Explainable analysis =====
  function analyze(result) {
    // result: hh:result detail (planner recommended)
    const score = Number(result.score || 0);
    const acc = Number(result.acc || 0);
    const timeMs = Number(result.timeMs || 0);
    const streak = Number(result.streak || 0);

    // per game if present
    const steps = Array.isArray(result.steps) ? result.steps : null; // optional if you include in result
    const aiPerf = result?.ai?.perf ?? null;

    // simple skill profile from known games (if available as columns in result or steps)
    // We'll accept either: result.shadow_score etc OR result.steps array.
    const pick = (g, k) => {
      if (result[`${g}_${k}`] != null) return Number(result[`${g}_${k}`]) || 0;
      if (steps) {
        const s = steps.find(x => x.game === g);
        if (!s) return 0;
        return Number(s[k] || 0) || 0;
      }
      return 0;
    };

    const shadow = pick('shadow','score');
    const rhythm = pick('rhythm','score');
    const jumpduck= pick('jumpduck','score');
    const balance= pick('balance','score');
    const boss = pick('boss','score');

    // Determine weakest area
    const area = [
      { id:'reaction', label:'ความไว', v: shadow },
      { id:'rhythm', label:'จังหวะ', v: rhythm },
      { id:'agility', label:'Jump/Duck', v: jumpduck },
      { id:'balance', label:'การทรงตัว', v: balance },
    ].sort((a,b)=>a.v-b.v)[0];

    // Build suggestion (next plan)
    // 3-slot plan: focus weak + one support + boss
    const plan = [];
    if (area.id === 'reaction') plan.push('shadow');
    if (area.id === 'rhythm') plan.push('rhythm');
    if (area.id === 'agility') plan.push('jumpduck');
    if (area.id === 'balance') plan.push('balance');

    // support: choose best to keep motivation
    const best = [
      { g:'shadow', v: shadow },
      { g:'rhythm', v: rhythm },
      { g:'jumpduck', v: jumpduck },
      { g:'balance', v: balance },
    ].sort((a,b)=>b.v-a.v)[0]?.g || 'shadow';

    if (plan[0] !== best) plan.push(best);
    // fill to 3
    const all = ['shadow','rhythm','jumpduck','balance'];
    for (const g of all) if (plan.length < 3 && !plan.includes(g)) plan.push(g);

    // message templates
    let tag = 'TIP';
    let message = '';
    let explain = '';

    if (score >= 95) {
      tag = '🌟 SUPER';
      message = `สุดยอดมาก! คะแนนรวม ${score} 🌟 ลองเพิ่มความท้าทายด้วย “Boss ยากขึ้น” ได้เลย!`;
      explain = `เพราะคะแนนรวมสูงมาก (≥95) และคอมโบสูงสุด ${streak} — เหมาะกับการเพิ่มความเร็ว/จังหวะอีกนิด`;
    } else if (score >= 80) {
      tag = '🔥 GREAT';
      message = `เก่งมาก! คะแนนรวม ${score} ✅ รอบหน้าลองโฟกัส “${area.label}” อีกนิด จะพุ่งไวมาก`;
      explain = `คะแนนรวมดีแล้ว แต่เกมที่ต่ำสุดคือ ${area.label} (ประมาณ ${area.v||0}) → โฟกัส 1 จุดจะคุ้มสุด`;
    } else {
      tag = '💪 TRY';
      message = `ไม่เป็นไร! รอบหน้ามาลองแบบ “ง่ายก่อน แล้วค่อยเร็วขึ้น” นะ 😊`;
      explain = `คะแนนรวมยังต่ำกว่า 80 → แนะนำฝึกทีละขั้น: เริ่มด้วย ${plan[0]} แล้วตามด้วย ${plan[1]}`;
    }

    // add AI note (research-friendly)
    if (aiPerf != null) {
      explain += ` | AI ปรับความยากตาม perf=${Number(aiPerf).toFixed(2)} (ยุติธรรมตามผลงาน)`;
    }

    // micro next action
    const suggestion = {
      nextPlan: plan.slice(0,3),
      focus: area.id,
      focusLabel: area.label
    };

    return { tag, message, explain, suggestion };
  }

  // ===== Rate limit: avoid spamming kids =====
  function canShow() {
    const last = Number(localStorage.getItem(LS_LAST_SHOWN) || 0);
    const t = Date.now();
    // show at most once per 20s
    return (t - last) > 20000;
  }

  function markShown() {
    localStorage.setItem(LS_LAST_SHOWN, String(Date.now()));
  }

  function onResult(ev) {
    const r = ev?.detail || {};
    // We mainly show for planner results; but accept boss too.
    const isPlanner = (r.game === 'planner');
    const isBoss = (r.game === 'boss');

    // Always log for research
    const entry = {
      at: Date.now(),
      pid: r.pid || '',
      name: r.name || '',
      phase: r.phase || '',
      game: r.game || '',
      score: r.score ?? null,
      acc: r.acc ?? null,
      timeMs: r.timeMs ?? null,
      streak: r.streak ?? null,
      aiPerf: r?.ai?.perf ?? null
    };
    saveHistory(entry);

    // Show UI only for planner end (or boss if you want)
    if (!(isPlanner || isBoss)) return;
    if (!canShow()) return;

    const a = analyze(r);
    show(a);
    markShown();
  }

  function init() {
    ensureCoachUI();
    global.addEventListener('hh:result', onResult);
  }

  global.HHAICoach = { init, analyze };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);