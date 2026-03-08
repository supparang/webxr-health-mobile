import { buildCtx, getDailyDone, setDailyDone, setText } from './gate-common.js?v=20260308a';
import { mountSummaryLayer, mountToast } from './gate-summary.js?v=20260308a';
import { createGateLogger } from './gate-logger.js?v=20260308a';

function titleOf(ctx){
  const m = ctx.mode === 'cooldown' ? 'Cooldown' : 'Warmup';
  const g = ctx.game.charAt(0).toUpperCase() + ctx.game.slice(1);
  return `${m} — ${g}`;
}

function subtitleOf(ctx){
  if(ctx.mode === 'warmup') return `เตรียมความพร้อมก่อนเข้าเกม ${ctx.game}`;
  return `คูลดาวน์และสรุปก่อนออกจากเกม ${ctx.game}`;
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

function modulePath(ctx){
  return `./games/${ctx.game}/${ctx.mode}.js?v=20260308a`;
}

function appendResultToNext(nextUrl, result){
  const u = new URL(nextUrl, location.href);
  const buffs = result?.buffs || {};
  Object.entries(buffs).forEach(([k,v])=>{
    if(v != null) u.searchParams.set(k, String(v));
  });
  u.searchParams.set('gateResult', result?.ok ? '1' : '0');
  u.searchParams.set('gateMode', String(result?.mode || ''));
  return u.toString();
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
        buffs: result.buffs || {},
        markDailyDone: result.markDailyDone !== false
      };

      logger.push('finish', finalResult);
      logger.flush(finalResult);

      if(finalResult.markDailyDone) setDailyDone(ctx, true);

      summary.show({
        title: finalResult.title,
        subtitle: finalResult.subtitle,
        lines: finalResult.lines,
        onBack: ()=>{
          location.href = ctx.hub;
        },
        onContinue: ()=>{
          if(ctx.mode === 'warmup' && ctx.next){
            location.href = appendResultToNext(ctx.next, finalResult);
            return;
          }
          location.href = ctx.hub;
        }
      });
    }
  };

  document.getElementById('gateBackBtn')?.addEventListener('click', ()=>{
    location.href = ctx.hub;
  });

  try{
    logger.push('boot', { modulePath: modulePath(ctx), dailyDone: ctx.dailyDone });

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
      </div>
    `;
    toast('โหลด gate module ไม่สำเร็จ');
  }
}
