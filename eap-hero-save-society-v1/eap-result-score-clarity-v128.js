/* =========================================================
   EAP Hero • Result Score Clarity v128
   UI-only clarification for Skill result pages.
   - Distinguishes the official mission score from AI formative feedback.
   - Shows whether the completed Skill passed the 60-point gate.
   - Does not alter scoring, Sheet writes, evidence, or unlock authority.
========================================================= */
(function(){
  'use strict';

  var VERSION='20260802-EAP-RESULT-SCORE-CLARITY-V128';
  var STYLE_ID='eap-result-score-clarity-v128-style';
  var NOTE_ID='eap-result-score-clarity-v128-note';
  var timer=0;

  function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function visible(n){return !!(n&&n.isConnected&&n.getClientRects&&n.getClientRects().length);}

  function injectStyle(){
    if(document.getElementById(STYLE_ID))return;
    var style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent='\n'
      +'#'+NOTE_ID+'{margin:12px 0;padding:12px 14px;border:2px solid #0f766e;border-radius:14px;background:#ecfeff;color:#134e4a;font:800 13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}\n'
      +'#'+NOTE_ID+' strong{display:block;margin-bottom:4px;font-size:15px;color:#115e59}\n'
      +'#'+NOTE_ID+'.fail{border-color:#d97706;background:#fff7ed;color:#7c2d12}\n'
      +'#'+NOTE_ID+'.fail strong{color:#9a3412}\n'
      +'.eap128-official-label{font-weight:900!important;color:#065f46!important}\n'
      +'.eap128-formative-label{font-weight:900!important;color:#4338ca!important}\n'
      +'@media(max-width:700px){#'+NOTE_ID+'{font-size:12px;padding:10px 12px}}';
    document.head.appendChild(style);
  }

  function resultContext(){
    var app=document.getElementById('app');
    if(!app)return null;
    var text=clean(app.innerText||'');
    var skillMatch=text.match(/(Reading|Writing|Listening|Speaking)\s+Evidence\s+Saved/i);
    if(!skillMatch)return null;
    var scoreMatch=text.match(/(\d{1,3})\s*\/\s*100\s*Auto Score/i)||text.match(/Auto Score\s*(\d{1,3})/i);
    var score=scoreMatch?Math.max(0,Math.min(100,Number(scoreMatch[1]))):0;
    return {app:app,skill:skillMatch[1],score:score,passed:score>=60};
  }

  function smallestNodeContaining(root,phrase,maxLength){
    var nodes=[].slice.call(root.querySelectorAll('div,span,p,small,strong,b,h1,h2,h3,h4,h5,h6'));
    var found=[];
    nodes.forEach(function(n){
      if(!visible(n))return;
      var t=clean(n.textContent);
      if(t.indexOf(phrase)<0||t.length>maxLength)return;
      found.push(n);
    });
    found.sort(function(a,b){return clean(a.textContent).length-clean(b.textContent).length;});
    return found[0]||null;
  }

  function relabel(ctx){
    var auto=smallestNodeContaining(ctx.app,'Auto Score',80);
    if(auto){
      var exact=[].slice.call(auto.querySelectorAll('*')).find(function(n){return clean(n.textContent)==='Auto Score';});
      var target=exact||auto;
      if(clean(target.textContent)==='Auto Score')target.textContent='คะแนนภารกิจ — ใช้ตัดสินผ่าน Skill';
      target.classList.add('eap128-official-label');
    }

    var rubric=smallestNodeContaining(ctx.app,'AI Formative Rubric',160);
    if(rubric){
      var heading=[rubric].concat([].slice.call(rubric.querySelectorAll('*'))).find(function(n){return clean(n.textContent)==='🤖 AI Formative Rubric'||clean(n.textContent)==='AI Formative Rubric';});
      if(heading){
        heading.textContent='🤖 AI Formative Feedback — ใช้เพื่อพัฒนา ไม่ใช้ปลดล็อก';
        heading.classList.add('eap128-formative-label');
      }
    }
  }

  function addNote(ctx){
    var note=document.getElementById(NOTE_ID);
    if(!note){
      note=document.createElement('div');
      note.id=NOTE_ID;
      var anchor=smallestNodeContaining(ctx.app,'Auto Score',220);
      var host=anchor;
      while(host&&host.parentElement&&host.parentElement!==ctx.app){
        var t=clean(host.parentElement.textContent);
        if(t.length>500)break;
        host=host.parentElement;
      }
      if(host&&host.parentNode)host.parentNode.insertBefore(note,host.nextSibling);
      else ctx.app.insertBefore(note,ctx.app.firstChild);
    }
    note.className=ctx.passed?'':'fail';
    note.innerHTML='<strong>'+ctx.skill+' '+(ctx.passed?'ผ่านแล้ว':'ยังไม่ผ่าน')+' — คะแนนภารกิจ '+ctx.score+'/100</strong>'+
      'คะแนนภารกิจเป็นคะแนนทางการที่ใช้ตัดสินผ่าน Skill และปลดล็อกเส้นทาง ส่วน AI Formative Feedback เป็นข้อมูลวิเคราะห์เพื่อช่วยพัฒนาคำตอบ จึงอาจมีค่าต่างจากคะแนนภารกิจและไม่ใช้แทนคะแนนทางการ';
    note.dataset.skill=ctx.skill;
    note.dataset.score=String(ctx.score);
    note.dataset.version=VERSION;
  }

  function apply(){
    injectStyle();
    var ctx=resultContext();
    if(!ctx)return;
    relabel(ctx);
    addNote(ctx);
    document.documentElement.dataset.eapResultScoreClarityVersion=VERSION;
  }

  function schedule(){clearTimeout(timer);timer=setTimeout(apply,120);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  window.addEventListener('load',function(){apply();setTimeout(apply,500);setTimeout(apply,1500);});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();

  window.EAPResultScoreClarityV128={version:VERSION,refresh:apply};
})();
