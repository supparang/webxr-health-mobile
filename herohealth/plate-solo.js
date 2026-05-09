/* === /herohealth/plate-solo.css ===
   Plate Solo v40.5 HOTFIX
   Append this block to the bottom of plate-solo.css
   Fix:
   - rightPanel / วิธีเล่นแบบเร็ว หลุดลงมาบังสนาม
   - food card ไม่มี icon/emoji เมื่อ PNG asset ไม่เจอ
   - จานกลางจอบังสายตาเกินไป
*/

/* 1) ห้ามให้ right panel ลงมาบังสนามในจอกว้าง/แท็บเล็ตแนวนอน */
@media (min-width: 861px){
  #gameShell,
  .gameShell{
    display:grid !important;
    grid-template-columns:320px minmax(520px,1fr) 320px !important;
    grid-template-rows:auto minmax(560px,1fr) !important;
    gap:14px !important;
    align-items:stretch !important;
  }

  #topStats,
  .topStats{
    grid-column:1 / 2 !important;
    grid-row:1 !important;
  }

  #topCenter,
  .topCenter,
  #headerCard,
  .headerCard{
    grid-column:2 / 3 !important;
    grid-row:1 !important;
  }

  #topRight,
  .topRight,
  #missionPanelTop,
  .missionPanelTop{
    grid-column:3 / 4 !important;
    grid-row:1 !important;
  }

  #leftPanel,
  .leftPanel{
    grid-column:1 / 2 !important;
    grid-row:2 !important;
  }

  #centerPanel,
  .centerPanel{
    grid-column:2 / 3 !important;
    grid-row:2 !important;
  }

  #rightPanel,
  .rightPanel{
    grid-column:3 / 4 !important;
    grid-row:2 !important;
    max-height:calc(100vh - 118px) !important;
    overflow:auto !important;
  }

  #arena,
  .arena{
    min-height:560px !important;
    height:calc(100vh - 135px - var(--safeTop) - var(--safeBottom)) !important;
    max-height:none !important;
  }

  #log,
  .log{
    height:210px !important;
    max-height:28vh !important;
  }
}

/* 2) ช่วงหน้าจอกลาง ให้ลด sidebar แทนการดัน panel ลงล่าง */
@media (min-width: 861px) and (max-width: 1280px){
  #gameShell,
  .gameShell{
    grid-template-columns:270px minmax(440px,1fr) 270px !important;
  }

  #leftPanel,
  .leftPanel,
  #rightPanel,
  .rightPanel{
    padding:12px !important;
  }

  .groupMeter{
    padding:9px 10px !important;
  }

  .mission{
    font-size:11px !important;
    padding:6px 8px !important;
  }
}

/* 3) มือถือจริงเท่านั้น ค่อยเอา right panel ลงล่าง */
@media (max-width: 860px){
  #rightPanel,
  .rightPanel{
    max-height:38vh !important;
    overflow:auto !important;
  }

  #arena,
  .arena{
    min-height:520px !important;
  }
}

/* 4) แก้การ์ดอาหารว่างเปล่า: ถ้ารูป asset ไม่ขึ้น ให้เห็น emoji แน่นอน */
.foodVisual{
  position:relative !important;
}

.foodVisual .foodEmojiFallback{
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  font-size:46px !important;
  line-height:1 !important;
  width:100% !important;
  height:100% !important;
}

/* ถ้ามี img โหลดได้ ให้รูปอยู่บน emoji */
.foodVisual img.foodImg,
.foodVisual .foodImg{
  position:absolute !important;
  inset:0 !important;
  z-index:2 !important;
  width:100% !important;
  height:100% !important;
  object-fit:contain !important;
}

/* ถ้ารูปเสีย JS จะซ่อน img แล้ว emoji จะโผล่ */
.foodVisual img.assetMissing,
.foodVisual .foodImg.assetMissing{
  display:none !important;
}

.foodVisual.assetFallback .foodEmojiFallback,
.foodCard .foodEmojiFallback{
  display:inline-flex !important;
}

/* icon บนจานก็ต้อง fallback เหมือนกัน */
.plateFoodIcon{
  position:relative !important;
}

.plateFoodIcon .foodEmojiFallback{
  display:inline-flex !important;
  align-items:center !important;
  justify-content:center !important;
  width:100% !important;
  height:100% !important;
  font-size:22px !important;
}

.plateFoodIcon img{
  position:absolute !important;
  inset:0 !important;
  z-index:2 !important;
}

.plateFoodIcon img.assetMissing{
  display:none !important;
}

/* 5) ลดความเด่นจานอีกนิด แต่ยังเห็นพอเป็นเป้าหมาย */
#app.playing #plate,
#app.playing .plate,
.app.playing #plate,
.app.playing .plate{
  opacity:.38 !important;
  scale:.66 !important;
}

/* Practice mode ยิ่งต้องไม่ให้จานแย่งสายตา */
#app.practice-mode #plate,
#app.practice-mode .plate,
.app.practice-mode #plate,
.app.practice-mode .plate{
  opacity:.32 !important;
  scale:.62 !important;
}

/* 6) ให้เป้าชัดกว่า background */
.foodCard{
  background:rgba(255,255,255,.96) !important;
  border-width:3px !important;
  z-index:80 !important;
}

.foodCard .name{
  font-size:13px !important;
  font-weight:1000 !important;
  color:#31536a !important;
}

/* 7) ลดความสูงแผงวิธีเล่น/พลัง/ประวัติด้านขวา */
.rightPanel .panelTitle,
#rightPanel .panelTitle,
.rightPanel .sectionTitle,
#rightPanel .sectionTitle{
  margin-bottom:8px !important;
}

#hintBox,
.hintBox{
  margin-bottom:8px !important;
  padding:9px 11px !important;
}

.powerRow,
#powerRow{
  margin:8px 0 !important;
}

/* 8) ถ้าหน้าจอเตี้ยมาก ให้ลด log และ overlay ไม่ให้บัง */
@media (min-width: 861px) and (max-height: 760px){
  #rightPanel,
  .rightPanel{
    max-height:calc(100vh - 96px) !important;
  }

  #log,
  .log{
    height:145px !important;
    max-height:22vh !important;
  }

  #arena,
  .arena{
    height:calc(100vh - 116px - var(--safeTop) - var(--safeBottom)) !important;
  }

  #orderBox,
  #bossMechanicBox{
    top:112px !important;
  }

  #miniEventBox,
  #lastSaveBox{
    top:152px !important;
  }
}

/* 9) Landscape tablet safety: ให้สนามเป็นพื้นที่หลัก */
@media (orientation: landscape) and (min-width: 861px) and (max-width: 1180px){
  #gameShell,
  .gameShell{
    grid-template-columns:250px minmax(430px,1fr) 250px !important;
  }

  #arena,
  .arena{
    min-height:500px !important;
  }

  .foodCard{
    width:98px !important;
    min-height:118px !important;
  }

  .foodVisual{
    width:58px !important;
    height:58px !important;
  }
}
