// === /herohealth/api/hub-api-guard.js ===
'use strict';

import { isRemoteDisabled, disabledInfo, clearDisable } from './api-status.js';
import { probeApi } from './api-probe.js';

function el(id){ return document.getElementById(id); }

function setDot(kind){
  const d = el('apiDot');
  if(!d) return;
  d.classList.remove('ok','warn','bad');
  d.classList.add(kind);
}
function setBanner({ title, msg, kind='warn' }){
  if(el('apiTitle')) el('apiTitle').textContent = title || '';
  if(el('apiMsg')) el('apiMsg').textContent = msg || '';
  setDot(kind);
}

// Optional defaults from window (shared with hub-api-boot.js idea)
function getProbeDefaults(){
  const d = (typeof window !== 'undefined' && window.__HHA_API_DEFAULTS__) || {};
  return {
    // IMPORTANT: probe should hit a public GET endpoint (health/ping), not POST root.
    healthPath: d.healthPath || '/prod/health',  // ✅ adjust to your real public route
    timeoutMs: Number.isFinite(d.probeTimeoutMs) ? d.probeTimeoutMs : 3500,
    // If your API is expected to require auth, don't paint as "system down".
    authIsExpected: (typeof d.authIsExpected === 'boolean') ? d.authIsExpected : true
  };
}

export async function guardApi({ uri }){
  const apiBase = String(uri || '').trim();
  const def = getProbeDefaults();

  if(!apiBase){
    setBanner({ kind:'warn', title:'ไม่มี API URI', msg:'ทำงานแบบ Offline' });
    return { ok:false, status:0, reason:'missing_uri' };
  }

  if(isRemoteDisabled()){
    const info = disabledInfo();
    setBanner({
      kind:'bad',
      title:`Offline mode (API ${info.code || 403})`,
      msg:'ถูกบล็อกชั่วคราวในแท็บนี้ — HUB/เกมยังใช้ได้ปกติ'
    });
    return { ok:false, status:info.code||403, reason:'disabled' };
  }

  setBanner({
    kind:'warn',
    title:'กำลังตรวจสอบระบบ…',
    msg:'ถ้า API ล่ม/403 หน้า HUB จะยังใช้งานได้ปกติ (เข้าเกมได้ทุกเกม)'
  });

  // Pass healthPath + timeout to probe layer
  const r = await probeApi({
    uri: apiBase,
    healthPath: def.healthPath,
    timeoutMs: def.timeoutMs
  });

  if(r.ok){
    setBanner({ kind:'ok', title:'Online', msg:'เชื่อมต่อ API สำเร็จ • logging/research ใช้งานได้' });
    return r;
  }

  // Auth-related responses: display informative message
  if(r.status === 401 || r.status === 403){
    if(def.authIsExpected){
      setBanner({
        kind:'warn',
        title:`Auth required (API ${r.status})`,
        msg:'ระบบต้องยืนยันตัวตนก่อน • HUB/เกมยังเล่นได้ปกติ • logging จะพร้อมเมื่อมี token/key'
      });
    }else{
      setBanner({
        kind:'bad',
        title:`Offline mode (API ${r.status})`,
        msg:'Forbidden/Unauthorized • HUB/เกมยังเล่นได้ปกติ • logging ถูกปิด'
      });
    }
    return r;
  }

  setBanner({ kind:'warn', title:'Offline fallback', msg:'API ไม่พร้อมใช้งานชั่วคราว • เล่นได้ปกติ' });
  return r;
}

export async function retryGuard({ uri }){
  clearDisable();
  return guardApi({ uri });
}
