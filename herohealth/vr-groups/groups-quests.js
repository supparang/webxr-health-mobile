/* === /herohealth/vr-groups/groups-quests.js ===
Quest Director for Food Groups VR
- goals: clear group 1..5 sequential (collect correct hits)
- minis: chain challenges (perfect switch / no junk / storm survive / boss down)
Events consumed:
- groups:progress  { kind, ... }
Emits:
- quest:update, hha:celebrate, hha:coach (optional)
*/

(function(root){
  'use strict';

  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };

  // deterministic RNG (same as engine style)
  function xmur3(str){
    str = String(str||'seed');
    let h = 1779033703 ^ str.length;
    for (let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= (h >>> 16);
      return h >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function makeRng(seed){
    const gen = xmur3(seed);
    return sfc32(gen(), gen(), gen(), gen());
  }
  function clamp(v,a,b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
  function now(){ return (performance && performance.now) ? performance.now() : Date.now(); }

  const TH_GROUP_LINES = {
    1:'หมู่ 1 กินเนื้อ นม ไข่ ถั่วเมล็ดช่วยให้เติบโตแข็งขัน',
    2:'หมู่ 2 ข้าว แป้ง เผือก มัน และน้ำตาล จะให้พลัง',
    3:'หมู่ 3 กินผักต่างๆ สารอาหารมากมายกินเป็นอาจิณ',
    4:'หมู่ 4 กินผลไม้ สีเขียวเหลืองบ้างมีวิตามิน',
    5:'หมู่ 5 อย่าได้ลืมกิน ไขมันทั้งสิ้น อบอุ่นร่างกาย'
  };

  function goalNeed(diff){
    diff = String(diff||'normal').toLowerCase();
    if (diff==='easy') return 6;
    if (diff==='hard') return 10;
    return 8;
  }

  function makeMiniPool(style){
    style = String(style||'mix').toLowerCase();
    const base = [
      { id:'perfect_switch', title:'Perfect Switch: เปลี่ยนหมู่แบบไม่พลาด', total:1, time:12 },
      { id:'nojunk', title:'No Junk: ห้ามโดนขยะ 8 วิ', total:1, time:8 },
      { id:'storm', title:'Storm: รอดให้ครบช่วงพายุ', total:1, time:7 },
      { id:'boss', title:'Boss: โค่นบอสให้ได้', total:1, time:18 }
    ];
    if (style==='hard'){
      base.unshift({ id:'nojunk12', title:'No Junk+ : ห้ามโดนขยะ 12 วิ', total:1, time:12 });
    }
    if (style==='feel'){
      base.push({ id:'streak5', title:'Combo: ติดกัน 5 ครั้ง', total:5, time:10 });
    }
    return base;
  }

  function createGroupsQuest(opts){
    opts = opts || {};
    const runMode = String(opts.runMode||'play').toLowerCase()==='research' ? 'research' : 'play';
    const diff = String(opts.diff||'normal').toLowerCase();
    const style = String(opts.style||'mix').toLowerCase();
    const seed = String(opts.seed||Date.now());

    const rng = (runMode==='research') ? makeRng('Q:'+seed) : Math.random;

    const st = {
      running:false,

      group:1,
      goalNow:0,
      goalTotal: goalNeed(diff),

      goalsCleared:0,
      goalsTotal:5,

      miniActive:null,
      miniNow:0,
      miniTotal:0,
      miniEndsAt:0,
      miniCleared:0,
      miniTotalAll:999,

      lastKind:'',
      lastHitAt:0,
      lastBadAt:0,
      perfectSwitchArmed:false,

      stormOn:false,
      stormStartedAt:0,
      bossSeen:false,
      bossDown:false,

      pool: makeMiniPool(style),
    };

    function pushUpdate(){
      const mLeft = st.miniActive ? Math.max(0, Math.ceil((st.miniEndsAt - now())/1000)) : 0;
      emit('quest:update', {
        goalTitle: `เก็บให้ถูก ${TH_GROUP_LINES[st.group] || ('หมู่ '+st.group)}`,
        goalNow: st.goalNow,
        goalTotal: st.goalTotal,
        miniTitle: st.miniActive ? st.miniActive.title : '—',
        miniNow: st.miniNow,
        miniTotal: st.miniTotal,
        miniTimeLeftSec: mLeft,
        goalsCleared: st.goalsCleared,
        goalsTotal: st.goalsTotal,
        miniCleared: st.miniCleared,
        miniTotal: st.miniTotalAll,
      });
    }

    function celebrate(kind, title){
      emit('hha:celebrate', { kind: kind||'mini', title: title||'GOOD!' });
    }

    function coach(text, mood){
      emit('hha:coach', { text: text||'', mood: mood||'neutral' });
    }

    function nextGoal(){
      st.goalsCleared++;
      celebrate('goal', `เคลียร์หมู่ ${st.group}!`);
      coach(`เยี่ยมมาก! ✅ หมู่ ${st.group} ผ่านแล้ว`, 'happy');

      st.group = clamp(st.group + 1, 1, 5);
      st.goalNow = 0;

      if (st.group <= 5){
        pushUpdate();
      } else {
        // all goals
        celebrate('all', 'ครบ 5 หมู่แล้ว!');
        coach('สุดยอด! ครบ 5 หมู่ของไทยแล้ว 🏆', 'happy');
      }
    }

    function pickMini(){
      const pool = st.pool.slice();
      const idx = (rng() * pool.length) | 0;
      return pool[idx] || pool[0];
    }

    function startMini(){
      st.miniActive = pickMini();
      st.miniNow = 0;
      st.miniTotal = Math.max(1, Number(st.miniActive.total||1));
      st.miniEndsAt = now() + Math.max(3, Number(st.miniActive.time||8))*1000;
      pushUpdate();

      coach('มินิเควสท์มาแล้ว! 🎯 ' + st.miniActive.title, 'neutral');
    }

    function passMini(){
      st.miniCleared++;
      celebrate('mini', 'Mini Clear!');
      coach('ผ่านมินิเควสท์! 🔥', 'happy');
      st.miniActive = null;
      st.miniNow = 0;
      st.miniTotal = 0;
      st.miniEndsAt = 0;
      pushUpdate();

      // chain: start next after short delay
      setTimeout(()=>{ if (st.running) startMini(); }, 700);
    }

    function failMini(reason){
      coach('พลาดมินิเควสท์ 😵 ' + (reason||''), 'sad');
      st.miniActive = null;
      st.miniNow = 0;
      st.miniTotal = 0;
      st.miniEndsAt = 0;
      pushUpdate();
      setTimeout(()=>{ if (st.running) startMini(); }, 900);
    }

    function tickMini(){
      if (!st.running) return;
      if (!st.miniActive) return;

      const t = now();
      if (t >= st.miniEndsAt){
        // time up => pass only if requirement done
        if (st.miniNow >= st.miniTotal) passMini();
        else failMini('หมดเวลา');
      } else {
        pushUpdate();
      }
    }

    function onProgress(ev){
      if (!st.running) return;
      const d = (ev && ev.detail) ? ev.detail : {};
      const kind = String(d.kind||'');
      st.lastKind = kind;

      // goal counting
      if (kind === 'hit_good'){
        st.goalNow = clamp(st.goalNow + 1, 0, st.goalTotal);
        if (st.goalNow >= st.goalTotal){
          nextGoal();
        } else {
          pushUpdate();
        }
      }

      if (kind === 'hit_bad'){
        st.lastBadAt = now();
        st.perfectSwitchArmed = false;
        // fail some minis instantly
        if (st.miniActive && (st.miniActive.id==='nojunk' || st.miniActive.id==='nojunk12')){
          failMini('โดนขยะ/ผิด');
        }
      }

      if (kind === 'group_swap'){
        // “Perfect switch” armed only if no bad recently
        const ok = (now() - st.lastBadAt) > 4500;
        st.perfectSwitchArmed = ok;
        if (ok) celebrate('mini', 'Perfect Switch Ready!');
      }

      if (kind === 'perfect_switch'){
        if (st.miniActive && st.miniActive.id==='perfect_switch'){
          st.miniNow = 1;
          passMini();
        }
      }

      if (kind === 'storm_on'){
        st.stormOn = true;
        st.stormStartedAt = now();
      }
      if (kind === 'storm_off'){
        st.stormOn = false;
        if (st.miniActive && st.miniActive.id==='storm'){
          // survive means storm ended or lasted long enough
          st.miniNow = 1;
          passMini();
        }
      }

      if (kind === 'boss_spawn'){
        st.bossSeen = true;
      }
      if (kind === 'boss_down'){
        st.bossDown = true;
        if (st.miniActive && st.miniActive.id==='boss'){
          st.miniNow = 1;
          passMini();
        }
      }

      if (kind === 'combo'){
        if (st.miniActive && st.miniActive.id==='streak5'){
          const c = Number(d.combo||0);
          st.miniNow = clamp(c, 0, st.miniTotal);
          if (st.miniNow >= st.miniTotal) passMini();
          else pushUpdate();
        }
      }

      // nojunk time-based minis handled by tick: if any bad => fail (handled above)
    }

    function start(){
      if (st.running) return;
      st.running = true;
      st.group = 1;
      st.goalNow = 0;
      st.goalTotal = goalNeed(diff);
      st.goalsCleared = 0;

      st.lastBadAt = 0;
      st.perfectSwitchArmed = false;
      st.stormOn = false;
      st.bossSeen = false;
      st.bossDown = false;

      pushUpdate();
      startMini();

      st._tick = setInterval(tickMini, 220);
    }

    function stop(){
      st.running = false;
      try{ clearInterval(st._tick); }catch{}
    }

    function getState(){
      return {
        goalsCleared: st.goalsCleared|0,
        goalsTotal: st.goalsTotal|0,
        miniCleared: st.miniCleared|0,
        miniTotal: st.miniTotalAll|0
      };
    }

    return { start, stop, onProgress, getState, pushUpdate };
  }

  root.GroupsVR = root.GroupsVR || {};
  root.GroupsVR.createGroupsQuest = createGroupsQuest;

})(typeof window !== 'undefined' ? window : globalThis);