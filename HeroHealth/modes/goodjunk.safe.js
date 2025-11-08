// === modes/goodjunk.safe.js — capped spawns + non-overlap + fever/quests/coach ===
function emit(n,d){try{window.dispatchEvent(new CustomEvent(n,{detail:d||{}}));}catch(_){}}
function coach(m){emit('hha:coach',{text:String(m||'')});}
function hudScore(s,c){emit('hha:score',{score:s,combo:c});}
function hudTime(t){emit('hha:time',{sec:t});}
function questLine(t){emit('hha:quest',{text:String(t||'')});}
function feverEvt(d){emit('hha:fever',d||{});}

var EMO_CACHE={};
function sprite(emo,px){
  px=px||192; var k=emo+'@'+px; if(EMO_CACHE[k]) return EMO_CACHE[k];
  var c=document.createElement('canvas'); c.width=c.height=px; var x=c.getContext('2d');
  x.textAlign='center'; x.textBaseline='middle';
  x.save(); x.shadowColor='rgba(255,255,255,.55)'; x.shadowBlur=px*.18; x.font=(px*.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif'; x.fillText(emo,px/2,px/2); x.restore();
  x.save(); x.shadowColor='rgba(0,0,0,.35)'; x.shadowBlur=px*.12; x.shadowOffsetX=px*.03; x.shadowOffsetY=px*.05; x.font=(px*.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif'; x.fillText(emo,px/2,px/2); x.restore();
  x.font=(px*.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif'; x.fillText(emo,px/2,px/2);
  return EMO_CACHE[k]=c.toDataURL('image/png');
}

var GOOD=['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
var JUNK=['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

var QUESTS=[
  {id:'good10',label:'เก็บของดี 10 ชิ้น', ok:s=>s.good>=10,     prog:s=>Math.min(10,s.good)+'/10'},
  {id:'avoid5',label:'เลี่ยงขยะ 5 ครั้ง',   ok:s=>s.avoid>=5,    prog:s=>Math.min(5,s.avoid)+'/5'},
  {id:'combo10',label:'ทำคอมโบ 10',        ok:s=>s.comboMax>=10,prog:s=>Math.min(10,s.comboMax)+'/10'},
  {id:'good20',label:'เก็บของดี 20 ชิ้น',   ok:s=>s.good>=20,    prog:s=>Math.min(20,s.good)+'/20'},
  {id:'nostreak10',label:'ไม่พลาด 10 วิ',  ok:s=>s.noMiss>=10,  prog:s=>Math.min(10,s.noMiss)+'s/10s'},
  {id:'fever2',label:'เข้า Fever 2 ครั้ง',  ok:s=>s.fever>=2,    prog:s=>Math.min(2,s.fever)+'/2'},
  {id:'combo20',label:'คอมโบ 20 ต่อเนื่อง', ok:s=>s.comboMax>=20,prog:s=>Math.min(20,s.comboMax)+'/20'},
  {id:'score500',label:'ทำคะแนน 500+',      ok:s=>s.score>=500,  prog:s=>Math.min(500,s.score)+'/500'},
  {id:'star3',label:'เก็บดาว ⭐ 3 ดวง',      ok:s=>s.star>=3,     prog:s=>Math.min(3,s.star)+'/3'},
  {id:'diamond1',label:'เก็บเพชร 💎 1 เม็ด', ok:s=>s.diamond>=1,  prog:s=>Math.min(1,s.diamond)+'/1'}
];
function draw3(){var p=QUESTS.slice(),r=[];for(var i=0;i<3;i++)r.push(p.splice((Math.random()*p.length)|0,1)[0]);return r;}

function explode(host,pos,colors){
  var N=12;
  for(var i=0;i<N;i++){
    var e=document.createElement('a-entity');
    var pl=document.createElement('a-plane');
    pl.setAttribute('width',.06); pl.setAttribute('height',.12);
    pl.setAttribute('material','color:'+colors[i%colors.length]+';opacity:.95;side:double'); e.appendChild(pl);
    e.setAttribute('position',pos.x+' '+pos.y+' '+pos.z);
    var th=Math.random()*Math.PI*2, sp=.8+Math.random()*.8, dx=Math.cos(th)*sp, dz=Math.sin(th)*sp, dy=.8+Math.random()*.6;
    e.setAttribute('animation__move','property: position; to: '+(pos.x+dx)+' '+(pos.y+dy)+' '+(pos.z+dz)+'; dur:360; easing:easeOutQuad');
    e.setAttribute('animation__fade','property: components.material.material.opacity; to:0; dur:420; easing:linear; delay:240');
    e.setAttribute('rotation',((Math.random()*180-90)|0)+' '+((Math.random()*360)|0)+' '+((Math.random()*180-90)|0));
    host.appendChild(e);
    (function(n){setTimeout(function(){try{host.removeChild(n);}catch(_e){}},640);})(e);
  }
}
function popText(host,txt,pos,color){
  var t=document.createElement('a-entity');
  t.setAttribute('position',pos.x+' '+(pos.y+.06)+' '+pos.z);
  t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#fff')+'; fontSize:0.10;');
  t.setAttribute('animation__rise','property: position; to: '+pos.x+' '+(pos.y+.35)+' '+pos.z+'; dur:520; easing:easeOutCubic');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur:520; easing: linear');
  host.appendChild(t); setTimeout(function(){try{host.removeChild(t);}catch(_e){}},560);
}

export async function boot(cfg){
  cfg=cfg||{};
  var scene=document.getElementById('scene');
  var host=(cfg.host)||document.getElementById('spawnHost')||scene;

  // เคลียร์จากรอบก่อน (ถ้ามี)
  try{ Array.from(host.children).forEach(function(n){ if(n && n.tagName==='A-ENTITY') host.removeChild(n); }); }catch(_){}

  var duration=(cfg.duration|0)||60;
  var diff=String(cfg.difficulty||'normal');

  // State
  var running=true, remain=duration;
  var score=0, combo=0, comboMax=0, hits=0, misses=0, spawns=0;
  var stats={good:0,avoid:0,comboMax:0,noMiss:0,fever:0,score:0,star:0,diamond:0};

  // Fever
  var FEVER=false, fever=0, feverEnd=null;
  function feverAdd(v){fever=Math.max(0,Math.min(100,fever+v));feverEvt({state:'change',level:fever,active:FEVER}); if(!FEVER&&fever>=100) startFever();}
  function startFever(){FEVER=true;fever=100;stats.fever++;feverEvt({state:'start',level:100,active:true});coach('🔥 FEVER มาแล้ว!');clearTimeout(feverEnd);feverEnd=setTimeout(endFever,10000);}
  function endFever(){if(!FEVER)return;FEVER=false;fever=0;feverEvt({state:'end',level:0,active:false});}

  // Diff
  var spawnMin=520, spawnMax=700, lifeMs=1700, goodAdd=12, feverBonus=2.0, MAX_ACTIVE=4, MIN_DIST=0.45;
  if(diff==='easy'){ spawnMin=650; spawnMax=880; lifeMs=2000; goodAdd=14; feverBonus=2.0; MAX_ACTIVE=3; MIN_DIST=0.5; }
  if(diff==='hard'){ spawnMin=420; spawnMax=560; lifeMs=1400; goodAdd=10; feverBonus=2.2; MAX_ACTIVE=5; MIN_DIST=0.42; }

  // Quests
  var deck=draw3(), qi=0;
  function qHUD(){ var q=deck[qi]; questLine(q?('Quest '+(qi+1)+'/3: '+q.label+' ('+q.prog(stats)+')'):'Mini Quest — เคลียร์ครบแล้ว!'); }
  function qAdvance(){ var q=deck[qi]; if(q && q.ok(stats)){ qi++; coach('เควสสำเร็จ ✅'); } qHUD(); }

  // Timers
  hudTime(remain); hudScore(0,0); qHUD();
  var secTimer=setInterval(function(){ if(!running) return; remain=Math.max(0,remain-1); hudTime(remain); stats.noMiss=Math.min(9999,stats.noMiss+1); qAdvance(); if(remain<=0) finish('timeout'); },1000);
  var decay=setInterval(function(){ if(!running) return; if(!FEVER && fever>0) feverAdd(-4); },500);

  // Active list + helper
  var act=[]; // {el, x,y, ttl, good}
  function countActive(){ return act.length; }
  function removeActive(el){
    for(var i=act.length-1;i>=0;i--) if(act[i].el===el){ act.splice(i,1); break; }
  }
  function farEnough(x,y){
    for(var i=0;i<act.length;i++){
      var dx=act[i].x-x, dy=act[i].y-y; if(Math.sqrt(dx*dx+dy*dy) < MIN_DIST) return false;
    }
    return true;
  }
  function findSpot(){
    for(var k=0;k<20;k++){
      var x=(Math.random()*1.6-0.8), y=(Math.random()*0.8-0.2);
      if(farEnough(x,y)) return {x:x,y:y};
    }
    // ถ้าแน่นจริง ๆ วางกึ่งกลางล่าง
    return {x: (Math.random()<.5?-0.5:0.5), y: -0.1};
  }

  // Spawner
  var spawnTimer=null;
  function plan(){ if(!running) return; var wait=Math.floor(spawnMin+Math.random()*(spawnMax-spawnMin)); if(FEVER) wait=Math.max(300,Math.round(wait*0.85)); spawnTimer=setTimeout(spawnOne,wait); }
  var SH_GOOD=['#36d399','#22c55e','#4ade80','#86efac'], SH_BAD=['#fb7185','#ef4444','#f97316','#f43f5e'];

  function spawnOne(){
    if(!running) return;
    // ถ้าเต็มโควตา ให้รอใหม่
    if(countActive()>=MAX_ACTIVE){ plan(); return; }

    spawns++;
    var isGood = Math.random()<0.65;
    var list = isGood?GOOD:JUNK;
    var ch=list[(Math.random()*list.length)|0];

    var spot=findSpot();
    var item=document.createElement('a-entity'); item.classList.add('gj-target');
    var img=document.createElement('a-image');
    img.setAttribute('src', sprite(ch,192));
    img.setAttribute('width',.46); img.setAttribute('height',.46);
    img.classList.add('clickable');

    item.setAttribute('position', spot.x+' '+spot.y+' 0'); item.appendChild(img);

    var glow=document.createElement('a-plane');
    glow.setAttribute('width',.52); glow.setAttribute('height',.52);
    glow.setAttribute('position','0 0 -0.01');
    glow.setAttribute('material','color:'+(isGood?'#22c55e':'#ef4444')+';opacity:.18;transparent:true;side:double');
    item.appendChild(glow);

    // TTL
    var killed=false; var ttl=setTimeout(function(){
      if(killed||!running) return;
      // despawn
      if(isGood){
        combo=0; score=Math.max(0,score-10); misses++; emit('hha:miss',{count:misses}); coach('พลาดของดี! -10');
      }else{
        score+=5; stats.avoid++; coach('เลี่ยงขยะได้ดี! +5');
      }
      hudScore(score,combo);
      try{host.removeChild(item);}catch(_){}
      removeActive(item); plan();
    }, lifeMs);

    // Click
    img.addEventListener('click', function(){
      if(killed||!running) return; killed=true; clearTimeout(ttl);
      try{host.removeChild(item);}catch(_){}
      removeActive(item);

      var wp={x:spot.x, y:spot.y, z:-1.6};
      if(isGood){
        hits++; var base=20+combo*2; var plus=FEVER?Math.round(base*2.0):base;
        score+=plus; combo++; if(combo>comboMax) comboMax=combo;
        stats.good++; stats.score=Math.max(stats.score,score);
        hudScore(score,combo); explode(host,wp,SH_GOOD); popText(host,'+'+plus,wp,'#fff'); feverAdd(diff==='hard'?10:12);
        if(combo%5===0) coach('คอมโบ x'+combo+'!');
      }else{
        score=Math.max(0,score-15); combo=0; misses++; stats.noMiss=0;
        hudScore(score,combo); explode(host,wp,SH_BAD); popText(host,'-15',wp,'#ffb4b4'); coach('ระวังของขยะ!'); emit('hha:miss',{count:misses});
      }
      qAdvance(); plan();
    });

    host.appendChild(item);
    act.push({el:item,x:spot.x,y:spot.y,good:isGood});
    plan();
  }

  // Start
  coach('เริ่ม Good vs Junk! โฟกัสของดี เลี่ยงของขยะ!');
  plan();

  function finish(reason){
    if(!running) return; running=false;
    try{clearInterval(secTimer);}catch(_){}
    try{clearInterval(decay);}catch(_){}
    try{clearTimeout(spawnTimer);}catch(_){}
    try{clearTimeout(feverEnd);}catch(_){}

    try{ Array.from(host.querySelectorAll('.gj-target')).forEach(function(n){ try{host.removeChild(n);}catch(_){} }); }catch(_){}

    emit('hha:end',{
      mode:'Good vs Junk', difficulty:diff,
      score:score, comboMax:comboMax, hits:hits, misses:misses, spawns:spawns,
      questsCleared:Math.min(3,qi), questsTotal:3, duration:duration, reason:reason||'done'
    });
  }

  return { stop:function(){finish('quit');}, pause:function(){running=false;}, resume:function(){ if(running) return; running=true; plan(); } };
}

export default { boot };
