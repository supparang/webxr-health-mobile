// === Hero Health Academy — game/main.js (G14 Full-Bleed + 3D Click-Shatter + Legacy Bridge) ===
window.__HHA_BOOT_OK = 'main';

(function () {
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  // ---------------- CSS: full-bleed gameplay + hide menu while playing ----------------
  (function injectCSS(){
    const css = `
      html,body{height:100%;margin:0;background:#0b1626;overflow:hidden;}
      #gameLayer{position:fixed;inset:0;width:100vw;height:100vh;overflow:hidden;background:#0b1626;}
      #c{position:absolute;inset:0;width:100%;height:100%;z-index:6;display:block;}
      #spawnHost{position:absolute;inset:0;z-index:6;pointer-events:auto;}
      body.playing header.brand,body.playing #menuBar{display:none!important;}
      #hudWrap{position:fixed;left:16px;top:14px;z-index:1500;pointer-events:none;display:none;}
      body.playing #hudWrap{display:block!important;}
      body.result #c{pointer-events:none;filter:grayscale(.2) brightness(.85);}
      /* popup score */
      .hitPopup{position:fixed;z-index:2002;font-weight:900;font-size:20px;color:#7CFFB2;
        text-shadow:0 2px 6px rgba(0,0,0,.55);pointer-events:none;transform:translate(-50%,-50%) scale(1);
        opacity:0;animation:popfade .9s ease forwards;}
      .hitPopup.bad{color:#ff7c7c}
      @keyframes popfade{
        0%{opacity:0;transform:translate(-50%,-50%) scale(.8)}
        15%{opacity:1;transform:translate(-50%,-64%) scale(1.08)}
        100%{opacity:0;transform:translate(-50%,-110%) scale(1)}}
    `;
    const tag=document.createElement('style'); tag.textContent=css; document.head.appendChild(tag);
  })();

  // ---------------- Ensure DOM base ----------------
  (function ensureDOM(){
    if(!$('#gameLayer')){ const g=document.createElement('section'); g.id='gameLayer'; document.body.appendChild(g); }
    if(!$('#c')){ const c=document.createElement('canvas'); c.id='c'; $('#gameLayer').appendChild(c); }
    if(!$('#spawnHost')){ const h=document.createElement('div'); h.id='spawnHost'; $('#gameLayer').appendChild(h); }
  })();

  // ---------------- Safe stubs (จะถูกแทนเมื่อ import ได้) ----------------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput, CoachClass;

  async function loadCore() {
    try { ({ ScoreSystem } = await import('./core/score.js')); }
    catch { ScoreSystem = class{ constructor(){this.value=0;} add(n=0){ this.value+=n;} get(){return this.value|0;} reset(){this.value=0;} }; }

    try { ({ SFX: SFXClass } = await import('./core/sfx.js')); }
    catch { SFXClass = class{ play(){} tick(){} good(){} bad(){} perfect(){} power(){} }; }

    try { ({ Quests } = await import('./core/quests.js')); }
    catch { Quests = { beginRun(){}, event(){}, tick(){}, endRun(){return[]}, bindToMain(){return{refresh(){}}} }; }

    try { ({ Progress } = await import('./core/progression.js')); }
    catch { Progress = { init(){}, beginRun(){}, endRun(){}, emit(){}, getStatSnapshot(){return{};}, profile(){return{};} }; }

    try { ({ VRInput } = await import('./core/vrinput.js')); }
    catch { VRInput = { init(){}, toggleVR(){}, isXRActive(){return false;}, isGazeMode(){return false;} }; }

    try { ({ Coach: CoachClass } = await import('./core/coach.js')); }
    catch {
      CoachClass = class {
        constructor(){ this.lang=(localStorage.getItem('hha_lang')||'TH').toUpperCase(); this.hud=null; this.txt=null; this._ensureHUD(); }
        _ensureHUD(){ this.hud = $('#coachHUD') || Object.assign(document.createElement('div'),{id:'coachHUD',className:'coach'});
          if(!$('#coachHUD')){ const t=document.createElement('span'); t.id='coachText'; this.hud.appendChild(t);
            (document.getElementById('hudWrap')||document.body).appendChild(this.hud); }
          this.txt = $('#coachText'); }
        say(m){ if(this.txt){ this.txt.textContent=m||''; this.hud.style.display='flex'; setTimeout(()=>{ this.hud.style.display='none'; },1200);} }
        onStart(){ this.say(this.lang==='EN'?'Ready? Go!':'พร้อมไหม? ลุย!'); }
        onGood(){ this.say(this.lang==='EN'?'+Nice!':'+ดีมาก!'); }
        onPerfect(){ this.say(this.lang==='EN'?'PERFECT!':'เป๊ะเว่อร์!'); }
        onBad(){ this.say(this.lang==='EN'?'Watch out!':'ระวัง!'); }
        onTimeLow(){ this.say(this.lang==='EN'?'10s left—push!':'เหลือ 10 วิ สุดแรง!'); }
        onEnd(score){ this.say((score|0)>=200 ? (this.lang==='EN'?'Awesome!':'สุดยอด!') : (this.lang==='EN'?'Nice!':'ดีมาก!')); }
      };
    }
  }

  // ---------------- Mode loader (รองรับได้ทั้ง API เก่า/ใหม่) ----------------
  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key) {
    const m = await import(MODE_PATH(key));
    // สร้างสะพานให้รองรับได้ทั้ง:
    // - API ใหม่: start(cfg), update(dt), onPointer(ctx), stop()
    // - API เก่า: create()/init()/tick()/cleanup()
    const api = {
      _raw: m,
      name: m.name || key,
      hasNew: (typeof m.start==='function' && typeof m.update==='function'),
      start(cfg){
        if (this.hasNew) return m.start(cfg);
        if (typeof m.create==='function'){
          this._inst = m.create({ engine:{ fx:FX }, hud:R.hud, coach:R.coach });
          this._inst?.start?.();
        } else if (typeof m.init==='function'){
          m.init(R.state||{}, R.hud||{}, { time: R.remain|0, life: 1600 });
        }
      },
      update(dt){
        if (this.hasNew) return m.update(dt);
        if (this._inst?.update) return this._inst.update(dt, busFor());
        if (m.tick) return m.tick(R.state||{}, R.sys||{}, R.hud||{});
      },
      onPointer(ctx){ if (m.onPointer) m.onPointer(ctx); },
      stop(){
        if (this.hasNew) return m.stop?.();
        try { this._inst?.cleanup?.(); m.cleanup?.(R.state,R.hud); } catch {}
      }
    };
    return api;
  }

  // ---------------- Tiny FX helper: pop score ----------------
  const FX = {
    popText(txt, { x, y, ms = 900 } = {}) {
      const el = document.createElement('div');
      el.textContent = txt;
      el.className = 'hitPopup';
      el.style.left = (x|0) + 'px';
      el.style.top  = (y|0) + 'px';
      document.body.appendChild(el);
      setTimeout(()=> el.remove(), ms);
    }
  };

  // ---------------- HUD helpers ----------------
  function setScore(v){ const el = $('#score'); if (el) el.textContent = v|0; }
  function setTime(v){ const el = $('#time');  if (el) el.textContent = v|0; }

  // ---------------- Engine state ----------------
  let R = {
    playing:false, startedAt:0, remain:45, raf:0,
    sys:{ score:null, sfx:null },
    modeKey:'goodjunk', modeAPI:null, modeInst:null, state:null, hud:null, coach:null
  };

  function busFor(){ // event bus ให้ API เก่าใช้
    return {
      sfx: R.sys.sfx,
      hit(e){ // {kind:'good'|'perfect'|'ok', points, ui}
        if (e?.points) R.sys.score.add(e.points);
        setScore(R.sys.score.get?.() || R.sys.score.value || 0);
        if (e?.ui) FX.popText(`+${e.points||0}`, e.ui);
        if (e?.kind==='perfect') R.coach?.onPerfect(); else if (e?.kind==='good') R.coach?.onGood();
        Quests.event('hit', { result: e?.kind || 'good', meta: e?.meta || {} });
      },
      miss(){ /* soft miss */ }
    };
  }

  // ---------------- Three.js glue (full-bleed) ----------------
  let THREE_CTX={ready:false};
  function ensureThree(){
    if(THREE_CTX.ready) return Promise.resolve(THREE_CTX);
    return import('https://unpkg.com/three@0.159.0/build/three.module.js').then((THREE)=>{
      const cvs=$('#c');
      const renderer=new THREE.WebGLRenderer({canvas:cvs,antialias:true,alpha:true});
      renderer.setClearColor(0x000000,0);
      const scene=new THREE.Scene();
      const cam=new THREE.PerspectiveCamera(50,window.innerWidth/window.innerHeight,0.1,50);
      cam.position.set(0,0,8);
      scene.add(new THREE.AmbientLight(0xffffff,0.7));
      const dl=new THREE.DirectionalLight(0xffffff,0.9);dl.position.set(4,5,5);scene.add(dl);

      function resize(){
        const w=window.innerWidth,h=window.innerHeight;
        cam.aspect=w/h; cam.updateProjectionMatrix(); renderer.setSize(w,h,false);
      }
      resize(); window.addEventListener('resize',resize);

      const ray=new THREE.Raycaster(), pointer=new THREE.Vector2();
      ray.params.Sprite = ray.params.Sprite || {}; ray.params.Sprite.threshold = 0.6;

      function pointerFrom(e){
        const rect=cvs.getBoundingClientRect();
        const cx=(e?.clientX ?? e?.touches?.[0]?.clientX ?? rect.left+rect.width/2);
        const cy=(e?.clientY ?? e?.touches?.[0]?.clientY ?? rect.top +rect.height/2);
        pointer.x = ((cx-rect.left)/rect.width)*2 - 1;
        pointer.y = -((cy-rect.top)/rect.height)*2 + 1;
      }
      function fire(){
        if (R.modeAPI && typeof R.modeAPI.onPointer === 'function') {
          R.modeAPI.onPointer({THREE, renderer, scene, camera:cam, cam, ray, pointer, canvas:cvs});
        }
      }
      ['click','pointerdown','pointerup','touchstart'].forEach(ev=>{
        cvs.addEventListener(ev,e=>{
          if(!R.playing) return;
          pointerFrom(e); fire();
        },false);
      });

      function randInView(z=0){
        const zv=Math.min(0.6,Math.max(-0.25,z));
        const dist=(cam.position.z - zv);
        const halfH=Math.tan((cam.fov*Math.PI/180)/2)*dist;
        const halfW=halfH*cam.aspect;
        return {x:(Math.random()*2-1)*(halfW*0.9),y:(Math.random()*2-1)*(halfH*0.9),z:zv};
      }

      THREE_CTX={ready:true,THREE,renderer,scene,camera:cam,cam,ray,pointer,canvas:cvs,utils:{randInView}};
      return THREE_CTX;
    });
  }

  // plane-lock: 3D ใช้ canvas, DOM ปิด
  function setPlane3D(on=true){
    const cvs=$('#c'), host=$('#spawnHost');
    if(on){
      document.body.classList.add('use3d');
      if(cvs){ cvs.style.pointerEvents='auto'; cvs.style.zIndex='12'; }
      if(host){ host.style.display='none'; host.style.pointerEvents='none'; }
    }else{
      document.body.classList.remove('use3d');
      if(cvs){ cvs.style.pointerEvents='none'; }
      if(host){ host.style.display='block'; host.style.pointerEvents='auto'; }
    }
  }

  // ---------------- pop score for new API (NDC → screen) ----------------
  window.__HHA_showPopup = function(ndcX, ndcY, text, good=true){
    const cvs = $('#c'); const r = cvs.getBoundingClientRect();
    const x = (ndcX*0.5+0.5)*r.width  + r.left;
    const y = (-ndcY*0.5+0.5)*r.height + r.top;
    const d = document.createElement('div');
    d.className='hitPopup'+(good?'':' bad'); d.textContent = text;
    d.style.left = x+'px'; d.style.top = y+'px';
    document.body.appendChild(d);
    setTimeout(()=>d.remove(), 900);
  };

  // ---------------- HUD glue ----------------
  function setScoreHUD(v){ setScore(v); }
  function addScore(delta){ R.sys.score.add(delta); setScoreHUD(R.sys.score.get?.()||R.sys.score.value||0); }
  function badHit(){ /* can add combo reset here if needed */ }

  // ---------------- Expose hooks for new API modes ----------------
  window.__HHA_modeHooks = { addScore, badHit };

  // ---------------- Loop & timer ----------------
  function render3D(){
    if(THREE_CTX.ready && R.playing){
      THREE_CTX.renderer.render(THREE_CTX.scene, THREE_CTX.cam||THREE_CTX.camera);
    }
  }

  function gameTick(){
    if (!R.playing) return;
    const tNow = performance.now();

    // second tick
    const secGone = Math.floor((tNow - R._secMark)/1000);
    if (secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = tNow;
      setTime(R.remain);
      if (R.remain === 10) R.coach?.onTimeLow?.();
      Quests.tick({ score: (R.sys.score.get?.()||0) });
    }

    // mode update
    try {
      const dt = (tNow - (R._dtMark||tNow)) / 1000; R._dtMark = tNow;
      R.modeAPI?.update?.(dt);
    } catch(e){ console.warn('[mode.update] error', e); }

    render3D();

    if (R.remain <= 0) return endGame(false);
    R.raf = requestAnimationFrame(gameTick);
  }

  // ---------------- Screens ----------------
  function enterPlaying(){
    document.body.classList.add('playing');
    document.body.classList.remove('result');
    $('#hudWrap') && ($('#hudWrap').style.display='block');
  }
  function enterResult(){
    document.body.classList.add('result');
    document.body.classList.remove('playing');
    const res = $('#result'); if(res) res.style.display='block';
  }
  function enterHome(){
    document.body.classList.remove('playing','result');
    const res = $('#result'); if(res) res.style.display='none';
  }

  // ---------------- Lifecycle ----------------
  function toast(text){
    let el = $('#toast');
    if(!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent = text; el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'), 1200);
  }

  function endGame(){
    if (!R.playing) return;
    R.playing = false;
    cancelAnimationFrame(R.raf);
    try { Quests.endRun({ score: R.sys.score.get?.()||0 }); } catch {}
    try { R.modeAPI?.stop?.(); } catch {}
    R.coach?.onEnd?.(R.sys.score.get?.()||0);
    try { Progress.endRun({ score: R.sys.score.get?.()||0 }); } catch {}

    // สรุปผล
    const secs = Math.round((performance.now()-R.startedAt)/1000);
    const txt = `คะแนนรวม: ${R.sys.score.get?.()||0} • เวลาเล่น: ${secs}s`;
    const resText = $('#resultText'); if(resText) resText.textContent = txt;
    enterResult();
  }

  async function startGame(){
    if (window.HHA?._busy) return;
    window.HHA._busy = true;

    await loadCore();
    Progress.init?.();

    // mode/diff จาก global หรือ data-attr
    const modeKey = window.__HHA_MODE || (document.body.getAttribute('data-mode') || 'goodjunk');
    const diff    = window.__HHA_DIFF || (document.body.getAttribute('data-diff') || 'Normal');
    R.modeKey = modeKey;

    // systems
    R.sys.score = new (ScoreSystem||function(){})();
    R.sys.score.reset?.();
    R.sys.sfx   = new (SFXClass||function(){})();

    setScore(0);

    // HUD & Coach
    R.hud = {
      setTarget(g,have,need){
        const el = $('#targetWrap'); if(!el) return;
        const mapTH = { veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม' };
        el.textContent = `${mapTH[g]||g} • ${have|0}/${need|0}`;
        el.style.display = 'inline-flex';
      },
      showHydration(){}, hideHydration(){},
      dimPenalty(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 120); },
      setQuestChips(){}, markQuestDone(){}
    };

    R.coach = new CoachClass({ lang: (localStorage.getItem('hha_lang')||'TH') });
    R.coach.onStart();
    try { Quests.bindToMain({ hud: R.hud, coach: R.coach }); } catch {}

    // state
    R.state = { difficulty: diff, lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };

    // โหลดโหมด
    let api;
    try { api = await loadMode(modeKey); }
    catch (e) { console.error('[HHA] Failed to load mode:', modeKey, e); toast(`Failed to load mode: ${modeKey}`); window.HHA._busy = false; return; }
    R.modeAPI = api;

    // เริ่ม 3D
    const three = await ensureThree();
    setPlane3D(true);

    // เริ่มโหมด (รองรับ API ใหม่/เก่า)
    api.start({ difficulty: diff, lang: R.state.lang, three });

    // begin run
    try { Quests.beginRun(modeKey, diff, (R.state.lang||'TH'), 45); } catch {}
    try { Progress.beginRun(modeKey, diff, (R.state.lang||'TH')); } catch {}

    // start timer & loop
    R.playing = true;
    R.startedAt = performance.now();
    R._secMark = performance.now();
    R._dtMark  = performance.now();
    R.remain = 45;
    setTime(R.remain);

    enterPlaying();
    R.raf = requestAnimationFrame(gameTick);

    // ปล่อย busy flag หลังเริ่มสำเร็จ
    window.HHA._busy = false;
  }

  // ---------------- Expose globals & bind Start ----------------
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame   = endGame;

  // (สำคัญ) อย่าปิดคลิก canvas ตอนนี้ — เราใช้คลิกบน 3D
  // ลบการตั้งค่า pointerEvents:none เดิมทิ้ง

  // strong bind ปุ่ม Start
  (function bindStartStrong(){
    const b = document.getElementById('btn_start');
    if (!b) return;
    const clone = b.cloneNode(true);
    b.parentNode.replaceChild(clone, b);
    clone.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); startGame(); }, {capture:true});
  })();

  // Enter/Space เพื่อเริ่มจากหน้า Home
  window.addEventListener('keydown', (e)=>{
    if ((e.key === 'Enter' || e.key === ' ') && !document.body.classList.contains('playing')){
      const menuVisible = !$('#menuBar')?.hasAttribute('data-hidden');
      if (menuVisible) { e.preventDefault(); startGame(); }
    }
  }, { passive:false });

  // ปุ่มใน Result
  (function wireResultButtons(){
    const replay = $('#btn_replay'); const home = $('#btn_home');
    replay && replay.addEventListener('click', ()=>{ $('#result')&&( $('#result').style.display='none' ); startGame(); });
    home   && home.addEventListener('click',  ()=>{ $('#result')&&( $('#result').style.display='none' ); document.body.classList.remove('playing','result'); });
  })();

  // --------- helper popup เด้งคะแนนให้ API เก่า (จากตำแหน่งจอ) ---------
  function screenPopup(x,y,text,good=true){
    const d=document.createElement('div'); d.className='hitPopup'+(good?'':' bad'); d.textContent=text;
    d.style.left=(x|0)+'px'; d.style.top=(y|0)+'px'; document.body.appendChild(d); setTimeout(()=>d.remove(),900);
  }
  // เปิดทางให้โหมดแบบเก่าเรียกได้ (ผ่าน R.state.ctx)
  R.state = R.state || {}; R.state.ctx = R.state.ctx || {}; R.state.ctx.screenPopup = screenPopup;

})();
