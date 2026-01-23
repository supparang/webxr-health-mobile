// === /herohealth/hub-dashboard.js ===
// HeroHealth Dashboard — Multi-game (Hydration + Hygiene) — PACK AK
// Reads localStorage:
// - HHA_LAST_SUMMARY (latest session summary)
// - HHA_HYDRATION_EVENTS_LAST (latest hydration events pack)
// - HHA_HYGIENE_EVENTS_LAST   (latest hygiene events pack)
//
// Shows:
// - For Hydration: aim assist lockPx, RT, panic-ish, storm/boss counters (legacy-compatible)
// - For Hygiene: step accuracy, boss pattern, boss skill score, panic index, RT normal vs boss, soap/block stats

(function(){
  'use strict';

  const $ = (sel)=>document.querySelector(sel);

  function loadJSON(key){
    try{
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : null;
    }catch(_){ return null; }
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function median(arr){
    arr = (arr||[]).map(Number).filter(x=>isFinite(x)).sort((a,b)=>a-b);
    if(!arr.length) return 0;
    const m = (arr.length-1)/2;
    return (arr.length%2) ? arr[m|0] : (arr[m|0] + arr[(m|0)+1])/2;
  }

  function pct(n, d){
    n = Number(n||0); d = Math.max(1, Number(d||0));
    return (100*n/d);
  }

  // sparkline SVG from numbers
  function spark(values){
    values = (values||[]).map(Number).filter(x=>isFinite(x));
    if(values.length < 2) return '';
    const w = 120, h = 24;
    const min = Math.min(...values), max = Math.max(...values);
    const den = Math.max(1e-6, max-min);
    const pts = values.map((v,i)=>{
      const x = (i/(values.length-1))*w;
      const y = h - ((v-min)/den)*h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
      <polyline fill="none" stroke="currentColor" stroke-width="2" points="${pts}"></polyline>
    </svg>`;
  }

  function normalizeGameMode(sum){
    const g = String(sum?.gameMode || sum?.game || sum?.game_mode || '').toLowerCase();
    if(g.includes('hydration')) return 'hydration';
    if(g.includes('hygiene') || g.includes('handwash') || g.includes('wash')) return 'hygiene';
    if(g.includes('goodjunk')) return 'goodjunk';
    if(g.includes('plate')) return 'plate';
    if(g.includes('groups')) return 'groups';
    return g || 'unknown';
  }

  function readEventsPack(gameKey){
    if(gameKey === 'hygiene') return loadJSON('HHA_HYGIENE_EVENTS_LAST');
    if(gameKey === 'hydration') return loadJSON('HHA_HYDRATION_EVENTS_LAST');
    return null;
  }

  function safeText(s){
    return String(s ?? '').replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function render(){
    const host = $('#hhDash');
    if(!host) return;

    const sum = loadJSON('HHA_LAST_SUMMARY') || loadJSON('hha_last_summary');
    const gameKey = normalizeGameMode(sum);
    const pack = readEventsPack(gameKey);
    const events = (pack && Array.isArray(pack.events)) ? pack.events : [];

    // ---------------- Hydration metrics (legacy / compatible) ----------------
    function calcHydration(){
      const shotEv = events.filter(e=>e.type==='shot');
      const lockPxSeries = shotEv.map(e=>e.lockPx).filter(x=>isFinite(x));
      const lockPxMed = median(lockPxSeries);

      const hitEv = events.filter(e=>e.type==='hit' && e.kind==='good');
      const rtSeries = hitEv.map(e=>e.rtMs).filter(x=>isFinite(x));
      const rtMed = median(rtSeries);

      const badHitEv = events.filter(e=>e.type==='bad_hit');
      const blockEv  = events.filter(e=>e.type==='block');
      const perfectEv= events.filter(e=>e.type==='perfect_block');

      const stormEnter = events.filter(e=>e.type==='storm_enter').length;
      const miniPass  = events.filter(e=>e.type==='mini_pass').length;
      const bossClear = events.filter(e=>e.type==='boss_clear').length;

      const expireGood = events.filter(e=>e.type==='expire' && e.kind==='good').length;
      const missShots  = shotEv.filter(e=>e.hit===false).length;

      const panic = clamp((badHitEv.length*1.0 + missShots*0.45 + expireGood*0.65), 0, 999);
      const blocks = blockEv.length;
      const blocksPerStorm = stormEnter ? (blocks / stormEnter) : 0;

      const acc = sum ? Number(sum.accuracyGoodPct||0) : 0;
      const grade = sum ? String(sum.grade||'-') : '-';

      return {
        lockPxSeries, lockPxMed,
        rtSeries, rtMed,
        panic, badHit: badHitEv.length, missShots, expireGood,
        stormEnter, miniPass, blocks, perfect: perfectEv.length, blocksPerStorm,
        bossClear,
        acc, grade
      };
    }

    // ---------------- Hygiene metrics (PACK AK) ----------------
    function calcHygiene(){
      const stepHit = events.filter(e=>e.type==='step_hit');
      const ok = stepHit.filter(e=>e.ok===true);
      const wrong = stepHit.filter(e=>e.ok===false);

      const rtOk = ok.map(e=>e.rtMs).filter(x=>isFinite(x));
      const rtOkBoss = ok.filter(e=>e.bossActive).map(e=>e.rtMs).filter(x=>isFinite(x));
      const rtOkNormal = ok.filter(e=>!e.bossActive).map(e=>e.rtMs).filter(x=>isFinite(x));

      const rtMedAll = median(rtOk);
      const rtMedBoss = median(rtOkBoss);
      const rtMedNormal = median(rtOkNormal);

      const hazHit = events.filter(e=>e.type==='haz_hit').length;
      const hazBlock = events.filter(e=>e.type==='haz_block').length;
      const soapPick = events.filter(e=>e.type==='soap_pick').length;

      const loopComplete = events.filter(e=>e.type==='loop_complete').length;

      const bossEnter = events.filter(e=>e.type==='boss_enter').length;
      const bossClear = events.filter(e=>e.type==='boss_clear').length;
      const lastBossExit = [...events].reverse().find(e=>e.type==='boss_exit') || null;

      const totalStep = ok.length + wrong.length;
      const stepAcc = totalStep ? (ok.length / totalStep) : 0;

      // Boss Skill Score (interpretability-friendly):
      // + soapPick (ช่วยรอด), + hazBlock (กันได้), - hazHit (โดนเชื้อ), - wrong (ยิงผิดขั้น)
      const bossOnlyWrong = wrong.filter(e=>e.bossActive).length;
      const bossOnlyHazHit = events.filter(e=>e.type==='haz_hit' && e.bossActive).length;
      const bossOnlyBlock = events.filter(e=>e.type==='haz_block' && e.bossActive).length;
      const bossOnlySoap = events.filter(e=>e.type==='soap_pick' && e.bossActive).length;

      const bossSkill = clamp(
        (bossOnlySoap*1.2 + bossOnlyBlock*1.0) - (bossOnlyHazHit*1.6 + bossOnlyWrong*0.7),
        -999, 999
      );

      // Panic Index (Hygiene):
      // โดนเชื้อหนักสุด + ยิงผิดขั้น + RT แกว่งมาก (ใช้ IQR แบบง่าย)
      const rtRecent = rtOk.slice(-18);
      const rtSorted = rtRecent.slice().sort((a,b)=>a-b);
      const q = (p)=>{
        if(!rtSorted.length) return 0;
        const i = (rtSorted.length-1)*p;
        const lo = Math.floor(i), hi = Math.ceil(i);
        const t = i-lo;
        return (hi===lo) ? rtSorted[lo] : rtSorted[lo]*(1-t)+rtSorted[hi]*t;
      };
      const iqr = Math.max(0, q(0.75)-q(0.25)); // ความแกว่งของ RT
      const panic = clamp((hazHit*1.0 + wrong.length*0.65) + (iqr/450), 0, 999);

      const bossPattern = sum?.bossPattern || pack?.meta?.bossPattern || '-';

      // Trend
      const rtTrend = rtOk.slice(-18);
      const accTrend = (() => {
        // rolling 12-hit window of step accuracy (rough trend)
        const arr = [];
        const w = 12;
        for(let i=0;i<stepHit.length;i++){
          const sub = stepHit.slice(Math.max(0, i-w+1), i+1);
          const okN = sub.filter(x=>x.ok===true).length;
          arr.push(okN / Math.max(1, sub.length));
        }
        return arr.slice(-18);
      })();

      return {
        stepAcc,
        okN: ok.length,
        wrongN: wrong.length,
        hazHit, hazBlock, soapPick,
        loopComplete,
        bossEnter, bossClear,
        lastBossExit,
        bossPattern,
        rtMedAll, rtMedBoss, rtMedNormal,
        bossSkill,
        panic,
        rtTrend,
        accTrend
      };
    }

    // ---------------- UI ----------------
    const titleGame = sum ? String(sum.gameMode||sum.game||'-') : '-';
    const diff = sum ? String(sum.diff||'-') : '-';
    const mode = sum ? String(sum.runMode||sum.run||'-') : '-';
    const seed = sum ? String(sum.seed||'-') : '-';

    // compute
    const H = (gameKey==='hygiene') ? calcHygiene() : null;
    const HY = (gameKey==='hydration') ? calcHydration() : null;

    host.innerHTML = `
      <style>
        #hhDash{margin:14px 0 8px 0}
        .hhd-wrap{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.55);
          border-radius:18px;
          padding:14px;
          color:#e5e7eb;
          font-family:system-ui,-apple-system,Segoe UI,sans-serif;
        }
        .hhd-top{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;justify-content:space-between}
        .hhd-title{font-weight:900;font-size:16px}
        .hhd-sub{opacity:.85;font-size:12px;margin-top:2px;line-height:1.35}
        .hhd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}
        .hhd-card{
          border:1px solid rgba(148,163,184,.16);
          background:rgba(15,23,42,.55);
          border-radius:16px;
          padding:12px;
        }
        .hhd-k{opacity:.85;font-size:12px}
        .hhd-v{font-weight:950;font-size:18px;margin-top:4px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
        .hhd-mini{opacity:.9;font-size:12px;margin-top:6px;line-height:1.35}
        .hhd-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
        .hhd-btn{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.55);
          color:#e5e7eb;
          border-radius:999px;
          padding:8px 10px;
          font-weight:850;
          cursor:pointer;
        }
        .hhd-btn:active{transform:translateY(1px)}
        .hhd-note{opacity:.9;font-size:12px;margin-top:10px;line-height:1.35}
        .pill{
          border-radius:999px;
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.50);
          padding:6px 10px;
          font-weight:850;
          font-size:12px;
        }
        .pill.good{border-color:rgba(34,197,94,.28);background:rgba(34,197,94,.10)}
        .pill.warn{border-color:rgba(245,158,11,.30);background:rgba(245,158,11,.10)}
        .pill.bad{border-color:rgba(239,68,68,.30);background:rgba(239,68,68,.10)}
      </style>

      <div class="hhd-wrap">
        <div class="hhd-top">
          <div>
            <div class="hhd-title">📊 HeroHealth Dashboard (ล่าสุด)</div>
            <div class="hhd-sub">
              ${sum ? `Game: <b>${safeText(titleGame)}</b> • Diff: <b>${safeText(diff)}</b> • Mode: <b>${safeText(mode)}</b> • Seed: <b>${safeText(seed)}</b>` : 'ยังไม่มีผลล่าสุด (เล่นสักรอบก่อน)'}
              <div style="margin-top:6px;display:flex;gap:8px;flex-wrap:wrap">
                <span class="pill ${gameKey==='hygiene'?'good':''}">🧼 Hygiene</span>
                <span class="pill ${gameKey==='hydration'?'good':''}">💧 Hydration</span>
              </div>
            </div>
          </div>
          <div class="hhd-row">
            <button class="hhd-btn" id="btnDashCopySum">📋 Copy Summary</button>
            <button class="hhd-btn" id="btnDashCopyEv">📋 Copy Events</button>
            <button class="hhd-btn" id="btnDashClearEv">🧹 Clear Events</button>
          </div>
        </div>

        ${(!sum) ? `
          <div class="hhd-note">เล่นเกมอย่างน้อย 1 รอบก่อน แล้ว Dashboard จะขึ้นข้อมูลอัตโนมัติ ✅</div>
        ` : ''}

        ${(gameKey==='hygiene') ? `
          <div class="hhd-grid">
            <div class="hhd-card">
              <div class="hhd-k">🎯 Step Accuracy (ถูก/ทั้งหมด)</div>
              <div class="hhd-v">
                ${(H.stepAcc*100).toFixed(1)}%
                <span class="pill ${(H.stepAcc>=0.82?'good':(H.stepAcc>=0.68?'warn':'bad'))}">
                  ok ${H.okN} / wrong ${H.wrongN}
                </span>
              </div>
              <div class="hhd-mini">Trend: ${spark(H.accTrend.map(x=>x*100))}</div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">😈 Boss (pattern / clear)</div>
              <div class="hhd-v">
                ${safeText(H.bossPattern || '-')}
                <span class="pill ${(H.bossClear>0?'good':'warn')}">clear ${H.bossClear}/${H.bossEnter}</span>
              </div>
              <div class="hhd-mini">
                ${H.lastBossExit ? `exit: soap ${H.lastBossExit.soapPicked ?? '-'} • haz ${H.lastBossExit.hazHits ?? '-'} • wrong ${H.lastBossExit.wrongHits ?? '-'}` : 'ยังไม่มี boss_exit event'}
              </div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">⏱️ Median RT (hit ถูก)</div>
              <div class="hhd-v">
                ${H.rtMedAll ? `${H.rtMedAll.toFixed(0)} ms` : '-'}
                <span class="pill">normal ${H.rtMedNormal?H.rtMedNormal.toFixed(0):'-'} ms</span>
                <span class="pill ${H.rtMedBoss && H.rtMedBoss>H.rtMedNormal ? 'warn':'good'}">boss ${H.rtMedBoss?H.rtMedBoss.toFixed(0):'-'} ms</span>
              </div>
              <div class="hhd-mini">RT trend: ${spark(H.rtTrend)}</div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">🔥 Panic Index (Hygiene)</div>
              <div class="hhd-v">
                ${H.panic.toFixed(1)}
                <span class="pill bad">haz_hit ${H.hazHit}</span>
                <span class="pill warn">wrong ${H.wrongN}</span>
              </div>
              <div class="hhd-mini">ตีความง่าย ๆ: โดนเชื้อ + ยิงผิดขั้น + RT แกว่ง → panic สูง</div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">🧼 Soap / 🛡 Block</div>
              <div class="hhd-v">
                SOAP ${H.soapPick}
                <span class="pill cyan">block ${H.hazBlock}</span>
                <span class="pill bad">haz_hit ${H.hazHit}</span>
              </div>
              <div class="hhd-mini">เป้าหมายบอสที่ดี: SOAP ≥ 2 และ haz_hit ช่วงบอส ≤ 1</div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">🏁 Loops (ครบ 7 ขั้น)</div>
              <div class="hhd-v">
                ${H.loopComplete}
                <span class="pill ${(H.loopComplete>=2?'good':(H.loopComplete>=1?'warn':'bad'))}">loops</span>
              </div>
              <div class="hhd-mini">วัด “ความอึด + ความสม่ำเสมอ” ได้ดีมากใน Survival</div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">💎 Boss Skill Score</div>
              <div class="hhd-v">
                ${H.bossSkill.toFixed(1)}
                <span class="pill ${(H.bossSkill>=1?'good':(H.bossSkill>=-1?'warn':'bad'))}">skill</span>
              </div>
              <div class="hhd-mini">สูตร: +soap +block −haz_hit −wrong (ตีความง่ายสำหรับครู)</div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">🧪 Data Availability</div>
              <div class="hhd-v">
                events ${(events && events.length) ? events.length : 0}
                <span class="pill">${safeText(pack?.meta?.sessionId || sum?.sessionId || '-')}</span>
              </div>
              <div class="hhd-mini">Key: <code>HHA_HYGIENE_EVENTS_LAST</code></div>
            </div>
          </div>

          <div class="hhd-note">
            ✅ Hygiene Dashboard ใช้ events ระดับ “พฤติกรรม” (step_hit / haz / soap / boss) •
            ถ้าพร้อมค่อยต่อ Google Sheet ได้แบบ Sessions + Events เหมือนเกมอื่น
          </div>
        ` : ''}

        ${(gameKey==='hydration') ? `
          <div class="hhd-grid">
            <div class="hhd-card">
              <div class="hhd-k">🎯 Accuracy / Grade</div>
              <div class="hhd-v">${sum ? `${(HY.acc||0).toFixed(1)}% • ${safeText(HY.grade)}` : '-'}</div>
              <div class="hhd-mini">ComboMax: <b>${sum ? (sum.comboMax|0) : '-'}</b> • Miss: <b>${sum ? (sum.misses|0) : '-'}</b></div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">⏱️ Median RT (spawn→hit)</div>
              <div class="hhd-v">${HY.rtMed ? `${HY.rtMed.toFixed(0)} ms` : (sum ? `${Number(sum.medianRtGoodMs||0).toFixed(0)} ms` : '-')}</div>
              <div class="hhd-mini">Avg RT: <b>${sum ? Number(sum.avgRtGoodMs||0).toFixed(0) : '-'}</b> ms</div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">🎯 cVR Aim Assist (lockPx)</div>
              <div class="hhd-v">${HY.lockPxSeries.length ? `${HY.lockPxMed.toFixed(0)} px` : '-'}</div>
              <div class="hhd-mini">${HY.lockPxSeries.length ? `Trend: ${spark(HY.lockPxSeries.slice(-18))}` : 'ต้องเล่นโหมด cVR เพื่อเก็บค่า lockPx'}</div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">🔥 Panic Index</div>
              <div class="hhd-v">${HY.panic.toFixed(1)}</div>
              <div class="hhd-mini">bad_hit: <b>${HY.badHit}</b> • missShots: <b>${HY.missShots}</b> • expireGood: <b>${HY.expireGood}</b></div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">🌀 Storm / Mini</div>
              <div class="hhd-v">${HY.miniPass}/${HY.stormEnter || 0}</div>
              <div class="hhd-mini">Perfect Block: <b>${HY.perfect}</b> • Blocks/storm: <b>${HY.blocksPerStorm.toFixed(2)}</b></div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">🌩️ Boss</div>
              <div class="hhd-v">${HY.bossClear}</div>
              <div class="hhd-mini">Blocks: <b>${HY.blocks}</b> • Perfect: <b>${HY.perfect}</b></div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">🧪 Data Availability</div>
              <div class="hhd-v">
                events ${(events && events.length) ? events.length : 0}
                <span class="pill">${safeText(pack?.meta?.sessionId || sum?.sessionId || '-')}</span>
              </div>
              <div class="hhd-mini">Key: <code>HHA_HYDRATION_EVENTS_LAST</code></div>
            </div>

            <div class="hhd-card">
              <div class="hhd-k">🧭 Note</div>
              <div class="hhd-v">Hydration mode</div>
              <div class="hhd-mini">Dashboard นี้ยังคง compatible กับ events schema เดิมของ Hydration ✅</div>
            </div>
          </div>

          <div class="hhd-note">
            ✅ Hydration Dashboard: ถ้าตั้ง <code>&log=.../exec</code> ในอนาคตจะส่งขึ้นชีทอัตโนมัติ (Sessions + Events) •
            ตอนนี้เราเก็บ local ไว้ก่อนตามที่คุณพัก Google Sheet อยู่
          </div>
        ` : ''}

        ${(gameKey!=='hygiene' && gameKey!=='hydration' && sum) ? `
          <div class="hhd-note">
            ตอนนี้ Dashboard โฟกัส Hygiene/Hydration ก่อน ✅
            ถ้าจะให้รองรับ <b>${safeText(gameKey)}</b> ต่อ เดี๋ยวผมทำ PACK เพิ่มให้ได้เลย
          </div>
        ` : ''}
      </div>
    `;

    // Buttons
    $('#btnDashCopySum')?.addEventListener('click', async ()=>{
      try{
        const raw = localStorage.getItem('HHA_LAST_SUMMARY') || localStorage.getItem('hha_last_summary') || '';
        if(!raw) return;
        await navigator.clipboard.writeText(raw);
      }catch(_){}
    });

    $('#btnDashCopyEv')?.addEventListener('click', async ()=>{
      try{
        const key = (gameKey==='hygiene') ? 'HHA_HYGIENE_EVENTS_LAST' : (gameKey==='hydration' ? 'HHA_HYDRATION_EVENTS_LAST' : '');
        const raw = key ? (localStorage.getItem(key) || '') : '';
        if(!raw) return;
        await navigator.clipboard.writeText(raw);
      }catch(_){}
    });

    $('#btnDashClearEv')?.addEventListener('click', ()=>{
      try{
        const key = (gameKey==='hygiene') ? 'HHA_HYGIENE_EVENTS_LAST' : (gameKey==='hydration' ? 'HHA_HYDRATION_EVENTS_LAST' : '');
        if(key) localStorage.removeItem(key);
        render();
      }catch(_){}
    });
  }

  window.addEventListener('focus', render);
  render();
})();