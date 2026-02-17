// === /herohealth/log-admin.js — Logger Admin Mini (v20260217a) ===
'use strict';

function qs(k, d=''){
  try{ return new URL(location.href).searchParams.get(k) || d; }catch{ return d; }
}
function el(tag, cls, txt){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
function setStatus(box, txt, ok){
  box.textContent = txt;
  box.classList.remove('ok','bad');
  if (ok === true) box.classList.add('ok');
  if (ok === false) box.classList.add('bad');
}

async function ping(url){
  const u = new URL(url);
  u.searchParams.set('ping','1');
  const r = await fetch(u.toString(), { method:'GET', cache:'no-store' });
  const j = await r.json().catch(()=>null);
  return { ok:r.ok && j && j.ok, status:r.status, json:j };
}
async function postTest(url){
  const payload = {
    _table: 'events',
    rows: [{
      timestampIso: new Date().toISOString(),
      projectTag: 'HeroHealth-AdminTest',
      runMode: 'admin',
      studyId: 'TEST',
      phase: 'ping',
      conditionGroup: 'admin',
      sessionId: 'ADMIN-'+Date.now(),
      eventType: 'admin_test',
      gameMode: 'hub',
      diff: 'na',
      timeFromStartMs: 0,
      extra: JSON.stringify({ note:'test post from hub admin' })
    }]
  };
  const r = await fetch(url, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload),
    keepalive:true
  });
  const j = await r.json().catch(()=>null);
  return { ok:r.ok && j && j.ok, status:r.status, json:j };
}

export function mountLogAdmin(mountId='hh-log-admin'){
  const mount = document.getElementById(mountId);
  if (!mount) return;

  const box = el('section','hh-admin');
  const title = el('div','hh-admin-title','🧾 HeroHealth Logger Admin');
  const row = el('div','hh-admin-row');

  const input = el('input','hh-admin-input');
  input.placeholder = 'ใส่ Web App URL (…/exec)';
  input.value = qs('log','');

  const status = el('div','hh-admin-status','status: idle');

  const btnPing = el('button','hh-admin-btn','Ping');
  const btnPost = el('button','hh-admin-btn','Test POST');
  const btnCopy = el('button','hh-admin-btn','Copy ?log=');

  const hint = el('div','hh-admin-hint',
    'Tip: ถ้า Ping ok แล้วให้กด Copy แล้วเอาไปแปะท้าย hub URL หรือส่งต่อไป launcher/game');

  btnPing.onclick = async ()=>{
    const url = input.value.trim();
    if (!url){ setStatus(status,'⚠ ใส่ URL ก่อน', false); return; }
    setStatus(status,'⏳ ping...', null);
    try{
      const out = await ping(url);
      setStatus(status, out.ok ? `✅ ping ok (${out.status})` : `❌ ping fail (${out.status})`, out.ok);
    }catch(e){
      setStatus(status, '❌ ping error: '+(e?.message||e), false);
    }
  };

  btnPost.onclick = async ()=>{
    const url = input.value.trim();
    if (!url){ setStatus(status,'⚠ ใส่ URL ก่อน', false); return; }
    setStatus(status,'⏳ posting...', null);
    try{
      const out = await postTest(url);
      setStatus(status, out.ok ? `✅ POST ok (${out.status})` : `❌ POST fail (${out.status})`, out.ok);
    }catch(e){
      setStatus(status, '❌ post error: '+(e?.message||e), false);
    }
  };

  btnCopy.onclick = async ()=>{
    const url = input.value.trim();
    if (!url){ setStatus(status,'⚠ ใส่ URL ก่อน', false); return; }
    const s = `log=${encodeURIComponent(url)}`;
    try{
      await navigator.clipboard.writeText(s);
      setStatus(status, '✅ copied: '+s, true);
    }catch{
      setStatus(status, 'ℹ คัดลอกไม่สำเร็จ (เบราว์เซอร์บล็อก) — ใช้ข้อความนี้: '+s, null);
    }
  };

  row.append(btnPing, btnPost, btnCopy);

  box.append(title, input, row, status, hint);
  mount.innerHTML = '';
  mount.append(box);
}