// === /herohealth/gate/gate-core.js ===
// HeroHealth Gate Core
// PATCH v20260308-HYGIENE-GATE-CORE-r3
// ✅ game registry
// ✅ daily skip
// ✅ expected path debug
// ✅ sanitize buffs
// ✅ save last summary
// ✅ safer next/hub handling
// ✅ FIX: prevent warmup loop by sanitizing next/hub URLs
// ✅ FIX: skip/continue now always use safeNextUrl()
// ✅ FIX: GermDetective next path rewrite to real game file

import {
  buildCtx,
  getDailyDone,
  setDailyDone,
  setText,
  sanitizeBuffs,
  saveLastSummary
} from './gate-common.js?v=20260308b';

import { mountSummaryLayer, mountToast } from './gate-summary.js?v=20260308a';
import { createGateLogger } from './gate-logger.js?v=20260308a';
import { GATE_GAMES, getGameMeta } from './gate-games.js?v=20260308b';

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
  return `./games/${ctx.game}/${ctx.mode}.js?v=20260308a`;
}

function safeHubUrl(ctx){
  try{
    const u = new URL(ctx.hub || '../hub.html', location.href);
    [
      'gatePhase','phase','gateResult','gateMode',
      'wType','wPct','wSteps','wTimeBonus','wScoreBonus','wRank',
      'cd','next'
    ].forEach(k=>u.searchParams.delete(k));
    return u.toString();
  }catch{
    return '../hub.html';
  }
}

function safeNextUrl(ctx, result=null){
  const hub = safeHubUrl(ctx);
  const raw = String(ctx.next || '').trim();
  if(!raw) return hub;

  try{
    let u = new URL(raw, location.href);

    // กันการวนกลับเข้า gate เอง
    if(/warmup-gate\.html$/i.test(u.pathname)){
      return hub;
    }

    // FIX เฉพาะ Germ Detective:
    // ถ้า next ยังชี้ launcher root ให้ rewrite ไปหน้าเกมจริงทันที
    if(
      String(ctx.game || '').toLowerCase() === 'germdetective' &&
      /\/herohealth\/germ-detective\.html$/i.test(u.pathname)
    ){
      u = new URL('/webxr-health-mobile/herohealth/germ-detective/germ-detective.html', location.origin);
    }

    // ลบ query ของ gate ออกจากปลายทาง
    [
      'gatePhase','phase','gateResult','gateMode',
      'wType','wPct','wSteps','wTimeBonus','wScoreBonus','wRank',
      'cd','next'
    ].forEach(k=>u.searchParams.delete(k));

    // ใส่ hub ที่สะอาดกลับเข้าเกมปลายทาง
    u.searchParams.set('hub', hub);

    // คงค่าพื้นฐานให้หน้าเกม
    if(ctx.run)  u.searchParams.set('run', String(ctx.run));
    if(ctx.diff) u.searchParams.set('diff', String(ctx.diff));
    if(ctx.time != null) u.searchParams.set('time', String(ctx.time));
    if(ctx.seed) u.searchParams.set('seed', String(ctx.seed));
    if(ctx.pid)  u.searchParams.set('pid', String(ctx.pid));
    if(ctx.view) u.searchParams.set('view', String(ctx.view));

    // game-specific defaults
    if(String(ctx.game || '').toLowerCase() === 'germdetective' && !u.searchParams.get('scene')){
      u.searchParams.set('scene', 'classroom');
    }

    // research context passthrough
    if(ctx.studyId) u.searchParams.set('studyId', String(ctx.studyId));
    if(ctx.phase) u.searchParams.set('phase', String(ctx.phase));
    if(ctx.conditionGroup) u.searchParams.set('conditionGroup', String(ctx.conditionGroup));
    if(ctx.sessionOrder) u.searchParams.set('sessionOrder', String(ctx.sessionOrder));
    if(ctx.blockLabel) u.searchParams.set('blockLabel', String(ctx.blockLabel));
    if(ctx.siteCode) u.searchParams.set('siteCode', String(ctx.siteCode));
    if(ctx.schoolYear) u.searchParams.set('schoolYear', String(ctx.schoolYear));
    if(ctx.semester) u.searchParams.set('semester', String(ctx.semester));

    if(result){
      const buffs = sanitizeBuffs(result?.buffs || {});
      Object.entries(buffs).forEach(([k,v])=>{
        u.searchParams.set(k, String(v));
      });
      u.searchParams.set('gateResult', result?.ok ? '1' : '0');
      u.searchParams.set('gateMode', String(result?.mode || ''));
    }

    return u.toString();
  }catch{
    return hub;
  }
}

function appendResultToNext(ctx, result){
  return safeNextUrl(ctx, result);
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
          <div class="gate-stat"><div class="gate-stat-k">TIME</div><div class="gate-stat-v" id="hudTime">${ctx.time}s</div></div>
          <div class="gate-stat"><div class="gate-stat-k">SCORE</div><div class="gate-stat-v" id="hudScore">0</div></div>
          <div class="gate-stat"><div class="gate-stat-k">MISS</div><div class="gate-stat-v" id="hudMiss">0</div></div>
          <div class="gate-stat"><div class="gate-stat-k">ACC / PROGRESS</div><div class="gate-stat-v" id="hudAcc">0%</div></div>
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
  const ctx = buildCtx();
  ctx.dailyDone = getDailyDone(ctx);

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
          location.href = safeHubUrl(ctx);
        },
        onContinue: ()=>{
          if(ctx.mode === 'warmup'){
            location.href = appendResultToNext(ctx, finalResult);
            return;
          }
          location.href = safeHubUrl(ctx);
        }
      });
    }
  };

  document.getElementById('gateBackBtn')?.addEventListener('click', ()=>{
    location.href = safeHubUrl(ctx);
  });

  async function loadModuleNow(){
    try{
      logger.push('boot', {
        modulePath: modulePath(ctx),
        dailyDone: ctx.dailyDone,
        gameKnown: !!GATE_GAMES[ctx.game],
        next: ctx.next || '',
        hub: ctx.hub || '',
        safeNext: safeNextUrl(ctx),
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
      location.href = safeNextUrl(ctx);
    });
  }

  if(shouldAutoLoadModule){
    await loadModuleNow();
  }
}