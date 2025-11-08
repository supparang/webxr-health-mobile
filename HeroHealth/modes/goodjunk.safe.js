// === modes/goodjunk.safe.js (Release) =======================================
// - A-Frame targets (emoji texture from canvas) + 3D shard FX per hit
// - Fever gauge events: hha:fever {state:'change'|'start'|'end', level, count}
// - Mini-Quest: random 3/10 ต่อเกม + โค้ชกระตุ้นผ่าน hha:quest
// - Score/Time/End events: hha:score, hha:time, hha:end
// - นโยบายการนับ:
//   * ตีโดนของดี: +คะแนน, +คอมโบ, เติม fever
//   * ตีโดนขยะ: -คะแนนเล็กน้อย, คอมโบไม่เพิ่ม (รีเซ็ตคอมโบบางส่วน)
//   * ของดีหมดอายุ (ไม่โดน): บทลงโทษ (คอมโบ=0, -คะแนน, พลาด++)
//   * ของขยะหมดอายุ: ไม่หักอะไร (นับ “เลี่ยงขยะ” ให้เควสต์)
//
// ปลอดภัย: ไม่มี optional chaining, ไม่มีตัวแปร global ชนชื่อไฟล์อื่น

export async function boot(config){
  // ---------- Config ----------
  var host   = (config && config.host) || document.getElementById('spawnHost');
  if(!host){ host = document.createElement('a-entity'); host.id='spawnHost'; document.querySelector('a-scene').appendChild(host); }
  var DIFF   = (config && config.difficulty) || 'normal';
  var DURA   = Math.max(10, parseInt((config && config.duration) || 60, 10));

  // ความถี่ spawn (ถี่ขึ้นตามคำขอ) + อายุเป้า
  var DIFFCFG = {
    easy:   { size: 0.42, rateMin: 600,  rateMax: 900,  life: 2200, junkRatio: 0.28, specialRatio: 0.08 },
    normal: { size: 0.38, rateMin: 500,  rateMax: 750,  life: 1800, junkRatio: 0.36, specialRatio: 0.10 },
    hard:   { size: 0.34, rateMin: 420,  rateMax: 650,  life: 1500, junkRatio: 0.42, specialRatio: 0.12 }
  };
  var CFG = DIFFCFG[DIFF] || DIFFCFG.normal;

  // ---------- Pools ----------
  var GOOD  = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
  var JUNK  = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
  var STAR  = ['⭐']; // fever boost + score
  var DIAM  = ['💎']; // big score
  var SHLD  = ['🛡️']; // shield (กันบทลงโทษครั้งถัดไป)

  // ---------- State ----------
  var running=true, paused=false;
  var score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
  var avoidedJunk=0; // ของขยะหมดอายุ (ผู้เล่น “เลี่ยงขยะ”)
  var activeShield=0; // สะสมโล่
  var feverLevel=0, feverActive=false, feverCount=0;
  var feverEndTimer=null, secondTimer=null, spawnTimer=null;
  var startedAt=Date.now();
  var recentEmoji=new Set(); // กันซ้ำเล็กน้อย
  var rngSeed=(Math.random()*1e9)|0;

  // ---------- Utils ----------
  function rand(){ // LCG เบา ๆ
    rngSeed=(rngSeed*1664525+1013904223)>>>0;
    return (rngSeed/0xffffffff);
  }
  function pick(arr){
    if(!arr||!arr.length) return '⭐';
    if(recentEmoji && recentEmoji.size<arr.length){
      var cands = arr.filter(function(c){ return !recentEmoji.has(c); });
      var v = cands[(rand()*cands.length)|0];
      recentEmoji.add(v); if(recentEmoji.size>6) recentEmoji.clear();
      return v;
    }
    return arr[(rand()*arr.length)|0];
  }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail})); }catch(e){} }
  function withProb(p){ return rand()<p; }
  function now(){ return Date.now(); }

  // ---------- Fever System ----------
  var FEVER_FILL_PER_GOOD = 10;     // ของดี 10 ชิ้นติด ๆ จะเข้า fever โดยประมาณ
  var FEVER_DECAY_IDLE    = 5/second();    // ต่อ ms
  var FEVER_DECAY_ACTIVE  = 12/second();
  var FEVER_THRESHOLD     = 100;
  var FEVER_MS            = 10000;

  function second(){ return 1000; }

  function feverChange(){
    emit('hha:fever', {state:'change', level:feverLevel, active:feverActive, count:feverCount});
  }
  function feverStart(){
    if(feverActive) return;
    feverActive=true; feverCount++; feverLevel=100;
    try{ clearTimeout(feverEndTimer); }catch(e){}
    feverEndTimer=setTimeout(function(){ feverEnd(); }, FEVER_MS);
    emit('hha:fever', {state:'start', level:feverLevel, active:true, count:feverCount});
  }
  function feverEnd(){
    if(!feverActive) return;
    feverActive=false; feverLevel=0;
    try{ clearTimeout(feverEndTimer); }catch(e){}
    feverEndTimer=null;
    emit('hha:fever', {state:'end', level:feverLevel, active:false, count:feverCount});
  }
  function addFever(v){
    feverLevel = clamp(feverLevel + v, 0, FEVER_THRESHOLD);
    if(!feverActive && feverLevel>=FEVER_THRESHOLD) feverStart(); else feverChange();
  }
  function tickFever(dt){
    if(feverActive){
      feverLevel = clamp(feverLevel - FEVER_DECAY_ACTIVE*dt, 0, FEVER_THRESHOLD);
    }else{
      feverLevel = clamp(feverLevel - FEVER_DECAY_IDLE*dt, 0, FEVER_THRESHOLD);
    }
    feverChange();
  }

  // ---------- Mini-Quests ----------
  var questsPool = [
    { id:'good10',    label:'เก็บของดี 10 ชิ้น',       done:false, prog:0, target:10,  kind:'good'   },
    { id:'avoid5',    label:'เลี่ยงขยะ 5 ครั้ง',        done:false, prog:0, target:5,   kind:'avoid'  },
    { id:'combo10',   label:'ทำคอมโบ 10',              done:false, prog:0, target:10,  kind:'combo'  },
    { id:'good20',    label:'เก็บของดี 20 ชิ้น',       done:false, prog:0, target:20,  kind:'good'   },
    { id:'nomiss10',  label:'ไม่พลาด 10 วิ',            done:false, prog:0, target:10,  kind:'nomiss' },
    { id:'fever2',    label:'เข้า Fever 2 ครั้ง',       done:false, prog:0, target:2,   kind:'fever'  },
    { id:'combo20',   label:'คอมโบ 20 ต่อเนื่อง',      done:false, prog:0, target:20,  kind:'combo'  },
    { id:'score500',  label:'ทำคะแนน 500+',             done:false, prog:0, target:500, kind:'score'  },
    { id:'star3',     label:'เก็บดาว ⭐ 3 ดวง',          done:false, prog:0, target:3,   kind:'star'   },
    { id:'diamond1',  label:'เก็บเพชร 💎 1 เม็ด',        done:false, prog:0, target:1,   kind:'diamond'}
  ];
  var quests = draw3(questsPool);
  var nomissSec = 0; // นับวินาทีที่ “ไม่พลาด” ต่อเนื่อง
  function draw3(pool){
    var p = pool.slice(0);
    // สุ่ม easy, normal, hard แบบคร่าว ๆ: ใช้ 3 ตัวจาก pool
    var out = [];
    for(var i=0;i<3;i++){
      var k=(rand()*p.length)|0; out.push(p[k]); p.splice(k,1);
    }
    return out;
  }
  function questText(){
    return 'Mini Quest: '+quests.map(function(q){
      var s = q.done?'✓':'✗';
      if(q.kind==='score') return s+' '+q.label+' ('+Math.min(q.prog,q.target)+'/'+q.target+')';
      return s+' '+q.label+' ('+Math.min(q.prog,q.target)+'/'+q.target+')';
    }).join(' | ');
  }
  function questEmit(){ emit('hha:quest', {text:questText()}); }

  // โค้ช (ข้อความสั้น ๆ กระตุ้น)
  function coachSay(kind){
    var msg='สู้ ๆ!';
    if(kind==='fever') msg='FEVER มาแล้ว! x2 คะแนน 🔥';
    else if(kind==='good') msg='เยี่ยม! ของดีอีก!';
    else if(kind==='avoid') msg='เลี่ยงขยะสุดยอด!';
    else if(kind==='combo') msg='คอมโบต่อให้สุด! ✨';
    else if(kind==='miss') msg='พลาดนิดเดียว ลองใหม่!';
    emit('hha:quest', {text:questText()+'  —  โค้ช: '+msg});
  }

  // ---------- Emoji → canvas texture ----------
  var __texCache = {};
  function toEmojiTex(char, px){ // px = font px
    var size = px||128;
    var key = char+'@'+size;
    if(__texCache[key]) return __texCache[key];
    var c = document.createElement('canvas'); c.width=c.height=size;
    var ctx = c.getContext('2d');
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font=(size*0.82)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
    // glow
    ctx.shadowColor='rgba(255,255,255,0.5)'; ctx.shadowBlur=size*0.2;
    ctx.fillText(char, size/2, size/2);
    // shadow
    ctx.shadowColor='rgba(0,0,0,0.35)'; ctx.shadowBlur=size*0.12; ctx.shadowOffsetX=size*0.04; ctx.shadowOffsetY=size*0.06;
    ctx.fillText(char, size/2, size/2);
    __texCache[key]=c.toDataURL('image/png');
    return __texCache[key];
  }

  // ---------- FX: Score popup + 3D shards ----------
  function popupScore(txt, pos){
    var t = document.createElement('a-entity');
    t.setAttribute('troika-text', 'value: '+txt+'; color: #ffffff; fontSize: 0.10;');
    t.setAttribute('position', pos.x+' '+(pos.y+0.12)+' '+pos.z);
    t.setAttribute('animation__rise','property: position; to: '+pos.x+' '+(pos.y+0.45)+' '+pos.z+'; dur: 560; easing: easeOutCubic');
    t.setAttribute('animation__fade','property: opacity; to: 0; dur: 560; easing: linear');
    host.appendChild(t);
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 600);
  }
  function spawnShards(style, pos){
    // style: 'good'|'junk'|'star'|'diamond'
    var N = 10;
    var color = '#9ae6b4'; // good = เขียวอ่อน
    if(style==='junk') color='#fca5a5';
    if(style==='star') color='#fde68a';
    if(style==='diamond') color='#93c5fd';

    for(var i=0;i<N;i++){
      var p = document.createElement('a-sphere');
      p.setAttribute('radius', 0.015 + rand()*0.015);
      p.setAttribute('color', color);
      var dx = (rand()*2-1)*0.20;
      var dy = rand()*0.30 + 0.05;
      var dz = (rand()*2-1)*0.20;
      p.setAttribute('position', pos.x+' '+pos.y+' '+pos.z);
      p.setAttribute('animation__move', 'property: position; to: '+(pos.x+dx)+' '+(pos.y+dy)+' '+(pos.z+dz)+'; dur: 420; easing: easeOutQuad');
      p.setAttribute('animation__fade', 'property: scale; to: 0 0 0; dur: 420; easing: linear');
      host.appendChild(p);
      (function(node){
        setTimeout(function(){ if(node.parentNode) node.parentNode.removeChild(node); }, 440);
      })(p);
    }
  }

  // ---------- Target factory ----------
  function makeTarget(char, kind){
    // kind: 'good'|'junk'|'star'|'diamond'|'shield'
    var root = document.createElement('a-entity');

    var img = document.createElement('a-image');
    var tex = toEmojiTex(char, 192);
    img.setAttribute('src', tex);
    img.setAttribute('width', CFG.size);
    img.setAttribute('height', CFG.size);
    img.classList.add('clickable');

    // ตำแหน่ง: กึ่งกลางจอแนวตั้งมากขึ้น (y ~ 1.0 ± 0.25)
    var px = (rand()*1.6 - 0.8);
    var py = 1.0 + (rand()*0.5 - 0.25);
    var pz = -1.6;

    root.setAttribute('position', px+' '+py+' '+pz);
    root.appendChild(img);

    // glow plate (บาง)
    var plate = document.createElement('a-plane');
    plate.setAttribute('width', CFG.size*1.05);
    plate.setAttribute('height', CFG.size*1.05);
    var color = (kind==='good'||kind==='star'||kind==='diamond'||kind==='shield') ? '#22c55e' : '#ef4444';
    if(kind==='star') color='#f59e0b';
    if(kind==='diamond') color='#60a5fa';
    if(kind==='shield') color='#a78bfa';
    plate.setAttribute('material','color:'+color+'; opacity:0.22; transparent:true');
    plate.setAttribute('position','0 0 -0.01');
    root.appendChild(plate);

    // click handler
    var clicked=false;
    function centerPos(){
      var p = root.getAttribute('position');
      return {x: p.x, y: p.y, z: p.z};
    }
    function destroy(){ try{ host.removeChild(root); }catch(e){} }

    img.addEventListener('click', function(){
      if(!running || clicked) return;
      clicked=true;
      var pos=centerPos();

      if(kind==='good'){
        var base = 20 + combo*2;
        if(feverActive) base*=2;
        score += base;
        combo += 1; if(combo>maxCombo) maxCombo=combo;
        addFever(FEVER_FILL_PER_GOOD);
        hits++;
        spawnShards('good', pos);
        popupScore('+'+base, pos);
        // เควสต์
        incQuest('good',1);
        incQuest('combo', combo); // จะถูก cap ในตัวเควสต์เองโดย prog = max
        updateScoreCombo();
        coachSay('good');
      } else if(kind==='junk'){
        // โดนขยะ → โทษเบา + คอมโบรีเซ็ต
        var penalty = 15;
        if(activeShield>0){ penalty=0; activeShield--; popupScore('🛡️ Block!', pos); }
        score = Math.max(0, score - penalty);
        combo = 0;
        spawnShards('junk', pos);
        popupScore(penalty?('-'+penalty):'0', pos);
        updateScoreCombo();
        coachSay('miss');
      } else if(kind==='star'){
        var plus = 60;
        if(feverActive) plus*=2;
        score += plus; hits++;
        addFever(40); // boost fever
        spawnShards('star', pos); popupScore('+⭐'+plus, pos);
        incQuest('star',1); updateScoreCombo(); coachSay('good');
      } else if(kind==='diamond'){
        var big = 120;
        if(feverActive) big*=2;
        score += big; hits++;
        spawnShards('diamond', pos); popupScore('+💎'+big, pos);
        incQuest('diamond',1); updateScoreCombo(); coachSay('good');
      } else if(kind==='shield'){
        activeShield = Math.min(3, activeShield+1);
        popupScore('🛡️ +1', pos);
        updateScoreCombo(); coachSay('good');
      }

      emit('hha:score', {score:score, combo:combo});
      destroy();
    }, {passive:true});

    // TTL
    var lifeMs = CFG.life;
    var ttl = setTimeout(function(){
      if(!running || clicked) return;
      // time up
      if(kind==='good'){
        // บทลงโทษสำหรับ “ตีไม่โดนของดี”
        if(activeShield>0){ activeShield--; } else {
          score = Math.max(0, score - 10);
          combo = 0; misses++;
          emit('hha:miss', {count:misses});
          updateScoreCombo();
        }
      }else if(kind==='junk'){
        // “เลี่ยงขยะ” ได้ 1
        avoidedJunk++;
        incQuest('avoid',1);
        coachSay('avoid');
      }
      try{ clearTimeout(ttl); }catch(e){}
      destroy();
    }, lifeMs);

    host.appendChild(root);
  }

  function incQuest(kind, val){
    for(var i=0;i<quests.length;i++){
      var q=quests[i];
      if(q.kind===kind){
        q.prog = Math.min(q.target, Math.max(q.prog, (kind==='combo') ? val : (q.prog+val)));
        q.done = q.prog>=q.target;
      }
    }
    questEmit();
  }
  function updateScoreCombo(){
    // combo quest อัปเดตค่าสูงสุด (ใช้ maxCombo)
    for(var i=0;i<quests.length;i++){
      var q=quests[i];
      if(q.kind==='combo'){
        q.prog = Math.min(q.target, Math.max(q.prog, combo));
        q.done = q.prog>=q.target;
      }else if(q.kind==='score'){
        q.prog = Math.min(q.target, Math.max(q.prog, score));
        q.done = q.prog>=q.target;
      }
    }
    questEmit();
  }

  // ---------- Spawn loop ----------
  function scheduleNext(){
    if(!running) return;
    var wait = Math.floor(CFG.rateMin + rand()*(CFG.rateMax - CFG.rateMin));
    spawnTimer = setTimeout(function(){
      if(!running) return;
      spawnOne();
      // โอกาสเกิดพร้อมกันอีก 1 ชิ้น (เพิ่มความหนาแน่น)
      if(withProb(0.40)) spawnOne();
      scheduleNext();
    }, wait);
  }

  function spawnOne(){
    if(!running) return;
    spawns++;

    // เลือก kind
    var kind='good';
    var r = rand();
    if(r < CFG.specialRatio*0.40){ kind='star'; }
    else if(r < CFG.specialRatio*0.65){ kind='diamond'; }
    else if(r < CFG.specialRatio){ kind='shield'; }
    else if(r < (CFG.specialRatio + CFG.junkRatio)){ kind='junk'; }

    var ch='⭐';
    if(kind==='good') ch=pick(GOOD);
    else if(kind==='junk') ch=pick(JUNK);
    else if(kind==='star') ch=pick(STAR);
    else if(kind==='diamond') ch=pick(DIAM);
    else if(kind==='shield') ch=pick(SHLD);

    makeTarget(ch, kind);
  }

  // ---------- Clocks ----------
  var lastTick = now();
  function loopSecond(){
    if(!running || paused) return;
    var t = Math.max(0, Math.round(DURA - (now()-startedAt)/1000));
    emit('hha:time', {sec:t});
    // no-miss counter
    if(misses===0) nomissSec = Math.min(9999, nomissSec+1);
    else nomissSec = 0;

    // อัปเดตเควสต์ no-miss/fever
    for(var i=0;i<quests.length;i++){
      var q=quests[i];
      if(q.kind==='nomiss'){ q.prog = Math.min(q.target, nomissSec); q.done = q.prog>=q.target; }
      if(q.kind==='fever'){ q.prog = Math.min(q.target, feverCount); q.done = q.prog>=q.target; }
    }
    questEmit();

    if(t<=0){ endGame('timeout'); return; }
    secondTimer = setTimeout(loopSecond, 1000);
  }

  function rafLoop(){
    if(!running || paused) return;
    var nowT = now();
    var dt = nowT - lastTick; lastTick = nowT;
    tickFever(dt);
    requestAnimationFrame(rafLoop);
  }

  // ---------- End ----------
  function endGame(reason){
    if(!running) return;
    running=false;
    try{ clearTimeout(spawnTimer); }catch(e){}
    try{ clearTimeout(secondTimer); }catch(e){}
    try{ clearTimeout(feverEndTimer); }catch(e){}
    // เก็บสถิติ/เควสต์
    var cleared = 0; for(var i=0;i<quests.length;i++){ if(quests[i].done) cleared++; }
    emit('hha:end', {
      mode: 'Good vs Junk',
      difficulty: DIFF,
      score: score,
      comboMax: maxCombo,
      misses: misses,
      hits: hits,
      spawns: spawns,
      avoidedJunk: avoidedJunk,
      shieldLeft: activeShield,
      questsCleared: cleared,
      questsTotal: 3,
      duration: DURA,
      reason: reason||'done'
    });
  }

  // ---------- Boot ----------
  // HUD reset + first quest text + coach
  questEmit();
  emit('hha:score', {score:0, combo:0});
  emit('hha:fever', {state:'change', level:0, active:false, count:0});

  startedAt = now();
  loopSecond();
  scheduleNext();
  requestAnimationFrame(rafLoop);

  // API
  return {
    stop: function(){ endGame('quit'); },
    pause: function(){ paused=true; },
    resume: function(){ if(!running) return; paused=false; lastTick=now(); requestAnimationFrame(rafLoop); }
  };
}

export default { boot };
