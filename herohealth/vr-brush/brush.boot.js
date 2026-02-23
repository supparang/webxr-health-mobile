// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION PATCH v20260223b
// ✅ Fix boot duplicate / event duplicate
// ✅ Fix overlay state at startup (menu shown, end hidden)
// ✅ Tap-to-start unlock without auto-entering summary
// ✅ AI HUD + Big Pop (rate-limited)
// ✅ Safe if DOM pieces are missing

(function(){
  'use strict';

  const WIN = window, DOC = document;

  // กันโหลดซ้ำ (cache / html ซ้ำ script / hot reload)
  if (WIN.__BRUSH_BOOT_PATCH_READY__) {
    console.warn('[BrushVR boot] duplicate load ignored');
    return;
  }
  WIN.__BRUSH_BOOT_PATCH_READY__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const num = (v,d)=>{ const n = Number(v); return Number.isFinite(n)? n : d; };

  // -------------------------
  // Context builder (HHA style)
  // -------------------------
  function buildCtx(){
    const view = String(qs('view', DOC.body.getAttribute('data-view') || 'pc') || 'pc').toLowerCase();
    const hub  = qs('hub','') || '';
    const seed = num(qs('seed', Date.now()), Date.now());
    const time = num(qs('time', 90), 90);

    const studyId = qs('studyId','') || '';
    const phase = qs('phase','') || '';
    const conditionGroup = qs('conditionGroup','') || '';

    return { view, hub, seed, time, studyId, phase, conditionGroup };
  }

  // -------------------------
  // DOM helpers / startup state fix
  // -------------------------
  function byId(id){ return DOC.getElementById(id); }

  function forceStartupUi(ctx){
    const wrap = byId('br-wrap');
    const menu = byId('br-menu');
    const end  = byId('br-end');
    const tap  = byId('tapStart');

    // body + wrap view sync
    try { DOC.body.setAttribute('data-view', ctx.view || 'pc'); } catch(_){}
    try { if (wrap) wrap.setAttribute('data-view', ctx.view || 'pc'); } catch(_){}

    // สำคัญ: เริ่มต้นต้องเป็น menu (ยังไม่สรุป)
    if (wrap) wrap.setAttribute('data-state', 'menu');

    // เมนูแสดง / summary ซ่อน
    if (menu) {
      menu.hidden = false;
      menu.setAttribute('aria-hidden', 'false');
      menu.style.display = ''; // ปล่อยให้ CSS จัดการ
    }
    if (end) {
      end.hidden = true;
      end.setAttribute('aria-hidden', 'true');
      end.style.display = 'none';
    }

    // fatal ซ่อนถ้ามีค้างจากรอบก่อน
    const fatal = byId('fatal');
    if (fatal) fatal.classList.add('br-hidden');

    // toast reset
    const toast = byId('toast');
    if (toast) {
      toast.classList.remove('show');
      toast.textContent = '';
    }

    // tap overlay: แสดงเฉพาะ mobile/cvr เป็นค่าเริ่มต้น
    if (tap) {
      const needsTap = (ctx.view === 'mobile' || ctx.view === 'cvr' || ctx.view === 'cardboard');
      tap.style.display = needsTap ? 'grid' : 'none';
      tap.hidden = !needsTap ? true : false;
    }
  }

  // -------------------------
  // Minimal HUD AI (creates DOM if not present)
  // -------------------------
  function ensureAIHud(){
    let wrap = DOC.getElementById('hud-ai');
    if(wrap) return wrap;

    wrap = DOC.createElement('section');
    wrap.id = 'hud-ai';
    wrap.className = 'hudCard hudAI';
    wrap.style.position = 'fixed';
    wrap.style.left = '12px';
    wrap.style.bottom = '96px'; // เผื่อชน vr-ui ด้านล่าง
    wrap.style.zIndex = '59';
    wrap.style.width = 'min(420px, 92vw)';
    wrap.style.border = '1px solid rgba(148,163,184,.18)';
    wrap.style.borderRadius = '20px';
    wrap.style.padding = '10px 12px';
    wrap.style.background = 'rgba(2,6,23,.72)';
    wrap.style.backdropFilter = 'blur(10px)';
    wrap.style.webkitBackdropFilter = 'blur(10px)';
    wrap.style.boxShadow = '0 18px 60px rgba(0,0,0,.35)';
    wrap.style.pointerEvents = 'none';
    wrap.style.opacity = '0';
    wrap.style.transition = 'opacity .18s ease, transform .18s ease';
    wrap.style.transform = 'translateY(6px)';

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div id="ai-emo" style="font-size:18px;line-height:1;">🧠</div>
        <div style="flex:1;min-width:0">
          <div id="ai-title" style="font-weight:950;letter-spacing:.2px;">AI Coach</div>
          <div id="ai-sub" style="margin-top:2px;color:rgba(229,231,235,.82);font-size:13px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">พร้อมช่วย!</div>
        </div>
        <div id="ai-tag" style="font-size:11px;color:rgba(148,163,184,1);font-weight:900;">TIP</div>
      </div>
      <div id="ai-mini" style="margin-top:8px;color:rgba(229,231,235,.86);font-size:13px;line-height:1.45;">
        ทำ PERFECT เพื่อคอมโบ + เติม FEVER
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function setAI(msg){
    const wrap = ensureAIHud();
    const emo = DOC.getElementById('ai-emo');
    const title = DOC.getElementById('ai-title');
    const sub = DOC.getElementById('ai-sub');
    const tag = DOC.getElementById('ai-tag');
    const mini = DOC.getElementById('ai-mini');
    if(emo) emo.textContent = msg.emo || '🧠';
    if(title) title.textContent = msg.title || 'AI Coach';
    if(sub) sub.textContent = msg.sub || '';
    if(tag) tag.textContent = msg.tag || 'TIP';
    if(mini) mini.textContent = msg.mini || '';
    wrap.style.opacity = '1';
    wrap.style.transform = 'translateY(0)';
    clearTimeout(setAI._t);
    setAI._t = setTimeout(()=>{
      wrap.style.opacity = '0';
      wrap.style.transform = 'translateY(6px)';
    }, msg.ms || 1600);
  }

  // -------------------------
  // Big pop C (center toast)
  // -------------------------
  function bigPop(msg){
    let el = DOC.getElementById('ai-bigpop');
    if(!el){
      el = DOC.createElement('div');
      el.id = 'ai-bigpop';
      el.style.position='fixed';
      el.style.left='50%';
      el.style.top='50%';
      el.style.transform='translate(-50%,-50%) scale(0.96)';
      el.style.zIndex='60';
      el.style.padding='12px 16px';
      el.style.borderRadius='999px';
      el.style.border='1px solid rgba(148,163,184,.22)';
      el.style.background='rgba(2,6,23,.78)';
      el.style.color='rgba(229,231,235,.95)';
      el.style.fontWeight='950';
      el.style.letterSpacing='.6px';
      el.style.boxShadow='0 18px 60px rgba(0,0,0,.45)';
      el.style.backdropFilter='blur(10px)';
      el.style.webkitBackdropFilter='blur(10px)';
      el.style.pointerEvents='none';
      el.style.opacity='0';
      el.style.transition='opacity .14s ease, transform .14s ease';
      DOC.body.appendChild(el);
    }
    el.textContent = msg.big || msg.title || 'READY!';
    el.style.opacity='1';
    el.style.transform='translate(-50%,-50%) scale(1)';
    clearTimeout(bigPop._t);
    bigPop._t = setTimeout(()=>{
      el.style.opacity='0';
      el.style.transform='translate(-50%,-50%) scale(0.96)';
    }, msg.bigMs || 900);
  }

  // -------------------------
  // AI Mapper: brush:ai event -> HUD message
  // -------------------------
  function aiMsgFromEvent(ev){
    const d = ev?.detail || {};
    const t = String(d.type||'').toLowerCase();
    const mk = (emo,title,sub,mini,tag='TIP',ms=1600,big=null,bigMs=900)=>({emo,title,sub,mini,tag,ms,big,bigMs});

    switch(t){
      case 'boss_start':
        return mk('🦠','บอสมาแล้ว!','โหมด BOSS เริ่ม','โฟกัส PERFECT + คุมคอมโบ','BOSS',1800,'BOSS!',900);
      case 'boss_phase':
        return mk('🔥',`บอส Phase ${d.phase||'?'}`,`HP เหลือ ${Math.round(d.hp||0)}`,'Phase หลัง ๆ จะมี Weak Spot 🎯','BOSS',1700);
      case 'gate_on':
        return mk('🛡️','GATE เปิด!','ต้องทำ PERFECT ติดกัน','อย่าพลาด—ช้าแต่แม่น','GATE',1900,'GATE!',900);
      case 'gate_reset':
        return mk('😵','GATE รีเซ็ต','พลาดแล้วต้องเริ่มใหม่','กลับไปจับจังหวะ PERFECT','GATE',1600);
      case 'gate_break':
        return mk('💥','เกราะแตก!','ตีบอสได้เต็มแรงแล้ว','รีบกวาด Weak Spot 🎯','GATE',1600,'BREAK!',900);
      case 'laser_warn':
        return mk('⚠️','เลเซอร์กำลังมา','อีกแป๊บห้ามตี','ปล่อยมือ รอให้ผ่าน','LASER',1500,'STOP!',900);
      case 'laser_on':
        return mk('🚫','LASER SWEEP!','ห้ามตีช่วงนี้','นิ่งไว้ก่อน แล้วค่อยลุยต่อ','LASER',1500,'NO HIT!',900);
      case 'shock_on':
        return mk('🎵','SHOCKWAVE!','ตีเฉพาะตอน “วงเขียว”','พลาดจังหวะคอมโบจะหาย','SHOCK',1700,'TIMING!',900);
      case 'shock_pulse':
        return mk('🟢',`PULSE ${d.idx||''}`,'ตอนนี้ “วงเขียว” เปิด','ตี 1 ทีพอ! อย่ารัว','SHOCK',900);
      case 'finisher_on':
        return mk('🏁','FINISHER!','โอกาสปิดเกม','ทำ PERFECT ให้ครบตามจำนวน','FIN',1900,'FINISH!',900);
      case 'time_10s':
        return mk('⏳','อีก 10 วิ!','เร่งแบบแม่น ๆ','กันพลาด > รักษาคอมโบ','TIME',1200,'10s!',800);
      default:
        return null;
    }
  }

  function shouldBigPop(type){
    const t = String(type||'').toLowerCase();
    return (
      t==='boss_start' ||
      t==='gate_on' ||
      t==='gate_break' ||
      t==='laser_on' ||
      t==='shock_on' ||
      t==='finisher_on' ||
      t==='time_10s'
    );
  }

  const RL = {
    lastAny: 0,
    lastBig: 0,
    minAnyMs: 260,
    minBigMs: 900
  };

  function onBrushAI(ev){
    const d = ev?.detail || {};
    const type = d.type;
    const tnow = Date.now();

    if(tnow - RL.lastAny < RL.minAnyMs) return;
    RL.lastAny = tnow;

    const msg = aiMsgFromEvent(ev);
    if(!msg) return;

    setAI(msg);

    if(shouldBigPop(type)){
      if(tnow - RL.lastBig < RL.minBigMs) return;
      RL.lastBig = tnow;
      bigPop(msg);
    }
  }

  // -------------------------
  // Engine boot (safe, once)
  // -------------------------
  function bootEngineOnce(ctx){
    if (WIN.__BRUSH_ENGINE_BOOTED__) {
      console.warn('[BrushVR boot] engine already booted; skip duplicate');
      return;
    }
    WIN.__BRUSH_ENGINE_BOOTED__ = true;

    // AI event listener (bind only once)
    WIN.addEventListener('brush:ai', onBrushAI);

    if (WIN.BrushVR && typeof WIN.BrushVR.boot === 'function'){
      WIN.BrushVR.boot(ctx);
    } else {
      console.warn('[BrushVR] missing BrushVR.boot(ctx)');
      // ไม่ fatal เพื่อให้ดู UI ได้ก่อน
    }
  }

  // -------------------------
  // Tap-to-start unlock then boot
  // -------------------------
  function setupTapStartAndBoot(){
    const ctx = buildCtx();

    // startup UI reset สำคัญมาก (กัน summary โผล่)
    forceStartupUi(ctx);

    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');

    const needsTap = (ctx.view === 'mobile' || ctx.view === 'cvr' || ctx.view === 'cardboard');

    // function ที่ "เริ่มระบบ" แต่ไม่ auto-start เกม
    const startSystem = ()=>{
      // กันกดซ้ำ
      if (WIN.__BRUSH_BOOT_UNLOCKED__) return;
      WIN.__BRUSH_BOOT_UNLOCKED__ = true;

      // ซ่อน tap overlay
      try{
        if (tap){
          tap.style.display = 'none';
          tap.hidden = true;
        }
      }catch(_){}

      // พยายาม resume audio context ถ้ามี (optional)
      try{
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if (AC && WIN.__HHA_AUDIO_CTX__ && typeof WIN.__HHA_AUDIO_CTX__.resume === 'function'){
          WIN.__HHA_AUDIO_CTX__.resume().catch(()=>{});
        }
      }catch(_){}

      // boot engine once
      bootEngineOnce(ctx);

      // ย้ำสถานะหน้าเริ่ม (เมนูยังต้องอยู่จนกด "เริ่มเกม")
      const wrap = byId('br-wrap');
      const menu = byId('br-menu');
      const end  = byId('br-end');

      if (wrap) wrap.setAttribute('data-state', 'menu');
      if (menu) { menu.hidden = false; menu.style.display = ''; }
      if (end)  { end.hidden = true; end.style.display = 'none'; }
    };

    if (!needsTap || !tap || !btn){
      // desktop หรือไม่มี tap overlay => boot ทันที
      bootEngineOnce(ctx);

      // ย้ำ startup state หลัง boot อีกรอบ (กัน engine/async ไปแตะ DOM)
      forceStartupUi(ctx);
      return;
    }

    // mobile/cVR: รอแตะก่อน
    tap.style.display = 'grid';
    tap.hidden = false;

    const onTapBtn = (e)=>{ e.preventDefault(); e.stopPropagation(); startSystem(); };
    const onTapBg = (e)=>{
      if(e.target === tap){
        e.preventDefault();
        e.stopPropagation();
        startSystem();
      }
    };

    btn.addEventListener('click', onTapBtn, { passive:false, once:true });
    tap.addEventListener('click', onTapBg, { passive:false });

    // safety: ถ้าผู้ใช้แตะที่ไหนก็ได้ครั้งแรกใน mobile แล้ว overlay ยังอยู่ ให้ unlock ได้
    const firstPointerUnlock = ()=>{
      if (tap && tap.style.display !== 'none') startSystem();
      DOC.removeEventListener('pointerdown', firstPointerUnlock, true);
    };
    DOC.addEventListener('pointerdown', firstPointerUnlock, true);
  }

  // -------------------------
  // DOM ready
  // -------------------------
  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', setupTapStartAndBoot, { once:true });
  } else {
    setupTapStartAndBoot();
  }
})();