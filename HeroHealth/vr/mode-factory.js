// === HeroHealth/vr/mode-factory.js (production, stable) ===
export async function boot(config){
  config = config || {};
  var host   = config.host || document.getElementById('spawnHost') || document.body;
  var diff   = String(config.difficulty || 'normal');
  var dur    = Number(config.duration || 60);
  var pools  = config.pools || { good: ['🍎'], bad: ['🍔'] };
  var goodRate = (typeof config.goodRate==='number') ? config.goodRate : 0.7;
  var judge  = typeof config.judge === 'function' ? config.judge : function(ch){ return {good:true,scoreDelta:1}; };
  var running = true;

  // ---------- safe helpers ----------
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
  function fire(name, detail){
    try { window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); } catch(e){}
  }

  // ---------- style (inject once) ----------
  if(!document.getElementById('hha-style')){
    var st = document.createElement('style');
    st.id = 'hha-style';
    st.textContent =
      '.hha-layer{position:fixed;left:0;top:0;right:0;bottom:0;z-index:650;pointer-events:none;}'+
      '.hha-tgt{position:absolute;pointer-events:auto;font-size:64px;line-height:1;'+
      'filter: drop-shadow(0 6px 10px rgba(0,0,0,.45)) blur(0px);'+
      'transition: transform .12s ease, opacity .24s ease;}'+
      '.hha-tgt.hit{transform: scale(.85) translateY(-6px); opacity:.2;}';
    document.head.appendChild(st);
  }

  // ---------- layer host ----------
  var layer = document.createElement('div');
  layer.className = 'hha-layer';
  // ผูกกับ root (ไม่ผูกใน a-scene เพื่อให้ pointer ทำงานแน่นอน)
  document.body.appendChild(layer);

  // ---------- state ----------
  var score=0, combo=0, misses=0;
  var left = Math.max(1, Math.round(dur));
  var spawnTimer = null, timeTimer = null;

  // ---------- difficulty tuning ----------
  var spawnMin=900, spawnMax=1200, life=1600;
  if(diff==='easy'){ spawnMin=1000; spawnMax=1400; life=1700; }
  if(diff==='hard'){ spawnMin=700; spawnMax=1000; life=1450; }

  // ---------- timers ----------
  function tickTime(){
    if(!running) return;
    left = Math.max(0, left-1);
    fire('hha:time', {sec:left});
    if(left<=0){ end(); }
  }

  function planNextSpawn(){
    if(!running) return;
    var wait = Math.floor(spawnMin + Math.random()*(spawnMax-spawnMin));
    spawnTimer = setTimeout(spawnOne, wait);
  }

  function spawnOne(){
    if(!running) return;
    // สุ่ม good/bad ตาม goodRate, กัน pool ว่าง
    var goodPool = (pools && pools.good && pools.good.length) ? pools.good : ['✅'];
    var badPool  = (pools && pools.bad  && pools.bad.length ) ? pools.bad  : ['❌'];
    var isGood = Math.random() < goodRate;
    var ch = pick(isGood ? goodPool : badPool);

    var el = document.createElement('div');
    el.className = 'hha-tgt';
    el.textContent = ch;

    // ตำแหน่งสุ่ม (โซนกลางหน้าจอเล็กน้อย)
    var vw = Math.max(320, window.innerWidth||320);
    var vh = Math.max(320, window.innerHeight||320);
    var px = Math.floor(vw*0.12 + Math.random()*vw*0.76);
    var py = Math.floor(vh*0.18 + Math.random()*vh*0.62);
    el.style.left = px+'px';
    el.style.top  = py+'px';

    // ขนาดปรับตามความยาก
    var fs = 64;
    if(diff==='easy') fs=72; if(diff==='hard') fs=56;
    el.style.fontSize = fs+'px';

    // คลิกเพื่อเก็บคะแนน
    var clicked = false;
    function onHit(ev){
      if(clicked) return;
      clicked = true;
      ev && ev.preventDefault && ev.preventDefault();

      // คำนวณผลจาก judge
      var res = judge(ch, { score:score, combo:combo, misses:misses, diff:diff });
      var good = !!(res && res.good);
      var delta = (res && typeof res.scoreDelta==='number') ? res.scoreDelta : (good?1:-1);

      if(good){ combo = clamp(combo+1, 0, 9999); }
      else { combo = 0; }

      score = clamp(score + delta, -99999, 999999);

      // เอฟเฟกต์เล็ก ๆ
      el.className = 'hha-tgt hit';
      try{ layer.removeChild(el); }catch(e){}
      fire('hha:score', {score:score, combo:combo, delta:delta, good:good});

      // วาง spawn ถัดไป
      planNextSpawn();
    }
    el.addEventListener('click', onHit, {passive:false});
    el.addEventListener('touchstart', onHit, {passive:false});

    // หมดอายุ = miss
    var ttl = setTimeout(function(){
      if(clicked) return;
      try{ layer.removeChild(el); }catch(e){}
      combo = 0; misses += 1;
      planNextSpawn();
    }, life);

    // ใส่ลงเลเยอร์
    layer.appendChild(el);
  }

  function start(){
    if(timeTimer) clearInterval(timeTimer);
    timeTimer = setInterval(tickTime, 1000);
    // เริ่มตัวแรกทันที
    planNextSpawn();
  }

  function end(){
    if(!running) return;
    running = false;
    try{ clearInterval(timeTimer); }catch(e){}
    try{ clearTimeout(spawnTimer); }catch(e){}
    // เก็บกวาดเป้าที่เหลือ
    try{
      var nodes = layer.querySelectorAll('.hha-tgt');
      for(var i=0;i<nodes.length;i++){ try{ layer.removeChild(nodes[i]); }catch(_e){} }
    }catch(e){}
    // ส่งสรุป
    fire('hha:end', {score:score, combo:combo, misses:misses, duration:dur});
    // เอาเลเยอร์ออก
    try{ document.body.removeChild(layer); }catch(e){}
  }

  // ป้องกันกรณี host ถูกบัง pointer (เมนู)
  // ให้เลเยอร์คลิกได้
  layer.style.pointerEvents = 'auto';

  // เริ่ม!
  start();

  // public api
  return {
    stop: end,
    pause: function(){
      if(!running) return;
      running = false;
      try{ clearInterval(timeTimer); }catch(e){}
      try{ clearTimeout(spawnTimer); }catch(e){}
    },
    resume: function(){
      if(running) return;
      running = true;
      start();
    }
  };
}

export default { boot };