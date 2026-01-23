// === /herohealth/hub-boss-inspector.js ===
// PACK AM — Boss Replay Inspector (Hygiene-first, but works with any events pack)
// Reads: HHA_HYGIENE_EVENTS_LAST / HHA_HYDRATION_EVENTS_LAST
// Detect boss segments if events contain boss_*
// If no boss events, shows "No boss segments" + global summary
// UI: segments list + quick KPIs + coach tip + copy JSON + export CSV

(function(){
  'use strict';

  const HOST_ID = 'hhBoss';
  const KEY_HYGI = 'HHA_HYGIENE_EVENTS_LAST';
  const KEY_HYDR = 'HHA_HYDRATION_EVENTS_LAST';
  const KEY_SUM  = 'HHA_LAST_SUMMARY';

  const $ = (sel)=>document.querySelector(sel);

  function loadJSON(key){
    try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; }
    catch(_){ return null; }
  }
  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, (m)=>({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }
  function copyText(text){
    const t = String(text ?? '');
    if(navigator.clipboard && navigator.clipboard.writeText){
      return navigator.clipboard.writeText(t).catch(()=>{});
    }
    return new Promise((resolve)=>{
      try{
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.position='fixed';
        ta.style.left='-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }catch(_){}
      resolve();
    });
  }
  function nowText(){
    try{ return new Date().toLocaleString('th-TH', { hour12:false }); }
    catch(_){ return new Date().toISOString(); }
  }

  function normalizeGameMode(sum){
    const g = String(sum?.gameMode || sum?.game || '').toLowerCase();
    if(g.includes('hygiene') || g.includes('handwash')) return 'hygiene';
    if(g.includes('hydration')) return 'hydration';
    return g || 'unknown';
  }

  function pickPackSource(){
    const sum = loadJSON(KEY_SUM);
    const g = normalizeGameMode(sum);
    if(g==='hygiene' && localStorage.getItem(KEY_HYGI)) return 'hygiene';
    if(g==='hydration' && localStorage.getItem(KEY_HYDR)) return 'hydration';
    if(localStorage.getItem(KEY_HYGI)) return 'hygiene';
    if(localStorage.getItem(KEY_HYDR)) return 'hydration';
    return 'hygiene';
  }

  function readPack(source){
    return (source==='hydration') ? loadJSON(KEY_HYDR) : loadJSON(KEY_HYGI);
  }

  // ---- Boss segmentation (works if events include boss_enter / boss_exit / boss_clear / boss_fail) ----
  function isBossStart(type){
    type = String(type||'').toLowerCase();
    return (type === 'boss_enter' || type === 'boss_start' || type === 'boss_begin');
  }
  function isBossEnd(type){
    type = String(type||'').toLowerCase();
    return (type === 'boss_exit' || type === 'boss_end' || type === 'boss_clear' || type === 'boss_fail');
  }
  function isBossType(type){
    type = String(type||'').toLowerCase();
    return type.startsWith('boss_') || isBossStart(type) || isBossEnd(type);
  }

  function segmentBoss(events){
    const segs = [];
    let cur = null;

    for(const e of events){
      const type = String(e?.type||'').toLowerCase();

      if(isBossStart(type)){
        // close previous (if weird data)
        if(cur){
          cur.endType = cur.endType || 'boss_exit';
          cur.endT = (cur.endT!=null ? cur.endT : e.t);
          segs.push(cur);
        }
        cur = {
          idx: segs.length + 1,
          startT: e.t,
          startType: type,
          endT: null,
          endType: null,
          events: [e]
        };
        continue;
      }

      if(cur){
        cur.events.push(e);
        if(isBossEnd(type)){
          cur.endT = e.t;
          cur.endType = type;
          segs.push(cur);
          cur = null;
        }
      }
    }

    // if boss never ended, still keep it
    if(cur){
      cur.endType = cur.endType || 'boss_unknown_end';
      cur.endT = cur.endT!=null ? cur.endT : null;
      segs.push(cur);
    }

    return segs;
  }

  // ---- Metrics summarizer (works for hygiene/hydration style) ----
  function summarizeEvents(evs){
    const out = {
      n: evs.length,
      // hygiene-ish
      stepHitOk: 0,
      stepHitWrong: 0,
      hazHit: 0,
      hazBlock: 0,
      soapPick: 0,
      loopComplete: 0,
      // hydration-ish
      stormEnter: 0,
      stormExit: 0,
      badHit: 0,
      hitGood: 0,
      hitBad: 0,
      shot: 0,
      missShot: 0,
      expireGood: 0,
      // generic
      bossEvents: 0,
      pauseToggle: 0
    };

    for(const e of evs){
      const t = String(e?.type||'').toLowerCase();

      if(isBossType(t)) out.bossEvents++;

      if(t === 'step_hit'){
        if(e?.ok === true) out.stepHitOk++;
        else out.stepHitWrong++;
      }
      if(t === 'haz_hit') out.hazHit++;
      if(t === 'haz_block' || t === 'block') out.hazBlock++;
      if(t === 'soap_pick') out.soapPick++;
      if(t === 'loop_complete') out.loopComplete++;

      if(t === 'storm_enter') out.stormEnter++;
      if(t === 'storm_exit') out.stormExit++;
      if(t === 'bad_hit') out.badHit++;
      if(t === 'hit' && e?.kind === 'good') out.hitGood++;
      if(t === 'hit' && e?.kind === 'bad') out.hitBad++;
      if(t === 'shot'){
        out.shot++;
        if(e?.hit === false) out.missShot++;
      }
      if(t === 'expire' && e?.kind === 'good') out.expireGood++;
      if(t === 'pause_toggle') out.pauseToggle++;
    }

    // derived
    const stepTotal = out.stepHitOk + out.stepHitWrong;
    out.stepAcc = stepTotal ? (out.stepHitOk/stepTotal) : null;

    const shots = out.shot || 0;
    out.shotAcc = shots ? ((shots - out.missShot)/shots) : null;

    return out;
  }

  function coachTipFromMetrics(m, source){
    // source: hygiene/hydration
    if(source === 'hygiene'){
      const tips = [];

      if(m.stepAcc != null){
        if(m.stepAcc < 0.65) tips.push('โฟกัส “ยิงเฉพาะไอคอนขั้นตอนปัจจุบัน” ลดการกดยิงมั่ว');
        else if(m.stepAcc < 0.80) tips.push('เริ่มนิ่ง ๆ ก่อน: เล็งให้ชัด แล้วค่อยเพิ่มความเร็ว');
        else tips.push('ความถูกต้องดีมาก! ลองเพิ่มสปีด/ลดเวลาตอบสนองให้ไวขึ้น');
      }else{
        tips.push('ยังไม่พบ event step_hit — ถ้าอยากให้สรุปละเอียด ให้ log “step_hit ok/false” ในเกม');
      }

      if(m.hazHit >= 3) tips.push('โดนเชื้อบ่อย: เพิ่ม “มองหามุมว่าง” ก่อนยิง และอย่ายิงตอนเป้าเบียดกัน');
      if(m.soapPick === 0) tips.push('ถ้ามีไอเทมสบู่ในบอส: ให้บันทึก event soap_pick เพื่อวัด “กลยุทธ์” ได้');
      if(m.loopComplete === 0) tips.push('ถ้าอยากวัด “ครบ 7 ขั้นตอน”: แนะนำ emit loop_complete ทุกครั้งที่ครบ 7');

      return tips.length ? ('🤖 โค้ช: ' + tips.join(' • ')) : '🤖 โค้ช: ทำได้ดีมาก!';
    }

    // hydration
    const tips = [];
    if(m.shotAcc != null){
      if(m.shotAcc < 0.55) tips.push('เล็งช้าลงนิดหนึ่ง ลด missShots');
      else if(m.shotAcc < 0.75) tips.push('ดีขึ้นแล้ว! ลองคุมจังหวะยิงให้สม่ำเสมอ');
      else tips.push('แม่นมาก! ลองโหมดยาก/เพิ่มสปีด');
    }
    if(m.badHit >= 3) tips.push('โดนของไม่ดีบ่อย: ให้ตั้งเป้าหมาย “เห็นแล้วรอครึ่งจังหวะ” ก่อนยิง');
    return tips.length ? ('🤖 โค้ช: ' + tips.join(' • ')) : '🤖 โค้ช: เยี่ยม!';
  }

  function toCsv(rows){
    if(!rows || !rows.length) return '';
    const keys = new Set();
    rows.forEach(r=>{
      if(r && typeof r==='object') Object.keys(r).forEach(k=>keys.add(k));
    });
    const headers = Array.from(keys);
    const escCsv = (v)=>{
      if(v==null) return '';
      if(typeof v==='object') v = JSON.stringify(v);
      v = String(v);
      if(/[",\n]/.test(v)) v = `"${v.replace(/"/g,'""')}"`;
      return v;
    };
    const lines = [];
    lines.push(headers.map(escCsv).join(','));
    for(const r of rows){
      lines.push(headers.map(k=>escCsv(r ? r[k] : '')).join(','));
    }
    return lines.join('\n');
  }
  function downloadText(filename, content){
    try{
      const blob = new Blob([content], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url), 1500);
    }catch(_){}
  }

  function render(){
    const host = document.getElementById(HOST_ID);
    if(!host) return;

    const sourceDefault = pickPackSource();
    const pack0 = readPack(sourceDefault);
    const sum = loadJSON(KEY_SUM);
    const gsum = normalizeGameMode(sum);

    host.innerHTML = `
      <style>
        #${HOST_ID}{ margin:14px 0 8px 0; }
        .hb-wrap{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.55);
          border-radius:18px;
          padding:14px;
          color:#e5e7eb;
          font-family:system-ui,-apple-system,Segoe UI,sans-serif;
        }
        .hb-top{ display:flex; flex-wrap:wrap; gap:10px; align-items:flex-start; justify-content:space-between; }
        .hb-title{ font-weight:900; font-size:16px; }
        .hb-sub{ opacity:.9; font-size:12px; line-height:1.35; margin-top:2px; }
        .row{ display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; align-items:center; }
        .btn{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.55);
          color:#e5e7eb;
          border-radius:999px;
          padding:8px 10px;
          font-weight:850;
          cursor:pointer;
          user-select:none;
        }
        .btn:active{ transform: translateY(1px); }
        .sel{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(15,23,42,.55);
          color:#e5e7eb;
          border-radius:12px;
          padding:9px 10px;
          font-weight:850;
          font-size:12px;
          outline:none;
        }
        .pill{
          border:1px solid rgba(148,163,184,.18);
          background:rgba(15,23,42,.55);
          color:#e5e7eb;
          border-radius:999px;
          padding:7px 10px;
          font-weight:850;
          font-size:12px;
        }
        .grid{
          display:grid;
          grid-template-columns: repeat(3, minmax(0,1fr));
          gap:10px;
          margin-top:12px;
        }
        @media (max-width:900px){ .grid{ grid-template-columns:1fr; } }
        .card{
          border:1px solid rgba(148,163,184,.14);
          background:rgba(15,23,42,.55);
          border-radius:16px;
          padding:12px;
        }
        .k{ opacity:.85; font-size:12px; }
        .v{ font-weight:900; font-size:18px; margin-top:4px; }
        .mini{ opacity:.9; font-size:12px; margin-top:6px; line-height:1.35; }
        .list{
          margin-top:12px;
          border:1px solid rgba(148,163,184,.14);
          border-radius:16px;
          overflow:hidden;
        }
        .item{
          padding:10px 12px;
          border-bottom:1px solid rgba(148,163,184,.10);
          background:rgba(2,6,23,.25);
          cursor:pointer;
          user-select:none;
        }
        .item:hover{ background:rgba(15,23,42,.35); }
        .item:last-child{ border-bottom:none; }
        .tag{
          display:inline-block;
          border:1px solid rgba(148,163,184,.18);
          background:rgba(2,6,23,.45);
          border-radius:999px;
          padding:4px 8px;
          font-weight:850;
          font-size:11px;
          opacity:.95;
          white-space:nowrap;
        }
        .tag.boss{ border-color: rgba(239,68,68,.28); background: rgba(239,68,68,.10); }
        .tag.ok{ border-color: rgba(34,197,94,.28); background: rgba(34,197,94,.10); }
        .tag.warn{ border-color: rgba(245,158,11,.28); background: rgba(245,158,11,.10); }
        .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; font-size:12px; }
        .pre{
          margin-top:10px;
          border:1px solid rgba(148,163,184,.14);
          background:rgba(2,6,23,.40);
          border-radius:14px;
          padding:10px;
          font-size:11px;
          line-height:1.35;
          max-height:240px;
          overflow:auto;
          display:none;
        }
      </style>

      <div class="hb-wrap">
        <div class="hb-top">
          <div>
            <div class="hb-title">👹 Boss Replay Inspector</div>
            <div class="hb-sub">
              สรุป “ช่วงบอส” ถ้ามี boss_* events • ถ้ายังไม่มี → สรุปรวมทั้งแพ็คให้แทน<br>
              Last summary: <b>${esc(gsum||'-')}</b> • เวลา: <span class="mono">${esc(nowText())}</span>
            </div>
          </div>
          <div class="row">
            <button class="btn" id="hbReload">↻ Reload</button>
            <button class="btn" id="hbExportCsv">⬇ Export CSV</button>
            <button class="btn" id="hbToggleRaw">🧬 Raw</button>
          </div>
        </div>

        <div class="row">
          <select class="sel" id="hbSource">
            <option value="hygiene">🧼 Hygiene (HHA_HYGIENE_EVENTS_LAST)</option>
            <option value="hydration">💧 Hydration (HHA_HYDRATION_EVENTS_LAST)</option>
          </select>
          <span class="pill" id="hbMeta">loading…</span>
          <span class="pill" id="hbBossMeta">boss: —</span>
        </div>

        <div class="grid" id="hbKpi"></div>
        <div class="card" id="hbCoach"></div>

        <div class="list" id="hbList"></div>
        <pre class="pre mono" id="hbRaw"></pre>

        <div class="mini" style="margin-top:10px; opacity:.9">
          ✅ แตะ “รายการบอส” เพื่อ Copy JSON ของ segment นั้นทันที •
          ถ้าอยากให้จับบอสได้ 100%: ให้เกม emit <span class="mono">boss_enter/boss_exit/boss_clear</span>
        </div>
      </div>
    `;

    const elSource = $('#hbSource');
    const elMeta = $('#hbMeta');
    const elBossMeta = $('#hbBossMeta');
    const elKpi = $('#hbKpi');
    const elCoach = $('#hbCoach');
    const elList = $('#hbList');
    const elRaw = $('#hbRaw');

    elSource.value = sourceDefault;

    function summarizeMeta(pack){
      const meta = pack?.meta || {};
      const evs = Array.isArray(pack?.events) ? pack.events : [];
      const sid = meta.sessionId || '-';
      const game = meta.game || elSource.value;
      const run = meta.runMode || meta.run || '-';
      const diff = meta.diff || '-';
      const view = meta.view || '-';
      const seed = (meta.seed!=null)? meta.seed : '-';
      elMeta.textContent = `${elSource.value} • ev=${evs.length} • sid=${sid} • ${run}/${diff}/${view} • seed=${seed} • game=${game}`;
    }

    function renderUI(pack){
      const evs = Array.isArray(pack?.events) ? pack.events : [];
      summarizeMeta(pack);

      const segs = segmentBoss(evs);
      elBossMeta.textContent = `boss: ${segs.length || 0}`;

      // Global metrics
      const mAll = summarizeEvents(evs);

      // KPI cards
      const stepAccTxt = (mAll.stepAcc==null) ? '—' : `${(mAll.stepAcc*100).toFixed(1)}%`;
      const shotAccTxt = (mAll.shotAcc==null) ? '—' : `${(mAll.shotAcc*100).toFixed(1)}%`;

      elKpi.innerHTML = `
        <div class="card">
          <div class="k">📦 Total events</div>
          <div class="v">${mAll.n}</div>
          <div class="mini">bossEvents: <b>${mAll.bossEvents}</b> • pause: <b>${mAll.pauseToggle}</b></div>
        </div>
        <div class="card">
          <div class="k">🧼 Hygiene accuracy</div>
          <div class="v">${stepAccTxt}</div>
          <div class="mini">stepHit ok: <b>${mAll.stepHitOk}</b> • wrong: <b>${mAll.stepHitWrong}</b> • hazHit: <b>${mAll.hazHit}</b></div>
        </div>
        <div class="card">
          <div class="k">🎯 Hydration accuracy</div>
          <div class="v">${shotAccTxt}</div>
          <div class="mini">shots: <b>${mAll.shot}</b> • missShots: <b>${mAll.missShot}</b> • badHit: <b>${mAll.badHit}</b></div>
        </div>
      `;

      // Coach tip
      const tip = coachTipFromMetrics(mAll, elSource.value);
      elCoach.innerHTML = `
        <div class="k">🤖 Coach Tip</div>
        <div class="mini" style="margin-top:6px">${esc(tip)}</div>
        <div class="mini" style="margin-top:6px; opacity:.85">
          หมายเหตุ: ถ้าอยากให้โค้ช “บอส-เฉพาะช่วง” ให้เกม log boss_* + soap_pick + haz_hit ให้ครบ
        </div>
      `;

      // Boss list
      if(!segs.length){
        elList.innerHTML = `
          <div class="item" style="cursor:default">
            <span class="tag warn">ยังไม่พบ boss_* events</span>
            <span style="opacity:.9"> • ระบบจึงสรุปรวมทั้งแพ็คแทน</span>
            <div class="mini" style="margin-top:6px; opacity:.9">
              ถ้าต้องการ “Boss Replay” จริง ๆ: ให้เกม emit <span class="mono">boss_enter/boss_exit/boss_clear</span>
            </div>
            <div class="row" style="margin-top:8px">
              <button class="btn" id="hbCopyAll">📋 Copy Pack JSON</button>
              <button class="btn" id="hbCopyAllMetrics">📋 Copy Metrics</button>
            </div>
          </div>
        `;

        $('#hbCopyAll')?.addEventListener('click', async ()=>{
          await copyText(JSON.stringify(pack || {}, null, 2));
        }, { passive:true });

        $('#hbCopyAllMetrics')?.addEventListener('click', async ()=>{
          await copyText(JSON.stringify(mAll, null, 2));
        }, { passive:true });

      }else{
        const items = [];
        segs.forEach((seg)=>{
          const m = summarizeEvents(seg.events);
          const dur = (seg.startT!=null && seg.endT!=null) ? (Number(seg.endT)-Number(seg.startT)).toFixed(2) : '—';
          const status = String(seg.endType||'boss_unknown').toLowerCase();
          const okTag = (status.includes('clear')) ? `<span class="tag ok">CLEAR</span>` :
                        (status.includes('fail')) ? `<span class="tag warn">FAIL</span>` :
                        `<span class="tag boss">${esc(seg.endType||'BOSS')}</span>`;

          const stepAcc = (m.stepAcc==null) ? '—' : `${(m.stepAcc*100).toFixed(0)}%`;

          items.push(`
            <div class="item hbSeg" data-idx="${seg.idx}">
              <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center">
                <span class="tag boss">BOSS #${seg.idx}</span>
                ${okTag}
                <span class="mono" style="opacity:.9">dur=${esc(dur)}s</span>
                <span class="mono" style="opacity:.9">events=${m.n}</span>
              </div>
              <div class="mini" style="margin-top:6px">
                stepAcc: <b>${esc(stepAcc)}</b> • ok:${m.stepHitOk} wrong:${m.stepHitWrong} • haz:${m.hazHit} • soap:${m.soapPick}
              </div>
              <div class="mini" style="opacity:.85; margin-top:4px">
                แตะเพื่อ Copy JSON ของ segment นี้ 📋
              </div>
            </div>
          `);
        });
        elList.innerHTML = items.join('');

        // click -> copy JSON seg
        elList.querySelectorAll('.hbSeg').forEach((el)=>{
          el.addEventListener('click', async ()=>{
            const idx = Number(el.getAttribute('data-idx')||0);
            const seg = segs.find(s=>s.idx===idx);
            if(!seg) return;

            const payload = {
              segment: { idx: seg.idx, startT: seg.startT, endT: seg.endT, startType: seg.startType, endType: seg.endType },
              metrics: summarizeEvents(seg.events),
              events: seg.events
            };
            await copyText(JSON.stringify(payload, null, 2));
            el.style.outline = '2px solid rgba(34,197,94,.35)';
            setTimeout(()=>{ el.style.outline = 'none'; }, 420);
          }, { passive:true });
        });
      }

      // raw view
      elRaw.textContent = JSON.stringify({
        source: elSource.value,
        meta: pack?.meta || {},
        bossSegments: segs.map(seg=>({
          idx: seg.idx,
          startT: seg.startT,
          endT: seg.endT,
          startType: seg.startType,
          endType: seg.endType,
          metrics: summarizeEvents(seg.events)
        })),
        allMetrics: mAll
      }, null, 2);
    }

    function reload(){
      const pack = readPack(elSource.value);
      if(!pack){
        elMeta.textContent = `${elSource.value} • (no pack in localStorage)`;
        elBossMeta.textContent = 'boss: —';
        elKpi.innerHTML = '';
        elCoach.innerHTML = `<div class="k">🤖 Coach Tip</div><div class="mini" style="margin-top:6px">ยังไม่มีข้อมูล events — เล่นเกมให้มี events ก่อน</div>`;
        elList.innerHTML = `
          <div class="item" style="cursor:default">
            <span class="tag warn">ไม่พบ ${elSource.value==='hydration'?KEY_HYDR:KEY_HYGI}</span>
            <div class="mini" style="margin-top:6px; opacity:.9">
              วิธีทำให้มี: เล่นเกม 1 รอบ แล้วให้เกมเซฟ events ลง localStorage (events buffer)
            </div>
          </div>
        `;
        elRaw.style.display = 'none';
        return;
      }
      renderUI(pack);
    }

    // binds
    $('#hbReload').addEventListener('click', reload, { passive:true });
    $('#hbExportCsv').addEventListener('click', ()=>{
      const pack = readPack(elSource.value);
      if(!pack) return;
      const evs = Array.isArray(pack.events) ? pack.events : [];
      const segs = segmentBoss(evs);

      // export: 1 row per segment, else 1 row global
      const rows = [];
      if(segs.length){
        segs.forEach(seg=>{
          const m = summarizeEvents(seg.events);
          rows.push({
            source: elSource.value,
            segIdx: seg.idx,
            startT: seg.startT,
            endT: seg.endT,
            endType: seg.endType,
            events: m.n,
            stepHitOk: m.stepHitOk,
            stepHitWrong: m.stepHitWrong,
            stepAcc: (m.stepAcc==null)? '' : m.stepAcc,
            hazHit: m.hazHit,
            soapPick: m.soapPick,
            bossEvents: m.bossEvents
          });
        });
      }else{
        const m = summarizeEvents(evs);
        rows.push({
          source: elSource.value,
          segIdx: 'ALL',
          events: m.n,
          stepHitOk: m.stepHitOk,
          stepHitWrong: m.stepHitWrong,
          stepAcc: (m.stepAcc==null)? '' : m.stepAcc,
          hazHit: m.hazHit,
          soapPick: m.soapPick,
          bossEvents: m.bossEvents,
          note: 'no boss_* events'
        });
      }

      const csv = toCsv(rows);
      downloadText(`HHA_${elSource.value}_boss_inspector_${Date.now()}.csv`, csv);
    }, { passive:true });

    $('#hbToggleRaw').addEventListener('click', ()=>{
      elRaw.style.display = (elRaw.style.display==='block') ? 'none' : 'block';
    }, { passive:true });

    elSource.addEventListener('change', reload, { passive:true });

    // first
    reload();

    window.addEventListener('focus', reload);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', render);
  else render();
})();