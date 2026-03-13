// === /webxr-health-mobile/herohealth/gate/gate-core.js ===
// HeroHealth Gate Core
// PATCH v20260313a-GATE-PHASE-COOLDOWN-FIX
// ✅ read ctx.mode from gate-common Phase parser
// ✅ warmup continue -> next
// ✅ cooldown continue -> hub
// ✅ strip gate params before continue
// ✅ extra logs for debugging flow
// ✅ keep Germ Detective special case

import {
  buildCtx,
  getDailyDone,
  setDailyDone,
  setText,
  sanitizeBuffs,
  saveLastSummary
} from './gate-common.js?v=20260313a';

import { mountSummaryLayer, mountToast } from './gate-summary.js?v=20260313a';
import { createGateLogger } from './gate-logger.js?v=20260313a';
import { GATE_GAMES, getGameMeta } from './gate-games.js?v=20260313a';

function titleOf(ctx){
  const meta = getGameMeta(ctx.game) || {
    label: ctx.game,
    warmupTitle: ctx.game,
    cooldownTitle: ctx.game
  };

  return ctx.mode === 'cooldown'
    ? `Cooldown — ${meta.label}`
    : `Warmup — ${meta.label}`;
}

function subtitleOf(ctx){
  const meta = getGameMeta(ctx.game) || { label: ctx.game };

  if(ctx.mode === 'warmup'){
    return `เตรียมความพร้อมก่อนเข้าเกม ${meta.label}`;
  }
  return `คูลดาวน์และสรุปก่อนออกจากเกม ${meta.label}`;
}

function modulePath(ctx){
  return `./games/${ctx.game}/${ctx.mode}.js?v=20260313a`;
}

function safeHubUrl(ctx){
  try{
    const u = new URL(ctx.hub || '../hub.html', location.href);
    [
      'gatePhase','phase','Phase','gateResult','gateMode',
      'wType','wPct','wSteps','wTimeBonus','wScoreBonus','wRank',
      'cd','next','wskip'
    ].forEach(k=>u.searchParams.delete(k));
    return u.toString();
  }catch(_){
    return '../hub.html';
  }
}

function appendResultParams(u, result){
  if(!result) return;

  const buffs = sanitizeBuffs(result?.buffs || {});
  Object.entries(buffs).forEach(([k, v])=>{
    u.searchParams.set(k, String(v));
  });

  u.searchParams.set('gateResult', result?.ok ? '1' : '0');
  u.searchParams.set('gateMode', String(result?.mode || 'warmup'));
}

function appendCommonParams(u, ctx, hub){
  if(ctx.run)  u.searchParams.set('run', String(ctx.run));
  if(ctx.diff) u.searchParams.set('diff', String(ctx.diff));
  if(ctx.time != null) u.searchParams.set('time', String(ctx.time));
  if(ctx.seed) u.searchParams.set('seed', String(ctx.seed));
  if(ctx.pid)  u.searchParams.set('pid', String(ctx.pid));
  if(ctx.view) u.searchParams.set('view', String(ctx.view));
  if(ctx.cat)  u.searchParams.set('zone', String(ctx.cat));
  u.searchParams.set('hub', hub);

  if(ctx.studyId) u.searchParams.set('studyId', String(ctx.studyId));
  if(ctx.conditionGroup) u.searchParams.set('conditionGroup', String(ctx.conditionGroup));
  if(ctx.sessionOrder) u.searchParams.set('sessionOrder', String(ctx.sessionOrder));
  if(ctx.blockLabel) u.searchParams.set('blockLabel', String(ctx.blockLabel));
  if(ctx.siteCode) u.searchParams.set('siteCode', String(ctx.siteCode));
  if(ctx.schoolYear) u.searchParams.set('schoolYear', String(ctx.schoolYear));
  if(ctx.semester) u.searchParams.set('semester', String(ctx.semester));
}

function coreParamsOf(ctx){
  return {
    mode: ctx.mode || '',
    game: ctx.game || '',
    cat: ctx.cat || '',
    pid: ctx.pid || 'anon',
    run: ctx.run || 'play',
    diff: ctx.diff || 'normal',
    time: ctx.time != null ? String(ctx.time) : '',
    view: ctx.view || 'mobile',
    seed: ctx.seed || '',
    hub: ctx.hub || '',
    next: ctx.next || '',
    Phase: ctx.Phase || '',
    gatePhase: ctx.gatePhase || '',
    phase: ctx.phase || ''
  };
}

function validateGateCtx(ctx){
  const missing = [];

  ['mode','game','cat','pid','run','diff','time','view'].forEach(k=>{
    const v = ctx[k];
    if(v == null || String(v).trim() === ''){
      missing.push(k);
    }
  });

  if(missing.length){
    console.warn('[gate-core] missing ctx keys:', missing, coreParamsOf(ctx));
  }else{
    console.log('[gate-core] ctx OK', coreParamsOf(ctx));
  }

  return missing;
}

function buildRawNextUrl(ctx, result=null){
  const hub = safeHubUrl(ctx);
  const game = String(ctx.game || '').toLowerCase();

  // Special case: Germ Detective
  if(game === 'germdetective'){
    const u = new URL('/webxr-health-mobile/herohealth/germ-detective/germ-detective-vr.html', location.origin);

    appendCommonParams(u, ctx, hub);

    if(!u.searchParams.get('scene')){
      u.searchParams.set('scene', 'classroom');
    }
    if(!u.searchParams.get('zone')){
      u.searchParams.set('zone', 'hygiene');
    }

    appendResultParams(u, result);

    console.log('[gate-core] germdetective direct vr run =', u.toString());
    return u.toString();
  }

  const rawNext = String(ctx.next || '').trim();
  if(rawNext){
    try{
      const u = new URL(rawNext, location.href);

      [
        'gatePhase','phase','Phase','gateResult','gateMode',
        'wType','wPct','wSteps','wTimeBonus','wScoreBonus','wRank',
        'cd','next','wskip'
      ].forEach(k=>u.searchParams.delete(k));

      if(/warmup-gate\.html$/i.test(u.pathname)){
        console.warn('[gate-core] next points back to warmup-gate -> fallback hub', u.toString());
        return hub;
      }

      appendCommonParams(u, ctx, hub);
      appendResultParams(u, result);
      return u.toString();
    }catch(err){
      console.error('[gate-core] invalid next', rawNext, err);
    }
  }

  console.warn('[gate-core] no usable next, fallback hub =', hub, coreParamsOf(ctx));
  return hub;
}

function renderShell(root, ctx){
  root.innerHTML = `
    <div class="gate-shell">
      <div class="gate-card">
        <section class="gate-head">
          <div class="gate-title-row">
            <div class="gate-badge-logo">HH</div>
            <div class="gate-title-wrap">
              <h1 class="gate-title" id="gateTitle">${titleOf(ctx)}</h1>
              <div class="gate-subtitle" id="gateSubtitle">${subtitleOf(ctx)}</div>
            </div>
          </div>

          <div class="gate-pills">
            <div class="gate-pill">PHASE: ${ctx.mode.toUpperCase()}</div>
            <div class="gate-pill">CAT: ${ctx.cat.toUpperCase()}</div>
            <div class="gate-pill">GAME: ${ctx.game.toUpperCase()}</div>
            <div class="gate-pill" id="gateDailyPill">DAILY: ${ctx.dailyDone ? 'DONE' : 'NEW'}</div>
          </div>
        </section>

        <section class="gate-stats">
          <div class="gate-stat">
            <div class="gate-stat-k">TIME</div>
            <div class="gate-stat-v" id="hudTime">${ctx.time}s</div>
          </div>
          <div class="gate-stat">
            <div class="gate-stat-k">SCORE</div>
            <div class="gate-stat-v" id="hudScore">0</div>
          </div>
          <div class="gate-stat">
            <div class="gate-stat-k">MISS</div>
            <div class="gate-stat-v" id="hudMiss">0</div>
          </div>
          <div class="gate-stat">
            <div class="gate-stat-k">ACC / PROGRESS</div>
            <div class="gate-stat-v" id="hudAcc">0%</div>
          </div>
        </section>

        <div id="gateDailyAction" class="hidden" style="padding:12px 16px 0;">
          <div style="padding:14px;border-radius:18px;border:1px solid rgba(148,163,184,.14);background:rgba(2,6,23,.45);">
            <div style="font-weight:900;margin-bottom:6px;">วันนี้คุณเคยเล่นส่วนนี้แล้ว</div>
            <div style="color:#94a3b8;font-size:13px;margin-bottom:10px;">
              จะเล่นซ้ำเพื่อฝึกเพิ่ม หรือข้ามไปต่อเลยก็ได้
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <button class="btn btn-ghost" id="gateReplayBtn">เล่นซ้ำ</button>
              <button class="btn btn-primary" id="gateSkipBtn">ข้ามไปต่อ</button>
            </div>
          </div>
        </div>

        <section class="gate-stage">
          <div class="gate-play" id="gatePlay"></div>
        </section>

        <div class="gate-footer">
          <button class="btn btn-ghost" id="gateBackBtn">กลับ HUB</button>
        </div>
      </div>
    </div>
  `;
}

export async function bootGate(root){
  console.log('[gate-core] v20260313a running');

  const ctx = buildCtx();
  ctx.dailyDone = getDailyDone(ctx);

  console.log('[gate-core] ctx raw =', ctx);
  console.log('[gate-core] ctx.mode =', ctx.mode);
  console.log('[gate-core] ctx.Phase =', ctx.Phase);
  console.log('[gate-core] ctx.gatePhase =', ctx.gatePhase);
  console.log('[gate-core] ctx.phase =', ctx.phase);
  console.log('[gate-core] ctx.next =', ctx.next);
  console.log('[gate-core] ctx.hub =', ctx.hub);

  validateGateCtx(ctx);
  renderShell(root, ctx);

  const playEl = document.getElementById('gatePlay');
  const summary = mountSummaryLayer(document.body);
  const toast = mountToast(document.body);
  const logger = createGateLogger(ctx);

  const stats = {
    time: document.getElementById('hudTime'),
    score: document.getElementById('hudScore'),
    miss: document.getElementById('hudMiss'),
    acc: document.getElementById('hudAcc')
  };

  const dailyAction = document.getElementById('gateDailyAction');
  const replayBtn = document.getElementById('gateReplayBtn');
  const skipBtn = document.getElementById('gateSkipBtn');

  const api = {
    ctx,
    logger,
    toast,
    setStats(patch={}){
      if(patch.time != null) setText(stats.time, `${patch.time}s`);
      if(patch.score != null) setText(stats.score, patch.score);
      if(patch.miss != null) setText(stats.miss, patch.miss);
      if(patch.acc != null) setText(stats.acc, patch.acc);
    },
    finish(result={}){
      const finalResult = {
        ok: !!result.ok,
        mode: ctx.mode,
        title: result.title || (ctx.mode === 'warmup' ? 'พร้อมแล้ว!' : 'คูลดาวน์เสร็จแล้ว'),
        subtitle: result.subtitle || 'ไปต่อได้เลย',
        lines: Array.isArray(result.lines) ? result.lines : [],
        buffs: sanitizeBuffs(result.buffs || {}),
        markDailyDone: result.markDailyDone !== false
      };

      logger.push('finish', finalResult);
      logger.flush(finalResult);

      if(finalResult.markDailyDone){
        setDailyDone(ctx, true);
      }

      saveLastSummary({
        ts: new Date().toISOString(),
        game: ctx.game,
        cat: ctx.cat,
        mode: ctx.mode,
        result: finalResult
      });

      summary.show({
        title: finalResult.title,
        subtitle: finalResult.subtitle,
        lines: finalResult.lines,
        onBack: ()=>{
          const hubUrl = ctx.hub || '../hub.html';
          console.log('[gate-core] onBack -> hub', hubUrl, coreParamsOf(ctx));
          location.replace(hubUrl);
        },
        onContinue: ()=>{
          if(ctx.mode === 'warmup'){
            const nextUrl = buildRawNextUrl(ctx, finalResult);
            console.log('[gate-core] warmup continue ->', nextUrl, coreParamsOf(ctx));
            location.replace(nextUrl);
            return;
          }

          const hubUrl = ctx.hub || '../hub.html';
          console.log('[gate-core] cooldown continue -> hub', hubUrl, coreParamsOf(ctx));
          location.replace(hubUrl);
        }
      });
    }
  };

  document.getElementById('gateBackBtn')?.addEventListener('click', ()=>{
    const hubUrl = ctx.hub || '../hub.html';
    console.log('[gate-core] back btn -> hub', hubUrl, coreParamsOf(ctx));
    location.replace(hubUrl);
  });

  async function loadModuleNow(){
    try{
      logger.push('boot', {
        modulePath: modulePath(ctx),
        dailyDone: ctx.dailyDone,
        gameKnown: !!GATE_GAMES[ctx.game],
        game: ctx.game || '',
        theme: ctx.theme || '',
        next: ctx.next || '',
        hub: ctx.hub || '',
        mode: ctx.mode || '',
        rawNextResolved: buildRawNextUrl(ctx),
        safeHub: safeHubUrl(ctx)
      });

      const mod = await import(modulePath(ctx));

      if(!mod || typeof mod.mount !== 'function'){
        throw new Error(`Module missing mount(): ${modulePath(ctx)}`);
      }

      if(typeof mod.loadStyle === 'function'){
        mod.loadStyle();
      }

      const controller = await mod.mount(playEl, ctx, api);
      if(controller && typeof controller.start === 'function'){
        controller.start();
      }
    }catch(err){
      console.error(err);
      playEl.innerHTML = `
        <div style="padding:22px;">
          <h2 style="margin:0 0 8px;">โหลดมินิเกมไม่สำเร็จ</h2>
          <p style="margin:0;color:#94a3b8;">
            ไม่พบโมดูลของเกม ${ctx.game} โหมด ${ctx.mode}
          </p>
          <p style="margin:8px 0 0;color:#cbd5e1;font-size:13px;">
            expected: ${modulePath(ctx)}
          </p>
        </div>
      `;
      toast('โหลด gate module ไม่สำเร็จ');
    }
  }

  let shouldAutoLoadModule = true;

  if(ctx.mode === 'warmup' && ctx.dailyDone){
    dailyAction?.classList.remove('hidden');
    shouldAutoLoadModule = false;

    replayBtn?.addEventListener('click', async ()=>{
      dailyAction?.classList.add('hidden');
      await loadModuleNow();
    });

    skipBtn?.addEventListener('click', ()=>{
      const nextUrl = buildRawNextUrl(ctx);
      console.log('[gate-core] warmup skip ->', nextUrl, coreParamsOf(ctx));
      location.replace(nextUrl);
    });
  }

  if(shouldAutoLoadModule){
    await loadModuleNow();
  }
}