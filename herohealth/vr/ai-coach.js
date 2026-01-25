// === /herohealth/vr/ai-coach.js ===
// AI Coach (SAFE, explainable micro-tips)
// Export: createAICoach({ emit, game, cooldownMs })
// Emits: 'hha:coach' {game, text, tag, level, at, data}

'use strict';

const DOC = document;

const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

function ensureCoachUI(){
  if (DOC.getElementById('hhaCoachToast')) return;

  const st = DOC.createElement('style');
  st.id = 'hhaCoachStyle';
  st.textContent = `
  .hha-coach-toast{
    position:fixed;
    left: calc(12px + env(safe-area-inset-left, 0px));
    bottom: calc(12px + env(safe-area-inset-bottom, 0px));
    z-index:90;
    max-width:min(520px, 92vw);
    pointer-events:none;
  }
  .hha-coach-bubble{
    border-radius:18px;
    border:1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.74);
    backdrop-filter: blur(10px);
    box-shadow: 0 18px 70px rgba(0,0,0,.40);
    padding:12px 12px;
    color:rgba(229,231,235,.95);
    transform: translateY(10px);
    opacity:0;
    transition: opacity .20s ease, transform .20s ease;
    display:flex;
    gap:10px;
    align-items:flex-start;
  }
  .hha-coach-bubble.show{ opacity:1; transform: translateY(0); }
  .hha-coach-ico{
    width:34px; height:34px;
    border-radius:12px;
    display:flex; align-items:center; justify-content:center;
    background: rgba(34,211,238,.12);
    border:1px solid rgba(34,211,238,.18);
    flex: 0 0 auto;
    font-size:18px;
  }
  .hha-coach-txt{ line-height:1.25; font-size:13px; }
  .hha-coach-tag{
    margin-top:6px;
    font-size:11px;
    color:rgba(148,163,184,.95);
  }`;
  DOC.head.appendChild(st);

  const wrap = DOC.createElement('div');
  wrap.id = 'hhaCoachToast';
  wrap.className = 'hha-coach-toast';
  wrap.innerHTML = `
    <div class="hha-coach-bubble" id="hhaCoachBubble">
      <div class="hha-coach-ico" id="hhaCoachIco">🧠</div>
      <div>
        <div class="hha-coach-txt" id="hhaCoachText">—</div>
        <div class="hha-coach-tag" id="hhaCoachTag">—</div>
      </div>
    </div>
  `;
  DOC.body.appendChild(wrap);
}

function showToast({ text, tag, level }){
  ensureCoachUI();
  const b = DOC.getElementById('hhaCoachBubble');
  const t = DOC.getElementById('hhaCoachText');
  const g = DOC.getElementById('hhaCoachTag');
  const ico = DOC.getElementById('hhaCoachIco');

  if (t) t.textContent = String(text || '');
  if (g) g.textContent = tag ? `Tip: ${tag}` : '';

  const icon =
    level === 'warn' ? '⚠️' :
    level === 'good' ? '✅' :
    level === 'hype' ? '🔥' :
    '🧠';
  if (ico) ico.textContent = icon;

  if (b){
    b.classList.add('show');
    clearTimeout(showToast._tm);
    showToast._tm = setTimeout(()=>{ try{ b.classList.remove('show'); }catch(_){ } }, 2200);
  }
}

export function createAICoach({ emit, game='generic', cooldownMs=3000 } = {}){
  const state = {
    lastAt: 0,
    lastTag: '',
    started: false
  };

  const _emit = (payload)=>{
    try{
      if (typeof emit === 'function') emit('hha:coach', payload);
      else window.dispatchEvent(new CustomEvent('hha:coach', { detail: payload }));
    }catch(_){}
  };

  function say({ text, tag='', level='info', data=null, force=false }){
    const now = performance.now();
    if (!force){
      if (now - state.lastAt < cooldownMs) return;
      if (tag && tag === state.lastTag) return;
    }
    state.lastAt = now;
    state.lastTag = tag || state.lastTag;

    const payload = {
      game,
      text,
      tag,
      level,
      at: Date.now(),
      data: data || null
    };

    _emit(payload);
    showToast(payload);
  }

  function onStart(){
    state.started = true;
    say({
      text: 'เริ่มเลย! โฟกัสคุม Water ให้เข้า GREEN แล้วค่อยไป Storm Mini 😄',
      tag: 'คุม GREEN ก่อน',
      level: 'hype',
      force: true
    });
  }

  function onUpdate(ctx={}){
    if (!state.started) return;

    const skill = clamp(ctx.skill, 0, 1);
    const frustration = clamp(ctx.frustration, 0, 1);
    const fatigue = clamp(ctx.fatigue, 0, 1);

    // 1) Accuracy ต่ำ
    if (skill < 0.38 && (ctx.misses|0) >= 4){
      return say({
        text: 'ค่อย ๆ เล็งก่อนยิงนะ อย่ารัว—จะคุม GREEN ง่ายขึ้น 👀',
        tag: 'เล็งก่อนยิง',
        level: 'warn',
        data:{ skill, misses: ctx.misses|0 }
      });
    }

    // 2) End Window (สำคัญสุด)
    if (ctx.inStorm && ctx.inEndWindow){
      if ((ctx.shield|0) > 0){
        return say({
          text: 'นี่แหละ End Window! ใช้ 🛡️ BLOCK ช่วงท้ายเพื่อผ่าน Mini ⚡',
          tag: 'BLOCK ช่วงท้าย',
          level: 'hype',
          data:{ shield: ctx.shield|0 }
        });
      }
      return say({
        text: 'End Window มาแล้ว แต่ 🛡️ หมด—พยายามหลบ BAD แล้วเก็บ Shield รอบหน้า!',
        tag: 'เก็บ Shield ก่อนพายุ',
        level: 'warn',
        data:{ shield: ctx.shield|0 }
      });
    }

    // 3) หลุด GREEN บ่อย
    if (!ctx.inStorm && String(ctx.waterZone||'') !== 'GREEN' && frustration > 0.55){
      return say({
        text: 'ตอนนี้ไม่ GREEN แล้ว—ยิง 💧 ต่อเนื่อง 2–3 ที จะดันกลับสมดุลได้ 💧',
        tag: 'ดันกลับ GREEN',
        level: 'info',
        data:{ waterZone: ctx.waterZone }
      });
    }

    // 4) เหนื่อย/ยาว
    if (fatigue > 0.78 && frustration > 0.55){
      return say({
        text: 'ใกล้จบแล้ว! ลดพลาดก่อน ค่อยเร่งคอมโบทีหลังนะ ✨',
        tag: 'ลดพลาดก่อน',
        level: 'info',
        data:{ fatigue, frustration }
      });
    }

    // 5) ทำได้ดี
    if ((ctx.combo|0) >= 12 && skill >= 0.62){
      return say({
        text: 'โคตรดี! คอมโบยาว ๆ แบบนี้เกรดพุ่งแน่ 🔥',
        tag: 'ลากคอมโบ',
        level: 'good',
        data:{ combo: ctx.combo|0, skill }
      });
    }
  }

  function onEnd(summary={}){
    const g = String(summary.grade || 'C');
    if (g === 'SSS' || g === 'SS' || g === 'S'){
      say({ text:'สุดยอด! เกรดแรงมาก 👑', tag:'เก่งมาก', level:'good', force:true });
    } else {
      say({ text:'รอบหน้าเอาใหม่! โฟกัส Stage1 (GREEN) แล้วค่อย Mini นะ 💪', tag:'คุม GREEN', level:'info', force:true });
    }
  }

  return { onStart, onUpdate, onEnd, say };
}