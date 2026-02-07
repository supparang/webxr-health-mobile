// === /herohealth/vr/hha-logger.js ===
// HHA Unified Logger — v1.0.0 (Classic)
// ✅ createSessionId + ctx from query
// ✅ pushEvent() + finalizeSession()
// ✅ toCSV(sessions/events) + downloadCSV()
// ✅ safe stringify + size guard
(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  const qs = (k,d='')=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const now = ()=>Date.now();

  function uid(){
    // short unique (time + rand)
    return 'S' + now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
  }

  function safeStr(v){
    if(v==null) return '';
    return String(v).replace(/\r?\n/g,' ').replace(/,/g,' ');
  }

  function safeJson(obj){
    try{ return JSON.stringify(obj); }catch(_){ return '{}'; }
  }

  function baseCtx(game){
    return {
      pid: qs('pid',''),
      studyId: qs('studyId',''),
      phase: qs('phase',''),
      conditionGroup: qs('conditionGroup',''),
      hub: qs('hub',''),
      log: qs('log',''),
      view: (qs('view','')||'').toLowerCase(),
      style: (qs('style','')||'').toLowerCase(),
      run: (qs('run','play')||'play').toLowerCase(),
      diff: (qs('diff','normal')||'normal').toLowerCase(),
      seed: qs('seed',''),
      time: Number(qs('time','0')||0) || 0,
      game: game || ''
    };
  }

  function create(game){
    const ctx = baseCtx(game);
    const sid = uid();
    const t0 = (performance && performance.now) ? performance.now() : now();

    const S = {
      sid,
      t0,
      ctx,
      startedAt: now(),
      endedAt: 0,
      events: [],
      session: null
    };

    function tMs(){
      const t = (performance && performance.now) ? performance.now() : now();
      return Math.max(0, Math.round(t - t0));
    }

    function push(type, data){
      const ev = Object.assign({
        ts: now(),
        sid,
        t_ms: tMs(),
        game: ctx.game,
        type: type || 'ev'
      }, (data && typeof data==='object') ? data : {});
      // keep event payload light
      if(ev.extra && typeof ev.extra==='object'){
        ev.extra_json = safeJson(ev.extra);
        delete ev.extra;
      }
      S.events.push(ev);
      return ev;
    }

    function finalize(summary){
      S.endedAt = now();
      const sum = summary && typeof summary==='object' ? summary : {};

      const session = {
        ts: S.endedAt,
        sid,
        pid: ctx.pid,
        game: ctx.game,
        run: (sum.run ?? ctx.run),
        diff: (sum.diff ?? ctx.diff),
        view: (sum.view ?? ctx.view),
        seed: (sum.seed ?? ctx.seed),

        time_planned_sec: Number(sum.time_planned_sec ?? ctx.time ?? sum.timeSec ?? sum.durationPlannedSec ?? 0) || 0,
        time_played_sec: Number(sum.time_played_sec ?? sum.durationPlayedSec ?? 0) || 0,

        score_final: Number(sum.score_final ?? sum.scoreFinal ?? sum.score ?? 0) || 0,
        grade: safeStr(sum.grade ?? ''),
        miss: Number(sum.miss ?? sum.misses ?? 0) || 0,
        combo_max: Number(sum.combo_max ?? sum.comboMax ?? sum.maxCombo ?? 0) || 0,
        accuracy_pct: Number(sum.accuracy_pct ?? sum.accuracyGoodPct ?? sum.accuracyPct ?? 0) || 0,

        mini_cleared: (sum.mini_cleared ?? sum.miniCleared) ? 1 : 0,
        boss_cleared: (sum.boss_cleared ?? sum.bossCleared) ? 1 : 0,

        studyId: ctx.studyId,
        phase: ctx.phase,
        conditionGroup: ctx.conditionGroup,

        meta_json: safeJson(sum.meta || sum)
      };

      S.session = session;
      return session;
    }

    function csvSessionsRow(sess){
      const cols = [
        'ts','sid','pid','game','run','diff','view','seed',
        'time_planned_sec','time_played_sec','score_final','grade','miss','combo_max',
        'accuracy_pct','mini_cleared','boss_cleared',
        'studyId','phase','conditionGroup','meta_json'
      ];
      return { cols, row: cols.map(k=> safeStr(sess[k])) };
    }

    function csvEventsRows(){
      const cols = [
        'ts','sid','t_ms','game','type','phase','kind',
        'group_id','group_key','x','y','lock_px',
        'score','water_pct','combo','msg','extra_json'
      ];
      const rows = S.events.map(ev => cols.map(k=> safeStr(ev[k])));
      return { cols, rows };
    }

    function toCSV(){
      if(!S.session) finalize({});
      const s = csvSessionsRow(S.session);
      const e = csvEventsRows();

      const out = [];
      out.push('### sessions');
      out.push(s.cols.join(','));
      out.push(s.row.join(','));
      out.push('');
      out.push('### events');
      out.push(e.cols.join(','));
      for(const r of e.rows) out.push(r.join(','));
      return out.join('\n');
    }

    function downloadCSV(filename){
      const text = toCSV();
      try{
        const blob = new Blob([text], { type:'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = DOC.createElement('a');
        a.href = url;
        a.download = filename || (`hha-${ctx.game}-${sid}.csv`);
        DOC.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(url), 1200);
      }catch(_){}
    }

    return {
      sid,
      ctx,
      push,
      finalize,
      toCSV,
      downloadCSV,
      _state: S
    };
  }

  WIN.HHA_Logger = { create };

})();