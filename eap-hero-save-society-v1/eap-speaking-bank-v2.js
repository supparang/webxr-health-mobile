/* EAP Hero Speaking Bank v2 — short A2 cue support for S1–S15 */
(function(){
  'use strict';
  function text(el){return String(el&&el.textContent||'').replace(/\s+/g,' ').trim();}
  function session(){var m=text(document.getElementById('app')||document.body).match(/\bS(?:ession)?\s*0?(1[0-5]|[1-9])\b/i);return m?Number(m[1]):0;}
  function ctx(){var all=text(document.getElementById('app')||document.body);if(!/Speaking Mission/i.test(all)||/Evidence Saved|Boss Gate|Boss Clash/i.test(all))return null;var sid=session(), lessons=window.EAPA2B1TaskScaffoldV2&&window.EAPA2B1TaskScaffoldV2.lessons;return sid&&lessons&&lessons[sid]?{sid:sid,lesson:lessons[sid]}:null;}
  function say(value){var old=document.getElementById('eap-speaking-bank-toast');if(old)old.remove();var t=document.createElement('div');t.id='eap-speaking-bank-toast';t.textContent=value;t.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:100011;background:#0e7490;color:#fff;padding:10px 14px;border-radius:12px;font:800 13px system-ui,-apple-system,sans-serif;box-shadow:0 12px 30px rgba(0,0,0,.24)';document.body.appendChild(t);setTimeout(function(){if(t.parentNode)t.remove();},2100);}
  function copy(value){if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(value).then(function(){say('Cue copied. Use it in your own short talk.');}).catch(function(){say(value);});}else say(value);}
  function render(){
    var c=ctx(), old=document.getElementById('eap-speaking-bank-v2');if(old)old.remove();if(!c)return;
    var start=[].slice.call(document.querySelectorAll('#app button')).find(function(b){return /start speaking/i.test(text(b));});
    var host=start&&start.closest('.panel,section,div');if(!host)return;
    var box=document.createElement('div');box.id='eap-speaking-bank-v2';box.style.cssText='margin:12px 0;padding:11px;border:1px solid #86d9e8;border-radius:12px;background:#edfcff;color:#10394d';
    box.innerHTML='<b style="display:block;margin-bottom:7px">Easy word bank · เลือก 2 cue แล้วพูดตาม frame</b>'+c.lesson.bank.slice(0,4).map(function(word){return '<button type="button" data-cue="'+word.replace(/"/g,'&quot;')+'" style="margin:3px;padding:6px 9px;border:1px solid #bae2eb;border-radius:999px;background:#fff;color:#24546b;font:800 12px system-ui,-apple-system,sans-serif;cursor:pointer">'+word+'</button>';}).join('')+'<div style="margin-top:8px;font-size:12px">B1+ Stretch (optional): '+c.lesson.stretch+'</div>';
    box.querySelectorAll('[data-cue]').forEach(function(b){b.addEventListener('click',function(){copy(b.dataset.cue||'');});});
    host.insertAdjacentElement('beforebegin',box);
  }
  var timer;function schedule(){clearTimeout(timer);timer=setTimeout(render,120);}
  window.addEventListener('load',schedule);new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
})();
