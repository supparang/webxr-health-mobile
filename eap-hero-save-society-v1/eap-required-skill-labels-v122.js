/* =========================================================
   EAP Hero • Required Skill Labels v122
   UI-only clarity layer.
   - Makes required vs supplementary skills visible on the active Session.
   - Shows per-skill pass state from official/portfolio evidence.
   - Does not alter scores, evidence, Sheet writes or unlock authority.
========================================================= */
(function(){
  'use strict';
  if(window.__EAP_REQUIRED_SKILL_LABELS_V122__) return;
  window.__EAP_REQUIRED_SKILL_LABELS_V122__=true;

  var VERSION='20260802-EAP-REQUIRED-SKILL-LABELS-V122';
  var STATE_KEY='EAP_HERO_PROGRESS_V3';
  var STYLE_ID='eap-required-skill-labels-v122-style';
  var BANNER_ID='eap-required-skill-contract-v122';
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
  function visible(n){return !!(n&&n.isConnected&&n.offsetParent!==null);}
  function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch(_){return{};}}
  function sessionId(){
    var heads=[].slice.call(document.querySelectorAll('#app h1,#app h2,#app h3,#app h4'));
    for(var i=0;i<heads.length;i++){
      if(!visible(heads[i]))continue;
      var m=clean(heads[i].textContent).match(/Session\s*:?[\s-]*(1[0-5]|[1-9])\b/i);
      if(m)return Number(m[1]);
    }
    var active=[].slice.call(document.querySelectorAll('#app [aria-selected="true"],#app .active,#app [aria-current="page"]'));
    for(var j=0;j<active.length;j++){
      if(!visible(active[j]))continue;
      var x=clean(active[j].textContent).match(/^S(1[0-5]|[1-9])\b/i);
      if(x)return Number(x[1]);
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
    var values=[row&&row.bestScore,row&&row.latestScore,row&&row.score,row&&row.autoScore,row&&row.missionTaskScore];
    for(var i=0;i<values.length;i++){var n=Number(values[i]);if(Number.isFinite(n))return n;}
    return 0;
  }
  function scores(sid){
    var out={Reading:0,Writing:0,Listening:0,Speaking:0};
    var s=state();
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
  function skillButtons(){
    var all=[].slice.call(document.querySelectorAll('#app button,#app a[href],#app [role="button"],#app .skill-btn,#app .skill-card'))
      .filter(function(n){return visible(n)&&!n.closest('#'+BANNER_ID);});
    var map={};
    SKILLS.forEach(function(sk){
      var rx=new RegExp('\\b'+sk+'\\b','i');
      var matches=all.filter(function(n){return rx.test(clean(n.textContent));});
      matches.sort(function(a,b){return clean(a.textContent).length-clean(b.textContent).length;});
      map[sk]=matches[0]||null;
    });
    return map;
  }
  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');style.id=STYLE_ID;
    style.textContent='\n'
      +'#'+BANNER_ID+'{margin:10px 0 12px;padding:12px 14px;border:2px solid #f59e0b;border-radius:14px;background:#fff7ed;color:#7c2d12;font:800 13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}\n'
      +'#'+BANNER_ID+' strong{display:block;margin-bottom:4px;font-size:15px;color:#9a3412}\n'
      +'#'+BANNER_ID+' .eap-contract-progress{margin-top:7px;color:#065f46}\n'
      +'.eap-required-skill-v122{position:relative!important;padding-top:28px!important;outline:3px solid #f59e0b!important;outline-offset:2px!important}\n'
      +'.eap-supplementary-skill-v122{position:relative!important;opacity:.88!important}\n'
      +'.eap-skill-badge-v122{position:absolute;z-index:4;top:4px;left:50%;transform:translateX(-50%);padding:3px 9px;border-radius:999px;white-space:nowrap;font:900 10px/1.2 system-ui,-apple-system,"Segoe UI",sans-serif;pointer-events:none}\n'
      +'.eap-required-skill-v122>.eap-skill-badge-v122{background:#f59e0b;color:#431407}\n'
      +'.eap-supplementary-skill-v122>.eap-skill-badge-v122{background:#dbeafe;color:#1e3a8a}\n'
      +'.eap-required-skill-v122.eap-skill-pass-v122{outline-color:#16a34a!important}\n'
      +'.eap-required-skill-v122.eap-skill-pass-v122>.eap-skill-badge-v122{background:#16a34a;color:white}\n'
      +'@media(max-width:700px){#'+BANNER_ID+'{font-size:12px}.eap-skill-badge-v122{font-size:9px;padding:3px 6px}}';
    document.head.appendChild(style);
  }
  function clearOld(){
    document.querySelectorAll('.eap-required-skill-v122,.eap-supplementary-skill-v122').forEach(function(n){
      n.classList.remove('eap-required-skill-v122','eap-supplementary-skill-v122','eap-skill-pass-v122');
      var b=n.querySelector(':scope > .eap-skill-badge-v122');if(b)b.remove();
    });
  }
  function hostFor(buttons){
    var nodes=SKILLS.map(function(s){return buttons[s];}).filter(Boolean);
    if(!nodes.length)return null;
    var host=nodes[0].parentElement;
    while(host&&host.id!=='app'){
      if(nodes.every(function(n){return host.contains(n);}))return host;
      host=host.parentElement;
    }
    return nodes[0].parentElement;
  }
  function apply(){
    injectStyle();
    var sid=sessionId();if(!sid)return;
    var req=REQUIRED[sid]||[];
    var sc=scores(sid);
    var buttons=skillButtons();
    if(!SKILLS.some(function(s){return buttons[s];}))return;
    clearOld();

    SKILLS.forEach(function(sk){
      var btn=buttons[sk];if(!btn)return;
      var required=req.indexOf(sk)>=0;
      var pass=sc[sk]>=PASS;
      btn.classList.add(required?'eap-required-skill-v122':'eap-supplementary-skill-v122');
      if(required&&pass)btn.classList.add('eap-skill-pass-v122');
      var badge=document.createElement('span');badge.className='eap-skill-badge-v122';
      badge.textContent=required?(pass?'✓ บังคับ · ผ่านแล้ว':'★ บังคับ · ต้องผ่าน'):'เสริม · ทำเพิ่มได้';
      btn.insertBefore(badge,btn.firstChild);
      btn.dataset.eapSkillRequirement=required?'required':'supplementary';
      btn.dataset.eapSkillScore=String(sc[sk]||0);
    });

    var host=hostFor(buttons);if(!host)return;
    var banner=document.getElementById(BANNER_ID);
    if(!banner){banner=document.createElement('div');banner.id=BANNER_ID;host.parentNode.insertBefore(banner,host);}
    var passed=req.filter(function(sk){return sc[sk]>=PASS;}).length;
    var next=sid<15?'S'+(sid+1):'Boss/Completion';
    banner.innerHTML='<strong>เงื่อนไขบังคับของ S'+sid+'</strong>'+
      'ต้องผ่าน <b>'+req.join(' + ')+'</b> อย่างน้อย '+PASS+' คะแนนต่อ Skill จึงปลดล็อก <b>'+next+'</b> · '+
      'Writing/Listening ที่ไม่อยู่ในรายการเป็นกิจกรรมเสริม ไม่ใช้แทน Skill บังคับ'+
      '<div class="eap-contract-progress">สถานะ Skill บังคับ: <b>'+passed+'/'+req.length+' ผ่านแล้ว</b></div>';
    banner.dataset.session=String(sid);
    banner.dataset.version=VERSION;
  }
  function schedule(){clearTimeout(timer);timer=setTimeout(apply,120);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  ['load','storage','eap:resume-synced','eap:cloud-resume-applied','eap:profile-changed'].forEach(function(n){window.addEventListener(n,schedule);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  window.EAPRequiredSkillLabelsV122={version:VERSION,refresh:apply,required:REQUIRED};
})();
