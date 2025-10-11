
(function(){
  const $=id=>document.getElementById(id);
  const LS = "fitnessDuoMenu_v1";
  function load(){
    try{
      const s = JSON.parse(localStorage.getItem(LS)||"{}");
      ['difficulty','theme','quest','bpm','training','task'].forEach(k=>{ if(s[k]) $(k).value = s[k]; });
      if(s.autostart) $('autostart').checked = !!s.autostart;
    }catch(e){}
  }
  function save(){
    const s = Object.fromEntries(['difficulty','theme','quest','bpm','training','task'].map(k=>[k,$(k).value]));
    s.autostart = $('autostart').checked ? 1 : 0;
    localStorage.setItem(LS, JSON.stringify(s));
    return s;
  }
  function buildAdventureURL(s){
    const q = new URLSearchParams({diff:s.difficulty,theme:s.theme,quest:s.quest,source:"fitness-duo",autostart:s.autostart?'1':'0'}).toString();
    return `adventure/index.html?${q}`;
  }
  function buildRhythmURL(s){
    const q = new URLSearchParams({diff:s.difficulty,bpm:s.bpm,training:s.training,task:s.task,source:"fitness-duo",autostart:s.autostart?'1':'0'}).toString();
    return `rhythm/index.html?${q}`;
  }
  function wire(){
    load(); const s=save();
    function refresh(){ const cur=save();
      $('goAdventure').href=buildAdventureURL(cur);
      $('goRhythm').href=buildRhythmURL(cur);
      $('openAdventureNew').href=buildAdventureURL(cur);
      $('openRhythmNew').href=buildRhythmURL(cur);
    }
    ['difficulty','theme','quest','bpm','training','task','autostart'].forEach(id=>{
      $(id).addEventListener('change', refresh);
      $(id).addEventListener('input', refresh);
    });
    $('save').addEventListener('click', ()=>{ save(); refresh(); alert('บันทึกแล้ว'); });
    $('reset').addEventListener('click', ()=>{ localStorage.removeItem(LS); location.reload(); });
    refresh();
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", wire); else wire();
})();
