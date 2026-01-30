// === /fitness/js/mission-badges.js ===
'use strict';

(function(){
  const LS_KEY = 'RB_BADGES_V1';

  function ymd(d=new Date()){
    const pad=(n)=>String(n).padStart(2,'0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  }
  function hash32(str){
    // simple deterministic hash
    let h = 2166136261 >>> 0;
    for (let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a){
    return function(){
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)] || arr[0]; }

  function getBadges(){
    try{
      const s = localStorage.getItem(LS_KEY);
      const j = s ? JSON.parse(s) : [];
      return Array.isArray(j) ? j : [];
    }catch(_){ return []; }
  }
  function addBadge(id){
    const b = getBadges();
    if (!b.includes(id)){
      b.push(id);
      try{ localStorage.setItem(LS_KEY, JSON.stringify(b)); }catch(_){}
    }
    return b;
  }

  // --- Mission templates ---
  const MISSIONS = [
    { id:'acc85', type:'acc', target:85, label:'Accuracy ≥ 85%' },
    { id:'acc90', type:'acc', target:90, label:'Accuracy ≥ 90%' },
    { id:'combo20', type:'combo', target:20, label:'Max Combo ≥ 20' },
    { id:'combo35', type:'combo', target:35, label:'Max Combo ≥ 35' },
    { id:'missle5', type:'miss', target:5, label:'Miss ≤ 5' },
    { id:'fever1', type:'fever', target:1, label:'เข้า FEVER อย่างน้อย 1 ครั้ง' },
    { id:'balance', type:'balance', target:22, label:'ซ้าย/ขวาสมดุล (ต่าง ≤ 22%)' }
  ];

  function makeDailyChallenge(){
    const day = ymd();
    const rng = mulberry32(hash32('RB-DAILY-' + day));

    const track = pick(rng, ['n1','n2','n3']);
    const mission = pick(rng, MISSIONS);

    // reward badge id deterministic
    const badgeId = `daily-${day}`;

    return {
      day,
      id: `daily-${day}`,
      trackId: track,
      mission,
      rewardBadgeId: badgeId,
      title: `Daily Challenge · ${day}`,
      desc: `วันนี้: ${mission.label} (Track: ${track.toUpperCase()})`
    };
  }

  function describeMission(m){
    if(!m) return '';
    return m.label || `${m.type}:${m.target}`;
  }

  window.RB_MISSIONS = { MISSIONS, describeMission, getBadges, addBadge, makeDailyChallenge };
  window.RB_DAILY = makeDailyChallenge();
})();