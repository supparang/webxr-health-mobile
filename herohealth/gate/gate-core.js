// === /herohealth/gate/gate-core.js ===
// HeroHealth Gate Core
// FULL PATCH v20260314c-GATE-CORE-DAILY-DONE-STATUS

import {
  buildCtx,
  getDailyDone,
  setDailyDone,
  saveLastSummary
} from './gate-common.js?v=20260314a';

import { mountSummaryLayer, mountToast } from './gate-summary.js?v=20260313c';
import { createGateLogger } from './gate-logger.js?v=20260313b-GATE-LOGGER-PUSH-FIX';
import {
  getGameMeta,
  getPhaseFile,
  getGameStyleFile,
  normalizeGameId
} from './gate-games.js?v=20260314b';

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function delay(ms){
  return new Promise(resolve => setTimeout(resolve, ms));
}

function qs(url, key, fallback = '') {
  try {
    return url.searchParams.get(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function qbool(url, key, fallback = false) {
  const v = String(qs(url, key, fallback ? '1' : '0')).toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(v);
}

function safeUrl(raw, fallback = '') {
  try {
    if (!raw) return fallback;
    return new URL(raw, window.location.href).toString();
  } catch {
    return fallback;
  }
}

function setText(el, text=''){
  if(el) el.textContent = String(text ?? '');
}

function statusTitle(ctx){
  return ctx.mode === 'cooldown'
    ? 'วันนี้ทำ Cooldown แล้ว ✅'
    : 'วันนี้ทำ Warmup แล้ว ✅';
}

function statusSubtitle(ctx){
  return ctx.mode === 'cooldown'
    ? 'กำลังกลับหน้าหลัก...'
    : 'กำลังเข้าเกมหลัก...';
}

function titleOf(ctx){
  const meta = getGameMeta(ctx.game) || {
    label: ctx.game,
    warmupTitle: ctx.game,
    cooldownTitle: ctx.game
  };

  return ctx.mode === 'cooldown'
    ? (meta.cooldownTitle || `${meta.label} Cooldown`)
    : (meta.warmupTitle || `${meta.label} Warmup`);
}

function fallbackRunOf(ctx){
  const meta = getGameMeta(ctx.game);
  return safeUrl(meta?.run || '../hub.html', '../hub.html');
}

function nextUrlOf(ctx){
  if(ctx.mode === 'cooldown'){
    return safeUrl(ctx.next || ctx.hub || '../hub.html', '../hub.html');
  }
  return safeUrl(ctx.next || fallbackRunOf(ctx), fallbackRunOf(ctx));
}

function applyStyleFile(styleFile){
  if(!styleFile) return;
  const href = safeUrl(styleFile, '');
  if(!href) return;

  const id = `gate-style-${btoa(href).replace(/[^a-zA-Z0-9]/g,'').slice(0,24)}`;
  if(document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function renderShell(app, ctx){
  const meta = getGameMeta(ctx.game) || {
    label: ctx.game,
    warmupTitle: ctx.game,
    cooldownTitle: ctx.game,
    cat: ctx.cat || '-'
  };

  const phaseTitle = titleOf(ctx);
  const phaseText = ctx.mode === 'cooldown' ? 'cooldown' : 'warmup';

  app.innerHTML = `
    <div class="gate-wrap">
      <section class="gate-hero">
        <div class="gate-kicker">${esc(String(phaseText).toUpperCase())}</div>
        <h1 class="gate-title">${esc(phaseTitle)}</h1>
        <div class="gate-sub" id="gateSub">เตรียมมินิเกม...</div>

        <div class="gate-meta">
          <div><b>PHASE:</b> ${esc(phaseText)}</div>
          <div><b>CAT:</b> ${esc(meta.cat || ctx.cat || '-')}</div>
          <div><b>GAME:</b> ${esc(meta.label || ctx.game || '-')}</div>
          <div><b>DAILY:</b> <span id="gateDailyState">CHECKING</span></div>
        </div>
      </section>

      <section class="gate-stats">
        <div class="gate-stat">
          <div class="gate-stat-k">TIME</div>
          <div class="gate-stat-v" id="statTime">0s</div>
        </div>
        <div class="gate-stat">
          <div class="gate-stat-k">SCORE</div>
          <div class="gate-stat-v" id="statScore">0</div>
        </div>
        <div class="gate-stat">
          <div class="gate-stat-k">MISS</div>
          <div class="gate-stat-v" id="statMiss">0</div>
        </div>
        <div class="gate-stat">
          <div class="gate-stat-k">ACC / PROGRESS</div>
          <div class="gate-stat-v" id="statAcc">0%</div>
        </div>
      </section>

      <section class="gate-main">
        <div class="gate-loading" id="gateLoading">
          กำลังโหลดมินิเกม...<br>
          <code>${esc(getPhaseFile(ctx.game, ctx.mode))}</code>
        </div>
        <div id="gateGameMount"></div>
      </section>
    </div>
  `;
}

function renderAlreadyDoneCard(app, ctx){
  const title = statusTitle(ctx);
  const sub = statusSubtitle(ctx);

  app.innerHTML = `
    <div class="gate-wrap">
      <section class="gate-skip-card">
        <div class="gate-skip-badge">DAILY DONE</div>
        <h2 class="gate-skip-title">${esc(title)}</h2>
        <div class="gate-skip-sub">${esc(sub)}</div>
      </section>
    </div>
  `;
}

function ensureInlineSkipStyle(){
  const id = 'gate-inline-skip-style';
  if(document.getElementById(id)) return;

  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    .gate-skip-card{
      max-width: 720px;
      margin: 6vh auto 0;
      border: 1px solid rgba(148,163,184,.18);
      border-radius: 22px;
      background: rgba(2,6,23,.72);
      box-shadow: 0 22px 80px rgba(0,0,0,.35);
      padding: 20px 18px;
      text-align: center;
    }
    .gate-skip-badge{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:32px;
      padding:6px 12px;
      border-radius:999px;
      border:1px solid rgba(34,197,94,.26);
      background:rgba(34,197,94,.12);
      color:#dcfce7;
      font-size:12px;
      font-weight:1000;
    }
    .gate-skip-title{
      margin:12px 0 8px;
      font-size:clamp(24px,4vw,36px);
      line-height:1.12;
      font-weight:1000;
    }
    .gate-skip-sub{
      color:rgba(148,163,184,.95);
      font-size:14px;
      font-weight:900;
      line-height:1.5;
    }
  `;
  document.head.appendChild(style);
}

function makeApi(app, logger){
  const statTime = app.querySelector('#statTime');
  const statScore = app.querySelector('#statScore');
  const statMiss = app.querySelector('#statMiss');
  const statAcc = app.querySelector('#statAcc');
  const gateSub = app.querySelector('#gateSub');
  const dailyState = app.querySelector('#gateDailyState');

  const api = {
    logger,
    setStats(v = {}){
      if('time' in v) setText(statTime, `${v.time ?? 0}s`);
      if('score' in v) setText(statScore, `${v.score ?? 0}`);
      if('miss' in v) setText(statMiss, `${v.miss ?? 0}`);
      if('acc' in v) setText(statAcc, `${v.acc ?? '0%'}`);
    },
    setSub(text=''){
      setText(gateSub, text);
    },
    setDailyState(text=''){
      setText(dailyState, text);
    },
    finish(payload = {}){
      api.__finish?.(payload);
    }
  };

  return api;
}

async function importPhaseModule(ctx){
  const file = getPhaseFile(ctx.game, ctx.mode);
  if(!file) throw new Error(`No phase file for game=${ctx.game} mode=${ctx.mode}`);
  const abs = safeUrl(file, '');
  if(!abs) throw new Error(`Invalid phase file URL: ${file}`);
  return import(abs);
}

function buildNextWithBuffs(nextUrl, buffs){
  try{
    const u = new URL(nextUrl, window.location.href);
    const map = buffs || {};
    Object.keys(map).forEach(k=>{
      const v = map[k];
      if(v !== undefined && v !== null && v !== ''){
        u.searchParams.set(k, String(v));
      }
    });
    return u.toString();
  }catch{
    return nextUrl;
  }
}

async function runGate(app){
  ensureInlineSkipStyle();

  const ctx = buildCtx(new URL(window.location.href));
  ctx.game = normalizeGameId(ctx.game || ctx.theme || '');

  const logger = createGateLogger(ctx);
  const nextUrl = nextUrlOf(ctx);

  renderShell(app, ctx);

  const api = makeApi(app, logger);
  const dailyKeyStateEl = app.querySelector('#gateDailyState');
  const loadingEl = app.querySelector('#gateLoading');
  const mountEl = app.querySelector('#gateGameMount');

  try{
    logger?.push?.('gate_open', {
      game: ctx.game,
      mode: ctx.mode,
      pid: ctx.pid || 'anon',
      next: nextUrl
    });
  }catch(_){}

  const styleFile = getGameStyleFile(ctx.game);
  applyStyleFile(styleFile);

  const alreadyDone = !!getDailyDone(ctx);

  if(dailyKeyStateEl){
    setText(dailyKeyStateEl, alreadyDone ? 'DONE' : 'NEW');
  }

  if(alreadyDone){
    renderAlreadyDoneCard(app, ctx);

    try{
      logger?.push?.('gate_already_done', {
        game: ctx.game,
        mode: ctx.mode,
        pid: ctx.pid || 'anon'
      });
    }catch(_){}

    await delay(1200);
    window.location.href = nextUrl;
    return;
  }

  let instance = null;
  let finished = false;

  api.__finish = async (payload = {})=>{
    if(finished) return;
    finished = true;

    try{
      instance?.destroy?.();
    }catch(_){}

    const summary = {
      ok: !!payload.ok,
      game: ctx.game,
      mode: ctx.mode,
      title: payload.title || (ctx.mode === 'cooldown' ? 'เสร็จแล้ว!' : 'พร้อมแล้ว!'),
      subtitle: payload.subtitle || '',
      lines: Array.isArray(payload.lines) ? payload.lines : [],
      buffs: payload.buffs || {},
      markDailyDone: payload.markDailyDone !== false,
      ctx
    };

    if(summary.markDailyDone){
      try{ setDailyDone(ctx, 1); }catch(_){}
    }

    try{
      saveLastSummary(ctx, summary);
    }catch(_){}

    try{
      logger?.push?.('gate_finish', {
        game: ctx.game,
        mode: ctx.mode,
        ok: summary.ok ? 1 : 0,
        buffs: summary.buffs || {}
      });
    }catch(_){}

    const dest = buildNextWithBuffs(nextUrl, summary.buffs || {});

    mountSummaryLayer({
      title: summary.title,
      subtitle: summary.subtitle,
      lines: summary.lines,
      primaryLabel: ctx.mode === 'cooldown' ? 'กลับหน้าหลัก' : 'ไปต่อ',
      onPrimary: ()=>{
        window.location.href = dest;
      }
    });
  };

  try{
    api.setSub('กำลังโหลดมินิเกม...');
    const mod = await importPhaseModule(ctx);

    if(loadingEl) loadingEl.remove();

    const mount =
      mod?.mount ||
      mod?.default?.mount ||
      mod?.default ||
      null;

    if(typeof mount !== 'function'){
      throw new Error(`Phase module has no mount() for game=${ctx.game} mode=${ctx.mode}`);
    }

    api.setSub('พร้อมแล้ว');
    instance = await mount(mountEl, ctx, api);

    try{
      logger?.push?.('gate_mount_ok', {
        game: ctx.game,
        mode: ctx.mode
      });
    }catch(_){}

    if(instance && typeof instance.start === 'function'){
      try{
        instance.start();
      }catch(err){
        console.error('[gate-core] start() failed', err);
      }
    }

  } catch (err) {
    console.error('[gate-core] failed to load phase module', err);

    try{
      logger?.push?.('gate_error', {
        game: ctx.game,
        mode: ctx.mode,
        error: String(err?.message || err || 'unknown')
      });
    }catch(_){}

    mountToast?.(`โหลดมินิเกมไม่สำเร็จ: ${err?.message || err}`);

    app.querySelector('#gateGameMount')?.replaceChildren();
    if(app.querySelector('#gateLoading')){
      app.querySelector('#gateLoading').innerHTML = `
        โหลดมินิเกมไม่สำเร็จ<br>
        <code>${esc(String(err?.message || err || 'unknown error'))}</code>
      `;
    } else {
      const fail = document.createElement('div');
      fail.className = 'gate-loading';
      fail.innerHTML = `โหลดมินิเกมไม่สำเร็จ<br><code>${esc(String(err?.message || err || 'unknown error'))}</code>`;
      app.appendChild(fail);
    }
  }
}

const app = document.getElementById('gate-app');
if(app){
  runGate(app);
}