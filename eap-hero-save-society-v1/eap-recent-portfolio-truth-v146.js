/* EAP Hero • Recent Portfolio Truth v148
   Writes cloud-confirmed player_resume records directly into the canonical
   Recent Portfolio table. Local evidence may appear as pending, but only
   serverResume records are labelled as Google Sheet verified.
*/
(() => {
  'use strict';
  if (window.__EAP_RECENT_PORTFOLIO_V148__) return;
  window.__EAP_RECENT_PORTFOLIO_V148__ = true;

  const VERSION='20260802-EAP-RECENT-PORTFOLIO-V148-CANONICAL-TBODY';
  const STATE_KEY='EAP_HERO_PROGRESS_V3';
  const SKILLS=['Reading','Writing','Listening','Speaking'];
  let timer=0;

  const text=v=>String(v??'').replace(/\s+/g,' ').trim();
  const esc=v=>text(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sessionOf=v=>{const m=text(v).toUpperCase().match(/(?:SESSION\s*:?\s*|\bS)(1[0-5]|[1-9])\b/);return m?'S'+Number(m[1]):'';};
  const skillOf=v=>SKILLS.find(s=>text(v).toLowerCase().includes(s.toLowerCase()))||'';
  const scoreOf=r=>{for(const v of [r?.bestScore,r?.latestScore,r?.score,r?.autoScore,r?.missionTaskScore,r?.accuracy]){const n=Number(v);if(Number.isFinite(n)&&n>=0&&n<=100)return n;}return 0;};
  const timeOf=r=>{for(const v of [r?.updatedAt,r?.submittedAt,r?.latestAt,r?.completedAt,r?.createdAt,r?.clientTimestamp,r?.timestamp]){if(!v)continue;const d=new Date(v);if(!Number.isNaN(d.getTime()))return d.toISOString();}return '';};

  function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}
  function isCloud(r){return !!(r&&(r.cloudVerified===true||r.serverVerified===true||r.restoredFromSheet===true||r.sourceSheet||r.sourceAuthority==='sheet'||r.authority==='sheet'||r.summaryId||r.attemptId));}
  function resultText(r,verified){
    for(const v of [r?.studentOutput,r?.output,r?.answer,r?.response,r?.reflection,r?.summary]){const t=text(v);if(t&&!/legacy|migration|browser-storage|system/i.test(t))return t;}
    return verified?'ยืนยันผลจาก Google Sheet แล้ว':'กำลังรอการยืนยันจาก Google Sheet';
  }

  function collect(){
    const state=readState();
    const server=state.serverResume||{};
    const cloud=[];
    ['records','attempts','summaries','summary','skillRecords'].forEach(k=>{if(Array.isArray(server[k]))cloud.push(...server[k]);});
    if(Array.isArray(state.cloudPortfolio))cloud.push(...state.cloudPortfolio);
    const local=Array.isArray(state.portfolio)?state.portfolio:[];
    const map=new Map();

    function add(r,verified){
      const session=sessionOf(r?.sessionId||r?.routeId||r?.session||r?.sessionCode||r?.taskId);
      const skill=skillOf(r?.skill||r?.skillName||r?.evidenceType||r?.type||r?.taskId);
      const score=scoreOf(r);
      if(!session||!skill||score<=0)return;
      if(r?.legacyCompletion===true||String(r?.legacyCompletion).toUpperCase()==='TRUE')return;
      const timestamp=timeOf(r);
      const rec={sessionId:session,skill,score,timestamp,verified:!!verified,output:resultText(r,verified)};
      const key=session+'|'+skill;
      const old=map.get(key);
      if(!old||(!old.verified&&rec.verified)||rec.score>old.score||(rec.score===old.score&&rec.timestamp>old.timestamp))map.set(key,rec);
    }

    cloud.forEach(r=>add(r,true));
    local.forEach(r=>add(r,isCloud(r)));
    return [...map.values()].sort((a,b)=>{
      if(a.verified!==b.verified)return a.verified?-1:1;
      if(a.timestamp&&b.timestamp&&a.timestamp!==b.timestamp)return b.timestamp.localeCompare(a.timestamp);
      return Number(b.sessionId.slice(1))-Number(a.sessionId.slice(1));
    }).slice(0,12);
  }

  function dateTH(v){
    if(!v)return 'รอเวลายืนยัน';
    const d=new Date(v);if(Number.isNaN(d.getTime()))return 'รอเวลายืนยัน';
    return new Intl.DateTimeFormat('th-TH',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Bangkok'}).format(d);
  }

  function findCanonicalTable(){
    const tables=[...document.querySelectorAll('#app table')];
    return tables.find(table=>{
      const headers=[...table.querySelectorAll('thead th, tr:first-child th, tr:first-child td')].map(n=>text(n.textContent).toLowerCase()).join('|');
      return headers.includes('session')&&headers.includes('skill')&&headers.includes('score')&&(headers.includes('output')||headers.includes('ผลลัพธ์'));
    })||null;
  }

  function render(){
    const table=findCanonicalTable();
    if(!table)return;
    let tbody=table.tBodies&&table.tBodies[0];
    if(!tbody){tbody=document.createElement('tbody');table.appendChild(tbody);}
    const data=collect();
    if(!data.length){
      tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:16px">ยังไม่มีผลการทำภารกิจที่ยืนยันจาก Google Sheet</td></tr>';
      return;
    }
    tbody.innerHTML=data.map(r=>`<tr data-eap-portfolio-source="${r.verified?'sheet':'pending'}"><td>${esc(dateTH(r.timestamp))}</td><td>${esc(r.sessionId)}</td><td>${esc(r.skill)}</td><td><strong>${r.score}/100</strong></td><td>${esc(r.verified?'ยืนยันจาก Google Sheet แล้ว':'กำลังส่งไป Google Sheet')} — ${esc(r.output)}</td></tr>`).join('');
    table.dataset.eapPortfolioVersion=VERSION;
    document.documentElement.dataset.eapPortfolioTruthVersion=VERSION;
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(render,100);}
  ['load','storage','eap:resume-synced','eap:cloud-resume-applied','eap:live-sheet-authority-applied','eap:local-result-saved','eap:route-changed','eap:sheet-delivery-queued'].forEach(name=>window.addEventListener(name,schedule));
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(render,1200);
  setTimeout(render,100);setTimeout(render,700);

  window.EAPRecentPortfolioTruthV148={version:VERSION,render,collect};
})();
