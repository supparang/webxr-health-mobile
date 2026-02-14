/* ===================================================
   HEROHEALTH — Boss Session (15s)
   - Mini game overlay inside planner (no external assets)
   - Mix: tap targets + rhythm pulse + jump/duck + balance hold
   - Emits result via callback
=================================================== */
(function(global){
  'use strict';

  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
  const rnd=(seed)=>{
    // mulberry32
    let a=(seed>>>0)||12345;
    return ()=>{let t=a+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
  };

  function ensureStyle(){
    if(document.getElementById('hhBossStyle')) return;
    const s=document.createElement('style');
    s.id='hhBossStyle';
    s.textContent=`
      .hhBossOverlay{
        position:fixed; inset:0; z-index:99999;
        background: radial-gradient(900px 600px at 10% -10%, rgba(255,0,64,.18), transparent 60%),
                    radial-gradient(900px 600px at 110% 20%, rgba(245,158,11,.14), transparent 60%),
                    rgba(0,0,0,.62);
        display:flex; align-items:center; justify-content:center;
        padding: 16px;
      }
      .hhBossCard{
        width:min(860px,100%);
        border-radius:24px;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.86);
        box-shadow: 0 18px 40px rgba(0,0,0,.45);
        padding: 14px;
      }
      .hhBossTop{display:flex;align-items:center;justify-content:space-between;gap:10px;}
      .hhBossTitle{font-weight:900;font-size:16px;}
      .hhBossHint{color:#94a3b8;font-size:12px;margin-top:4px;}
      .hhBossHUD{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;}
      .hhPill{
        border-radius:999px;border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.55);
        padding: 6px 10px; font-weight:900; color:#e5e7eb;
        font-size:13px;
      }
      .hhBossArena{
        position:relative;
        margin-top:12px;
        border-radius:22px;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(4,6,16,.55);
        height: min(56vh, 520px);
        overflow:hidden;
        touch-action: manipulation;
      }
      .hhBossTarget{
        position:absolute;
        width: 54px; height: 54px;
        border-radius: 999px;
        border: 2px solid rgba(34,211,238,.45);
        background: rgba(34,211,238,.14);
        display:flex;align-items:center;justify-content:center;
        font-weight: 900;
        color:#e5e7eb;
        user-select:none;
        transform: translate(-50%,-50%);
        box-shadow: 0 10px 20px rgba(0,0,0,.35);
      }
      .hhBossTarget.good{ border-color: rgba(34,197,94,.45); background: rgba(34,197,94,.14); }
      .hhBossTarget.bad{  border-color: rgba(239,68,68,.50); background: rgba(239,68,68,.14); }
      .hhBossBeat{
        position:absolute; left:12px; right:12px; bottom:12px;
        height: 10px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.55);
        overflow:hidden;
      }
      .hhBossBeat > i{
        display:block; height:100%;
        width: 0%;
        background: rgba(245,158,11,.55);
        transition: width 80ms linear;
      }
      .hhBossPrompt{
        position:absolute; top:12px; left:12px; right:12px;
        display:flex; align-items:center; justify-content:center;
        pointer-events:none;
      }
      .hhBossPrompt span{
        padding: 8px 12px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.66);
        font-weight: 900;
      }
      .hhBossBtns{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;}
      .hhBossBtn{
        border-radius: 16px;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.55);
        color:#e5e7eb;
        padding: 10px 12px;
        font-weight: 900;
        cursor:pointer;
        flex: 1 1 180px;
      }
      .hhBossBtn.primary{
        border-color: rgba(239,68,68,.40);
        background: rgba(239,68,68,.12);
      }
    `;
    document.head.appendChild(s);
  }

  function createOverlay(){
    ensureStyle();
    const ov=document.createElement('div');
    ov.className='hhBossOverlay';
    ov.innerHTML=`
      <div class="hhBossCard">
        <div class="hhBossTop">
          <div>
            <div class="hhBossTitle">👑 BOSS SESSION — 15 วินาที</div>
            <div class="hhBossHint">แตะเป้า ✅ / หลีกเลี่ยง ❌ / กดจังหวะตอน “ส้มเต็ม” / ทำตามคำสั่ง JUMP หรือ DUCK</div>
          </div>
          <div class="hhPill" id="hhBossTimer">15s</div>
        </div>

        <div class="hhBossHUD">
          <div class="hhPill" id="hhBossScore">Score: 0</div>
          <div class="hhPill" id="hhBossAcc">Acc: 0%</div>
          <div class="hhPill" id="hhBossStreak">Streak: 0</div>
          <div class="hhPill" id="hhBossMode">Mode: MIX</div>
        </div>

        <div class="hhBossArena" id="hhBossArena">
          <div class="hhBossPrompt"><span id="hhBossPromptText">READY…</span></div>
          <div class="hhBossBeat"><i id="hhBossBeatFill"></i></div>
        </div>

        <div class="hhBossBtns">
          <button class="hhBossBtn" id="hhBossJump">JUMP</button>
          <button class="hhBossBtn" id="hhBossDuck">DUCK</button>
          <button class="hhBossBtn primary" id="hhBossQuit">จบ/ข้าม</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    return ov;
  }

  function runBossSession(opts={}){
    const seed = (opts.seed>>>0) || 0;
    const durationMs = Number(opts.durationMs || 15000);
    const onDone = typeof opts.onDone === 'function' ? opts.onDone : ()=>{};
    const R = rnd(seed || 54321);

    const ov = createOverlay();
    const arena = ov.querySelector('#hhBossArena');
    const tEl = ov.querySelector('#hhBossTimer');
    const sEl = ov.querySelector('#hhBossScore');
    const aEl = ov.querySelector('#hhBossAcc');
    const stEl= ov.querySelector('#hhBossStreak');
    const pEl = ov.querySelector('#hhBossPromptText');
    const beatFill = ov.querySelector('#hhBossBeatFill');

    let score=0, hits=0, misses=0, streak=0, maxStreak=0;
    let alive=true;
    let startAt=performance.now();
    let lastSpawn=0;
    let beatPhase=0; // 0..1
    let prompt='READY';
    let needAction=null; // 'jump'|'duck' or null
    let needUntil=0;

    function updHUD(){
      const total = hits+misses;
      const acc = total ? Math.round((hits/total)*100) : 0;
      sEl.textContent = `Score: ${score}`;
      aEl.textContent = `Acc: ${acc}%`;
      stEl.textContent= `Streak: ${streak}`;
      pEl.textContent = prompt;
    }

    function end(){
      if(!alive) return;
      alive=false;

      const total = hits+misses;
      const acc = total ? Math.round((hits/total)*100) : 0;

      // boss score normalized 0..100 (rough)
      const norm = clamp(Math.round((score / 60) * 100), 0, 100);

      try{ ov.remove(); }catch{}
      onDone({
        game:'boss',
        score: norm,
        rawScore: score,
        acc,
        timeMs: Math.round(performance.now()-startAt),
        streak: maxStreak
      });
    }

    // quit
    ov.querySelector('#hhBossQuit').addEventListener('click', end);

    // jump/duck handlers
    function doAction(kind){
      if(!alive) return;
      if(needAction && kind===needAction && performance.now()<=needUntil){
        score += 6;
        hits++;
        streak++;
        maxStreak=Math.max(maxStreak,streak);
        prompt = `✅ ${kind.toUpperCase()} PERFECT!`;
        needAction=null;
      }else{
        misses++;
        streak=0;
        prompt = `❌ ไม่ทัน/ผิด (${kind.toUpperCase()})`;
      }
      updHUD();
      if(global.HHRewards){
        (needAction===null) ? global.HHRewards.onHit({combo:streak,isPerfect:true})
                            : global.HHRewards.onMiss({combo:0});
      }
    }
    ov.querySelector('#hhBossJump').addEventListener('click', ()=>doAction('jump'));
    ov.querySelector('#hhBossDuck').addEventListener('click', ()=>doAction('duck'));

    // tap targets
    function spawnTarget(){
      const rect = arena.getBoundingClientRect();
      const x = 40 + R()*(rect.width-80);
      const y = 70 + R()*(rect.height-140);

      const isBad = R() < 0.22;
      const el = document.createElement('div');
      el.className = 'hhBossTarget ' + (isBad ? 'bad':'good');
      el.style.left = x+'px';
      el.style.top  = y+'px';
      el.textContent = isBad ? '❌' : '✅';

      const born = performance.now();
      const ttl = isBad ? 520 : 680;

      el.addEventListener('pointerdown', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        if(!alive) return;
        const age = performance.now() - born;

        if(isBad){
          // punish hitting bad
          score = Math.max(0, score - 3);
          misses++;
          streak=0;
          prompt='โดน ❌';
          global.HHRewards?.onMiss?.({combo:0});
        }else{
          // reward, perfect if very fast
          const perfect = age < 220;
          score += perfect ? 4 : 2;
          hits++;
          streak++;
          maxStreak=Math.max(maxStreak,streak);
          prompt = perfect ? 'PERFECT! ⚡' : 'Nice!';
          global.HHRewards?.onHit?.({combo:streak,isPerfect:perfect});
        }

        updHUD();
        try{ el.remove(); }catch{}
      });

      arena.appendChild(el);

      // timeout
      setTimeout(()=>{
        if(!alive) return;
        if(el.isConnected){
          // missing good target is miss; bad target just disappears
          if(!isBad){
            misses++;
            streak=0;
            prompt='พลาด 😅';
            updHUD();
            global.HHRewards?.onMiss?.({combo:0});
          }
          try{ el.remove(); }catch{}
        }
      }, ttl);
    }

    // beat: tap arena when beat full (rhythm)
    arena.addEventListener('pointerdown', (e)=>{
      // don't count if hit target (target stops propagation)
      if(!alive) return;
      // rhythm window: beatPhase near 1
      const ok = beatPhase > 0.86;
      if(ok){
        score += 3;
        hits++;
        streak++;
        maxStreak=Math.max(maxStreak,streak);
        prompt='🎵 ตรงจังหวะ!';
        global.HHRewards?.onHit?.({combo:streak,isPerfect:true});
      }else{
        misses++;
        streak=0;
        prompt='🎵 เร็ว/ช้าไป';
        global.HHRewards?.onMiss?.({combo:0});
      }
      updHUD();
    });

    // main loop
    function tick(){
      if(!alive) return;

      const t = performance.now();
      const elapsed = t - startAt;
      const left = Math.max(0, durationMs - elapsed);

      tEl.textContent = `${Math.ceil(left/1000)}s`;

      // spawn targets faster as time goes
      const spawnEvery = clamp(520 - (elapsed/durationMs)*220, 280, 520);
      if(t - lastSpawn > spawnEvery){
        lastSpawn = t;
        spawnTarget();
      }

      // rhythm beat cycles
      const beatSpeed = 1.35; // cycles/sec
      beatPhase = (elapsed/1000 * beatSpeed) % 1;
      beatFill.style.width = Math.round(beatPhase*100) + '%';

      // prompt jump/duck sometimes
      if(!needAction && (R() < 0.015)){
        needAction = (R() < 0.5) ? 'jump' : 'duck';
        needUntil = t + 1200;
        prompt = `ทำเลย: ${needAction.toUpperCase()}!`;
        updHUD();
      }
      if(needAction && t > needUntil){
        // failed action window
        misses++;
        streak=0;
        prompt = `หมดเวลา: ${needAction.toUpperCase()} 😅`;
        needAction=null;
        updHUD();
      }

      if(left <= 0){
        end();
        return;
      }
      requestAnimationFrame(tick);
    }

    // start
    prompt='GO!';
    updHUD();
    global.HHRewards?.toast?.('BOSS!', '15 วินาที ลุย! 👑', 'boss');
    requestAnimationFrame(tick);
  }

  global.HHBossSession = { runBossSession };

})(window);