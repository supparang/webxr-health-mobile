// === /herohealth/vr-clean/ai-clean.js ===
// Clean Objects AI — Prediction + Explainable Coach (NO adaptive)
// FULL v20260305-AI-PRED-EXPLAIN-CLEAN
'use strict';

export function createCleanAI(opts = {}){
  const seed = String(opts.seed ?? '');
  const pid  = String(opts.pid ?? 'anon');
  const diff = String(opts.diff ?? 'normal').toLowerCase();
  const view = String(opts.view ?? 'mobile').toLowerCase();
  const pro  = !!opts.pro;

  const W = {
    lowSpray:      1.05,
    lowCoverage:   1.10,
    lowDQ:         1.15,
    bossSoon:      0.85,
    bossNotPicked: 1.10,
    contam:        0.70,
    slowStart:     0.85,
    hard:          0.25,
    cvr:           0.15,
    pro:           0.20
  };

  let lastPred = null;
  let lastBossWarn = { atSec: -999, step: '' };

  function clamp01(x){ x=Number(x)||0; return x<0?0:(x>1?1:x); }
  function sigmoid(x){ return 1/(1+Math.exp(-x)); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function valueScoreHotspot(h){
    const risk = clamp(h.risk,0,100)/100;
    const touch = clamp(h.touchLevel,0,1);
    const traffic = clamp(h.traffic,0,1);
    const mins = Math.max(0, Number(h.timeLastCleanedMin||0));
    const staleness = clamp(mins / (24*60), 0, 2);
    const staleW = 0.6 + 0.4*clamp(staleness/2,0,1);

    const surface = String(h.surfaceType||'').toLowerCase();
    const surfaceW =
      (surface==='metal' || surface==='plastic') ? 1.15 :
      (surface==='glass') ? 1.05 :
      (surface==='tile') ? 1.00 :
      (surface==='wood') ? 0.95 :
      (surface==='fabric') ? 0.90 : 1.0;

    const intensity = 0.45*touch + 0.35*traffic + 0.20;
    return risk * intensity * surfaceW * staleW;
  }

  function topK(hotspots, k=3){
    const arr = (hotspots||[]).slice().map(h=>({ id:h.id, name:h.name||h.id, v:valueScoreHotspot(h), h }));
    arr.sort((a,b)=>b.v-a.v);
    return arr.slice(0,k);
  }

  function explainTop2(features){
    const parts = [];
    parts.push({ key:'lowDQ',        score: W.lowDQ        * clamp01(features.lowDQ),        text:'ยังเลือกจุด “ไม่คุ้ม” อยู่บ้าง' });
    parts.push({ key:'lowCoverage',  score: W.lowCoverage  * clamp01(features.lowCoverage),  text:'ยังทำความสะอาดไม่ครอบคลุมพอ' });
    parts.push({ key:'lowSpray',     score: W.lowSpray     * clamp01(features.lowSpray),     text:'สเปรย์ใกล้หมด ต้องเลือกให้แม่น' });
    parts.push({ key:'bossNotPicked',score: W.bossNotPicked* clamp01(features.bossNotPicked),text:'ยังไม่แตะจุดบอสสำคัญ' });
    parts.push({ key:'bossSoon',     score: W.bossSoon     * clamp01(features.bossSoon),     text:'บอสใกล้มา ต้องรีบตัดสินใจ' });
    parts.push({ key:'contam',       score: W.contam       * clamp01(features.contam),       text:'มีเหตุการณ์ปนเปื้อนเพิ่มความเสี่ยง' });
    parts.push({ key:'slowStart',    score: W.slowStart    * clamp01(features.slowStart),    text:'ช่วงต้นเกมยังเก็บจุดคุ้มได้น้อย' });

    parts.sort((a,b)=>b.score-a.score);
    const top = parts.slice(0,2);
    return {
      top2: top.map(x=>x.text),
      detail: parts.slice(0,6).map(x=>({ factor:x.key, weight:Number(x.score.toFixed(3)) }))
    };
  }

  function bossForecaster(state, top3, boss){
    if(!boss) return null;
    if(state.mode !== 'A') return null;
    if(boss.active || boss.cleared) return null;

    const elapsed = clamp(state.elapsedSec ?? 0, 0, 99999);
    const t = clamp(boss.nextAtS ?? 0, 0, 99999);
    const warn = clamp(boss.warnSec ?? 8, 3, 20);
    if(t <= 0) return null;

    const left = t - elapsed;
    if(left <= 0) return null;

    const name = boss.type === 'wet' ? 'Bathroom Outbreak' : 'Shared Device Meltdown';
    const hint = top3?.[0]?.name ? `เตรียมเก็บ "${top3[0].name}"` : 'เตรียมเลือกจุดคุ้มที่สุด';

    if(left <= warn && left > 3.2){
      if(lastBossWarn.step === 'early' && Math.abs(lastBossWarn.atSec - t) < 0.001) return null;
      lastBossWarn = { atSec: t, step: 'early' };
      return { tipId:'boss_warn', text:`⚠️ บอสกำลังมา: ${name} (อีก ${Math.ceil(left)} วิ) — ${hint}` };
    }

    if(left <= 3.2){
      if(lastBossWarn.step === 'final' && Math.abs(lastBossWarn.atSec - t) < 0.001) return null;
      lastBossWarn = { atSec: t, step: 'final' };
      return { tipId:'boss_final', text:`🔥 FINAL! ${name} มาแน่ใน ${Math.ceil(left)} วิ — เล็งจุดคุ้มสุด!` };
    }

    return null;
  }

  function suggestNext(state, top3){
    if(state.mode === 'A'){
      if(Number(state.spraysLeft||0) <= 1 && top3[0]) return `เหลือ ${state.spraysLeft} ครั้ง! เลือก "${top3[0].name}" ก่อน`;
      if(Number(state.timeLeftS||0) <= 12 && top3[0]) return `ใกล้หมดเวลา! รีบเก็บ "${top3[0].name}"`;
      if(top3[0]) return `จุดคุ้มสุดตอนนี้: "${top3[0].name}"`;
      return 'เริ่มจากลูกบิด ของใช้ร่วม หรือก๊อกน้ำ';
    }
    const n = Number(state.routeLen||0);
    if(n === 0) return 'เริ่ม route จากของใช้ร่วมก่อน';
    if(state.balance?.wet === 0) return 'เพิ่มโซนเปียก 1 จุดจะดีมาก';
    if(state.balance?.shared < 2) return 'ของใช้ร่วมยังน้อย ลองเพิ่มอีก';
    return 'ปรับ route ให้สั้นลงและคุ้มขึ้น';
  }

  return {
    onTick(dt, f){
      void(dt);

      const mode = String(f.mode||'A');
      const spraysLeft = Number(f.spraysLeft||0);
      const spraysMax  = Number(f.spraysMax|| (mode==='A'?3:0));
      const chosen     = Number(f.chosen||0);
      const maxSelect  = Number(f.maxSelect|| (mode==='A'?spraysMax:0));
      const timeLeftS  = Number(f.timeLeft|| f.timeLeftS || 0);
      const timeLimitS = Number(f.timeLimitS || f.timeTotal || 0);
      const elapsedSec = Number(f.elapsedSec||0);

      const coveragePct = (maxSelect>0) ? (chosen/maxSelect)*100 : 0;
      const lowCoverage = clamp01(1 - clamp01(coveragePct/100));

      const top3 = topK(f.hotspots||[], 3);
      const top3Ids = new Set(top3.map(x=>x.id));
      const pickedIds = new Set((f.pickedIds||[]).map(String));
      let hit=0; for(const id of pickedIds) if(top3Ids.has(id)) hit++;
      const dq = (chosen>0) ? (hit/chosen) : 0;
      const lowDQ = clamp01(1 - dq);

      const lowSpray = (spraysMax>0) ? clamp01((Math.max(0, 2 - spraysLeft))/2) : 0;
      const bossId = String(f.bossId||'toilet_flush');
      const bossNotPicked = (mode==='A' && bossId && !pickedIds.has(bossId)) ? 1 : 0;

      let bossSoon = 0;
      if(f.boss && f.boss.nextAtS>0){
        const t = Number(f.boss.nextAtS||0);
        const warn = Number(f.boss.warnSec||8);
        bossSoon = (elapsedSec >= (t-warn) && elapsedSec < t) ? 1 : 0;
      }

      const contam = f.contamFired ? 1 : 0;
      const riskReduced = Number(f.riskReduced||0);
      const slowStart = (elapsedSec <= 18) ? clamp01(1 - clamp01(riskReduced/60)) : 0;

      const x =
        W.lowSpray * lowSpray +
        W.lowCoverage * lowCoverage +
        W.lowDQ * lowDQ +
        W.bossSoon * bossSoon +
        W.bossNotPicked * bossNotPicked +
        W.contam * contam +
        W.slowStart * slowStart +
        (diff==='hard' ? W.hard : 0) +
        ((view==='cvr'||view==='vr') ? W.cvr : 0) +
        (pro ? W.pro : 0);

      const hazardRisk = clamp01(sigmoid(x) - 0.50);
      const next = suggestNext({
        mode, spraysLeft, timeLeftS, routeLen: Number(f.routeLen||0), balance: f.balance||null
      }, top3);

      const explain = explainTop2({
        lowSpray, lowCoverage, lowDQ, bossSoon, bossNotPicked, contam, slowStart
      });

      const bossTip = bossForecaster(
        { mode, elapsedSec, timeLeftS, timeLimitS },
        top3,
        f.boss || null
      );

      lastPred = {
        hazardRisk,
        next5: [next],
        explainTop2: explain.top2,
        explainDetail: explain.detail,
        bossTip,
        top3: top3.map(t=>({ id:t.id, name:t.name, score:Number(t.v.toFixed(4)) })),
        meta: { seed, pid, diff, view, pro }
      };
      return lastPred;
    },

    getPrediction(){
      return lastPred;
    },

    onEnd(summary){
      const m = summary?.metrics || {};
      const mode = String(m.mode||'A');
      const bd = m.breakdown || {};
      const coveragePct = Number(bd.coverage ?? bd.coverageB ?? 0);
      const dqPct = Number(bd.dq ?? 0);
      const bossPenalty = Number(bd.bossPenalty ?? 0);

      const features = {
        lowCoverage: clamp01(1 - clamp01(coveragePct/100)),
        lowDQ: (mode==='A') ? clamp01(1 - clamp01(dqPct/100)) : 0,
        bossNotPicked: bossPenalty>0 ? 1 : 0
      };
      const ex = explainTop2(features);
      return {
        explainTop2: ex.top2,
        explainDetail: ex.detail,
        note: 'prediction-only (no adaptive difficulty)'
      };
    }
  };
}