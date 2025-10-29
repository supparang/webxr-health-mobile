// === Hero Health Academy — game/main.js (runtime glue; startGame wired) ===
window.__HHA_BOOT_OK = 'main';
(function () {
  const $ = (s) => document.querySelector(s);
  const on = (el, ev, fn, opt)=> el && el.addEventListener(ev, fn, opt||{});

  // --------- Safe stubs ----------
  let ScoreSystem, SFXClass, Quests, Progress, VRInput;
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
  }

  // 🔹 Leaderboard
  let LeaderboardClass, board;
  async function loadLeaderboard(){
    try { ({ Leaderboard: LeaderboardClass } = await import('./core/leaderboard.js')); }
    catch { LeaderboardClass = class{ submit(){}, getTop(){return[]}, getRecent(){return[]}, getPersonalBest(){return null}, stats(){return{count:0,avg:0,max:0,min:0}}, exportJSON(){return'{}'}, importJSON(){return 0;} }; }
    board = new LeaderboardClass({ key:'hha_board_v2', maxKeep: 600, retentionDays: 365 });
  }

  // --------- Mode loader ----------
  const MODE_PATH = (k) => `./modes/${k}.js`;
  async function loadMode(key) {
    const mod = await import(MODE_PATH(key));
    return {
      name: mod.name || key,
      create: mod.create || null,
      init: mod.init || null,
      tick: mod.tick || null,
      pickMeta: mod.pickMeta || null,
      onHit: mod.onHit || null,
      cleanup: mod.cleanup || null,
      fx: mod.fx || {}
    };
  }

  // --------- HUD helpers ----------
  function setScore(v){ const el = $('#score'); if (el) el.textContent = v|0; }
  function setTime(v){ const el = $('#time'); if (el) el.textContent = v|0; }
  function showCoach(txt){ const hud=$('#coachHUD'); const t=$('#coachText'); if(t) t.textContent = txt||'Ready?'; if(hud){ hud.style.display='flex'; hud.classList.add('show'); } }
  function hideCoach(){ const hud=$('#coachHUD'); if(hud){ hud.classList.remove('show'); hud.style.display='none'; } }
  function toast(text){ let el = $('#toast'); if(!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
    el.textContent=text; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1200); }

  // --------- FX pop text ----------
  const FX = {
    popText(txt, { x, y, ms = 700 } = {}) {
      const el = document.createElement('div');
      el.textContent = txt;
      el.style.cssText = `position:fixed;left:${x|0}px;top:${y|0}px;transform:translate(-50%,-50%);
        font:900 16px ui-rounded,system-ui;color:#fff;text-shadow:0 2px 10px #000;pointer-events:none;z-index:97;
        opacity:1;transition: all .72s ease-out;`;
      document.body.appendChild(el);
      requestAnimationFrame(() => { el.style.top = (y - 36) + 'px'; el.style.opacity = '0'; });
      setTimeout(() => el.remove(), ms);
    }
  };

  // --------- Player name helpers ----------
  function getPlayerName(){
    try {
      const el = $('#playerName');
      const v = (el?.value || localStorage.getItem('hha_player_name') || '').trim();
      return v ? v.slice(0,24) : undefined;
    } catch { return undefined; }
  }
  function bindPlayerName(){
    const el = $('#playerName');
    if(!el) return;
    const saved = localStorage.getItem('hha_player_name') || '';
    if(saved && !el.value) el.value = saved;
    on(el,'change', ()=>{ try{ localStorage.setItem('hha_player_name', el.value.trim().slice(0,24)); }catch{} });
  }

  // --------- Engine loop ----------
  let R = { playing:false, startedAt:0, remain:45, raf:0, sys:{ score:null, sfx:null }, modeAPI:null, modeInst:null };
  function busFor(){ return {
    sfx: R.sys.sfx,
    hit(e){ if (e?.points) R.sys.score.add(e.points);
      setScore(R.sys.score.get?.() || R.sys.score.value || 0);
      try{ FX.popText(`+${e.points||0}`, e.ui||{}); }catch{}
      try{ Quests.event('hit',{result:e?.kind||'good',comboNow:0,meta:e?.meta||{}}); }catch{}
    },
    miss(){ /* no-op */ }
  };}

  function gameTick(){
    if (!R.playing) return;
    const now = performance.now();
    const secGone = Math.floor((now - R._secMark)/1000);
    if (secGone >= 1){
      R.remain = Math.max(0, (R.remain|0) - secGone);
      R._secMark = now; setTime(R.remain);
      try{ Quests.tick({ score: (R.sys.score.get?.()||0) }); }catch{}
    }
    try {
      if (R.modeInst && typeof R.modeInst.update === 'function') {
        const dt = (now - (R._dtMark||now)) / 1000; R._dtMark = now;
        R.modeInst.update(dt, busFor());
      } else if (R.modeAPI?.tick) {
        R.modeAPI.tick(R.state||{}, R.sys, R.hud||{});
      }
    } catch(e){ console.warn('[mode.update] error', e); }
    if (R.remain <= 0) return endGame(false);
    R.raf = requestAnimationFrame(gameTick);
  }

  // --------- Leaderboard UI renderers ----------
  function renderMiniTop({ mode, diff }){
    if(!board) return;
    const wrap = $('#miniTop'); const pbRow = $('#pbRow'); if(!wrap) return;
    const name = getPlayerName();

    const top = board.getTop(5, { mode, diff, since:'month', uniqueByUser:true });
    const recent = board.getRecent(5, { mode, diff });
    const pb = board.getPersonalBest({ mode, diff });

    if(pbRow){
      pbRow.textContent = pb
        ? `Personal Best (${mode}/${diff}) — ⭐ ${pb.score}  •  ${new Date(pb.t).toLocaleString()}${name?`  •  ${name}`:''}`
        : `ยังไม่มี Personal Best ในโหมดนี้`;
    }

    const mk = (rows, title)=>[
      `<div style="font:900 13px ui-rounded;margin:6px 0 4px">${title}</div>`,
      `<table style="width:100%;border-collapse:collapse;font:600 12px ui-rounded">`,
      `<thead><tr><th style="text-align:left;padding:6px;border-bottom:1px solid #19304e">#</th><th style="text-align:left;padding:6px;border-bottom:1px solid #19304e">Name</th><th style="text-align:left;padding:6px;border-bottom:1px solid #19304e">Mode/Diff</th><th style="text-align:right;padding:6px;border-bottom:1px solid #19304e">Score</th></tr></thead>`,
      `<tbody>`,
      ...rows.map((r,i)=>`<tr>
        <td style="padding:6px;border-bottom:1px solid #13243d">${i+1}</td>
        <td style="padding:6px;border-bottom:1px solid #13243d">${r.name||'-'}</td>
        <td style="padding:6px;border-bottom:1px solid #13243d">${r.mode}/${r.diff}</td>
        <td style="padding:6px;border-bottom:1px solid #13243d;text-align:right">${r.score}</td>
      </tr>`),
      `</tbody></table>`
    ].join('');

    wrap.innerHTML = mk(top, 'Top (This Month)') + mk(recent, 'Recent');
  }

  function openBoardModal(scope='week'){
    const box = $('#boardModal'); if(!box||!board) return;
    box.style.display='flex';
    const info = $('#lb_info'); const table = $('#lb_table');
    const mode = (window.__HHA_MODE || document.body.getAttribute('data-mode') || 'goodjunk');
    const diff = (window.__HHA_DIFF || document.body.getAttribute('data-diff') || 'Normal');

    const rows = board.getTop(50, { mode, diff, since: scope, uniqueByUser:true });
    info.textContent = `Mode: ${mode} / Diff: ${diff} • Scope: ${scope}`;
    table.innerHTML = `<table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #19304e">#</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #19304e">Name</th>
        <th style="text-align:left;padding:8px;border-bottom:1px solid #19304e">Time</th>
        <th style="text-align:right;padding:8px;border-bottom:1px solid #19304e">Score</th>
      </tr></thead>
      <tbody>
        ${rows.map((r,i)=>`<tr>
          <td style="padding:8px;border-bottom:1px solid #13243d">${i+1}</td>
          <td style="padding:8px;border-bottom:1px solid #13243d">${r.name||'-'}</td>
          <td style="padding:8px;border-bottom:1px solid #13243d">${new Date(r.t).toLocaleString()}</td>
          <td style="padding:8px;border-bottom:1px solid #13243d;text-align:right">${r.score}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  // --------- End/start ----------
  function endGame(){
    if (!R.playing) return;
    R.playing = false; cancelAnimationFrame(R.raf);

    const mode = (R.modeKey || document.body.getAttribute('data-mode') || 'goodjunk');
    const diff = (R.state?.difficulty || document.body.getAttribute('data-diff') || 'Normal');
    const score = (R.sys.score.get?.()||0);
    const name = getPlayerName();

    // ✓ save to leaderboard
    try { board?.submit(mode, diff, score, { name, meta:{ duration:45 } }); } catch {}

    // update UI
    const res = $('#result'); const txt = $('#resultText');
    if (txt) txt.textContent = `⭐ Score: ${score}  •  Mode: ${mode}  •  Diff: ${diff}`;
    renderMiniTop({ mode, diff });
    if (res) res.style.display = 'flex';

    try { Quests.endRun({ score }); } catch {}
    try { R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(R.state, R.hud); } catch {}
    document.body.removeAttribute('data-playing');
    $('#menuBar')?.removeAttribute('data-hidden');
    showCoach('Nice run!'); setTimeout(hideCoach, 1200);
    try { Progress.endRun({ score }); } catch {}
    window.HHA._busy = false;
  }

  async function startGame(){
    if (window.HHA?._busy) return; window.HHA._busy = true;
    await loadCore(); await loadLeaderboard(); bindPlayerName(); Progress.init?.();

    const modeKey = (window.__HHA_MODE || document.body.getAttribute('data-mode') || 'goodjunk');
    const diff = (window.__HHA_DIFF || document.body.getAttribute('data-diff') || 'Normal');

    // load mode
    let api;
    try { api = await loadMode(modeKey); }
    catch (e) { console.error('[HHA] Failed to load mode:', modeKey, e); toast(`Failed to load mode: ${modeKey}`); window.HHA._busy=false; return; }

    // systems
    R.sys.score = new (ScoreSystem||function(){})(); R.sys.score.reset?.();
    R.sys.sfx = new (SFXClass||function(){})(); setScore(0);

    // HUD
    const hud = {
      setTarget(g,have,need){
        const el = document.getElementById('targetBadge'); const wrap = document.getElementById('targetWrap');
        if (!el || !wrap) return;
        const nameTH = ({veggies:'ผัก', protein:'โปรตีน', grains:'ธัญพืช', fruit:'ผลไม้', dairy:'นม'})[g] || g;
        el.textContent = `${nameTH} • ${have|0}/${need|0}`; wrap.style.display='inline-flex';
      },
      dimPenalty(){ document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 120); }
    };
    try { Quests.bindToMain({ hud }); } catch {}

    // mode init (prefer factory)
    R.modeKey = modeKey; R.modeAPI = api; R.hud = hud;
    R.state = { difficulty: diff, lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(), ctx:{} };
    if (api.create){
      R.modeInst = api.create({ engine:{ fx:FX }, hud, coach:{
        onStart(){ showCoach('Go!'); setTimeout(hideCoach,800); },
        onGood(){}, onBad(){}, onPerfect(){ showCoach('Perfect!'); setTimeout(hideCoach,500); }
      }});
      R.modeInst.start?.();
    } else if (api.init){
      api.init(R.state, hud, { time:45, life:1600 });
      showCoach('Go!'); setTimeout(hideCoach,800);
    }

    try { Quests.beginRun(modeKey, diff, (R.state.lang||'TH'), 45); } catch {}
    try { Progress.beginRun(modeKey, diff, (R.state.lang||'TH')); } catch {}

    R.playing = true; R.startedAt = performance.now();
    R._secMark = performance.now(); R._dtMark = performance.now();
    R.remain = 45; setTime(R.remain);

    document.body.setAttribute('data-playing','1');
    $('#menuBar')?.setAttribute('data-hidden','1');
    R.raf = requestAnimationFrame(gameTick);
  }

  // expose
  window.HHA = window.HHA || {};
  window.HHA.startGame = startGame;
  window.HHA.endGame = endGame;

  // UI bindings for Leaderboard modal
  on($('#btn_board'), 'click', ()=> openBoardModal($('#lb_scope')?.value || 'week'));
  on($('#btn_open_board'), 'click', ()=> openBoardModal($('#lb_scope')?.value || 'week'));
  on($('#lb_close'), 'click', ()=>{ const m=$('#boardModal'); if(m) m.style.display='none'; });
  on($('#lb_scope'), 'change', (e)=> openBoardModal(e.target.value||'week'));

  // safety
  setTimeout(()=>{ const c = document.getElementById('c'); if(c){ c.style.pointerEvents='none'; c.style.zIndex='1'; } }, 0);
})();
