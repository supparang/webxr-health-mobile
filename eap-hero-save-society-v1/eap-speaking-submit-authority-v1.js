/* =========================================================
   EAP Speaking Submit Authority v3
   VERSION: 20260812-SPEAKING-SUBMIT-AUTHORITY-V3-POST-ACK

   Normal-session Speaking S1-S15 only.
   - Uses hidden HTML FORM POST to Apps Script.
   - Ignores the iframe's initial about:blank load race.
   - Waits for EAP_Progress/player_resume server confirmation before navigating.
   - Gives Apps Script enough bounded time to finish the write.
   - Boss speaking remains untouched.
========================================================= */
(function(){
  'use strict';

  const VERSION='20260812-SPEAKING-SUBMIT-AUTHORITY-V3-POST-ACK';
  const ACTIVE_KEY='EAP_HERO_ACTIVE_PLAYER_V1';
  let inFlight=false;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch(_){return {};}}
  function endpoint(){return clean(window.EAP_SHEET_CONFIG&&window.EAP_SHEET_CONFIG.webAppUrl);}
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

  function identity(){
    const a=readJson(ACTIVE_KEY), p=readJson('EAP_HERO_PLAYER_PROFILE_V1'), s=readJson('EAP_HERO_PROGRESS_V3');
    const src=Object.assign({},s&&s.profile||{},p||{},a||{});
    return {
      studentId:clean(src.studentId||src.id||''),
      studentName:clean(src.studentName||src.name||'Student'),
      section:clean(src.section||(window.EAP_SHEET_CONFIG&&window.EAP_SHEET_CONFIG.section)||'122')||'122'
    };
  }

  function currentRoute(){
    const text=clean((document.getElementById('app')||document.body).innerText||'');
    let m=text.match(/Session\s*(1[0-5]|[1-9])\b/i);
    if(m)return 'S'+Number(m[1]);
    m=text.match(/\bS(1[0-5]|[1-9])\b/i);
    return m?'S'+Number(m[1]):'';
  }

  function durationSeconds(){
    const text=clean((document.getElementById('app')||document.body).innerText||'');
    const m=text.match(/Speaking\s*finished\s*:\s*(\d{1,2}):(\d{2})/i);
    return m?Number(m[1])*60+Number(m[2]):0;
  }

  function checkedChecklist(){
    const app=document.getElementById('app')||document;
    const boxes=[...app.querySelectorAll('input[type="checkbox"]')].filter(x=>x.checked);
    return {count:boxes.length,labels:boxes.map(x=>clean(x.closest('label')?.innerText||x.parentElement?.innerText||''))};
  }

  function optionalOutput(){
    const app=document.getElementById('app')||document;
    return [...app.querySelectorAll('textarea,input[type="text"]')].map(x=>clean(x.value)).filter(Boolean).join(' | ').slice(0,5000);
  }

  function makeId(person,route){return 'oral-'+person.studentId+'-'+route+'-Speaking-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);}

  function postByForm(payload){
    return new Promise((resolve,reject)=>{
      const url=endpoint();
      if(!url){reject(new Error('EAP_SHEET_CONFIG.webAppUrl is missing'));return;}

      const frameName='eapSpeakPost_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const iframe=document.createElement('iframe');
      iframe.name=frameName;
      iframe.style.display='none';
      iframe.setAttribute('aria-hidden','true');
      document.body.appendChild(iframe);

      const form=document.createElement('form');
      form.method='POST';
      form.action=url;
      form.target=frameName;
      form.style.display='none';

      Object.keys(payload).forEach(key=>{
        let value=payload[key];
        if(value&&typeof value==='object') value=JSON.stringify(value);
        const input=document.createElement('input');
        input.type='hidden'; input.name=key; input.value=String(value==null?'':value);
        form.appendChild(input);
      });
      document.body.appendChild(form);

      let done=false;
      let submitted=false;
      let loadCount=0;
      const cleanup=()=>{setTimeout(()=>{try{form.remove();}catch(_){} try{iframe.remove();}catch(_){}},1500);};
      const finish=(data)=>{if(done)return;done=true;clearTimeout(timer);cleanup();resolve(data);};
      const timer=setTimeout(()=>finish({transport:'form-post',timed:true}),8000);

      iframe.addEventListener('load',()=>{
        loadCount++;
        if(!submitted)return;
        /* The first iframe load can still be about:blank. Require either a second
           load, or a short post-submit delay, before treating transport as complete. */
        if(loadCount>=2){finish({transport:'form-post',loaded:true,loadCount:loadCount});return;}
        setTimeout(()=>finish({transport:'form-post',loaded:true,loadCount:loadCount,guarded:true}),1200);
      });

      try{
        submitted=true;
        form.submit();
      }catch(err){clearTimeout(timer);cleanup();reject(err);}
    });
  }

  function resumeJsonp(person){
    return new Promise((resolve,reject)=>{
      const url=endpoint();
      if(!url){reject(new Error('Missing Web App URL'));return;}
      const cb='__eapSpeakingAck_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      let settled=false;
      const timer=setTimeout(()=>finish(new Error('resume timeout')),9000);
      function finish(err,data){
        if(settled)return; settled=true; clearTimeout(timer);
        try{delete window[cb];}catch(_){window[cb]=undefined;}
        try{script.remove();}catch(_){}
        err?reject(err):resolve(data||{});
      }
      window[cb]=data=>finish(null,data);
      script.onerror=()=>finish(new Error('resume network error'));
      script.src=url+'?action=player_resume&studentId='+encodeURIComponent(person.studentId)+'&section='+encodeURIComponent(person.section)+'&callback='+encodeURIComponent(cb)+'&_speakAck='+Date.now();
      document.head.appendChild(script);
    });
  }

  function speakingPassed(resume,route){
    const rp=resume&&resume.routeProgress&&resume.routeProgress[route];
    const s=rp&&rp.skills&&rp.skills.Speaking;
    return !!(s&&(s.passed===true||String(s.passed).toLowerCase()==='true'||Number(s.score)>=60||Number(s.bestScore)>=60));
  }

  async function waitForAck(person,route){
    let last=null;
    const deadline=Date.now()+45000;
    let attempt=0;
    await sleep(1400);
    while(Date.now()<deadline){
      attempt++;
      try{
        last=await resumeJsonp(person);
        if(speakingPassed(last,route))return last;
      }catch(_){ }
      await sleep(Math.min(2600,900+attempt*220));
    }
    const err=new Error('Server has not confirmed Speaking evidence within 45 seconds');
    err.lastResume=last;
    throw err;
  }

  function setButtonState(btn,text,disabled){if(!btn)return;btn.textContent=text;btn.disabled=!!disabled;btn.style.opacity=disabled?'.72':'';}
  function findBackButton(){return [...document.querySelectorAll('button,a')].find(el=>/Back to S\d+ Skills/i.test(clean(el.innerText||el.textContent)));}

  async function submit(btn){
    if(inFlight)return;
    const route=currentRoute();
    if(!/^S(?:1[0-5]|[1-9])$/.test(route))return;
    const person=identity();
    if(!person.studentId){alert('ไม่พบรหัสนักศึกษา กรุณากลับหน้า Lobby แล้วเข้าใหม่');return;}

    const seconds=durationSeconds(), checklist=checkedChecklist();
    if(seconds<8){alert('กรุณาพูดอย่างน้อย 8 วินาทีก่อนส่งหลักฐาน');return;}
    if(checklist.count<1){alert('กรุณายืนยัน checklist ก่อนส่งหลักฐาน');return;}

    inFlight=true;
    const old=clean(btn.textContent)||'Submit Speaking Evidence';
    setButtonState(btn,'กำลังส่ง Speaking…',true);
    const evidenceId=makeId(person,route);
    const payload={
      action:'submit_evidence',submissionKind:'fresh_evidence_v118',
      evidenceId:evidenceId,eventId:evidenceId,
      section:person.section,studentId:person.studentId,studentName:person.studentName,
      routeId:route,sessionId:route,skill:'Speaking',evidenceType:'oral_duration_checklist',
      score:100,passed:true,
      output:optionalOutput()||('Speaking completed for '+seconds+' seconds'),
      durationSec:seconds,speakingSeconds:seconds,
      oralChecklist:{confirmed:true,count:checklist.count,labels:checklist.labels},
      teacherReviewRequired:false,teacherReviewStatus:'not_required',
      occurredAt:new Date().toISOString(),sourceUrl:location.href,clientVersion:VERSION
    };

    try{
      await postByForm(payload);
      setButtonState(btn,'รอ EAP_Progress ยืนยัน…',true);
      const resume=await waitForAck(person,route);
      try{
        const state=readJson('EAP_HERO_PROGRESS_V3');
        state.serverResume=resume; state.cloudResumeStatus='verified';
        state.currentRoute=resume.currentRoute||state.currentRoute;
        state.currentCloudRoute=resume.currentRoute||state.currentCloudRoute;
        localStorage.setItem('EAP_HERO_PROGRESS_V3',JSON.stringify(state));
      }catch(_){ }
      try{window.dispatchEvent(new CustomEvent('eap:resume-synced',{detail:resume}));}catch(_){ }
      setButtonState(btn,'✓ Speaking บันทึกแล้ว',true);
      const back=findBackButton();
      setTimeout(()=>{if(back)back.click();else location.reload();},450);
    }catch(err){
      console.error('[EAP Speaking Authority v3]',err);
      setButtonState(btn,'บันทึกยังไม่ยืนยัน · กดตรวจอีกครั้ง',false);
      alert('ระบบยังไม่เห็น Speaking ใน EAP_Progress ภายในเวลาที่กำหนด ไม่ต้องพูดใหม่ กรุณากดปุ่มนี้อีกครั้งเพื่อตรวจ/ส่งซ้ำ');
    }finally{
      inFlight=false;
      if(!btn.disabled&&clean(btn.textContent).indexOf('อีกครั้ง')<0)setButtonState(btn,old,false);
    }
  }

  document.addEventListener('click',function(ev){
    const btn=ev.target&&ev.target.closest&&ev.target.closest('button,a');
    if(!btn)return;
    const label=clean(btn.innerText||btn.textContent);
    if(!(/Submit\s+Speaking\s+Evidence/i.test(label)||/บันทึก.*อีกครั้ง/i.test(label)||/กดตรวจอีกครั้ง/i.test(label)))return;
    const route=currentRoute();
    if(!/^S(?:1[0-5]|[1-9])$/.test(route))return;
    ev.preventDefault();ev.stopPropagation();if(typeof ev.stopImmediatePropagation==='function')ev.stopImmediatePropagation();
    submit(btn).catch(err=>console.error('[EAP Speaking Authority v3 submit]',err));
  },true);

  window.EAPSpeakingSubmitAuthorityV1={
    version:VERSION,submit:submit,
    diagnostics:function(){return {version:VERSION,transport:'hidden-form-post-guarded',endpoint:endpoint(),identity:identity(),route:currentRoute(),durationSec:durationSeconds(),checklist:checkedChecklist(),inFlight:inFlight};}
  };
})();
