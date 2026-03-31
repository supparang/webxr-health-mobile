HeroHealth Hub v2 + Game Pages Integration Pack

สิ่งที่ได้:
1) assets/logo-system/   = โลโก้ทั้งชุดจาก pack เดิม
2) assets/herohealth-brand.css = style เสริมสำหรับ Hub v2 + หน้าเกม
3) assets/herohealth-brand.js  = ตัวช่วย map ชื่อเกมจริง + mount logo อัตโนมัติ
4) hub-v2-dropin.html          = snippet สำหรับ /herohealth/hub-v2.html
5) game-page-dropin.html       = snippet สำหรับทุกหน้าเกม

ชื่อเกมจริงที่ map ไว้แล้ว:
- goodjunk           -> GoodJunk Hero
- plate / platev1    -> Balanced Plate
- groups             -> Food Groups Quest
- hydration          -> Hydration Quest
- brush / brush-vr   -> Brush Hero
- bath / bath-v2     -> Bath Time Hero
- germ-detective     -> Germ Detective
- shadow-breaker     -> Shadow Breaker
- rhythm-boxer       -> Rhythm Boxer
- jump-duck          -> Jump Duck

วิธีใช้เร็ว:
A) วางโฟลเดอร์ assets ทั้งหมดไว้ใต้ /herohealth/
   ตัวอย่าง:
   /herohealth/assets/logo-system/...
   /herohealth/assets/herohealth-brand.css
   /herohealth/assets/herohealth-brand.js

B) หน้า hub-v2.html
   - เอา snippet จาก hub-v2-dropin.html ไปแปะ
   - mount point แนะนำให้อยู่เหนือ topbar เดิม หรืออยู่แทน branding block เดิม

C) หน้าเกมทุกหน้า
   - เอา snippet จาก game-page-dropin.html ไปแปะ
   - ใช้ data-game ที่ <body> ได้ถ้าต้องการ override เช่น
     <body data-game="goodjunk">
   - ถ้าไม่ใส่ script จะพยายามเดาจาก URL pathname และ query ?game=

D) HUD / badge
   - ใช้ไฟล์ใน assets/logo-system/hud และ badges ได้ทันที

หมายเหตุ:
- path ปัจจุบันถูกตั้งแบบ relative จาก /herohealth/...
- ถ้าบางหน้าอยู่โฟลเดอร์ลึก เช่น /herohealth/vr-goodjunk/goodjunk-run.html
  ให้เปลี่ยน path เป็น ../assets/... ตามระดับโฟลเดอร์
