/* === /herohealth/vr/ai/ai-coach.js ===
HHA AI Coach (Explainable Micro Tips)
- Listens to live metrics/events
- Emits: hha:coach {text,mood}
- Play mode: adaptive tips + praise + warnings
- Research mode: optional minimal (default OFF)
Expose: window.HHA_AI.Coach.create(...)
*/

(function(root){
  'use strict';
  const HHA = (root.HHA_AI = root.HHA_AI || {});
  const emit = (name, detail)=>{ try{ root.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch{} };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function create(opts){
    opts = opts || {};
    const mode = (String(opts.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';
    const enabledResearch = !!opts.enabledResearch; // default false
    const minGapMs = Math.max(900, Number(opts.minGapMs||1400));
    let lastSayAt = 0;

    // short memory
    let missStreak = 0;
    let junkStreak = 0;
    let goodStreak = 0;

    function canSpeak(){
      const t = Date.now();
      if (t - lastSayAt < minGapMs) return false;
      lastSayAt = t;
      return true;
    }

    function say(text, mood){
      if (mode==='research' && !enabledResearch) return;
      if (!canSpeak()) return;
      emit('hha:coach', { text: String(text||''), mood: mood||'neutral' });
    }

    function onHit(ev){
      // ev: {type:'good'|'bad'|'junk'|'wrong'|'decoy'|'boss', rtMs, feverPct, shield}
      const t = String(ev?.type||'').toLowerCase();
      if (t === 'good' || t === 'boss'){
        goodStreak++;
        missStreak = 0;
        junkStreak = 0;
        if (goodStreak >= 6) say('ดีมาก! รักษาจังหวะคอมโบไว้ 💚', 'happy');
      } else {
        goodStreak = 0;
        missStreak++;
        if (t === 'junk') junkStreak++;
        if (missStreak >= 2){
          const fever = clamp(ev?.feverPct ?? 0, 0, 100);
          if (fever >= 65) say('พักจังหวะนิดนึงนะ! เล็งให้ชัวร์ก่อนยิง 🔥', 'fever');
          else say('ช้าอีกนิดแล้วค่อยยิง จะพลาดน้อยลง 👍', 'neutral');
        } else if (t === 'junk'){
          say('หลบของหวาน/ของทอด! มองหา “อาหารหมู่นี้” ก่อน 🍟🚫', 'sad');
        } else {
          say('ระวัง “หมู่ผิด/ตัวลวง” นะ 👀', 'neutral');
        }
      }
    }

    function onMiniUrgent(secLeft){
      secLeft = Number(secLeft)||0;
      if (secLeft <= 3) say('ใกล้หมดเวลาแล้ว! โฟกัสเป้ากลางจอ ⚡', 'neutral');
    }

    function onDirectorExplain(explain){
      if (!explain) return;
      // show occasionally only
      if (mode==='research') return;
      if (!canSpeak()) return;
      emit('hha:coach', { text: `AI: ${String(explain)}`, mood:'neutral' });
    }

    function onMetrics(m){
      // m: {accPct, junkErrorPct, avgRtMs, feverPct, combo}
      if (mode==='research' && !enabledResearch) return;
      const acc = clamp((m?.accPct ?? 0)/100, 0, 1);
      const junkE = clamp((m?.junkErrorPct ?? 0)/100, 0, 1);
      const rt = clamp(m?.avgRtMs ?? 600, 180, 900);
      const fever = clamp(m?.feverPct ?? 0, 0, 100);

      if (junkE >= 0.18) say('ทริค: ของขยะมักสีจัด/หวาน/ทอด—เล็งอาหารจริงก่อน 🍎🥦', 'sad');
      else if (acc >= 0.90 && rt <= 330) say('โหดมาก! ลองเก็บ PERFECT ต่อเนื่องดู 😈', 'happy');
      else if (fever >= 70) say('ไฟลุกแล้ว! อย่ารีบ ยิงให้ชัวร์ก่อน 🔥', 'fever');
    }

    return { say, onHit, onMiniUrgent, onMetrics, onDirectorExplain };
  }

  HHA.Coach = { create };

})(typeof window !== 'undefined' ? window : globalThis);