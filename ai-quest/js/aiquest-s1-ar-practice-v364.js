/* =========================================================
   CSAI2102 AI Quest
   S1 AR Practice Mode — Inline Session UI
   File: /ai-quest/js/aiquest-s1-ar-practice-v364.js
   Version: v3.6.4-s1-ar-inline-session-ui
   ใช้คู่กับ aiquest-s1-ar-hand-hotfix-v364.js
========================================================= */
(function(){
  'use strict';

  const VERSION='v3.6.4-s1-ar-inline-session-ui';
  const STORAGE_KEY='AIQUEST_S1_AR_PRACTICE_RESULT_V364';

  const CATEGORIES=[
    {id:'ai',label:'AI',desc:'มีการรับรู้/เรียนรู้/ทำนาย/ตัดสินใจจากข้อมูล'},
    {id:'automation',label:'Automation',desc:'ทำงานอัตโนมัติตามขั้นตอนที่ตั้งไว้'},
    {id:'sensor',label:'Sensor-only',desc:'ตรวจจับ/วัดค่า แต่ยังไม่ตัดสินใจเอง'},
    {id:'rulebased',label:'Rule-based',desc:'ใช้กฎ IF–THEN ชัดเจน ไม่ได้เรียนรู้เอง'},
    {id:'prediction',label:'Prediction',desc:'ใช้ข้อมูลเพื่อคาดการณ์/จัดอันดับ/แนะนำ'}
  ];

  const BANK=[
    {id:'door_timer',object:'automatic door with motion trigger',th:'ประตูอัตโนมัติที่เปิดเมื่อมีคนเดินผ่าน',answer:'automation',hint:'ทำตาม trigger ที่ตั้งไว้ ไม่ได้เรียนรู้หรือทำนายเอง',explain:'ประตูเปิดตามเงื่อนไข/เซนเซอร์ จัดเป็น automation มากกว่า AI'},
    {id:'temp_sensor',object:'temperature sensor',th:'เซนเซอร์วัดอุณหภูมิ',answer:'sensor',hint:'วัดค่าอย่างเดียว ยังไม่ตัดสินใจซับซ้อน',explain:'sensor-only คือรับข้อมูลจากโลกจริง แต่ยังไม่ได้ reasoning หรือ learning'},
    {id:'face_unlock',object:'face recognition unlock',th:'ระบบปลดล็อกด้วยใบหน้า',answer:'ai',hint:'มีการรู้จำ pattern จากภาพ',explain:'face recognition ใช้ AI/computer vision เพื่อจำแนกรูปแบบใบหน้า'},
    {id:'traffic_timer',object:'traffic light timer',th:'สัญญาณไฟจราจรแบบตั้งเวลา',answer:'automation',hint:'ทำงานตามเวลาที่ตั้งไว้',explain:'ถ้าเป็นไฟจราจรตั้งเวลาเฉย ๆ คือ automation ไม่ใช่ AI'},
    {id:'rule_chatbot',object:'rule-based FAQ chatbot',th:'แชตบอตตอบคำถามจากคีย์เวิร์ดและกฎ IF–THEN',answer:'rulebased',hint:'ดูว่ามีกฎตายตัวหรือเรียนรู้จากข้อมูล',explain:'ถ้าตอบตาม rule/keyword แบบตายตัว จัดเป็น rule-based system'},
    {id:'movie_recommend',object:'movie recommendation system',th:'ระบบแนะนำหนังจากพฤติกรรมผู้ใช้',answer:'prediction',hint:'ใช้ข้อมูลเก่าเพื่อคาดการณ์สิ่งที่ผู้ใช้อาจชอบ',explain:'recommendation system ใช้ข้อมูลเพื่อทำนาย/จัดอันดับ จึงเป็น prediction system'},
    {id:'spam_filter',object:'email spam filter',th:'ระบบกรองอีเมลสแปม',answer:'prediction',hint:'คาดการณ์ว่าอีเมลน่าจะเป็น spam หรือไม่',explain:'spam filter มักใช้ ML/AI เพื่อทำนาย class ของอีเมล'},
    {id:'calculator',object:'calculator app',th:'แอปเครื่องคิดเลข',answer:'automation',hint:'คำนวณตามสูตรที่กำหนด ไม่ได้เรียนรู้เอง',explain:'เครื่องคิดเลขทำงานตาม algorithm แน่นอน จัดเป็น automation/computation ไม่ใช่ AI'},
    {id:'smart_camera',object:'smart camera detects people',th:'กล้องอัจฉริยะตรวจจับคนในภาพ',answer:'ai',hint:'มีการจำแนก object จากภาพ',explain:'object/person detection เป็นงาน computer vision จัดเป็น AI'},
    {id:'voice_assistant',object:'voice assistant understands command',th:'ผู้ช่วยเสียงที่เข้าใจคำสั่งผู้ใช้',answer:'ai',hint:'เกี่ยวกับภาษา เสียง และความตั้งใจของผู้ใช้',explain:'voice assistant ใช้ speech/NLP/intent detection จัดเป็น AI'},
    {id:'light_sensor',object:'light sensor turns on lamp',th:'เซนเซอร์แสงสั่งเปิดไฟเมื่อมืด',answer:'automation',hint:'มี sensor แต่การตอบสนองเป็นกฎตรงไปตรงมา',explain:'แม้มี sensor แต่ถ้าเป็นเงื่อนไขง่าย ๆ เช่น มืดแล้วเปิดไฟ ถือเป็น automation'},
    {id:'health_risk',object:'health risk prediction app',th:'แอปทำนายความเสี่ยงสุขภาพจากข้อมูลผู้ใช้',answer:'prediction',hint:'มีการคาดการณ์ความเสี่ยงจากข้อมูล',explain:'ระบบทำนาย risk ใช้ข้อมูลเพื่อ prediction จึงอยู่หมวด prediction/AI'}
  ];

  let stream=null, round=[], idx=0, correct=0, wrong=0, help=0, startedAt=0, lastResult=null;

  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
  function shuffle(a){a=(a||[]).slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  function toast(m){if(typeof window.showToast==='function')window.showToast(m);else console.log('[S1 AR]',m)}
  function beep(k){try{if(typeof window.beep==='function')window.beep(k==='ok'?'ok':'bad')}catch(e){}}

  function injectStyle(){
    if($('s1ArStyleV364'))return;
    const css=document.createElement('style');
    css.id='s1ArStyleV364';
    css.textContent=`
      .s1-ar-inline-entry-v364{margin:14px 0;padding:14px;border-radius:20px;border:1px solid rgba(34,211,238,.28);background:radial-gradient(circle at 0% 0%,rgba(34,211,238,.18),transparent 35%),linear-gradient(135deg,rgba(14,116,144,.22),rgba(15,23,42,.76));box-shadow:0 14px 34px rgba(0,0,0,.20)}
      .s1-ar-inline-row-v364{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.s1-ar-inline-title-v364{font-weight:1000;color:#e0f2fe;font-size:15px}.s1-ar-inline-desc-v364{color:#a7c6dd;font-size:12px;margin-top:3px;line-height:1.45}.s1-ar-inline-btn-v364{border:0;border-radius:999px;padding:10px 14px;font-weight:1000;color:#052e16;background:linear-gradient(135deg,#86efac,#67e8f9);cursor:pointer;box-shadow:0 10px 22px rgba(0,0,0,.25)}
      .s1-ar-panel-v364{position:fixed;inset:0;z-index:10000;background:#020617;color:#e5eefc;display:none;overflow:hidden;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.s1-ar-panel-v364.open{display:block}.s1-ar-video-v364{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scaleX(-1);opacity:.88;background:#0f172a}.s1-ar-fallback-bg-v364{position:absolute;inset:0;background:radial-gradient(circle at 15% 10%,rgba(34,211,238,.25),transparent 34%),radial-gradient(circle at 80% 30%,rgba(167,139,250,.22),transparent 35%),linear-gradient(135deg,#071426,#0f172a 55%,#111827)}
      .s1-ar-overlay-v364{position:absolute;inset:0;padding:14px;padding-top:calc(14px + env(safe-area-inset-top,0px));padding-bottom:calc(14px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:12px;background:linear-gradient(to bottom,rgba(2,6,23,.72),rgba(2,6,23,.20),rgba(2,6,23,.78))}
      .s1-ar-top-v364{display:flex;align-items:center;justify-content:space-between;gap:10px}.s1-ar-title-v364{font-weight:1000;font-size:18px;line-height:1.15}.s1-ar-sub-v364{font-size:12px;color:#bae6fd;margin-top:2px}.s1-ar-btn-v364{border:1px solid rgba(255,255,255,.18);background:rgba(15,23,42,.72);color:#f8fafc;border-radius:14px;padding:10px 12px;font-weight:900;cursor:pointer}.s1-ar-main-v364{flex:1;display:flex;align-items:center;justify-content:center;min-height:0}.s1-ar-card-v364,.s1-ar-result-v364{width:min(92vw,560px);border:1px solid rgba(148,163,184,.24);background:rgba(15,23,42,.80);backdrop-filter:blur(14px);border-radius:24px;padding:18px;box-shadow:0 22px 54px rgba(0,0,0,.38)}
      .s1-ar-badge-v364{display:inline-flex;border-radius:999px;padding:6px 10px;background:rgba(56,189,248,.18);border:1px solid rgba(56,189,248,.32);color:#bae6fd;font-size:12px;font-weight:900}.s1-ar-object-v364{margin:12px 0 4px;font-size:24px;font-weight:1000;line-height:1.2}.s1-ar-th-v364{font-size:16px;color:#fef9c3;line-height:1.45;margin-bottom:12px}.s1-ar-choices-v364{display:grid;grid-template-columns:1fr;gap:8px}.s1-ar-choice-v364{border:1px solid rgba(148,163,184,.24);background:rgba(30,41,59,.86);color:#f8fafc;border-radius:16px;padding:12px;text-align:left;font-weight:900;cursor:pointer;position:relative}.s1-ar-choice-v364 small{display:block;color:#9fb2cc;font-weight:700;margin-top:3px;line-height:1.35}.s1-ar-choice-v364.correct{border-color:rgba(34,197,94,.8);background:rgba(34,197,94,.22)}.s1-ar-choice-v364.wrong{border-color:rgba(239,68,68,.8);background:rgba(239,68,68,.22)}
      .s1-ar-feedback-v364{margin-top:12px;padding:12px;border-radius:16px;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.58);line-height:1.45}.s1-ar-feedback-v364.good{border-color:rgba(34,197,94,.45);background:rgba(34,197,94,.14)}.s1-ar-feedback-v364.bad{border-color:rgba(239,68,68,.45);background:rgba(239,68,68,.14)}.s1-ar-bottom-v364{display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between;align-items:center}.s1-ar-meter-v364{color:#cbd5e1;font-size:13px;font-weight:800}.s1-ar-result-grid-v364{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0}.s1-ar-stat-v364{border:1px solid rgba(148,163,184,.20);background:rgba(30,41,59,.82);border-radius:16px;padding:12px}.s1-ar-stat-v364 b{display:block;font-size:22px}.s1-ar-stat-v364 span{color:#9fb2cc;font-size:12px;font-weight:800}
      @media(min-width:720px){.s1-ar-choices-v364{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(css);
  }

  function ensurePanel(){
    injectStyle();
    let panel=$('s1ArPanelV364'); if(panel)return panel;
    panel=document.createElement('section');
    panel.id='s1ArPanelV364'; panel.className='s1-ar-panel-v364';
    panel.innerHTML=`
      <div id="s1ArFallbackBgV364" class="s1-ar-fallback-bg-v364"></div>
      <video id="s1ArVideoV364" class="s1-ar-video-v364" autoplay playsinline muted></video>
      <div class="s1-ar-overlay-v364">
        <div class="s1-ar-top-v364"><div><div class="s1-ar-title-v364">S1 AR Practice: AI Object Scanner</div><div class="s1-ar-sub-v364">ใช้กล้องและมือ เพื่อแยก AI / Automation / Sensor / Rule-based / Prediction</div></div><button id="s1ArExitV364" class="s1-ar-btn-v364">ออกจาก AR</button></div>
        <div id="s1ArMainV364" class="s1-ar-main-v364"></div>
        <div class="s1-ar-bottom-v364"><div id="s1ArMeterV364" class="s1-ar-meter-v364">Ready</div><div><button id="s1ArHelpV364" class="s1-ar-btn-v364">AI Help</button><button id="s1ArSkipV364" class="s1-ar-btn-v364">ข้าม AR</button></div></div>
      </div>`;
    document.body.appendChild(panel);
    $('s1ArExitV364').onclick=closeAR; $('s1ArSkipV364').onclick=skipAR; $('s1ArHelpV364').onclick=showHint;
    return panel;
  }

  function shouldShowInline(){
    const q=new URLSearchParams(location.search);
    const s=String(q.get('session')||q.get('mission')||'').toLowerCase();
    if(s==='s1'||s==='m1')return true;
    const t=(document.body&&document.body.innerText||'').toLowerCase();
    return t.includes('ai awakening') || t.includes('ai vs automation') || (t.includes('s1')&&t.includes('automation'));
  }
  function removeOldFloating(){['s1ArFabV362','s1ArFabV363','s1ArFabV364'].forEach(id=>$(id)?.remove());document.querySelectorAll('.s1-ar-fab-v362,.s1-ar-fab-v363,.s1-ar-fab-v364').forEach(e=>e.remove())}
  function findContainer(){return $('gameArea')||document.querySelector('.gameArea')||document.querySelector('.missionArea')||document.querySelector('main')||document.body}
  function findPhaseBar(){return Array.from(document.querySelectorAll('*')).find(el=>{const t=(el.textContent||'').toLowerCase();return t.includes('card rush')&&t.includes('trick cards')&&(t.includes('mini boss')||t.includes('explain strike'))})}

  function addInline(){
    injectStyle(); removeOldFloating(); if($('s1ArInlineEntryV364'))return;
    const container=findContainer(); if(!container)return;
    const wrap=document.createElement('div'); wrap.id='s1ArInlineEntryV364'; wrap.className='s1-ar-inline-entry-v364';
    wrap.innerHTML=`<div class="s1-ar-inline-row-v364"><div><div class="s1-ar-inline-title-v364">🖐️ S1 AR Practice: AI Object Scanner</div><div class="s1-ar-inline-desc-v364">ใช้กล้องและมือชี้/หนีบนิ้ว เพื่อแยก AI, Automation, Sensor-only, Rule-based, Prediction</div></div><button id="s1ArInlineStartV364" type="button" class="s1-ar-inline-btn-v364">เริ่ม AR Practice</button></div>`;
    const phase=findPhaseBar();
    if(phase&&phase.parentNode)phase.parentNode.insertBefore(wrap,phase.nextSibling); else container.insertBefore(wrap,container.firstChild);
    $('s1ArInlineStartV364').onclick=e=>{e.preventDefault();e.stopPropagation();startAR()};
  }
  function refreshInline(){removeOldFloating();const inline=$('s1ArInlineEntryV364');if(shouldShowInline()){if(!inline)addInline()}else if(inline)inline.remove()}

  async function startCamera(){
    const v=$('s1ArVideoV364'), bg=$('s1ArFallbackBgV364');
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera API not available');
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:720}},audio:false});
      v.srcObject=stream;v.style.display='block';bg.style.display='none';await v.play().catch(()=>{});return true;
    }catch(e){console.warn('[S1 AR] camera fallback',e);v.style.display='none';bg.style.display='block';toast('เปิดกล้องไม่ได้ ใช้ AR Card Overlay แทน');return false}
  }
  async function startAR(){ensurePanel();round=shuffle(BANK).slice(0,8);idx=0;correct=0;wrong=0;help=0;startedAt=Date.now();lastResult=null;$('s1ArPanelV364').classList.add('open');await startCamera();renderCard();window.dispatchEvent(new CustomEvent('aiquest:s1-ar-start',{detail:{version:VERSION,total:round.length,inline:true}}))}
  function stopCamera(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
  function closeAR(){stopCamera();$('s1ArPanelV364')?.classList.remove('open');window.dispatchEvent(new CustomEvent('aiquest:s1-ar-close',{detail:{version:VERSION}}))}
  function skipAR(){saveResult({version:VERSION,sessionId:'s1',missionId:'m1',arMode:true,arCompleted:false,arSkipped:true,arScore:0,correct,wrong,total:round.length||0,helpUsed:help,finishedAt:new Date().toISOString()});closeAR();toast('ข้าม AR Practice แล้ว')}

  function labelOf(id){return (CATEGORIES.find(c=>c.id===id)||{}).label||id}
  function item(){return round[idx]}
  function meter(){const total=round.length||0,acc=(correct+wrong)?Math.round(correct/(correct+wrong)*100):0;const m=$('s1ArMeterV364');if(m)m.textContent=`ข้อ ${Math.min(idx+1,total)}/${total} • Correct ${correct} • Accuracy ${acc}%`}

  function renderCard(){
    const main=$('s1ArMainV364'), it=item(); if(!it){renderResult();return}
    meter();
    main.innerHTML=`<div class="s1-ar-card-v364"><span class="s1-ar-badge-v364">Object ${idx+1}/${round.length}</span><div class="s1-ar-object-v364">${esc(it.object)}</div><div class="s1-ar-th-v364">${esc(it.th)}</div><div class="s1-ar-choices-v364">${CATEGORIES.map(c=>`<button class="s1-ar-choice-v364" data-cat="${esc(c.id)}">${esc(c.label)}<small>${esc(c.desc)}</small></button>`).join('')}</div><div id="s1ArFeedbackV364" class="s1-ar-feedback-v364" style="display:none"></div></div>`;
    document.querySelectorAll('.s1-ar-choice-v364').forEach(b=>b.onclick=()=>answer(b.dataset.cat));
    window.dispatchEvent(new CustomEvent('aiquest:s1-ar-card-rendered',{detail:{version:VERSION,index:idx,total:round.length,itemId:it.id}}));
  }

  function answer(cat){
    const it=item(); if(!it)return; const ok=cat===it.answer;
    document.querySelectorAll('.s1-ar-choice-v364').forEach(b=>{b.disabled=true;if(b.dataset.cat===it.answer)b.classList.add('correct');else if(b.dataset.cat===cat)b.classList.add('wrong')});
    ok?(correct++,beep('ok')):(wrong++,beep('bad'));
    const fb=$('s1ArFeedbackV364');
    if(fb){fb.style.display='block';fb.className='s1-ar-feedback-v364 '+(ok?'good':'bad');fb.innerHTML=`<b>${ok?'ถูกต้อง':'ยังไม่ถูก'}</b><br>คำตอบที่เหมาะที่สุด: <b>${esc(labelOf(it.answer))}</b><br>${esc(it.explain)}<div style="margin-top:10px"><button id="s1ArNextV364" class="s1-ar-btn-v364">${idx>=round.length-1?'สรุปผล AR':'ข้อต่อไป'}</button></div>`}
    meter(); $('s1ArNextV364').onclick=()=>{idx++;renderCard()};
    window.dispatchEvent(new CustomEvent('aiquest:s1-ar-answer',{detail:{version:VERSION,itemId:it.id,answer:cat,correctAnswer:it.answer,isCorrect:ok,index:idx,correct,wrong}}));
  }

  function showHint(){
    const it=item(); if(!it)return; help++;
    const fb=$('s1ArFeedbackV364'); if(fb){fb.style.display='block';fb.className='s1-ar-feedback-v364';fb.innerHTML=`<b>AI Help</b><br>${esc(it.hint)}`}
    window.dispatchEvent(new CustomEvent('aiquest:s1-ar-help',{detail:{version:VERSION,itemId:it.id,helpUsed:help}}));
  }

  function renderResult(){
    stopCamera();
    const total=round.length||0, acc=total?Math.round(correct/total*100):0, usedSec=Math.round((Date.now()-startedAt)/1000);
    const badge=acc>=85?'AI Scanner Master':acc>=70?'AI Scanner':'AR Practice Started';
    const bonus=acc>=85?3:acc>=70?2:correct>0?1:0;
    const result={version:VERSION,sessionId:'s1',missionId:'m1',arMode:true,arCompleted:true,arSkipped:false,arScore:acc,correct,wrong,total,helpUsed:help,usedSec,badge,bonus,finishedAt:new Date().toISOString()};
    saveResult(result);
    $('s1ArMainV364').innerHTML=`<div class="s1-ar-result-v364"><span class="s1-ar-badge-v364">AR Practice Complete</span><h2>${esc(badge)}</h2><p>สรุปผล S1 AR Practice: AI Object Scanner</p><div class="s1-ar-result-grid-v364"><div class="s1-ar-stat-v364"><span>AR Score</span><b>${acc}%</b></div><div class="s1-ar-stat-v364"><span>Correct</span><b>${correct}/${total}</b></div><div class="s1-ar-stat-v364"><span>Bonus</span><b>+${bonus}</b></div></div><div class="s1-ar-feedback-v364 good"><b>บันทึก AR result แล้ว</b><br>ผลนี้เก็บใน localStorage และพร้อมเชื่อม Result / Submit / Teacher Dashboard</div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px"><button id="s1ArReplayV364" class="s1-ar-btn-v364">เล่น AR อีกครั้ง</button><button id="s1ArBackV364" class="s1-ar-btn-v364">กลับ Mission</button></div></div>`;
    $('s1ArReplayV364').onclick=startAR; $('s1ArBackV364').onclick=closeAR; meter();
    window.dispatchEvent(new CustomEvent('aiquest:s1-ar-complete',{detail:result}));
  }

  function saveResult(r){lastResult=r;window.AIQUEST_S1_AR_RESULT=r;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(r));const all=JSON.parse(localStorage.getItem('AIQUEST_AR_RESULTS')||'{}');all.s1=r;localStorage.setItem('AIQUEST_AR_RESULTS',JSON.stringify(all))}catch(e){}}
  function loadResult(){try{const r=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(r&&r.sessionId==='s1'){lastResult=r;window.AIQUEST_S1_AR_RESULT=r;return r}}catch(e){}return null}
  function getResult(){return lastResult||loadResult()}

  function install(){refreshInline();const mo=new MutationObserver(refreshInline);mo.observe(document.body,{childList:true,subtree:true});setInterval(refreshInline,2000);const q=new URLSearchParams(location.search);const ar=String(q.get('ar')||'').toLowerCase();if(ar==='s1'||ar==='hand'||ar==='ar')setTimeout(startAR,500)}
  window.AIQUEST_S1_AR_PRACTICE={version:VERSION,start:startAR,close:closeAR,skip:skipAR,getResult,loadResult,categories:CATEGORIES,bank:BANK};
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install):install();
  console.log('[AIQuest] '+VERSION+' loaded',window.AIQUEST_S1_AR_PRACTICE);
})();
