// === /herohealth/fitness-planner/auto-captions.js ===
// Auto Figure Captions for Chapter 4 (4-1, 4-2, 4-3) — Markdown export

'use strict';

function todayKey(){
  const d=new Date();
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const da=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function safeStr(x){ return (x==null)?'':String(x); }

function dlText(filename, text){
  const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

export function exportChapter4Captions(ctx){
  const c = Object.assign({
    pid:'anon',
    run:'play',
    diff:'normal',
    time:80,
    seed:'0',
    orderSeq:'shadow>rhythm>jumpduck>balance'
  }, ctx||{});

  const date = todayKey();
  const pid = safeStr(c.pid||'anon');

  const baseA = `HHA_storyboard_${date}_${pid}`;
  const baseB = `HHA_storyboard_visual_${date}_${pid}`;
  const baseC = `HHA_storyboard_swimlane_${date}_${pid}`;

  const lines = [];

  lines.push(`# Chapter 4 — Figures & Captions (Auto)`);
  lines.push(`date: ${date}`);
  lines.push(`pid: ${pid}`);
  lines.push(`run: ${safeStr(c.run)} | diff: ${safeStr(c.diff)} | time: ${safeStr(c.time)}s | seed: ${safeStr(c.seed)}`);
  lines.push(`order: ${safeStr(c.orderSeq)}`);
  lines.push('');

  lines.push(`## List of Figures (ย่อ)`);
  lines.push(`- **Figure 4-1** Conceptual storyboard & script (Markdown/JSON)`);
  lines.push(`- **Figure 4-2** Visual storyboard flow (SVG/PNG)`);
  lines.push(`- **Figure 4-3** Swimlane storyboard (Student vs Teacher) (SVG/PNG)`);
  lines.push('');

  lines.push(`## Figure 4-1`);
  lines.push(`**Figure 4-1** โครงเรื่อง (storyboard) และบทพูด/สคริปต์ (script) ของกิจกรรมออกกำลังกายรายวันสำหรับนักเรียนชั้นประถมศึกษาปีที่ 5 โดยโครงสร้างการดำเนินงานประกอบด้วย Consent → Attention Check (เฉพาะโหมดวิจัย) → Warmup → เกมออกกำลังกาย 4 เกมแบบ counterbalanced พร้อมการแทรก Boss (ตามเงื่อนไข) → Cooldown → End Dashboard เพื่อสรุปผลและส่งออกข้อมูลสำหรับการวิเคราะห์ โดยแต่ละเกมออกแบบตาม Bloom taxonomy ในมิติ Psychomotor และ Cognitive และมีมาตรการควบคุมคุณภาพข้อมูล (attention check, fatigue guard) โดยไม่ปรับความยากในโหมดวิจัย (research lock).`);
  lines.push('');
  lines.push(`ไฟล์ประกอบ:`);
  lines.push(`- \`${baseA}.md\``);
  lines.push(`- \`${baseA}.json\``);
  lines.push(`- \`${baseA}_chapter4_snippet.md\``);
  lines.push('');

  lines.push(`## Figure 4-2`);
  lines.push(`**Figure 4-2** แผนภาพ storyboard แบบภาพ (visual storyboard) แสดงลำดับการโต้ตอบของผู้เล่นตามช่วงเวลา ตั้งแต่หน้าคำชี้แจง/ยินยอม ไปจนถึงการสรุปผล โดยแต่ละกล่องแสดง Entry → Action → Feedback เพื่อให้เห็นวงจรการเรียนรู้และการวัดผลภายในเกมอย่างชัดเจน รวมถึงจุดเชื่อมที่สำคัญ เช่น warmup/cooldown, boss insertion และ end dashboard.`);
  lines.push('');
  lines.push(`ไฟล์รูป:`);
  lines.push(`- \`${baseB}.svg\``);
  lines.push(`- \`${baseB}.png\``);
  lines.push('');

  lines.push(`## Figure 4-3`);
  lines.push(`**Figure 4-3** แผนภาพ storyboard แบบ swimlane แยกบทบาทผู้ใช้เป็น Student lane และ Teacher lane เพื่ออธิบายภาพรวมการใช้งานระบบเชิงกระบวนการ โดย Student lane แสดงการเล่นกิจกรรมรายวันแบบกดปุ่มเดียว (student mode) ตั้งแต่ consent/attention/warmup/เกมต่าง ๆ จนจบวัน ส่วน Teacher lane แสดงการกำหนดค่า (teacher bar แบบ PIN) การติดตามความปลอดภัยและคุณภาพข้อมูล (เช่น fatigue flags) และการสรุปผล/ส่งออกข้อมูล (RAW/ANALYSIS) สำหรับการวิเคราะห์งานวิจัย.`);
  lines.push('');
  lines.push(`ไฟล์รูป:`);
  lines.push(`- \`${baseC}.svg\``);
  lines.push(`- \`${baseC}.png\``);
  lines.push('');

  lines.push(`---`);
  lines.push(`### หมายเหตุการอ้างอิงในรายงาน`);
  lines.push(`- หากใช้รูปในบท 4 ให้จัดวางรูปตาม Figure 4-1 ถึง 4-3 และอ้างในเนื้อความ เช่น “ดังแสดงใน Figure 4-2”`);
  lines.push(`- หากเปลี่ยน pid/วันที่ ให้ export captions ใหม่เพื่อให้ชื่อไฟล์สอดคล้อง`);
  lines.push('');

  const md = lines.join('\n');
  dlText(`HHA_ch4_captions_${date}_${pid}.md`, md);
  return md;
}