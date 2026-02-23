// === /herohealth/fitness-planner/teacher-bar.js ===
// Teacher Control Bar (PIN lock, daily settings) — local-only

'use strict';

function safeParseJSON(s){ try{ return JSON.parse(s); }catch(_){ return null; } }
function todayKey(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}

const KEY_PIN = 'HHA_TEACHER_PIN';
function keyCfg(){ return `HHA_TEACHER_CFG_${todayKey()}`; }

function loadCfg(){
  try{
    return safeParseJSON(localStorage.getItem(keyCfg())||'null') || null;
  }catch(_){ return null; }
}
function saveCfg(cfg){
  try{ localStorage.setItem(keyCfg(), JSON.stringify(cfg)); }catch(_){}
}

function loadPin(){
  try{ return String(localStorage.getItem(KEY_PIN)||''); }catch(_){ return ''; }
}
function savePin(pin){
  try{ localStorage.setItem(KEY_PIN, String(pin)); }catch(_){}
}

export function shouldShowTeacherBar(){
  const qs = new URLSearchParams(location.search);
  if(qs.get('teacher') === '1') return true;
  if(qs.get('run') === 'research') return true;
  return false;
}

export function getTeacherCfg(){
  // defaults
  const d = {
    locked: 1,
    run: (new URLSearchParams(location.search).get('run') || 'play'),
    bossDay: (new URLSearchParams(location.search).get('bossDay') || ''), // '' auto, '0','1'
    bossWhere: (new URLSearchParams(location.search).get('bossWhere') || 'after2'), // after2|end|none
    consent: (new URLSearchParams(location.search).get('consent') || ''), // '' auto, '0','1'
    attn: (new URLSearchParams(location.search).get('attn') || ''),       // '' auto, '0','1'
    ai: (new URLSearchParams(location.search).get('ai') || ''),           // '' default, '0','1'
  };
  const saved = loadCfg();
  return Object.assign(d, saved||{});
}

export function mountTeacherBar(onChange){
  if(!shouldShowTeacherBar()) return null;

  const cfg = getTeacherCfg();

  const bar = document.createElement('div');
  bar.id = 'hhTeacherBar';
  bar.style.cssText = `
    position:fixed; left:10px; right:10px; bottom:10px; z-index:99998;
    pointer-events:auto;
    font-family:system-ui,-apple-system,'Noto Sans Thai',sans-serif;
  `;

  bar.innerHTML = `
    <div style="background:rgba(2,6,23,.78); border:1px solid rgba(255,255,255,.16);
                border-radius:18px; padding:10px 12px; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
      <div style="font-weight:900;">👩‍🏫 Teacher</div>

      <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
        <label style="opacity:.9; font-size:12px;">Run
          <select id="tbRun" style="margin-left:6px; padding:6px 8px; border-radius:12px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.25); color:#fff;">
            <option value="play">play</option>
            <option value="research">research</option>
          </select>
        </label>

        <label style="opacity:.9; font-size:12px;">BossDay
          <select id="tbBossDay" style="margin-left:6px; padding:6px 8px; border-radius:12px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.25); color:#fff;">
            <option value="">auto</option>
            <option value="0">off</option>
            <option value="1">on</option>
          </select>
        </label>

        <label style="opacity:.9; font-size:12px;">BossWhere
          <select id="tbBossWhere" style="margin-left:6px; padding:6px 8px; border-radius:12px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.25); color:#fff;">
            <option value="after2">after2</option>
            <option value="end">end</option>
            <option value="none">none</option>
          </select>
        </label>

        <label style="opacity:.9; font-size:12px;">Consent
          <select id="tbConsent" style="margin-left:6px; padding:6px 8px; border-radius:12px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.25); color:#fff;">
            <option value="">auto</option>
            <option value="0">off</option>
            <option value="1">on</option>
          </select>
        </label>

        <label style="opacity:.9; font-size:12px;">Attn
          <select id="tbAttn" style="margin-left:6px; padding:6px 8px; border-radius:12px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.25); color:#fff;">
            <option value="">auto</option>
            <option value="0">off</option>
            <option value="1">on</option>
          </select>
        </label>

        <label style="opacity:.9; font-size:12px;">AI
          <select id="tbAI" style="margin-left:6px; padding:6px 8px; border-radius:12px; border:1px solid rgba(255,255,255,.16); background:rgba(0,0,0,.25); color:#fff;">
            <option value="">default</option>
            <option value="0">off</option>
            <option value="1">on</option>
          </select>
        </label>
      </div>

      <div style="margin-left:auto; display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
        <span id="tbLockState" style="opacity:.9; font-size:12px;"></span>
        <button id="tbLock" style="padding:8px 10px;border-radius:14px;border:1px solid rgba(255,255,255,.16);
          background:rgba(0,0,0,.25);color:#fff;font-weight:900;">🔒 Lock</button>
        <button id="tbApply" style="padding:8px 10px;border-radius:14px;border:1px solid rgba(255,255,255,.16);
          background:rgba(59,130,246,.30);color:#fff;font-weight:900;">Apply</button>
      </div>
    </div>
  `;

  document.body.appendChild(bar);

  const $ = (id)=>bar.querySelector(id);

  const tbRun = $('#tbRun');
  const tbBossDay = $('#tbBossDay');
  const tbBossWhere = $('#tbBossWhere');
  const tbConsent = $('#tbConsent');
  const tbAttn = $('#tbAttn');
  const tbAI = $('#tbAI');
  const tbLock = $('#tbLock');
  const tbApply = $('#tbApply');
  const tbLockState = $('#tbLockState');

  // set current values
  tbRun.value = cfg.run || 'play';
  tbBossDay.value = cfg.bossDay ?? '';
  tbBossWhere.value = cfg.bossWhere || 'after2';
  tbConsent.value = cfg.consent ?? '';
  tbAttn.value = cfg.attn ?? '';
  tbAI.value = cfg.ai ?? '';

  function setLocked(locked){
    cfg.locked = locked ? 1 : 0;
    tbLockState.textContent = locked ? 'Locked (PIN required)' : 'Unlocked';
    tbLock.textContent = locked ? '🔓 Unlock' : '🔒 Lock';

    const dis = locked ? true : false;
    tbRun.disabled = dis;
    tbBossDay.disabled = dis;
    tbBossWhere.disabled = dis;
    tbConsent.disabled = dis;
    tbAttn.disabled = dis;
    tbAI.disabled = dis;
  }

  function promptPin(setup){
    const pin = prompt(setup ? 'ตั้ง PIN 4 หลัก (ครู):' : 'ใส่ PIN (ครู):');
    if(pin == null) return null;
    const p = String(pin).trim();
    if(!/^\d{4}$/.test(p)){
      alert('PIN ต้องเป็นเลข 4 หลัก');
      return null;
    }
    return p;
  }

  function ensurePin(){
    let pin = loadPin();
    if(!pin){
      const p = promptPin(true);
      if(!p) return null;
      savePin(p);
      pin = p;
      alert('ตั้ง PIN แล้ว');
    }
    return pin;
  }

  setLocked(!!cfg.locked);

  tbLock.addEventListener('click', ()=>{
    if(cfg.locked){
      // unlock
      const stored = ensurePin();
      if(!stored) return;
      const p = promptPin(false);
      if(!p) return;
      if(p !== stored){
        alert('PIN ไม่ถูกต้อง');
        return;
      }
      setLocked(false);
      saveCfg(cfg);
    } else {
      // lock
      ensurePin();
      setLocked(true);
      saveCfg(cfg);
    }
  });

  tbApply.addEventListener('click', ()=>{
    if(cfg.locked){
      alert('ปลดล็อกก่อน (Unlock)');
      return;
    }

    cfg.run = tbRun.value;
    cfg.bossDay = tbBossDay.value;
    cfg.bossWhere = tbBossWhere.value;
    cfg.consent = tbConsent.value;
    cfg.attn = tbAttn.value;
    cfg.ai = tbAI.value;

    saveCfg(cfg);

    // notify caller
    try{ onChange && onChange(Object.assign({}, cfg)); }catch(_){}

    alert('Apply แล้ว (ค่าจะใช้กับลำดับวันนี้/การเปิดหน้าต่าง ๆ)');
  });

  return { cfg, setLocked };
}