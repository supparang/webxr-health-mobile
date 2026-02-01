// === /fitness/js/rhythm-engine.js — Rhythm Boxer Engine (with Research lock + AI bridge + cVR side hit) ===
'use strict';

(function(){
  // ---- helpers ----
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const clamp01 = (v)=>Math.max(0, Math.min(1, Number(v)||0));
  const lerp = (a,b,t)=>a+(b-a)*t;

  function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }

  function detectDeviceType(){
    const ua = (navigator.userAgent||"").toLowerCase();
    const isMobile = /android|iphone|ipad|ipod/.test(ua);
    return isMobile ? "mobile" : "pc";
  }

  function detectView(){
    try{
      const v = (new URL(location.href).searchParams.get("view")||"").toLowerCase();
      if(v === "cvr" || v === "cardboard" || v === "vr-cardboard") return "cvr";
      return v || "";
    }catch(_){
      return "";
    }
  }

  // Cardboard/cVR UX: compress 5 lanes -> 3 lanes (L / C / R)
  // Mapping: 0..1 => 1 (L), 2 => 2 (C), 3..4 => 3 (R)
  function mapLaneForCvr(lane){
    lane = Number(lane)||0;
    if (lane <= 1) return 1;
    if (lane === 2) return 2;
    return 3;
  }

  function sideOfLane(lane){
    lane = Number(lane)||0;
    if (lane <= 1) return "L";
    if (lane === 2) return "C";
    return "R";
  }

  // ---- AIPredictor wrapper ----
  class RB_AIPredictor {
    constructor(){
      this.last = null;
    }
    update(snapshot){
      if (window.RB_AI && typeof window.RB_AI.predict === 'function'){
        this.last = window.RB_AI.predict(snapshot || {});
        return this.last;
      }
      this.last = { fatigueRisk:0, skillScore:0.5, suggestedDifficulty:"normal", tip:"" };
      return this.last;
    }
    isLocked(){
      try{ return !!(window.RB_AI && window.RB_AI.isLocked && window.RB_AI.isLocked()); }catch(_){ return false; }
    }
    isAssistEnabled(){
      try{ return !!(window.RB_AI && window.RB_AI.isAssistEnabled && window.RB_AI.isAssistEnabled()); }catch(_){ return false; }
    }
  }

  // ---- Engine ----
  class RhythmBoxerEngine {
    constructor(opts){
      this.wrap = opts.wrap;
      this.field = opts.field;
      this.lanesEl = opts.lanesEl;
      this.audio = opts.audio;
      this.renderer = opts.renderer;
      this.hud = opts.hud || {};
      this.hooks = opts.hooks || {};

      this.deviceType = detectDeviceType();
      this.view = detectView();               // '' | 'cvr' | ...
      this.useSideHit = (this.view === "cvr"); // cVR uses side (L/C/R) hit logic

      this.ai = new RB_AIPredictor();

      this.running = false;
      this.mode = "normal";
      this.trackId = "n1";
      this.meta = {};
      this.notes = [];
      this.events = [];
      this.sessionRow = null;

      this.songTime = 0;
      this.startPerf = 0;
      this.endPerf = 0;

      // stats
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;
      this.hp = 100;
      this.shield = 0;
      this.fever = 0; // 0..1
      this.feverOn = false;

      this.offsetList = []; // signed offsets (sec)
      this.offsetAbsList = [];

      // chart state
      this.chart = [];
      this.chartIndex = 0;
      this.durationSec = 0;
      this.endReason = "completed";

      // config
      this.PRE_SPAWN_SEC = 1.35;  // note starts falling before hit-line time
      this.JUDGE_WINDOWS = {
        perfect: 0.060,
        great:   0.095,
        good:    0.135
      };

      // input
      this._bindLanePointer();

      this._raf = null;
      this._tick = this._tick.bind(this);
    }

    _bindLanePointer(){
      if(!this.lanesEl) return;
      this.lanesEl.addEventListener("pointerdown", (e)=>{
        const laneEl = e.target && e.target.closest ? e.target.closest(".rb-lane") : null;
        if(!laneEl) return;
        const lane = Number(laneEl.getAttribute("data-lane"));
        if(!Number.isFinite(lane)) return;
        this.handleLaneTap(lane);
      }, { passive:true });
    }

    start(mode, trackId, meta){
      this.stop("restart");

      this.mode = (mode === "research") ? "research" : "normal";
      this.trackId = trackId || "n1";
      this.meta = meta || {};

      // reset stats
      this.score = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.hitPerfect = 0;
      this.hitGreat = 0;
      this.hitGood = 0;
      this.hitMiss = 0;
      this.hp = 100;
      this.shield = 0;
      this.fever = 0;
      this.feverOn = false;

      this.offsetList = [];
      this.offsetAbsList = [];
      this.events = [];
      this.notes = [];

      // load chart
      const pack = TRACKS[this.trackId] || TRACKS.n1;
      this.chart = (pack.chart || []).map(x=>Object.assign({}, x));
      this.durationSec = Number(pack.durationSec)||60;
      this.chartIndex = 0;

      // audio (optional)
      this._loadAudio(pack);

      this.running = true;
      this.startPerf = nowMs();
      this.endPerf = 0;
      this.endReason = "completed";

      // session row base
      this.sessionRow = {
        tsStart: new Date().toISOString(),
        mode: this.mode,
        trackId: this.trackId,
        trackName: pack.label || this.trackId,
        participant: (this.meta && this.meta.id) || "",
        group: (this.meta && this.meta.group) || "",
        note: (this.meta && this.meta.note) || "",
        device: this.deviceType,
        view: this.view
      };

      this._updateHud();
      this._raf = requestAnimationFrame(this._tick);
    }

    stop(reason){
      if(!this.running) return;
      this.running = false;
      this.endPerf = nowMs();
      this.endReason = reason || this.endReason || "stopped";
      if(this._raf){ cancelAnimationFrame(this._raf); this._raf = null; }

      // cleanup notes DOM
      this.notes.forEach(n=>{ try{ n.el && n.el.remove(); }catch(_){ } });
      this.notes = [];

      const summary = this._buildSummary();
      if(this.hooks && typeof this.hooks.onEnd === "function"){
        try{ this.hooks.onEnd(summary); }catch(_){ }
      }
    }

    handleLaneTap(laneOrSide){
      if(!this.running) return;

      const nowPerf = nowMs();
      const songTime = (nowPerf - this.startPerf)/1000;
      this.songTime = songTime;

      // cVR: allow passing side string (L/C/R)
      let lane = -1;
      let sideKey = "";

      if(typeof laneOrSide === "string"){
        sideKey = (laneOrSide||"").toUpperCase();
        if(sideKey === "L") lane = 1;
        else if(sideKey === "C") lane = 2;
        else if(sideKey === "R") lane = 3;
        else lane = 2;
      }else{
        lane = Number(laneOrSide);
        if(!Number.isFinite(lane)) lane = 2;
        lane = clamp(lane, 0, 4);
      }

      if(this.useSideHit){
        sideKey = sideKey || sideOfLane(lane);
      }

      // anti-spam small penalty for empty taps
      const hit = this._tryHit(songTime, lane, sideKey);
      if(!hit){
        this._applyEmptyTapMiss(songTime, lane, sideKey);
      }
    }

    _tryHit(songTime, lane, sideKey){
      // find closest note in lane (or side group for cVR)
      const windowGood = this.JUDGE_WINDOWS.good;

      let best = null;
      let bestAbs = Infinity;

      for(let i=0;i<this.notes.length;i++){
        const n = this.notes[i];
        if(n.hit) continue;

        if(this.useSideHit){
          // side grouping (L/C/R)
          if(n.side !== sideKey) continue;
        }else{
          if(n.lane !== lane) continue;
        }

        const dt = songTime - n.hitTime;
        const adt = Math.abs(dt);
        if(adt < bestAbs){
          bestAbs = adt;
          best = n;
        }
      }

      if(!best) return false;
      if(bestAbs > windowGood) return false;

      // judge
      const winP = this.JUDGE_WINDOWS.perfect;
      const winG = this.JUDGE_WINDOWS.great;
      let judgment = "good";
      if(bestAbs <= winP) judgment = "perfect";
      else if(bestAbs <= winG) judgment = "great";
      else judgment = "good";

      this._applyHit(best, songTime, judgment, songTime - best.hitTime);
      return true;
    }

    _applyHit(note, songTime, judgment, offset){
      note.hit = true;
      try{ note.el && note.el.classList.add("rb-note-hit"); }catch(_){}

      const absOff = Math.abs(offset);
      this.offsetList.push(offset);
      this.offsetAbsList.push(absOff);

      let scoreDelta = 0;
      if(judgment === "perfect"){ scoreDelta = 120; this.hitPerfect++; }
      else if(judgment === "great"){ scoreDelta = 80; this.hitGreat++; }
      else { scoreDelta = 45; this.hitGood++; }

      // combo & fever
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.fever = clamp01(this.fever + (judgment==="perfect"?0.07:judgment==="great"?0.05:0.03));
      if(this.fever >= 1 && !this.feverOn){
        this.feverOn = true;
      }

      // fever boosts
      if(this.feverOn) scoreDelta = Math.round(scoreDelta * 1.25);

      this.score += scoreDelta;

      // renderer FX
      if(this.renderer && this.renderer.showHitFx){
        try{ this.renderer.showHitFx({ lane: note.lane, judgment, scoreDelta }); }catch(_){}
      }

      // log event
      this._pushEvent({
        t: songTime,
        type: "hit",
        lane: note.lane,
        side: note.side,
        judgment,
        offset,
        scoreDelta,
        combo: this.combo
      });

      this._updateHud();
    }

    _applyMiss(note, songTime, reason){
      note.hit = true;
      try{ note.el && note.el.classList.add("rb-note-miss"); }catch(_){}

      this.hitMiss++;
      this.combo = 0;

      // shield / hp
      if(this.shield > 0){
        this.shield--;
      }else{
        this.hp = clamp(this.hp - 8, 0, 100);
      }
      this.fever = clamp01(this.fever - 0.08);
      if(this.fever < 0.35) this.feverOn = false;

      if(this.renderer && this.renderer.showMissFx){
        try{ this.renderer.showMissFx({ lane: note.lane }); }catch(_){}
      }

      this._pushEvent({
        t: songTime,
        type: "miss",
        lane: note.lane,
        side: note.side,
        reason: reason || "late",
        hp: this.hp
      });

      this._updateHud();

      if(this.hp <= 0){
        this.endReason = "hp-zero";
        this.stop("hp-zero");
      }
    }

    _applyEmptyTapMiss(songTime, lane, sideKey){
      // tiny penalty (anti-spam)
      const penalty = this.useSideHit ? 1 : 2;
      this.score = Math.max(0, this.score - penalty);
      this.combo = 0;

      this._pushEvent({
        t: songTime,
        type: "empty-tap",
        lane: Number(lane)||0,
        side: sideKey || "",
        scoreDelta: -penalty
      });

      this._updateHud();
    }

    _tick(){
      if(!this.running) return;
      const nowPerf = nowMs();
      const songTime = (nowPerf - this.startPerf)/1000;
      this.songTime = songTime;

      // spawn notes ahead-of-time
      const spawnUntil = songTime + this.PRE_SPAWN_SEC;
      while(this.chartIndex < this.chart.length){
        const info = this.chart[this.chartIndex];
        if(!info) break;
        if(info.t > spawnUntil) break;
        this._createNote(info);
        this.chartIndex++;
      }

      // update live notes positions and miss check
      for(let i=0;i<this.notes.length;i++){
        const n = this.notes[i];
        if(n.hit) continue;
        const dt = songTime - n.hitTime; // negative => before line
        const progress = clamp01((dt + this.PRE_SPAWN_SEC) / (this.PRE_SPAWN_SEC + 0.26));
        // translate from top to hit line
        const y = lerp(n.yTop, n.yHit, progress);
        n.el.style.transform = `translate(-50%, ${y}px)`;
        // late miss
        if(dt > this.JUDGE_WINDOWS.good + 0.03){
          this._applyMiss(n, songTime, "late");
        }
      }

      // cleanup hit notes (DOM remove)
      const alive = [];
      for(let i=0;i<this.notes.length;i++){
        const n = this.notes[i];
        if(n.hit){
          // keep briefly for anim
          if(songTime - n.hitTime > 0.35){
            try{ n.el && n.el.remove(); }catch(_){}
          }else{
            alive.push(n);
          }
        }else{
          alive.push(n);
        }
      }
      this.notes = alive;

      // progress / end
      const prog = clamp01(songTime / this.durationSec);
      this._updateProgress(prog);

      if(songTime >= this.durationSec){
        this.endReason = "timeup";
        this.stop("timeup");
        return;
      }

      // AI snapshot & HUD (prediction only; no gameplay adjustment in research lock)
      const snap = this._buildSnapshot();
      const ai = this.ai.update(snap);
      if(this.hud){
        if(this.hud.aiFatigue) this.hud.aiFatigue.textContent = Math.round((ai.fatigueRisk||0)*100) + "%";
        if(this.hud.aiSkill) this.hud.aiSkill.textContent = Math.round((ai.skillScore||0)*100) + "%";
        if(this.hud.aiSuggest) this.hud.aiSuggest.textContent = (ai.suggestedDifficulty||"normal");
        if(this.hud.aiTip){
          this.hud.aiTip.textContent = ai.tip || "";
          this.hud.aiTip.classList.toggle("hidden", !ai.tip);
        }
      }

      this._raf = requestAnimationFrame(this._tick);
    }

    _createNote(info){
      // info: {t, lane}
      let laneIndex = clamp(info.lane | 0, 0, 4);
      // cVR: collapse into 3 lanes (1,2,3)
      if (this.useSideHit) laneIndex = mapLaneForCvr(laneIndex);

      const laneEl = this.lanesEl.querySelector(`.rb-lane[data-lane="${laneIndex}"]`);
      if(!laneEl) return;

      const rect = laneEl.getBoundingClientRect();
      const fieldRect = this.field.getBoundingClientRect();

      const x = rect.left + rect.width/2 - fieldRect.left;
      // hit line is near bottom area of field; use CSS baseline reference
      const yHit = fieldRect.height - 58;
      const yTop = -44;

      // note element
      const noteEl = document.createElement("div");
      noteEl.className = "rb-note";
      noteEl.dataset.lane = String(laneIndex);

      // emoji per lane (5 icons; reuse for mapped lanes)
      const icons = ["👊","🥊","🔥","⚡","💥"];
      noteEl.textContent = icons[laneIndex] || "👊";

      noteEl.style.left = x + "px";
      noteEl.style.top = "0px";

      // tail (visual duration)
      const tail = document.createElement("div");
      tail.className = "rb-note-tail";
      noteEl.appendChild(tail);

      this.field.appendChild(noteEl);

      const hitTime = Number(info.t)||0;
      const n = {
        el: noteEl,
        lane: laneIndex,
        side: sideOfLane(laneIndex),
        hitTime,
        yTop,
        yHit,
        hit: false
      };
      this.notes.push(n);
    }

    _loadAudio(pack){
      try{
        if(!this.audio) return;
        if(pack && pack.audioUrl){
          this.audio.src = pack.audioUrl;
          this.audio.load();
          // best-effort: play on user gesture (we do not autoplay here)
        }else{
          this.audio.removeAttribute("src");
        }
      }catch(_){}
    }

    _updateProgress(prog){
      if(this.hud && this.hud.progFill){
        this.hud.progFill.style.width = Math.round(prog*100) + "%";
      }
      if(this.hud && this.hud.progText){
        this.hud.progText.textContent = Math.round(prog*100) + "%";
      }
    }

    _updateHud(){
      const hud = this.hud||{};
      if(hud.score) hud.score.textContent = String(this.score|0);
      if(hud.combo) hud.combo.textContent = String(this.combo|0);

      const judged = (this.hitPerfect+this.hitGreat+this.hitGood+this.hitMiss);
      const acc = judged>0 ? ((this.hitPerfect*1 + this.hitGreat*0.85 + this.hitGood*0.65) / judged) : 0;
      if(hud.acc) hud.acc.textContent = (acc*100).toFixed(1) + "%";

      if(hud.hp) hud.hp.textContent = String(this.hp|0);
      if(hud.shield) hud.shield.textContent = String(this.shield|0);
      if(hud.time) hud.time.textContent = this.songTime.toFixed(1);

      if(hud.countPerfect) hud.countPerfect.textContent = String(this.hitPerfect|0);
      if(hud.countGreat) hud.countGreat.textContent = String(this.hitGreat|0);
      if(hud.countGood) hud.countGood.textContent = String(this.hitGood|0);
      if(hud.countMiss) hud.countMiss.textContent = String(this.hitMiss|0);

      if(hud.feverFill) hud.feverFill.style.width = Math.round(this.fever*100) + "%";
      if(hud.feverStatus) hud.feverStatus.textContent = this.feverOn ? "ON" : "READY";
    }

    _buildSnapshot(){
      const judged = (this.hitPerfect+this.hitGreat+this.hitGood+this.hitMiss);
      const acc = judged>0 ? ((this.hitPerfect*1 + this.hitGreat*0.85 + this.hitGood*0.65) / judged) : 0;

      // mean abs offset
      let offAbsMean = null;
      if(this.offsetAbsList.length>0){
        const s = this.offsetAbsList.reduce((a,b)=>a+b,0);
        offAbsMean = s / this.offsetAbsList.length;
      }

      return {
        accPct: acc*100,
        hitPerfect: this.hitPerfect,
        hitGreat: this.hitGreat,
        hitGood: this.hitGood,
        hitMiss: this.hitMiss,
        combo: this.combo,
        offsetAbsMean: offAbsMean,
        hp: this.hp,
        songTime: this.songTime,
        durationSec: this.durationSec
      };
    }

    _buildSummary(){
      const judged = (this.hitPerfect+this.hitGreat+this.hitGood+this.hitMiss);
      const acc = judged>0 ? ((this.hitPerfect*1 + this.hitGreat*0.85 + this.hitGood*0.65) / judged) : 0;

      // mean & std (signed offsets)
      let mean = null, std = null;
      if(this.offsetList.length>0){
        const n = this.offsetList.length;
        const m = this.offsetList.reduce((a,b)=>a+b,0) / n;
        const v = this.offsetList.reduce((a,b)=>a+(b-m)*(b-m),0) / n;
        mean = m; std = Math.sqrt(v);
      }

      const dur = (this.endPerf>0? (this.endPerf-this.startPerf)/1000 : this.songTime);
      const rank = computeRank(acc, this.hitMiss, this.maxCombo);

      const qualityNote = computeQualityNote(acc, mean, std, this.hitMiss, dur);

      return {
        modeLabel: (this.mode === "research") ? "Research" : "Normal",
        trackName: (TRACKS[this.trackId] && TRACKS[this.trackId].label) || this.trackId,
        endReason: this.endReason,
        finalScore: this.score|0,
        maxCombo: this.maxCombo|0,
        hitPerfect: this.hitPerfect|0,
        hitGreat: this.hitGreat|0,
        hitGood: this.hitGood|0,
        hitMiss: this.hitMiss|0,
        accuracyPct: acc*100,
        durationSec: dur,
        rank,
        offsetMean: mean,
        offsetStd: std,
        participant: (this.meta && this.meta.id) || "",
        qualityNote
      };
    }

    _pushEvent(ev){
      const row = Object.assign({
        ts: new Date().toISOString(),
        mode: this.mode,
        trackId: this.trackId,
        participant: (this.meta && this.meta.id) || "",
        group: (this.meta && this.meta.group) || "",
        device: this.deviceType,
        view: this.view
      }, ev || {});
      this.events.push(row);
    }

    getEventsCsv(){
      if(!this.events || this.events.length===0) return "";
      const cols = [
        "ts","mode","trackId","participant","group","device","view",
        "t","type","lane","side","judgment","offset","scoreDelta","combo","reason","hp"
      ];
      return toCsv(cols, this.events);
    }

    getSessionCsv(){
      const summary = this._buildSummary();
      const cols = [
        "tsStart","mode","trackId","trackName","participant","group","note","device","view",
        "finalScore","maxCombo","hitPerfect","hitGreat","hitGood","hitMiss","accuracyPct",
        "durationSec","rank","offsetMean","offsetStd","endReason"
      ];
      const row = Object.assign({}, this.sessionRow||{}, summary, { endReason: summary.endReason });
      return toCsv(cols, [row]);
    }
  }

  function toCsv(cols, rows){
    const esc = (v)=>{
      const s = (v==null? "" : String(v));
      if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
      return s;
    };
    const head = cols.map(esc).join(",");
    const body = rows.map(r=>cols.map(c=>esc(r[c])).join(",")).join("\n");
    return head + "\n" + body;
  }

  function computeRank(acc, miss, maxCombo){
    const a = Number(acc)||0;
    if(a>=0.92 && miss<=3 && maxCombo>=20) return "SSS";
    if(a>=0.88 && miss<=6) return "SS";
    if(a>=0.82) return "S";
    if(a>=0.74) return "A";
    if(a>=0.66) return "B";
    return "C";
  }

  function computeQualityNote(acc, mean, std, miss, dur){
    const a = Number(acc)||0;
    if(dur < 10) return "⚠️ เล่นสั้นมาก อาจเป็นการทดสอบระบบ (แนะนำเล่นเต็มเพลง)";
    if(miss >= 25) return "⚠️ Miss สูงมาก—แนะนำเริ่ม Easy 1–2 รอบก่อนเก็บวิจัย";
    if(std != null && std > 0.12) return "⚠️ ความผันผวนของจังหวะสูง (offset std สูง)—อาจยังไม่คุ้นจังหวะ";
    if(a >= 0.90) return "✅ คุณภาพดี เหมาะเก็บวิจัย";
    return "";
  }

  // ---- Track packs (prototype) ----
  const TRACKS = {
    n1: {
      label: "Warm-up Groove",
      durationSec: 60,
      chart: makeChart(60, 100, "easy")
    },
    n2: {
      label: "Focus Combo",
      durationSec: 70,
      chart: makeChart(70, 120, "normal")
    },
    n3: {
      label: "Speed Rush",
      durationSec: 80,
      chart: makeChart(80, 140, "hard")
    },
    r1: {
      label: "Research Track 120",
      durationSec: 120,
      chart: makeChart(120, 120, "normal")
    }
  };

  function makeChart(durationSec, bpm, diff){
    const beatsPerSec = bpm / 60;
    const chart = [];
    const lanes = [0,1,2,3,4];

    // density by diff
    const base = diff==="easy" ? 0.55 : diff==="hard" ? 0.95 : 0.75;

    let t = 1.2;
    while(t < durationSec - 0.8){
      // choose how many notes this beat
      const r = Math.random();
      let k = 1;
      if(r > 0.86) k = 2;
      if(r > 0.96) k = 3;

      for(let i=0;i<k;i++){
        const lane = lanes[(Math.random()*lanes.length)|0];
        chart.push({ t: t + i*0.08, lane });
      }

      // step
      const jitter = (Math.random()*0.03);
      const step = (1/beatsPerSec) / base;
      t += step + jitter;
    }

    // sort by time
    chart.sort((a,b)=>a.t-b.t);
    return chart;
  }

  // export global
  window.RhythmBoxerEngine = RhythmBoxerEngine;
})();