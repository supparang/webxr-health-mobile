// === /fitness/js/post-run-analytics.js ===
// Post-run analytics (DL-feel coach) — lightweight, explainable
'use strict';

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function pct(n,d){ return d>0 ? (n/d)*100 : 0; }

export function analyzeRun(eventLogs = [], sessionSummary = {}, opts = {}) {
  const zones = new Array(6).fill(0).map(()=>({ seen:0, hit:0, miss:0, rtSum:0, rtN:0, late:0 }));
  const phase = { 1:{hit:0,miss:0}, 2:{hit:0,miss:0}, 3:{hit:0,miss:0} };

  let hits = 0, miss = 0, bombs = 0, decoys = 0, heals = 0, shields = 0, bossfaces = 0;
  let perfect=0, good=0, bad=0;
  let rtSum=0, rtN=0;
  let lateHits=0;
  let focusLost = 0;

  for (const e of eventLogs) {
    const p = Number(e.boss_phase)||1;
    if (phase[p]) {}

    const t = String(e.target_type||'');
    const grade = String(e.grade||'');
    const ev = String(e.event_type||'');

    const z = (e.zone_id != null) ? Number(e.zone_id) : (e.zone != null ? Number(e.zone) : null);
    const zid = (z!=null && z>=0 && z<=5) ? z : null;

    if (t==='bomb') bombs++;
    if (t==='decoy') decoys++;
    if (t==='heal') heals++;
    if (t==='shield') shields++;
    if (t==='bossface') bossfaces++;

    if (ev==='hit') {
      hits++;
      if (phase[p]) phase[p].hit++;
      if (grade==='perfect') perfect++;
      else if (grade==='good') good++;
      else if (grade==='bad') bad++;

      const rt = (e.rt_ms!=null && e.rt_ms!=='') ? Number(e.rt_ms) : null;
      if (rt!=null && isFinite(rt)) {
        rtSum += rt; rtN++;
        if (rt > 520) { lateHits++; }
        if (zid!=null) { zones[zid].rtSum += rt; zones[zid].rtN++; }
      }

      if (zid!=null){
        zones[zid].seen++;
        zones[zid].hit++;
      }
    }

    if (ev==='timeout') {
      // real miss ถ้า grade=miss
      if (String(e.grade||'') === 'miss') {
        miss++;
        if (phase[p]) phase[p].miss++;
        if (zid!=null){
          zones[zid].seen++;
          zones[zid].miss++;
        }
      }
    }

    if (ev==='focus_lost') focusLost++;
  }

  const totalTrials = hits + miss;
  const acc = pct(hits, totalTrials);
  const avgRt = rtN ? rtSum/rtN : null;

  // weak zone by lowest accuracy (seen>=4)
  let weakZone = -1;
  let weakestScore = 999;
  for (let i=0;i<6;i++){
    const s = zones[i].seen;
    if (s < 4) continue;
    const a = pct(zones[i].hit, s);
    const r = zones[i].rtN ? zones[i].rtSum/zones[i].rtN : 999;
    const score = (100-a) + clamp((r-380)/8, 0, 40); // mix: miss+slow
    if (score < weakestScore) continue;
    // เราอยาก “แย่สุด” → score สูงสุด
  }
  // find max score instead (worst)
  let worst = -1, worstScore = -1;
  for (let i=0;i<6;i++){
    const s = zones[i].seen;
    if (s < 4) continue;
    const a = pct(zones[i].hit, s);
    const r = zones[i].rtN ? zones[i].rtSum/zones[i].rtN : 999;
    const score = (100-a) + clamp((r-380)/8, 0, 40);
    if (score > worstScore) { worstScore = score; worst = i; }
  }
  weakZone = worst;

  // drill suggestions (2 max)
  const drills = [];

  if (acc < 75 || miss >= 6) {
    drills.push({
      title: 'Drill 1: “ชัวร์ก่อนเร็ว”',
      why: `ความแม่นยังต่ำ (Accuracy ${acc.toFixed(1)}%)`,
      how: 'ให้รอเป้าโผล่ “เต็มวง” 0.1–0.2 วินาที แล้วค่อยตี เน้นไม่พลาดก่อน'
    });
  } else if (avgRt != null && avgRt > 520) {
    drills.push({
      title: 'Drill 1: “เล็งล่วงหน้า”',
      why: `RT เฉลี่ยยังช้า (${avgRt.toFixed(0)}ms)`,
      how: 'ย้ายสายตาไป “โซนถัดไป” ก่อนเป้าเกิด แล้วค่อยตีทันทีเมื่อเห็นวงแหวน'
    });
  } else {
    drills.push({
      title: 'Drill 1: “รักษาคอมโบ”',
      why: `คุณทำได้ดีแล้ว (Accuracy ${acc.toFixed(1)}%)`,
      how: 'ตั้งเป้า “ไม่พลาดติดกัน” และคุมจังหวะให้คอมโบต่อเนื่อง'
    });
  }

  const bombRate = pct(bombs, totalTrials);
  if (bombRate > 10 || decoys > 0) {
    drills.push({
      title: 'Drill 2: “อ่านสัญญาณหลอก”',
      why: `มีเป้าหลอก/ระเบิดเยอะ (Bomb+Decoy ${bombs+decoys})`,
      how: 'ถ้าไม่มั่นใจ “ปล่อยผ่าน” 1 จังหวะ แล้วค่อยตีเป้าจริง เน้นไม่โดนระเบิด'
    });
  } else if (weakZone >= 0) {
    drills.push({
      title: `Drill 2: “โซนที่ยังอ่อน (Zone ${weakZone+1})”`,
      why: 'โซนนี้ช้า/พลาดมากกว่าโซนอื่น',
      how: 'ตั้งใจมองโซนนี้ก่อน 2–3 เป้าแรกของแต่ละเฟส แล้วค่อยกระจายสายตา'
    });
  } else {
    drills.push({
      title: 'Drill 2: “สปีดสั้น 20 วิ”',
      why: 'เพิ่มความเร็วโดยไม่เสียความแม่น',
      how: 'เล่นสั้น 20–30 วิ 2 รอบ เน้น Perfect/Good ต่อเนื่อง'
    });
  }

  const topText = (() => {
    if (acc >= 92 && (avgRt!=null && avgRt < 420)) return '🔥 ฟอร์มดีมาก! เร็วและแม่น';
    if (acc >= 85) return '✅ ดีมาก! เหลือเก็บรายละเอียดความเร็ว/การอ่านหลอก';
    if (acc >= 70) return '👍 กำลังดี! ถ้าลดการพลาดติดกันได้ จะพุ่งขึ้นเร็ว';
    return '🧠 เริ่มต้นได้ดี! โฟกัส “ไม่พลาด” ก่อน แล้วสปีดจะตามมาเอง';
  })();

  return {
    acc_pct: +acc.toFixed(2),
    avg_rt_ms: avgRt!=null ? +avgRt.toFixed(1) : null,
    late_hits: lateHits,
    hits, miss, perfect, good, bad,
    bombs, decoys, heals, shields, bossfaces,
    weak_zone: weakZone,
    phase_breakdown: phase,
    headline: topText,
    drills: drills.slice(0,2),
  };
}