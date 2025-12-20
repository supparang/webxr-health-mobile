(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  function ensure(){
    let el = doc.querySelector('.hha-summary');
    if (el) return el;

    el = doc.createElement('div');
    el.className = 'hha-summary';
    Object.assign(el.style, {
      position:'fixed',
      inset:'0',
      zIndex:'900',
      display:'none',
      alignItems:'center',
      justifyContent:'center',
      padding:'18px',
      background:'rgba(2,6,23,0.86)'
    });

    el.innerHTML = `
      <div class="hha-summary-card" style="
        width:min(640px, 96vw);
        border-radius:22px;
        padding:14px 14px 12px;
        background:linear-gradient(135deg, rgba(15,23,42,0.98), rgba(15,23,42,0.84));
        border:1px solid rgba(148,163,184,0.2);
        box-shadow:0 30px 80px rgba(0,0,0,0.55);
        color:#e5e7eb;
      ">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
          <div>
            <div style="font-weight:950;font-size:18px;">สรุปผลการเล่น 🎉</div>
            <div class="hha-summary-sub" style="color:#9ca3af;font-size:12px;margin-top:2px;"></div>
          </div>
          <div class="hha-summary-grade" style="
            border-radius:999px;
            padding:6px 10px;
            border:1px solid rgba(187,247,208,0.7);
            background:rgba(15,23,42,0.8);
            font-weight:950;
          ">GRADE A</div>
        </div>

        <div class="hha-summary-grid" style="
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap:10px;
          margin-top:12px;
        ">
          <div class="box" style="border:1px solid rgba(148,163,184,0.18); border-radius:16px; padding:10px;">
            <div style="color:#9ca3af;font-size:11px;letter-spacing:.14em;text-transform:uppercase;">Score</div>
            <div class="hha-summary-score" style="font-size:22px;font-weight:950;margin-top:2px;color:#22c55e;">0</div>
            <div class="hha-summary-lines" style="font-size:12px;color:#cbd5e1;margin-top:6px;line-height:1.35;"></div>
          </div>

          <div class="box" style="border:1px solid rgba(148,163,184,0.18); border-radius:16px; padding:10px;">
            <div style="color:#9ca3af;font-size:11px;letter-spacing:.14em;text-transform:uppercase;">Quests</div>
            <div class="hha-summary-quests" style="font-size:14px;font-weight:850;margin-top:2px;">0 / 2</div>
            <div class="hha-summary-minis" style="font-size:12px;color:#cbd5e1;margin-top:6px;">mini ผ่าน 0</div>
            <div class="hha-summary-logger" style="font-size:11px;color:#9ca3af;margin-top:6px;">logger: …</div>
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px;">
          <button class="hha-btn hha-restart" style="border-radius:999px;border:1px solid rgba(148,163,184,0.6);padding:9px 12px;background:rgba(15,23,42,0.86);color:#e5e7eb;font-weight:850;cursor:pointer;">เล่นใหม่</button>
          <button class="hha-btn hha-hub" style="border-radius:999px;border:1px solid rgba(187,247,208,0.9);padding:9px 12px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#052e16;font-weight:950;cursor:pointer;">กลับ Hub</button>
        </div>
      </div>
    `;

    doc.body.appendChild(el);
    return el;
  }

  function fmtMode(d){
    const run = String(d.runMode||'play').toUpperCase();
    const diff = String(d.diff||'normal').toUpperCase();
    const ch = String(d.challenge||'rush').toUpperCase();
    const t = Number(d.durationSec||0)|0;
    return `${run} • ${diff} • ${ch} • ${t}s`;
  }

  function show(detail = {}){
    const el = ensure();
    const card = el.querySelector('.hha-summary-card');

    const sub = el.querySelector('.hha-summary-sub');
    const grade = el.querySelector('.hha-summary-grade');
    const score = el.querySelector('.hha-summary-score');
    const lines = el.querySelector('.hha-summary-lines');
    const quests = el.querySelector('.hha-summary-quests');
    const minis = el.querySelector('.hha-summary-minis');
    const logger = el.querySelector('.hha-summary-logger');

    sub.textContent = fmtMode(detail);

    grade.textContent = `GRADE ${detail.grade || 'A'}`;
    score.textContent = String(detail.score ?? 0);

    const good = detail.good ?? 0;
    const perfect = detail.perfect ?? 0;
    const miss = detail.miss ?? 0;

    lines.innerHTML = `
      ✅ good: <b>${good}</b><br/>
      🌟 perfect: <b>${perfect}</b><br/>
      ❌ miss: <b>${miss}</b>
    `;

    const gC = detail.goalsCleared ?? 0;
    const gT = detail.goalsTotal ?? 2;
    quests.textContent = `${gC} / ${gT} goals`;

    minis.textContent = `mini ผ่าน ${detail.minisCleared ?? 0}`;

    const lg = detail.logger || {};
    logger.textContent = lg.pending ? 'logger: pending…' : (lg.ok ? 'logger: ok ✓' : `logger: ${lg.message||'error'}`);

    const btnRestart = el.querySelector('.hha-restart');
    const btnHub = el.querySelector('.hha-hub');

    btnRestart.onclick = ()=> location.href = detail.restartUrl || location.href.split('#')[0];
    btnHub.onclick = ()=> location.href = detail.hubUrl || './hub.html';

    el.style.display = 'flex';
    el.addEventListener('click', (e)=>{
      // click outside card -> close
      if (e.target === el){
        el.style.display = 'none';
      }
    }, { once:true });

    // keep focus (optional)
    if (card) card.focus?.();
  }

  root.HHA_Summary = { show };

})(window);
