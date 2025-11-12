// === /HeroHealth/game/main.js (2025-11-12 FIX: correct goal & mini quest summary + live HUD) ===
(function () {
  "use strict";

  const $ = (s)=>document.querySelector(s);
  const byId = (id)=>document.getElementById(id);

  // ---------- HUD live update from hha:stats / hha:time ----------
  function setText(el, v){ if(el) el.textContent = String(v); }
  window.addEventListener('hha:stats', (e)=>{
    const d = e.detail||{};
    setText(byId('hudScore'), d.score ?? 0);
    setText(byId('hudCombo'), d.combo ?? 0);
  });
  window.addEventListener('hha:time', (e)=>{
    // ถ้ามีตัวจับเวลาบน HUD ให้ใส่ตรงนี้ (ตอนนี้ใช้ของเดิมใน quest HUD/fever)
    // setText(byId('hudTime'), (e?.detail?.sec ?? 0) + 's');
  });

  // ---------- RESULT OVERLAY ----------
  function paintQuestBadge(el, done, total){
    const r = total? (done/total) : 0;
    el.style.borderColor = (r>=1)?'#22c55e':(r>=0.5?'#f59e0b':'#ef4444');
    el.style.background  = (r>=1)?'#22c55e22':(r>=0.5?'#f59e0b22':'#ef444422');
    el.style.color       = (r>=1)?'#dcfce7':(r>=0.5?'#fff7ed':'#fee2e2');
    el.textContent = `Mini Quests ${done}/${total}`;
  }

  function showResult(detail){
    // ---- normalize fields from goodjunk.safe.js ----
    const score       = +detail.score || 0;
    const comboMax    = +detail.comboMax || 0;
    const misses      = +detail.misses  || 0;
    const duration    = +detail.duration || 0;
    const mode        = String(detail.mode || 'unknown');
    const difficulty  = String(detail.difficulty || 'normal');

    // quests
    const questsCleared = Number(detail.questsCleared ?? detail.questsDone ?? 0);
    const questsTotal   = Number(
      detail.questsTotal ?? detail.quests_total ??
      (Array.isArray(detail.miniQuests)? detail.miniQuests.length :
       Array.isArray(detail.quests)?     detail.quests.length : 0)
    );

    // goal
    const goalTarget   = Number(detail.goalTarget ?? 0);
    const goalCleared  = Boolean( detail.goalCleared === true || (goalTarget>0 && score>=goalTarget) );
    const goalText     = goalCleared ? `ถึงเป้า (${goalTarget})` : `ไม่ถึง (${goalTarget>0?goalTarget:'-'})`;

    // ---- build overlay ----
    const old = document.getElementById('resultOverlay'); if (old) old.remove();
    const wrap = document.createElement('div'); wrap.id = 'resultOverlay';
    wrap.innerHTML = `
      <div class="card">
        <h2>สรุปผล: ${mode} (${difficulty})</h2>
        <div class="grid">
          <div class="pill"><div class="k">คะแนนรวม</div><div class="v">${score.toLocaleString()}</div></div>
          <div class="pill"><div class="k">คอมโบสูงสุด</div><div class="v">${comboMax}</div></div>
          <div class="pill"><div class="k">พลาด</div><div class="v">${misses}</div></div>
          <div class="pill"><div class="k">เป้าหมาย</div><div class="v ${goalCleared?'ok':'ng'}">${goalText}</div></div>
          <div class="pill"><div class="k">เวลา</div><div class="v">${duration}s</div></div>
        </div>
        <div class="questRow"><span id="questBadge" class="questBadge">Mini Quests 0/0</span></div>
        <div class="btns">
          <button id="btnRetry">เล่นอีกครั้ง</button>
          <button id="btnHub">กลับ Hub</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const badge = wrap.querySelector('#questBadge');
    paintQuestBadge(badge, questsCleared, questsTotal);

    // actions
    wrap.querySelector('#btnRetry').onclick = ()=> location.reload();
    wrap.querySelector('#btnHub').onclick   = ()=>{
      const u = new URL('./hub.html', location.href);
      u.searchParams.set('mode', mode);
      u.searchParams.set('diff', difficulty);
      location.href = u.href;
    };
  }

  // listen end
  window.addEventListener('hha:end', (e)=>{
    const d = e.detail||{};
    showResult(d);
  });

  // ---------- styles ----------
  const css = document.createElement('style'); css.textContent = `
  #resultOverlay{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.72);z-index:9999;}
  #resultOverlay .card{background:#0b1220;border:1px solid #1f2a44;border-radius:18px;min-width:720px;max-width:960px;padding:20px 22px;color:#e5e7eb;box-shadow:0 20px 60px rgba(0,0,0,.5)}
  #resultOverlay h2{margin:0 0 12px 0;color:#f8fafc}
  #resultOverlay .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:10px}
  #resultOverlay .pill{background:#0f172a;border:1px solid #233250;border-radius:12px;padding:10px 12px}
  #resultOverlay .pill .k{font:600 12px/1.2 system-ui;color:#94a3b8}
  #resultOverlay .pill .v{font:800 24px/1.1 system-ui;color:#fff;margin-top:4px}
  #resultOverlay .pill .v.ok{color:#86efac}
  #resultOverlay .pill .v.ng{color:#fca5a5}
  #resultOverlay .questRow{margin:8px 2px 0}
  #resultOverlay .questBadge{display:inline-block;padding:6px 10px;border:2px solid #334155;border-radius:10px;font-weight:800}
  #resultOverlay .btns{margin-top:14px;display:flex;gap:12px;justify-content:flex-end}
  #resultOverlay .btns button{padding:10px 14px;border-radius:12px;border:1px solid #243449;cursor:pointer;font-weight:800}
  #resultOverlay #btnRetry{background:#16a34a;color:#fff;border-color:#16a34a}
  #resultOverlay #btnHub{background:#0ea5e9;color:#fff;border-color:#0ea5e9}
  @media (max-width:820px){#resultOverlay .card{min-width:auto;width:92%} #resultOverlay .grid{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(css);

  // (ถ้ามีโค้ด start เกม/Hub ตรงไฟล์นี้อยู่แล้ว ให้คงไว้ด้านล่าง)
})();
