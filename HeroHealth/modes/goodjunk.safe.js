// === Good vs Junk — SAFE (mini-quest 3/10 + fever gauge + avoid-junk rewards) ===
var running=false, host=null, score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, endTimer=null, secTimer=null;

// ---------- small utils ----------
function emit(n,d){ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(e){} }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function pick(a){ return a[(Math.random()*a.length)|0]; }
function qparam(name, def){ try{ return (new URL(location.href)).searchParams.get(name) ?? def; }catch(_){ return def; } }

// ---------- emoji canvas cache ----------
var __emojiCache={};
function emojiSprite(emo, px){
  var size=px||192, key=emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c=document.createElement('canvas'); c.width=c.height=size;
  var ctx=c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(size*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,.25)'; ctx.shadowBlur=size*0.06;
  ctx.fillText(emo,size/2,size/2);
  __emojiCache[key]=c.toDataURL('image/png');
  return __emojiCache[key];
}

// ---------- pools ----------
var GOOD=['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
var JUNK=['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

// ---------- per-mode shard theme ----------
var MODE=(qparam('mode','goodjunk')||'goodjunk').toLowerCase();
var THEME={
  goodjunk:{ good:{n:12,dur:420,color:'#a7f3d0'}, junk:{n:10,dur:360,color:'#fecaca'} },
  groups  :{ good:{n:14,dur:460,color:'#93c5fd'}, junk:{n:10,dur:380,color:'#fde68a'} },
  hydration:{good:{n:16,dur:520,color:'#a5f3fc'}, junk:{n:10,dur:420,color:'#fca5a5'} },
  plate   :{ good:{n:12,dur:440,color:'#86efac'}, junk:{n:10,dur:380,color:'#fda4af'} }
}[MODE] || { good:{n:12,dur:420,color:'#a7f3d0'}, junk:{n:10,dur:360,color:'#fecaca'} };

// ---------- stats for missions ----------
var st={
  good:0,        // เก็บของดี
  avoid:0,       // เลี่ยงขยะ (ปล่อยให้หมดเวลา)
  badHit:0,      // ตีโดนขยะ
  comboMax:0,
  noMissSec:0,   // วินาทีที่ไม่พลาด/ไม่ตีโดนขยะ
  feverCount:0
};

// ---------- fever ----------
var FEVER=false, FEVER_MS=10000, feverTimer=null, feverTicker=null, feverEndsAt=0;
function feverStart(){
  if(FEVER) return;
  FEVER=true; st.feverCount++;
  feverEndsAt = Date.now()+FEVER_MS;
  emit('hha:fever',{state:'start', ms:FEVER_MS});
  clearInterval(feverTicker);
  feverTicker=setInterval(function(){
    var left=Math.max(0, feverEndsAt-Date.now());
    var pct=(left/FEVER_MS)*100;
    emit('hha:fever',{state:'change', level:pct});
    if(left<=0){ feverEnd(); }
  },120);
  clearTimeout(feverTimer);
  feverTimer=setTimeout(feverEnd, FEVER_MS);
}
function feverEnd(){
  if(!FEVER) return;
  FEVER=false;
  clearTimeout(feverTimer); feverTimer=null;
  clearInterval(feverTicker); feverTicker=null;
  emit('hha:fever',{state:'end'});
}

// ---------- shatter fx ----------
function shatter(x,y,color,count,dur){
  var root=document.createElement('a-entity');
  root.setAttribute('position', x+' '+y+' -1.2');
  count=count||10; dur=dur||420;
  for(var i=0;i<count;i++){
    var p=document.createElement('a-plane');
    p.setAttribute('width',0.055); p.setAttribute('height',0.055);
    p.setAttribute('material','color:'+(color||'#fff')+'; opacity:.95; side:double');
    var dx=(Math.random()*0.9-0.45), dy=(Math.random()*0.9-0.45);
    p.setAttribute('animation__m','property: position; to: '+(x+dx)+' '+(y+dy)+' -1.28; dur: '+dur+'; easing: ease-out');
    p.setAttribute('animation__f','property: material.opacity; to: 0; dur: '+dur+'; easing: linear');
    root.appendChild(p);
  }
  host.appendChild(root);
  setTimeout(function(){ if(root.parentNode) root.parentNode.removeChild(root); }, dur+40);
}

// ---------- popup text ----------
function tip(txt,x,y,color){
  var t=document.createElement('a-entity');
  t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#fff')+'; fontSize:0.09;');
  t.setAttribute('position', x+' '+(y+0.05)+' -1.18');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.32)+' -1.18; dur: 520; easing: ease-out');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 560);
}

// ---------- mission deck (3 from 10) ----------
var deck=[], curI=0;
var ALL=([
  {id:'good10',   label:'เก็บของดี 10 ชิ้น',    ok:function(){return st.good>=10;}},
  {id:'good20',   label:'เก็บของดี 20 ชิ้น',    ok:function(){return st.good>=20;}},
  {id:'avoid5',   label:'เลี่ยงขยะ 5 ครั้ง',    ok:function(){return st.avoid>=5;}},
  {id:'avoid10',  label:'เลี่ยงขยะ 10 ครั้ง',   ok:function(){return st.avoid>=10;}},
  {id:'combo8',   label:'ทำคอมโบ 8',           ok:function(){return st.comboMax>=8;}},
  {id:'combo12',  label:'ทำคอมโบ 12',          ok:function(){return st.comboMax>=12;}},
  {id:'score300', label:'ทำคะแนน 300+',         ok:function(){return score>=300;}},
  {id:'score600', label:'ทำคะแนน 600+',         ok:function(){return score>=600;}},
  {id:'nomiss10', label:'ไม่พลาด 10 วินาที',     ok:function(){return st.noMissSec>=10;}},
  {id:'fever1',   label:'เข้าช่วง FEVER 1 ครั้ง', ok:function(){return st.feverCount>=1;}}
]);
function drawDeck(){
  deck=[]; curI=0;
  var bag=ALL.slice(0);
  for(var i=0;i<3 && bag.length;i++){
    var k=(Math.random()*bag.length)|0;
    deck.push(bag.splice(k,1)[0]);
  }
  showQuest();
}
function showQuest(){
  var txt = curI<deck.length ? ('Mini Quest — '+deck[curI].label) :
            'Mini Quest — สำเร็จครบ 3 ใบ! FEVER กำลังทำงาน…';
  emit('hha:quest',{text:txt});
}
function checkQuestAdvance(){
  if(curI>=deck.length) return;
  if(deck[curI].ok()){ curI++; showQuest(); if(curI>=deck.length) feverStart(); }
}

// ---------- target ----------
function makeTarget(emoji, good, diff){
  var el=document.createElement('a-entity');

  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  var px=(Math.random()*1.6-0.8);
  var py=(Math.random()*0.7+0.6);
  img.setAttribute('position', px+' '+py+' -1.2');
  img.setAttribute('width',0.42); img.setAttribute('height',0.42);
  el.appendChild(img);

  var glow=document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:.22; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.classList.add('clickable');
  img.addEventListener('click', function(){
    if(!running) return;
    destroy();

    if(good){
      var base = 20 + combo*2;
      var plus = FEVER ? base*2 : base;
      score += plus;
      combo += 1; if(combo>maxCombo) maxCombo=combo;
      st.good++;
      st.noMissSec = Math.min(9999, st.noMissSec+0); // คงไว้
      tip('+'+plus, px, py);
      shatter(px,py,THEME.good.color,THEME.good.n,THEME.good.dur);
    }else{
      // ตีโดนขยะ → ถือว่าพลาด
      combo = 0; misses++; st.badHit++;
      score = Math.max(0, score-15);
      st.noMissSec = 0;
      tip('-15', px, py, '#ffb4b4');
      shatter(px,py,THEME.junk.color,THEME.junk.n,THEME.junk.dur);
    }

    emit('hha:score',{score:score, combo:combo});
    checkQuestAdvance();
  });

  var ttl=1600; if(diff==='easy') ttl=1900; else if(diff==='hard') ttl=1400;
  setTimeout(function(){
    if(!el.parentNode || !running) return;
    destroy();

    if(good){
      // พลาดของดี
      misses++; combo=0; st.noMissSec=0;
      tip('MISS', px, py, '#ffb4b4');
    }else{
      // เลี่ยงขยะสำเร็จ
      var plus = FEVER ? 12 : 8;
      score += plus; st.avoid++;
      tip('+'+plus, px, py, '#b9ffcb');
      // การเลี่ยงไม่ได้ +คอมโบ แต่ก็ไม่รีเซ็ต
    }

    emit('hha:score',{score:score, combo:combo});
    checkQuestAdvance();
  }, ttl);

  return el;
}

// ---------- spawn ----------
function spawnLoop(diff){
  if(!running) return;
  var favor = (!FEVER && curI<deck.length && deck[curI].id.indexOf('good')===0) ? 0.72 : 0.65;
  var goodPick = Math.random() < favor;
  var emoji = goodPick ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
  host.appendChild(makeTarget(emoji, goodPick, diff));

  var gap=520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER) gap = Math.max(300, Math.round(gap*0.85));
  spawnTimer=setTimeout(function(){ spawnLoop(diff); }, gap);
}

// ---------- boot ----------
export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  var duration=(cfg && cfg.duration)|0 || 60;
  var diff=(cfg && cfg.difficulty) || 'normal';

  running=true; score=0; combo=0; maxCombo=0; misses=0;
  st={good:0,avoid:0,badHit:0,comboMax:0,noMissSec:0,feverCount:0};
  FEVER=false; clearTimeout(feverTimer); feverTimer=null; clearInterval(feverTicker); feverTicker=null;
  drawDeck(); // สุ่ม 3 จาก 10

  emit('hha:score',{score:0, combo:0});
  emit('hha:fever',{state:'end'});

  // timers
  var remain=duration;
  emit('hha:time',{sec:remain});
  clearInterval(endTimer);
  endTimer=setInterval(function(){
    if(!running){ clearInterval(endTimer); return; }
    remain=Math.max(0, remain-1);
    // อัปเดตค่า “ไม่พลาด” ต่อเนื่อง: ถ้านาทีที่แล้วไม่ตีโดนขยะ ก็สะสม
    st.noMissSec = Math.min(9999, st.noMissSec + 1);
    st.comboMax = Math.max(st.comboMax, combo);

    emit('hha:time',{sec:remain});
    checkQuestAdvance();
    if(remain<=0){ clearInterval(endTimer); endGame('timeout'); }
  },1000);

  spawnLoop(diff);

  function endGame(reason){
    running=false;
    clearTimeout(spawnTimer);
    clearInterval(endTimer);
    clearInterval(secTimer);
    feverEnd();
    emit('hha:end',{score:score, combo:maxCombo, misses:misses, title:'Good vs Junk', reason:reason||'done'});
  }

  return {
    stop:function(){ if(!running) return; endGame('quit'); },
    pause:function(){ running=false; },
    resume:function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
