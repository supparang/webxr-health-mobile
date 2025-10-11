(function(){
  const $=id=>document.getElementById(id);
  const LS = "fitnessDuoMenu_v1";

  // read & fill
  function load(){
    try{
      const s = JSON.parse(localStorage.getItem(LS)||"{}");
      if(s.difficulty) $('difficulty').value = s.difficulty;
      if(s.theme) $('theme').value = s.theme;
      if(s.quest) $('quest').value = s.quest;
      if(s.bpm) $('bpm').value = s.bpm;
      if(s.training) $('training').value = s.training;
      if(s.task) $('task').value = s.task;
      if(s.autostart) $('autostart').checked = !!s.autostart;
    }catch(e){}
  }
  function save(){
    const s = {
      difficulty: $('difficulty').value,
      theme: $('theme').value,
      quest: $('quest').value,
      bpm: $('bpm').value,
      training: $('training').value,
      task: $('task').value,
      autostart: $('autostart').checked ? 1 : 0
    };
    localStorage.setItem(LS, JSON.stringify(s));
    return s;
  }

  function buildAdventureURL(s, newTab=false){
    const base = "adventure/index.html";
    const q = new URLSearchParams({
      diff: s.difficulty,
      theme: s.theme,
      quest: s.quest,
      source: "fitness-duo",
      autostart: s.autostart ? "1" : "0"
    }).toString();
    return newTab ? `${base}?${q}` : `${base}?${q}`;
  }
  function buildRhythmURL(s, newTab=false){
    const base = "rhythm/index.html";
    const q = new URLSearchParams({
      diff: s.difficulty,
      bpm: s.bpm,
      training: s.training,
      task: s.task,
      source: "fitness-duo",
      autostart: s.autostart ? "1" : "0"
    }).toString();
    return newTab ? `${base}?${q}` : `${base}?${q}`;
  }

  function wire(){
    load();
    const s = save(); // sync defaults

    // set hrefs live
    function refreshLinks(){
      const cur = save();
      $('goAdventure').href = buildAdventureURL(cur,false);
      $('goRhythm').href   = buildRhythmURL(cur,false);
      $('openAdventureNew').href = buildAdventureURL(cur,true);
      $('openRhythmNew').href   = buildRhythmURL(cur,true);
    }
    ['difficulty','theme','quest','bpm','training','task','autostart'].forEach(id=>{
      $(id).addEventListener('change', refreshLinks);
      $(id).addEventListener('input', refreshLinks);
    });
    $('save').addEventListener('click', ()=>{ save(); refreshLinks(); alert('บันทึกแล้ว'); });
    $('reset').addEventListener('click', ()=>{
      localStorage.removeItem(LS);
      ['difficulty','theme','quest','bpm','training','task'].forEach(id=>$(id).selectedIndex=0);
      $('autostart').checked=false;
      refreshLinks();
    });

    refreshLinks();
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();
})();
