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

export async function guardApi({ uri }){
  if(!uri){
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

  const r = await probeApi({ uri });

  if(r.ok){
    setBanner({ kind:'ok', title:'Online', msg:'เชื่อมต่อ API สำเร็จ • logging/research ใช้งานได้' });
    return r;
  }

  if(r.status === 401 || r.status === 403){
    setBanner({
      kind:'bad',
      title:`Offline mode (API ${r.status})`,
      msg:'Forbidden/Unauthorized • HUB/เกมยังเล่นได้ปกติ • logging ถูกปิด'
    });
    return r;
  }

  setBanner({ kind:'warn', title:'Offline fallback', msg:'API ไม่พร้อมใช้งานชั่วคราว • เล่นได้ปกติ' });
  return r;
}

export async function retryGuard({ uri }){
  clearDisable();
  return guardApi({ uri });
}
