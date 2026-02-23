// === /herohealth/warmcool/cooldown-tools.js ===
// Cooldown Tools (GoodJunk/HHA) — FULL v20260223
// ✅ Inject deep stats + badges + micro-tip into cooldown overlay
// ✅ Hit-rate bar + Copy Summary JSON
// ✅ Copy CSV header + CSV row (1 line)
// ✅ LOG button: logMode=open (default) -> redirect to hub?log=...
//              : logMode=fetch -> POST to endpoint
'use strict';

(function(){
  const W = window, D = document;
  if (W.__HHA_COOLDOWN_TOOLS__) return;
  W.__HHA_COOLDOWN_TOOLS__ = 1;

  const $ = (s, root)=> (root||D).querySelector(s);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const safe=(v,fb='—') => (v==null || v==='') ? fb : String(v);
  const n=(v,fb=0)=>{ v=Number(v); return Number.isFinite(v)?v:fb; };

  // Try to find cooldown overlay element (compatible ids)
  const cool = $('#gj-cooldown-overlay') || $('#cooldownOverlay');
  if(!cool) return;

  const body = $('.ov-body', cool) || cool;

  let lastSummary = null;

  function q(k, def=''){
    try{ return (new URL(W.location.href)).searchParams.get(k) ?? def; }catch(_){ return def; }
  }

  /* ----------------- Deep Summary Panel ----------------- */
  function ensurePanel(){
    let panel = $('#gjCoolExtra', cool);
    if(panel) return panel;

    panel = D.createElement('div');
    panel.id = 'gjCoolExtra';
    panel.className = 'ov-section';
    panel.innerHTML = `
      <div class="ov-h3">สรุปเชิงลึก</div>
      <div id="gjCoolBadges" class="ov-row" style="flex-wrap:wrap; gap:8px; margin-top:8px;"></div>

      <div class="ov-divider"></div>

      <div class="ov-grid" style="margin-top:10px;">
        <div class="ov-col-6"><div class="ov-kv"><span class="k">Hits</span><span class="v" id="gjS_hits">—</span><span class="tag">GOOD</span></div></div>
        <div class="ov-col-6"><div class="ov-kv"><span class="k">Miss</span><span class="v" id="gjS_miss">—</span><span class="tag">TOTAL</span></div></div>
        <div class="ov-col-6"><div class="ov-kv"><span class="k">ComboMax</span><span class="v" id="gjS_combo">—</span><span class="tag">STREAK</span></div></div>
        <div class="ov-col-6"><div class="ov-kv"><span class="k">Time</span><span class="v" id="gjS_time">—</span><span class="tag">sec</span></div></div>
        <div class="ov-col-6"><div class="ov-kv"><span class="k">RT avg</span><span class="v" id="gjS_rtavg">—</span><span class="tag">ms</span></div></div>
        <div class="ov-col-6"><div class="ov-kv"><span class="k">RT median</span><span class="v" id="gjS_rtmed">—</span><span class="tag">ms</span></div></div>
      </div>

      <div class="ov-divider"></div>

      <div class="ov-h3">Micro-tip (อธิบายได้)</div>
      <div id="gjCoolTip" class="ov-note" style="margin-top:8px; white-space:pre-line;">—</div>
    `;
    body.appendChild(panel);
    return panel;
  }

  function chip(text, tone=''){
    const el = D.createElement('span');
    el.className = `ov-chip ${tone}`.trim();
    el.textContent = text;
    return el;
  }

  function tipFrom(summary){
    summary = summary || {};
    const grade = String(summary.grade || '—');
    const reason = String(summary.reason || '');

    const b = (summary.buffs && typeof summary.buffs==='object') ? summary.buffs : null;
    const wPct  = n(b?.wPct, 0);
    const wCrit = n(b?.wCrit,0);
    const wDmg  = n(b?.wDmg, 0);
    const calm  = n(b?.calm, 0);

    const tips = [];
    if(wPct>0)  tips.push(`• Assist +${wPct}%: เล็ง/ยิงติดง่ายขึ้น (เหมาะตอน STORM)`);
    if(wCrit>0) tips.push(`• Crit +${wCrit}%: โอกาส “CRIT!” สูงขึ้นเมื่อเก็บ GOOD ต่อเนื่อง`);
    if(wDmg>0)  tips.push(`• Score +${wDmg}%: คะแนนจาก GOOD สูงขึ้น ควรรักษา combo`);
    if(calm>0)  tips.push(`• Calm ${calm}: ลดโทษตอนพลาด/โดน JUNK/💀/💣 ทำให้เกมนิ่งขึ้น`);
    if(!tips.length) tips.push('• ไม่มีบัฟ: อ่าน telegraph (⚠️) แล้วเล่นให้แม่นขึ้น');

    if(summary.rageOn) tips.push('• RAGE: หลีก 💣/💀 และยิง GOOD ให้ไว (spawn ถี่)');
    else if(summary.bossOn) tips.push('• BOSS: เก็บ GOOD เพื่อตี HP บอส ระวัง STOMP/BURST ตาม ⚠️');
    else if(summary.stormOn) tips.push('• STORM: เล็งเป้าใกล้ crosshair อย่าฝืนยิงไกล');

    const head = `Grade ${grade}${reason ? ` • reason=${reason}` : ''}`;
    return `${head}\n${tips.join('\n')}`;
  }

  function updateDeepPanel(summary){
    ensurePanel();

    const badgeRow = $('#gjCoolBadges', cool);
    if(badgeRow){
      badgeRow.innerHTML = '';
      const b = (summary.buffs && typeof summary.buffs==='object') ? summary.buffs : null;

      if(summary.stormOn) badgeRow.appendChild(chip('⚡ STORM', 'is-info'));
      if(summary.bossOn)  badgeRow.appendChild(chip('👹 BOSS', 'is-bad'));
      if(summary.rageOn)  badgeRow.appendChild(chip('🔥 RAGE', 'is-bad'));

      const rank = safe(b?.rank || summary.rank || '—');
      const warmed = !!summary.warmed || !!b?.warmed;
      if(warmed) badgeRow.appendChild(chip(`BUFF ${rank}`, 'is-good'));
      else badgeRow.appendChild(chip('NO BUFF', 'is-warn'));

      badgeRow.appendChild(chip(`diff:${safe(summary.diff,'-')}`,''));
      badgeRow.appendChild(chip(`run:${safe(summary.runMode,'-')}`,''));
    }

    const set = (id, v)=>{ const el=$('#'+id, cool); if(el) el.textContent = safe(v); };
    set('gjS_hits', summary.hits ?? summary.nHitGood ?? '—');
    set('gjS_miss', summary.miss_core ?? summary.miss ?? summary.misses ?? '—');
    set('gjS_combo', summary.comboMax ?? '—');
    set('gjS_time', summary.durationPlayedSec ?? summary.durationSec ?? '—');
    set('gjS_rtavg', summary.avgRtGoodMs ?? '—');
    set('gjS_rtmed', summary.medianRtGoodMs ?? '—');

    const tipEl = $('#gjCoolTip', cool);
    if(tipEl) tipEl.textContent = tipFrom(summary);
  }

  /* ----------------- UX Block (Hit Rate + Copy JSON) ----------------- */
  function ensureUxBlock(){
    let box = $('#gjCoolUx', cool);
    if(box) return box;

    box = D.createElement('div');
    box.id = 'gjCoolUx';
    box.className = 'ov-section';

    box.innerHTML = `
      <div class="ov-h3">Hit Rate</div>
      <div class="ov-meter-label" style="margin-top:8px;">
        <span>ความแม่นยำ (Hits / (Hits+Miss))</span>
        <span><b id="gjHitRatePct">—</b></span>
      </div>
      <div class="ov-meter" style="margin-top:6px;">
        <div id="gjHitRateFill" class="fill" style="width:0%;"></div>
      </div>

      <div class="ov-divider"></div>

      <div class="ov-h3">Copy / Export</div>
      <div class="ov-row" style="gap:8px; margin-top:10px; flex-wrap:wrap;">
        <button id="gjCopySummaryBtn" class="ov-btn primary" type="button">Copy Summary (JSON)</button>
        <button id="gjCopyCsvHeaderBtn" class="ov-btn ghost" type="button">Copy CSV Header</button>
        <button id="gjCopyCsvRowBtn" class="ov-btn ghost" type="button">Copy CSV Row</button>
        <span id="gjCopyToast" class="ov-note" hidden>คัดลอกแล้ว ✅</span>
      </div>

      <div class="ov-divider"></div>

      <div class="ov-h3">LOG (flush-hardened)</div>
      <div class="ov-row" style="gap:8px; margin-top:10px; flex-wrap:wrap; align-items:center;">
        <button id="gjSendLogBtn" class="ov-btn primary" type="button">LOG ผลลัพธ์</button>
        <span id="gjLogStatus" class="ov-note" hidden>—</span>
        <span class="ov-note" style="margin-left:auto; opacity:.85;">
          logMode=<b id="gjLogModeLabel">open</b>
        </span>
      </div>
    `;

    body.appendChild(box);
    return box;
  }

  async function copyText(txt){
    let ok = false;
    try{
      await navigator.clipboard.writeText(txt);
      ok = true;
    }catch(_){
      try{
        const ta = D.createElement('textarea');
        ta.value = txt;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        D.body.appendChild(ta);
        ta.focus(); ta.select();
        ok = D.execCommand('copy');
        ta.remove();
      }catch(__){}
    }
    return ok;
  }

  function toast(msg, ok=true){
    const t = $('#gjCopyToast', cool);
    if(!t) return;
    t.hidden = false;
    t.textContent = msg;
    setTimeout(()=>{ try{ t.hidden = true; }catch(_){} }, ok ? 1200 : 1800);
  }

  function updateHitRate(summary){
    const hits = n(summary?.hits ?? summary?.nHitGood, 0);
    const miss = n(summary?.miss_core ?? summary?.miss ?? summary?.misses, 0);
    const denom = Math.max(1, hits + miss);
    const pct = Math.round(clamp(hits / denom, 0, 1) * 100);

    const pctEl = $('#gjHitRatePct', cool);
    const fillEl = $('#gjHitRateFill', cool);
    if(pctEl) pctEl.textContent = `${pct}%`;
    if(fillEl) fillEl.style.width = `${pct}%`;
  }

  /* ----------------- CSV pack ----------------- */
  const COLS = [
    'ts',
    'game','projectTag','gameVersion',
    'runMode','diff','seed',
    'device','view',
    'reason','grade',
    'score','hits','miss','miss_core','expireGood','hitJunk','hitJunkBlocked',
    'comboMax',
    'durationPlannedSec','durationPlayedSec',
    'avgRtGoodMs','medianRtGoodMs',
    'stormOn','bossOn','rageOn',
    'warmed','buff_rank','buff_type','buff_wPct','buff_wCrit','buff_wDmg','buff_wHeal','buff_calm',
    'startTimeIso','endTimeIso'
  ];

  function csvEscape(val){
    const s = safe(val,'');
    if(/[,"\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }

  function buildCsvHeader(){ return COLS.join(','); }

  function buildCsvRow(s){
    s = s || {};
    const b = (s.buffs && typeof s.buffs === 'object') ? s.buffs : null;

    const row = {
      ts: Date.now(),
      game: s.game || 'goodjunk',
      projectTag: s.projectTag || '',
      gameVersion: s.gameVersion || '',
      runMode: s.runMode || '',
      diff: s.diff || '',
      seed: s.seed || '',
      device: s.device || '',
      view: s.view || '',
      reason: s.reason || '',
      grade: s.grade || '',
      score: n(s.score ?? s.scoreFinal, 0),
      hits: n(s.hits, 0),
      miss: n(s.miss ?? s.misses, 0),
      miss_core: n(s.miss_core, n(s.expireGood,0) + n(s.hitJunk,0)),
      expireGood: n(s.expireGood, 0),
      hitJunk: n(s.hitJunk, 0),
      hitJunkBlocked: n(s.hitJunkBlocked, 0),
      comboMax: n(s.comboMax, 0),
      durationPlannedSec: n(s.durationPlannedSec, 0),
      durationPlayedSec: n(s.durationPlayedSec ?? s.durationSec, 0),
      avgRtGoodMs: n(s.avgRtGoodMs, 0),
      medianRtGoodMs: n(s.medianRtGoodMs, 0),
      stormOn: s.stormOn ? 1 : 0,
      bossOn: s.bossOn ? 1 : 0,
      rageOn: s.rageOn ? 1 : 0,
      warmed: s.warmed ? 1 : 0,
      buff_rank: b ? safe(b.rank,'') : '',
      buff_type: b ? safe(b.wType,'') : '',
      buff_wPct: b ? n(b.wPct,0) : 0,
      buff_wCrit: b ? n(b.wCrit,0) : 0,
      buff_wDmg: b ? n(b.wDmg,0) : 0,
      buff_wHeal: b ? n(b.wHeal,0) : 0,
      buff_calm: b ? n(b.calm,0) : 0,
      startTimeIso: s.startTimeIso || '',
      endTimeIso: s.endTimeIso || ''
    };

    return COLS.map(k => csvEscape(row[k])).join(',');
  }

  /* ----------------- LOG pack ----------------- */
  function encodeLog(payload){
    try{
      const s = JSON.stringify(payload);
      const b64 = btoa(unescape(encodeURIComponent(s)))
        .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      return b64;
    }catch(_){
      return '';
    }
  }

  function buildLogPayload(s){
    s = s || {};
    const b = (s.buffs && typeof s.buffs==='object') ? s.buffs : null;
    return {
      kind: 'hha_end',
      ts: Date.now(),
      game: s.game || 'goodjunk',
      projectTag: s.projectTag || '',
      gameVersion: s.gameVersion || '',
      runMode: s.runMode || '',
      diff: s.diff || '',
      seed: s.seed || '',
      device: s.device || '',
      view: s.view || '',
      reason: s.reason || '',
      grade: s.grade || '',
      score: (s.score ?? s.scoreFinal ?? 0),
      hits: (s.hits ?? 0),
      miss: (s.miss ?? s.misses ?? 0),
      miss_core: (s.miss_core ?? (n(s.expireGood,0)+n(s.hitJunk,0))),
      expireGood: (s.expireGood ?? 0),
      hitJunk: (s.hitJunk ?? 0),
      hitJunkBlocked: (s.hitJunkBlocked ?? 0),
      comboMax: (s.comboMax ?? 0),
      durationPlannedSec: (s.durationPlannedSec ?? 0),
      durationPlayedSec: (s.durationPlayedSec ?? s.durationSec ?? 0),
      avgRtGoodMs: (s.avgRtGoodMs ?? 0),
      medianRtGoodMs: (s.medianRtGoodMs ?? 0),
      stormOn: !!s.stormOn,
      bossOn:  !!s.bossOn,
      rageOn:  !!s.rageOn,
      warmed: !!s.warmed,
      buffs: b ? {
        rank: b.rank, wType: b.wType, wPct: b.wPct, wCrit: b.wCrit, wDmg: b.wDmg, wHeal: b.wHeal, calm: b.calm
      } : null,
      startTimeIso: s.startTimeIso || '',
      endTimeIso: s.endTimeIso || ''
    };
  }

  async function sendFetch(url, payload){
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify(payload)
    });
    return res.ok;
  }

  /* ----------------- Wire buttons ----------------- */
  function wireButtons(){
    ensureUxBlock();

    const logMode = String(q('logMode','open') || 'open').toLowerCase();
    const endpoint = q('endpoint', q('api',''));
    const label = $('#gjLogModeLabel', cool);
    if(label) label.textContent = logMode;

    $('#gjCopySummaryBtn', cool)?.addEventListener('click', async ()=>{
      const payload = buildLogPayload(lastSummary);
      const ok = await copyText(JSON.stringify(payload, null, 2));
      toast(ok ? 'คัดลอกแล้ว ✅ (Summary JSON)' : 'คัดลอกไม่สำเร็จ ❌', ok);
    });

    $('#gjCopyCsvHeaderBtn', cool)?.addEventListener('click', async ()=>{
      const ok = await copyText(buildCsvHeader());
      toast(ok ? 'คัดลอก CSV header แล้ว ✅' : 'คัดลอกไม่สำเร็จ ❌', ok);
    });

    $('#gjCopyCsvRowBtn', cool)?.addEventListener('click', async ()=>{
      const ok = await copyText(buildCsvRow(lastSummary));
      toast(ok ? 'คัดลอก CSV row แล้ว ✅' : 'คัดลอกไม่สำเร็จ ❌', ok);
    });

    $('#gjSendLogBtn', cool)?.addEventListener('click', async ()=>{
      const status = $('#gjLogStatus', cool);
      const setStatus=(msg, ok=true)=>{
        if(!status) return;
        status.hidden = false;
        status.textContent = msg;
        setTimeout(()=>{ try{ status.hidden = true; }catch(_){} }, ok ? 1400 : 1800);
      };

      const payload = buildLogPayload(lastSummary);

      if(logMode === 'fetch'){
        if(!endpoint){
          setStatus('ยังไม่ได้ตั้ง endpoint (ใส่ ?endpoint=...)', false);
          return;
        }
        try{
          const ok = await sendFetch(endpoint, payload);
          setStatus(ok ? 'ส่ง LOG แล้ว ✅' : 'ส่ง LOG ไม่สำเร็จ ❌', ok);
        }catch(_){
          setStatus('ส่ง LOG ไม่สำเร็จ ❌', false);
        }
        return;
      }

      // open mode -> redirect to hub?log=
      const b64 = encodeLog(payload);
      if(!b64){
        setStatus('สร้าง log ไม่สำเร็จ ❌', false);
        return;
      }

      const hub = q('hub','');
      try{
        const base = hub ? new URL(hub, W.location.href) : new URL(W.location.href);
        base.searchParams.set('log', b64);
        base.searchParams.set('logKind', 'hha_end');
        base.searchParams.set('from', 'goodjunk');

        const passthru = ['pid','studyId','study','phase','cond','conditionGroup','run','diff','seed'];
        const cur = new URL(W.location.href);
        passthru.forEach(k=>{
          const v = cur.searchParams.get(k);
          if(v!=null && v!=='') base.searchParams.set(k, v);
        });

        W.location.href = base.toString();
      }catch(_){
        setStatus('เปิด log ไม่สำเร็จ ❌', false);
      }
    });
  }

  /* ----------------- Main event hook ----------------- */
  wireButtons();

  W.addEventListener('hha:game-ended', (ev)=>{
    lastSummary = ev?.detail || {};
    updateDeepPanel(lastSummary);
    updateHitRate(lastSummary);
  });

})();