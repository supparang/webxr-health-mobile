// === fitness/js/rhythm-engine.js — Rhythm Boxer (Research-ready, 2025-11-28) ===
'use strict';

(function(){

  // ===== CONFIG =====
  const LANES = [0, 1, 2, 3, 4]; // L2, L1, C, R1, R2
  const NOTE_EMOJI_BY_LANE = ['🎵', '🎶', '🎵', '🎶', '🎼'];
  const HIT_WINDOWS = { perfect: 0.06, great: 0.12, good: 0.20 };
  const PRE_SPAWN_SEC = 2.0;

  const TRACKS = [
    { id: 't1', name: 'Warm-up Groove (ง่าย)', audio: 'audio/warmup-groove.mp3', duration: 32, bpm: 100, diff: 'easy', chart: makeWarmupChart(100, 32) },
  ];

  // ===== UTIL =====
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}
  function $(id){return document.getElementById(id);}
  function makeSessionId(){const t=new Date();return `RB-${t.getFullYear()}${String(t.getMonth()+1).padStart(2,'0')}${String(t.getDate()).padStart(2,'0')}-${String(t.getHours()).padStart(2,'0')}${String(t.getMinutes()).padStart(2,'0')}${String(t.getSeconds()).padStart(2,'0')}`;}
  class EventLogger{constructor(){this.rows=[];}clear(){this.rows=[];}add(r){this.rows.push(r);}toCsv(){if(!this.rows.length)return'';const c=Object.keys(this.rows[0]);const e=v=>{if(v==null)return'';const s=String(v);return s.includes('"')||s.includes(',')||s.includes('\n')?'"'+s.replace(/"/g,'""')+'"':s;};const lines=[c.join(',')];for(const r of this.rows)lines.push(c.map(x=>e(r[x])).join(','));return lines.join('\n');}}

  // ===== CHART =====
  function makeWarmupChart(bpm,dur){
    const out=[],beat=60/bpm;let t=2.0;
    const seq=[2,1,3,2,1,3,2,3];
    const total=Math.floor((dur-3)/beat);
    let i=0;while(t<dur-2&&i<total){out.push({time:t,lane:seq[i%seq.length],type:'note'});t+=beat;i++;}
    out.push({time:t+beat*0.5,lane:0,type:'hp'});out.push({time:t+beat*1.5,lane:4,type:'shield'});
    return out;
  }

  // ===== STATE =====
  let lanesEl,elField,hitLineEl,hudScore,hudCombo,hudAcc,hudHp,hudShield,hudTime,feedbackEl,flashEl;
  let score=0,combo=0,hp=100,shield=0,fever=0,feverActive=false,started=false,running=false,startPerf=0,lastPerf=0,currentSongTime=0;
  let activeNotes=[],chartIndex=0,currentTrack=TRACKS[0],eventLogger=new EventLogger();

  // ===== INIT =====
  function init(){
    lanesEl=$('rb-lanes');elField=$('rb-field');hitLineEl=document.querySelector('.rb-hit-line');
    hudScore=$('rb-hud-score');hudCombo=$('rb-hud-combo');hudAcc=$('rb-hud-acc');
    hudHp=$('rb-hud-hp');hudShield=$('rb-hud-shield');hudTime=$('rb-hud-time');
    feedbackEl=$('rb-feedback');flashEl=$('rb-flash');
    const btn=$('rb-btn-start');if(btn)btn.addEventListener('click',startGame);
    if(lanesEl)lanesEl.addEventListener('pointerdown',onLaneTap);
  }

  function startGame(){
    started=false;running=false;
    score=0;combo=0;hp=100;shield=0;fever=0;feverActive=false;
    activeNotes=[];chartIndex=0;eventLogger.clear();
    showFeedback('แตะ lane เพื่อเริ่มเพลง 🎵');
    document.getElementById('rb-view-menu')?.classList.add('hidden');
    document.getElementById('rb-view-play')?.classList.remove('hidden');
  }

  function handleFirstTap(){
    if(started)return;started=true;running=true;startPerf=performance.now();lastPerf=startPerf;currentSongTime=0;
    requestAnimationFrame(loop);
  }

  function loop(now){
    if(!running)return;
    const dt=(now-lastPerf)/1000;const t=(now-startPerf)/1000;lastPerf=now;currentSongTime=t;
    const dur=currentTrack.duration||30;updateTimeline(t,dt);updateHUD();
    if(t>=dur){running=false;showFeedback('เพลงจบแล้ว! ✅');return;}
    requestAnimationFrame(loop);
  }

  function updateTimeline(songTime,dt){
    spawnNotes(songTime);updateNotePositions(songTime);autoJudgeMiss(songTime);
    if(hitLineEl){const phase=(songTime*(currentTrack.bpm||100)/60)%1;hitLineEl.style.opacity=phase<0.15?1:0.6;}
  }

  function spawnNotes(songTime){
    const chart=currentTrack.chart;const pre=PRE_SPAWN_SEC;while(chartIndex<chart.length&&chart[chartIndex].time<=songTime+pre){
      createNote(chart[chartIndex]);chartIndex++;
    }
  }

  function createNote(info){
    const laneIndex=clamp(info.lane|0,0,4);
    const laneEl=lanesEl.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);if(!laneEl)return;
    const noteEl=document.createElement('div');noteEl.className='rb-note';
    const inner=document.createElement('div');inner.className='rb-note-inner';inner.textContent=NOTE_EMOJI_BY_LANE[laneIndex]||'🎵';
    noteEl.appendChild(inner);laneEl.appendChild(noteEl);
    activeNotes.push({lane:laneIndex,time:info.time,el:noteEl,judged:false,removed:false});
  }

  // ✅ ปรับตรงนี้ให้ตกจากด้านบน
  function updateNotePositions(songTime){
    if(!lanesEl)return;
    const rect=lanesEl.getBoundingClientRect();const h=rect.height||1;const pre=PRE_SPAWN_SEC;const travel=h*0.85;
    for(const n of activeNotes){
      if(!n.el||n.removed)continue;
      const dt=n.time-songTime;const progress=1-(dt/pre);const pClamp=clamp(progress,0,1.2);
      const y=(pClamp-1)*travel; // แก้ใหม่
      n.el.style.transform=`translateY(${y}px)`;n.el.style.opacity=(pClamp<=1.0)?1:clamp(1.2-pClamp,0,1);
    }
  }

  function autoJudgeMiss(songTime){
    const missWindow=HIT_WINDOWS.good+0.05;
    for(const n of activeNotes){
      if(n.judged)continue;
      if(songTime>n.time+missWindow){applyMiss(n);}
    }
    activeNotes=activeNotes.filter(n=>!n.removed);
  }

  function onLaneTap(ev){
    if(!running){handleFirstTap();return;}
    const laneEl=ev.target.closest('.rb-lane');if(!laneEl)return;
    const lane=parseInt(laneEl.dataset.lane||'0',10);
    const near=activeNotes.find(n=>!n.judged&&n.lane===lane);
    if(near){applyHit(near);}
  }

  function applyHit(n){
    n.judged=true;n.removed=true;if(n.el)n.el.remove();
    score+=100;combo++;updateHUD();showFeedback('Perfect! 🎯');
  }

  function applyMiss(n){
    n.judged=true;n.removed=true;if(n.el)n.el.remove();
    combo=0;hp=clamp(hp-5,0,100);showFeedback('พลาดจังหวะ! 🎧');
  }

  function updateHUD(){
    if(hudScore)hudScore.textContent=score;
    if(hudCombo)hudCombo.textContent=combo;
    if(hudHp)hudHp.textContent=hp;
    if(hudTime)hudTime.textContent=currentSongTime.toFixed(1);
  }

  function showFeedback(msg){
    if(!feedbackEl)return;feedbackEl.textContent=msg;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

})();
