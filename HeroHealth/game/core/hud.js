// === Hero Health Academy — game/core/hud.js (hardened + auto DOM + helpers) ===
export class HUD{
  /* -------------------- Safe getters -------------------- */
  _byId(id){
    let el = document.getElementById(id);
    if (!el && this._autoCreateIds?.has(id)) {
      // ถ้ายอมให้ auto-create บางส่วน
      el = this._ensureElem(id);
    }
    return el;
  }
  constructor(opts = {}){
    // อนุญาต auto-create สำหรับบาง HUD ที่สำคัญ เพื่อกันพัง
    this._autoCreate = opts.autoCreate ?? true;
    this._autoCreateIds = new Set(['score','combo','time','feverBar','hydroWrap','targetWrap','plateTracker','targetBadge','powerBar','questChips','coachHUD','coachText']);
    // สร้าง style สำหรับ flash/dim ถ้ายังไม่มี
    if (!document.getElementById('hud_fx_css')){
      const st = document.createElement('style'); st.id='hud_fx_css';
      st.textContent = `
        .flash-danger{ animation: hudFlashDanger .18s ease; }
        @keyframes hudFlashDanger{ from{ background: rgba(255,0,0,.14); } to{ background: transparent; } }
        .dim-penalty{ animation: hudDimPenalty .35s ease; }
        @keyframes hudDimPenalty{ from{ filter: brightness(.85); } to{ filter: brightness(1); } }
        #coachHUD{ display:none; position:fixed; left:50%; bottom:64px; transform:translateX(-50%); 
          padding:10px 14px; background:rgba(0,0,0,.55); color:#fff; font:600 16px/1.2 system-ui,Segoe UI,Arial;
          border-radius:12px; box-shadow:0 6px 18px rgba(0,0,0,.25); z-index:120; pointer-events:none; }
        #coachHUD.pulse{ animation: coachPulse 1.6s ease; }
        @keyframes coachPulse{ 0%{ transform: translate(-50%,8px) scale(.98); opacity:.0; }
          12%{ transform: translate(-50%,0) scale(1); opacity:1; } 84%{ opacity:1; } 100%{ opacity:.0; } }
      `;
      document.head.appendChild(st);
    }
  }

  /* -------------------- Basic HUD -------------------- */
  setScore(v){ const e=this._byId('score'); if(e) e.textContent = v|0; }
  setCombo(text){ const e=this._byId('combo'); if(e) e.textContent = text; }
  setTime(v){ const e=this._byId('time'); if(e) e.textContent = v|0; }
  setFeverProgress(p01){
    const b=this._byId('feverBar'); if(!b) return;
    const p=Math.max(0,Math.min(1, +p01||0));
    b.style.width = (p*100)+'%';
  }

  /* -------------------- Section toggles -------------------- */
  showHydration(){ const w=this._byId('hydroWrap'); if(w) w.style.display='block'; }
  hideHydration(){ const w=this._byId('hydroWrap'); if(w) w.style.display='none'; }
  showTarget(){ const w=this._byId('targetWrap'); if(w) w.style.display='block'; }
  hideTarget(){ const w=this._byId('targetWrap'); if(w) w.style.display='none'; }
  hidePills(){ const w=this._byId('plateTracker'); if(w) w.style.display='none'; }

  /* -------------------- Target badge -------------------- */
  setTargetBadge(text){ const el=this._byId('targetBadge'); if(el) el.textContent=String(text||''); }
  // helper: ตั้งเป้าหมายแบบมี (กลุ่ม, have/need)
  setTarget(groupKey, have=0, need=0){
    const mapTH = {veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', fruits:'ผลไม้', dairy:'นม'};
    const name = mapTH[groupKey] || groupKey || '';
    this.setTargetBadge(`${name} • ${have|0}/${need|0}`);
    this.showTarget();
  }

  /* -------------------- Power-up timers -------------------- */
  // timers = { x2:sec, freeze:sec, sweep:sec }  // (sweep = magnet/next)
  setPowerTimers(timers){
    const wrap=this._byId('powerBar'); if(!wrap) return;
    const ensureSeg = (k,label,grad)=>{
      let seg = wrap.querySelector(`.pseg[data-k="${k}"]`);
      if (!seg){
        seg = document.createElement('div');
        seg.className='pseg'; seg.dataset.k=k;
        seg.style.cssText='display:flex;gap:6px;align-items:center;margin:2px 0;';
        const i = document.createElement('i'); i.style.cssText='display:block;position:relative;flex:1;height:6px;background:#0003;border-radius:999px;overflow:hidden';
        const b = document.createElement('b'); b.className='barfill'; b.style.cssText=`position:absolute;left:0;top:0;bottom:0;width:0;background:${grad};border-radius:999px;transition:width .18s linear`;
        const s = document.createElement('span'); s.textContent = label; s.style.cssText='font:600 12px/1 system-ui;color:#fff8;min-width:48px';
        i.appendChild(b); seg.appendChild(s); seg.appendChild(i); wrap.appendChild(seg);
      }
      return seg;
    };

    const map = [
      ['x2','×2','linear-gradient(90deg,#ffd54a,#ff8a00)'],
      ['freeze','Freeze','linear-gradient(90deg,#66e0ff,#4fc3f7)'],
      ['sweep','Magnet','linear-gradient(90deg,#9effa8,#7fffd4)'],
    ];
    map.forEach(([k,label,grad])=>{
      const seg = ensureSeg(k,label,grad);
      const fill = seg.querySelector('.barfill');
      const v = Math.max(0, Math.min(10, (+timers?.[k]||0)));
      fill.style.width = (v*10)+'%';
    });
  }

  /* -------------------- Quest chips -------------------- */
  // list: [{ key, icon, need, progress, remain, done, fail, label }]
  setQuestChips(list){
    const wrap=this._byId('questChips'); if(!wrap) return;
    wrap.innerHTML='';
    (list||[]).forEach(q=>{
      const need = q.need|0, prog = Math.max(0, q.progress|0);
      const pct = need>0 ? Math.min(100, Math.round((prog/need)*100)) : 0;
      const chip=document.createElement('div'); chip.className='chip';
      chip.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 8px;border:1.5px solid #ffffff22;border-radius:999px;color:#fff;background:rgba(0,0,0,.28);backdrop-filter:blur(2px);font:600 12px/1 system-ui;';
      chip.innerHTML = `
        <span style="font-size:14px">${q.icon||'⭐'}</span>
        <span>${q.label||q.key||''}</span>
        <span style="opacity:.8">${prog}/${need}</span>
        <div class="bar" style="position:relative;width:72px;height:6px;background:#0003;border-radius:999px;overflow:hidden">
          <div style="position:absolute;left:0;top:0;bottom:0;width:${pct}%;background:linear-gradient(90deg,#7fffd4,#22c55e);border-radius:999px"></div>
        </div>
        <span style="opacity:.7">⏱ ${Math.max(0,q.remain|0)}s</span>
      `;
      if(q.done && !q.fail) chip.style.borderColor='#7fffd4';
      if(q.fail) chip.style.borderColor='#ff9b9b';
      wrap.appendChild(chip);
    });
  }

  /* -------------------- Coach speech -------------------- */
  say(text){
    const el=this._byId('coachText'), box=this._byId('coachHUD');
    if(!el||!box) return;
    el.textContent=String(text||'');
    box.style.display='flex';
    // pulse สั้น ๆ
    box.classList.remove('pulse'); // restart animation
    // eslint-disable-next-line no-unused-expressions
    box.offsetHeight;
    box.classList.add('pulse');
  }

  /* -------------------- Screen feedback -------------------- */
  flashDanger(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'),180); }
  dimPenalty(){ document.body.classList.add('dim-penalty'); setTimeout(()=>document.body.classList.remove('dim-penalty'),350); }

  /* -------------------- Private: ensure elements -------------------- */
  _ensureElem(id){
    if (!this._autoCreate) return null;
    const cfg = {
      score:      ['div','position:fixed;left:12px;top:12px;color:#fff;font:700 16px system-ui;z-index:10', '0'],
      combo:      ['div','position:fixed;left:12px;top:36px;color:#7fffd4;font:700 14px system-ui;z-index:10', 'x1'],
      time:       ['div','position:fixed;right:12px;top:12px;color:#fff;font:700 16px system-ui;z-index:10', '60'],
      feverBar:   ['div','position:fixed;left:12px;top:60px;width:220px;height:6px;background:#0003;border-radius:999px;overflow:hidden;z-index:10',''],
      hydroWrap:  ['div','position:fixed;left:12px;top:72px;z-index:10;color:#fff',''],
      targetWrap: ['div','position:fixed;left:12px;top:72px;display:none;z-index:10;color:#fff','<span id="targetBadge"></span>'],
      plateTracker:['div','position:fixed;left:12px;top:72px;display:none;z-index:10;color:#fff','<div id="platePills" style="display:flex;gap:8px;flex-wrap:wrap"></div>'],
      targetBadge:['span','', ''],
      powerBar:   ['div','position:fixed;left:12px;top:108px;z-index:10;color:#fff;display:flex;gap:8px;flex-direction:column;min-width:240px',''],
      questChips: ['div','position:fixed;left:12px;bottom:18px;z-index:12;display:flex;gap:8px;flex-wrap:wrap;max-width:90vw',''],
      coachHUD:   ['div','', '<span id="coachText"></span>'],
      coachText:  ['span','', '']
    };
    const def = cfg[id]; if (!def) return null;
    const [tag, css, html] = def;
    const el = document.createElement(tag); el.id = id;
    if (css) el.style.cssText = css;
    if (html) el.innerHTML = html;
    // feverBar ต้องมี <div> ภายในเพื่อเป็นแถบ
    if (id==='feverBar'){
      const bar = document.createElement('div');
      bar.style.cssText='height:100%;width:0;background:linear-gradient(90deg,#facc15,#fb923c);border-radius:999px;transition:width .18s linear';
      el.appendChild(bar);
      // ให้ setFeverProgress ใช้เด็กคนแรกถ้า id='feverBar' เป็น container
      el.id='feverBarContainer'; // เปลี่ยน id container หลีกเลี่ยงชนกับ selector ผู้ใช้
      bar.id='feverBar';
    }
    document.body.appendChild(el);
    return document.getElementById(id) || el;
  }
}
