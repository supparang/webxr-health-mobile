/* Fitness Duo VR — Menu Router
   - เลือก: Adventure (วิ่ง) หรือ Rhythm (ขยับตามจังหวะ)
   - ส่งต่อไปหน้าเกมย่อยผ่าน query string
   - เก็บสถิติเบา ๆ ใน localStorage
*/

const $ = (id)=>document.getElementById(id);
const stat = $("stat");
const sky = document.getElementById("sky");

/* ==== กำหนดปลายทางของแต่ละเกม (ปรับ path ให้ตรงโครงสร้างโปรเจกต์ของคุณ) ==== */
// แนะนำวาง:
//   fitness-duo/           (เมนูนี้)
//     adventure/index.html (เกมวิ่งของคุณที่มีอยู่แล้ว)
//     rhythm/index.html    (เกม Rhythm Stretch VR)
// แล้วปรับ path ด้านล่างให้ตรง
const ROUTE = {
  adventure: "adventure/index.html",
  rhythm:    "rhythm/index.html"
};

/* ==== Utility ==== */
function qs(params){
  const usp = new URLSearchParams(params);
  return "?" + usp.toString();
}
function track(key){
  try{
    const raw = localStorage.getItem("fitnessDuoStats") || "{}";
    const s = JSON.parse(raw);
    s[key] = (s[key]||0)+1;
    localStorage.setItem("fitnessDuoStats", JSON.stringify(s));
  }catch(e){}
}

/* ==== ปุ่ม Adventure ==== */
$("btnAdvStart").onclick = ()=>{
  const diff  = $("advDiff").value;
  const theme = $("advTheme").value;
  const quest = $("advQuest").value;

  // บันทึกสถิติเมนู
  track("start_adventure");

  const url = ROUTE.adventure + qs({ diff, theme, quest, source:"fitness-duo" });
  // ตรวจสอบว่าเส้นทางน่าจะถูก (เบื้องต้น)
  if (!ROUTE.adventure) {
    alert("ยังไม่ได้ตั้งค่าเส้นทาง Adventure");
    return;
  }
  stat.textContent = "กำลังเปิด Adventure…";
  window.location.href = url;
};
$("btnAdvHow").onclick = ()=>{
  alert("Adventure Mode:\n- เปลี่ยนเลน (ซ้าย/กลาง/ขวา) เพื่อเก็บ Orb และหลบสิ่งกีดขวาง\n- มีโหมด Easy/Normal/Hard + เควส\n- เลือกธีม Jungle/City/Space");
};

/* ==== ปุ่ม Rhythm ==== */
$("btnRymStart").onclick = ()=>{
  const mode  = $("rymMode").value;   // training/challenge
  const bpm   = $("rymBpm").value;    // 100–130
  const theme = $("rymTheme").value;  // beach/city/galaxy

  track("start_rhythm");

  const url = ROUTE.rhythm + qs({ mode, bpm, theme, source:"fitness-duo" });
  if (!ROUTE.rhythm) {
    alert("ยังไม่ได้ตั้งค่าเส้นทาง Rhythm");
    return;
  }
  stat.textContent = "กำลังเปิด Rhythm…";
  window.location.href = url;
};
$("btnRymHow").onclick = ()=>{
  alert("Rhythm Stretch VR:\n- ขยับตามไฟ/สัญญาณที่ลอยเข้ามาตามจังหวะเพลง\n- โหมด Training ช้ากว่า โหมด Challenge เร็วกว่า\n- ปรับ BPM ได้ 100–130");
};

/* ==== Optional: เปลี่ยนสีท้องฟ้าตามการโฮเวอร์การ์ด (เอฟเฟกต์น่ารัก ๆ) ==== */
const advThemeSel = $("advTheme");
const rymThemeSel = $("rymTheme");

function setSkyColor(themeGroup, theme){
  // โทนสีเบา ๆ แทนภาพ 360° (ถ้าอยากใช้รูปจริง ให้ใช้ <a-assets> + setAttribute('src', '#id') )
  const map = {
    adventure: {
      jungle: "#0e2412",
      city:   "#0f141a",
      space:  "#050914"
    },
    rhythm: {
      beach:  "#001a29",
      city:   "#10141f",
      galaxy: "#070022"
    }
  };
  const col = (map[themeGroup] && map[themeGroup][theme]) || "#0b1220";
  sky.setAttribute("color", col);
}

advThemeSel.addEventListener("change", ()=> setSkyColor("adventure", advThemeSel.value));
rymThemeSel.addEventListener("change", ()=> setSkyColor("rhythm", rymThemeSel.value));

// ค่าเริ่มต้น
setSkyColor("adventure", advThemeSel.value);

/* ==== เสริม: แสดงสถิติการคลิกเมนู ==== */
(function showStats(){
  try{
    const s = JSON.parse(localStorage.getItem("fitnessDuoStats")||"{}");
    const adv = s.start_adventure||0, rym = s.start_rhythm||0;
    stat.textContent = `พร้อมเริ่ม • เลือกเกมด้านล่าง\nเริ่ม Adventure: ${adv} ครั้ง • เริ่ม Rhythm: ${rym} ครั้ง`;
  }catch(e){}
})();
