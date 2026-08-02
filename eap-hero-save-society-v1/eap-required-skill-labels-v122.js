/* =========================================================
   EAP Hero • Required Skill Labels v123
   Robust UI-only clarity layer.
   - Uses data attributes + CSS pseudo-elements so labels survive DOM re-render.
   - Shows required/support skills and required-skill progress.
   - Does not alter scores, Sheet writes, evidence, or unlock authority.
========================================================= */
(function(){
  'use strict';

  var VERSION='20260802-EAP-REQUIRED-SKILL-LABELS-V123';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var STYLE_ID='eap-required-skill-labels-v123-style';
  var BANNER_ID='eap-required-skill-contract-v123';
  var PASS=60;
  var SKILLS=['Reading','Writing','Listening','Speaking'];
  var REQUIRED={
    1:['Reading','Speaking'],2:['Reading','Writing'],3:['Reading','Writing'],
    4:['Reading','Listening'],5:['Reading','Speaking'],6:['Reading','Writing'],
    7:['Writing','Speaking'],8:['Reading','Writing'],9:['Writing','Speaking'],
    10:['Reading','Writing'],11:['Writing','Speaking'],12:['Reading','Writing'],
    13:['Listening','Writing'],14:['Writing','Speaking'],15:['Writing','Speaking']
  };
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function visible(n){return !!(n&&n.isConnected&&n.getClientRects&&n.getClientRects().length);}
  function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}

  function sessionId(){
    var nodes=[].slice.call(document.querySelectorAll('#app h1,#app h2,#app h3,#app h4,#app [aria-selected="true"],#app .active'));
    for(var i=0;i<nodes.length;i++){
      if(!visible(nodes[i]))continue;
      var t=clean(nodes[i].textContent);
      var m=t.match(/Session\s*:?[\s-]*(1[0-5]|[1-9])\b/i)||t.match(/^S(1[0-5]|[1-9])\b/i);
      if(m)return Number(m[1]);
    }
    return 0;
  }

  function normalizeSession(v){
    var m=clean(v).toUpperCase().match(/S(?:ESSION)?\s*0?(1[0-5]|[1-9])/);
    return m?Number(m[1]):0;
  }
  function normalizeSkill(v){
    var t=clean(v).toLowerCase();
    for(var i=0;i<SKILLS.length;i++)if(t.indexOf(SKILLS[i].toLowerCase())>=0)return SKILLS[i];
    return'';
  }
  function scoreOf(row){
    var vals=[row&&row.bestScore,row&&row.latestScore,row&&row.score,row&&row.autoScore,row&&row.missionTaskScore];
    for(var i=0;i<vals.length;i++){var n=Number(vals[i]);if(Number.isFinite(n))return n;}
    return 0;
  }
  function scores(sid){
    var out={Reading:0,Writing:0,Listening:0,Speaking:0};
    var s=readState();
    var rows=[];
    if(Array.isArray(s.portfolio))rows=rows.concat(s.portfolio);
    if(Array.isArray(s.serverResume&&s.serverResume.records))rows=rows.concat(s.serverResume.records);
    if(Array.isArray(s.serverResume&&s.serverResume.attempts))rows=rows.concat(s.serverResume.attempts);
    rows.forEach(function(row){
      if(normalizeSession(row&&(row.sessionId||row.session||row.routeId||row.sessionCode))!==sid)return;
      var sk=normalizeSkill(row&&(row.skill||row.skillName||row.evidenceType||row.taskId||row.type));
      if(sk)out[sk]=Math.max(out[sk],scoreOf(row));
    });
    return out;
  }

  function findSkillControl(skill){
    var rx=new RegExp('(?:^|\\s)'+skill+'(?:$|\\s)','i');
    var nodes=[].slice.call(document.querySelectorAll('#app button,#app [role="button"],#app a,#app div,#app span'));
    var matches=[];
    for(var i=0;i<nodes.length;i++){
      var n=nodes[i];
      if(!visible(n))continue;
      var text=clean(n.textContent);
      if(!rx.test(text))continue;
      if(text.length>40)continue;
      var control=n.closest('button,[role="button"],a')||n;
      if(!visible(control))continue;
      if(matches.indexOf(control)<0)matches.push(control);
    }
    matches.sort(function(a,b){
      var aa=a.matches('button,[role="button"],a')?0:1;
      var bb=b.matches('button,[role="button"],a')?0:1;
      if(aa!==bb)return aa-bb;
      return clean(a.textContent).length-clean(b.textContent).length;
    });
    return matches[0]||null;
  }

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent='\n'
      +'#'+BANNER_ID+'{margin:10px 0 12px;padding:12px 14px;border:2px solid #f59e0b;border-radius:14px;background:#fff7ed;color:#7c2d12;font:800 13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}\n'
      +'#'+BANNER_ID+' strong{display:block;margin-bottom:4px;font-size:15px;color:#9a3412}\n'
      +'#'+BANNER_ID+' .eap-contract-progress{margin-top:7px;color:#065f46}\n'
      +'.eap-skill-contract-v123{position:relative!important;min-height:62px!important;padding-top:30px!important;overflow:visible!important}\n'
      +'.eap-skill-contract-v123::before{content:attr(data-eap-skill-label);position:absolute;z-index:10;top:4px;left:50%;transform:translateX(-50%);padding:4px 9px;border-radius:999px;white-space:nowrap;font:900 10px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:none}\n'
      +'.eap-skill-required-v123{outline:3px solid #f59e0b!important;outline-offset:2px!important}\n'
      +'.eap-skill-required-v123::before{background:#f59e0b;color:#431407}\n'
      +'.eap-skill-support-v123{opacity:.9!important}\n'
      +'.eap-skill-support-v123::before{background:#dbeafe;color:#1e3a8a}\n'
      +'.eap-skill-pass-v123{outline-color:#16a34a!important}\n'
      +'.eap-skill-pass-v123::before{background:#16a34a!important;color:#fff!important}\n'
      +'@media(max-width:700px){#'+BANNER_ID+'{font-size:12px}.eap-skill-contract-v123::before{font-size:9px;padding:3px 6px}.eap-skill-contract-v123{min-height:58px!important}}';
    document.head.appendChild(style);
  }

  function clearStale(){
    document.querySelectorAll('.eap-skill-contract-v123').forEach(function(n){
      n.classList.remove('eap-skill-contract-v123','eap-skill-required-v123','eap-skill-support-v123','eap-skill-pass-v123');
      n.removeAttribute('data-eap-skill-label');
      n.removeAttribute('data-eap-skill-requirement');
      n.removeAttribute('data-eap-skill-score');
    });
  }

  function commonHost(controls){
    var nodes=SKILLS.map(function(s){return controls[s];}).filter(Boolean);
    if(!nodes.length)return null;
    var host=nodes[0].parentElement;
    while(host&&host.id!=='app'){
      var ok=true;
      for(var i=0;i<nodes.length;i++)if(!host.contains(nodes[i])){ok=false;break;}
      if(ok)return host;
      host=host.parentElement;
    }
    return nodes[0].parentElement;
  }

  function apply(){
    injectStyle();
    var sid=sessionId();
    if(!sid)return;

    var controls={};
    SKILLS.forEach(function(sk){controls[sk]=findSkillControl(sk);});
    if(SKILLS.filter(function(sk){return controls[sk];}).length<4)return;

    clearStale();
    var req=REQUIRED[sid]||[];
    var sc=scores(sid);

    SKILLS.forEach(function(sk){
      var el=controls[sk];
      if(!el)return;
      var required=req.indexOf(sk)>=0;
      var passed=sc[sk]>=PASS;
      el.classList.add('eap-skill-contract-v123',required?'eap-skill-required-v123':'eap-skill-support-v123');
      if(required&&passed)el.classList.add('eap-skill-pass-v123');
      el.setAttribute('data-eap-skill-label',required?(passed?'✓ บังคับ · ผ่านแล้ว':'★ บังคับ · ต้องผ่าน'):'เสริม · ทำเพิ่มได้');
      el.setAttribute('data-eap-skill-requirement',required?'required':'support');
      el.setAttribute('data-eap-skill-score',String(sc[sk]||0));
    });

    var host=commonHost(controls);
    if(!host||!host.parentNode)return;
    var banner=document.getElementById(BANNER_ID);
    if(!banner){
      banner=document.createElement('div');
      banner.id=BANNER_ID;
      host.parentNode.insertBefore(banner,host);
    }
    var passedCount=req.filter(function(sk){return sc[sk]>=PASS;}).length;
    var next=sid<15?'S'+(sid+1):'Boss/Completion';
    var html='<strong>เงื่อนไขบังคับของ S'+sid+'</strong>'+
      'ต้องผ่าน <b>'+req.join(' + ')+'</b> อย่างน้อย '+PASS+' คะแนนต่อ Skill จึงปลดล็อก <b>'+next+'</b> · '+
      'Skill ที่ติดป้าย “เสริม” ทำเพิ่มได้ แต่ใช้แทน Skill บังคับไม่ได้'+
      '<div class="eap-contract-progress">สถานะ Skill บังคับ: <b>'+passedCount+'/'+req.length+' ผ่านแล้ว</b></div>';
    if(banner.innerHTML!==html)banner.innerHTML=html;
    banner.setAttribute('data-session',String(sid));
    banner.setAttribute('data-version',VERSION);
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(apply,180);}
  var observer=new MutationObserver(function(mutations){
    for(var i=0;i<mutations.length;i++){
      var target=mutations[i].target;
      if(target&&target.closest&&target.closest('#'+BANNER_ID))continue;
      schedule();
      break;
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:resume-synced','eap:cloud-resume-applied','eap:profile-changed'].forEach(function(name){window.addEventListener(name,schedule);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();

  window.EAPRequiredSkillLabelsV123={version:VERSION,refresh:apply,required:REQUIRED};
})();
