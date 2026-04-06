<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>HeroHealth • Groups VR</title>
  <meta name="color-scheme" content="light" />
  <meta name="theme-color" content="#9fe3ff" />
  <link rel="icon" href="./favicon.ico" />

  <style>
    :root{
      --sky1:#e9f9ff;
      --sky2:#d5f1ff;
      --sky3:#bfe8ff;

      --card:#fffefb;
      --card2:#f8fdff;
      --line:#d6edf7;

      --text:#29485f;
      --muted:#6a8ba0;

      --blue:#61bbff;
      --blue2:#2f95ff;
      --green:#7ed957;
      --green2:#4fc64c;
      --yellow:#ffd966;
      --yellow2:#ffba4a;
      --pink:#ff9fd0;
      --pink2:#ff6db2;
      --violet:#bca7ff;
      --violet2:#8d74ff;
      --orange:#ffb168;
      --orange2:#ff8e47;

      --shadow:0 16px 34px rgba(93,155,185,.16);
      --shadow-lg:0 22px 48px rgba(75,138,170,.18);

      --sat: env(safe-area-inset-top, 0px);
      --sab: env(safe-area-inset-bottom, 0px);
      --sal: env(safe-area-inset-left, 0px);
      --sar: env(safe-area-inset-right, 0px);
    }

    *{ box-sizing:border-box; }
    html,body{ min-height:100%; }

    body{
      margin:0;
      font-family:ui-rounded,"Nunito","Noto Sans Thai",system-ui,sans-serif;
      color:var(--text);
      background:
        radial-gradient(1100px 620px at 50% -10%, rgba(255,255,255,.92), transparent 58%),
        radial-gradient(680px 420px at 12% 8%, rgba(255,255,255,.48), transparent 62%),
        linear-gradient(180deg,var(--sky1),var(--sky2) 56%,var(--sky3));
    }

    .shell{
      min-height:100dvh;
      padding:
        calc(14px + var(--sat))
        calc(14px + var(--sar))
        calc(18px + var(--sab))
        calc(14px + var(--sal));
      width:min(1180px,100%);
      margin:0 auto;
      display:grid;
      gap:14px;
    }

    .topbar{
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:12px;
      flex-wrap:wrap;
    }

    .brand{
      min-width:0;
      display:flex;
      align-items:center;
      gap:12px;
      padding:12px 14px;
      background:rgba(255,255,255,.86);
      border:1px solid var(--line);
      border-radius:24px;
      box-shadow:var(--shadow);
      backdrop-filter:blur(6px);
      flex:1 1 520px;
    }

    .brandMark{
      width:56px;
      height:56px;
      border-radius:18px;
      display:grid;
      place-items:center;
      font-size:30px;
      background:linear-gradient(180deg,#fff3b7,#ffd76f);
      border:1px solid #ffe39a;
      box-shadow:0 10px 22px rgba(255,214,111,.20);
      flex:0 0 auto;
    }

    .brand h1{
      margin:0;
      font-size:clamp(1.3rem,2.3vw,1.9rem);
      line-height:1.05;
      font-weight:1000;
    }

    .brand p{
      margin:4px 0 0;
      color:var(--muted);
      font-size:.95rem;
      font-weight:800;
    }

    .actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }

    .btn{
      min-height:46px;
      border:none;
      border-radius:18px;
      padding:0 16px;
      font:inherit;
      font-weight:1000;
      cursor:pointer;
      color:var(--text);
      background:#fff;
      border:1px solid var(--line);
      box-shadow:var(--shadow);
    }

    .btn.primary{
      color:#fff;
      border:none;
      background:linear-gradient(180deg,var(--blue),var(--blue2));
    }

    .hero{
      position:relative;
      overflow:hidden;
      border-radius:30px;
      background:linear-gradient(180deg,rgba(255,255,255,.88),rgba(248,253,255,.92));
      border:1px solid var(--line);
      box-shadow:var(--shadow-lg);
      padding:18px;
    }

    .hero::after{
      content:"";
      position:absolute;
      right:-40px;
      top:-36px;
      width:180px;
      height:180px;
      border-radius:50%;
      background:
        radial-gradient(circle at 34% 34%, rgba(255,255,255,.65), transparent 26%),
        linear-gradient(180deg,#fff2ae,#ffd05f);
      opacity:.78;
    }

    .heroRow{
      position:relative;
      z-index:1;
      display:grid;
      grid-template-columns:1.1fr .9fr;
      gap:16px;
      align-items:center;
    }

    .hero h2{
      margin:0 0 8px;
      font-size:clamp(1.6rem,3vw,2.4rem);
      line-height:1.08;
      font-weight:1000;
    }

    .hero p{
      margin:0;
      color:var(--muted);
      line-height:1.6;
      font-weight:800;
      max-width:62ch;
    }

    .heroChips{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      margin-top:14px;
    }

    .chip{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:34px;
      padding:6px 12px;
      border-radius:999px;
      background:#fff;
      border:1px solid var(--line);
      color:#5d7f95;
      font-size:.86rem;
      font-weight:1000;
    }

    .heroPanel{
      display:grid;
      gap:10px;
    }

    .panelCard{
      border-radius:22px;
      padding:14px;
      background:rgba(255,255,255,.84);
      border:1px solid var(--line);
      box-shadow:var(--shadow);
    }

    .panelLabel{
      color:var(--muted);
      font-size:.82rem;
      font-weight:1000;
      text-transform:uppercase;
      letter-spacing:.05em;
      margin-bottom:4px;
    }

    .panelValue{
      font-size:1.2rem;
      font-weight:1000;
      line-height:1.2;
    }

    .modeGrid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:14px;
    }

    .modeCard{
      position:relative;
      overflow:hidden;
      border-radius:28px;
      background:linear-gradient(180deg,var(--card),var(--card2));
      border:1px solid var(--line);
      box-shadow:var(--shadow-lg);
      padding:16px;
      display:grid;
      gap:12px;
    }

    .modeCard::before{
      content:"";
      position:absolute;
      right:-28px;
      top:-30px;
      width:138px;
      height:138px;
      border-radius:50%;
      opacity:.9;
      pointer-events:none;
    }

    .modeCard.solo::before{
      background:linear-gradient(180deg,#fff4b6,#ffd76d);
    }

    .modeCard.race::before{
      background:linear-gradient(180deg,#b8e7ff,#73c7ff);
    }

    .modeCard.battle::before{
      background:linear-gradient(180deg,#ffd0c7,#ff9b81);
    }

    .modeCard.duet::before{
      background:linear-gradient(180deg,#ffe0f2,#ff9fd0);
    }

    .modeCard.coop::before{
      background:linear-gradient(180deg,#e6dbff,#b79cff);
    }

    .modeTop{
      position:relative;
      z-index:1;
      display:flex;
      justify-content:space-between;
      gap:10px;
      align-items:flex-start;
    }

    .modeIcon{
      width:58px;
      height:58px;
      border-radius:18px;
      display:grid;
      place-items:center;
      font-size:30px;
      background:#fff;
      border:1px solid rgba(0,0,0,.04);
      box-shadow:0 10px 22px rgba(120,160,185,.12);
      flex:0 0 auto;
    }

    .statusPill{
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:32px;
      padding:6px 12px;
      border-radius:999px;
      font-size:.82rem;
      font-weight:1000;
      white-space:nowrap;
    }

    .statusPill.ready{
      background:rgba(126,217,87,.14);
      border:1px solid rgba(126,217,87,.26);
      color:#45813a;
    }

    .statusPill.soon{
      background:rgba(255,185,92,.16);
      border:1px solid rgba(255,185,92,.26);
      color:#9a6517;
    }

    .modeBody{
      position:relative;
      z-index:1;
    }

    .modeTitle{
      margin:0;
      font-size:1.35rem;
      line-height:1.12;
      font-weight:1000;
    }

    .modeSub{
      margin:6px 0 0;
      color:var(--muted);
      font-size:.95rem;
      line-height:1.55;
      font-weight:800;
    }

    .modeMeta{
      display:flex;
      flex-wrap:wrap;
      gap:8px;
      margin-top:10px;
    }

    .modeMeta span{
      display:inline-flex;
      align-items:center;
      min-height:30px;
      padding:5px 10px;
      border-radius:999px;
      background:#fff;
      border:1px solid var(--line);
      font-size:.8rem;
      font-weight:1000;
      color:#5e7f94;
    }

    .modeActions{
      position:relative;
      z-index:1;
      display:flex;
      gap:10px;
      flex-wrap:wrap;
      margin-top:auto;
    }

    .modeBtn{
      min-height:46px;
      border:none;
      border-radius:18px;
      padding:0 16px;
      font:inherit;
      font-weight:1000;
      cursor:pointer;
      box-shadow:var(--shadow);
    }

    .modeBtn.play{
      color:#fff;
      background:linear-gradient(180deg,var(--blue),var(--blue2));
    }

    .modeBtn.alt{
      color:var(--text);
      background:#fff;
      border:1px solid var(--line);
    }

    .modeBtn.disabled{
      cursor:not-allowed;
      color:#8aa0af;
      background:#eef6fb;
      border:1px dashed #cfe4ef;
      box-shadow:none;
    }

    .footerNote{
      border-radius:22px;
      padding:14px 16px;
      background:rgba(255,255,255,.78);
      border:1px solid var(--line);
      box-shadow:var(--shadow);
      color:var(--muted);
      font-weight:800;
      line-height:1.6;
    }

    .toast{
      position:fixed;
      left:50%;
      bottom:18px;
      transform:translateX(-50%) translateY(14px);
      min-width:min(520px,calc(100vw - 28px));
      max-width:calc(100vw - 28px);
      padding:12px 14px;
      border-radius:18px;
      background:rgba(40,72,95,.94);
      color:#fff;
      font-weight:900;
      text-align:center;
      box-shadow:0 18px 40px rgba(0,0,0,.22);
      opacity:0;
      pointer-events:none;
      transition:opacity .18s ease, transform .18s ease;
      z-index:30;
    }

    .toast.show{
      opacity:1;
      transform:translateX(-50%) translateY(0);
    }

    @media (max-width: 900px){
      .heroRow,
      .modeGrid{
        grid-template-columns:1fr;
      }
    }

    @media (max-width: 640px){
      .shell{
        padding:
          calc(10px + var(--sat))
          calc(10px + var(--sar))
          calc(14px + var(--sab))
          calc(10px + var(--sal));
        gap:10px;
      }

      .topbar{
        align-items:stretch;
      }

      .actions{
        width:100%;
      }

      .actions .btn{
        flex:1 1 auto;
      }

      .brand{
        padding:10px 12px;
        border-radius:20px;
      }

      .brandMark{
        width:50px;
        height:50px;
        font-size:26px;
      }

      .modeCard{
        padding:14px;
        border-radius:24px;
      }

      .modeTitle{
        font-size:1.22rem;
      }

      .modeActions{
        flex-direction:column;
      }

      .modeBtn{
        width:100%;
      }
    }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brandMark">🥦</div>
        <div>
          <h1>Food Groups</h1>
          <p>เลือกโหมดที่อยากเล่น แล้วออกลุยกันเลย</p>
        </div>
      </div>

      <div class="actions">
        <button class="btn" id="btnContinue" type="button">▶ เล่นล่าสุด</button>
        <button class="btn primary" id="btnBackHub" type="button">🏠 กลับ HUB</button>
      </div>
    </header>

    <section class="hero">
      <div class="heroRow">
        <div>
          <h2>เกมจัดหมวดอาหารแบบสนุกและเข้าใจง่าย</h2>
          <p>
            ฝึกจำอาหารแต่ละหมู่ให้แม่นขึ้น ผ่านโหมดเล่นหลายแบบ
            ตอนนี้เปิดให้เล่นก่อน 2 โหมดคือ <b>Solo</b> และ <b>Race</b>
            ส่วน Battle, Duet และ Coop จะค่อย ๆ เปิดเพิ่มทีละโหมด
          </p>

          <div class="heroChips">
            <span class="chip">🥇 Solo พร้อมเล่น</span>
            <span class="chip">🏁 Race พร้อมเล่น</span>
            <span class="chip">⚔️ Battle เร็ว ๆ นี้</span>
            <span class="chip">🤝 Duet / Coop เร็ว ๆ นี้</span>
          </div>
        </div>

        <div class="heroPanel">
          <div class="panelCard">
            <div class="panelLabel">Main Game</div>
            <div class="panelValue">groups-vr.html</div>
          </div>
          <div class="panelCard">
            <div class="panelLabel">Run Game</div>
            <div class="panelValue">/herohealth/vr-groups/groups.html</div>
          </div>
          <div class="panelCard">
            <div class="panelLabel">ตอนนี้เปิดจริง</div>
            <div class="panelValue">Solo • Race</div>
          </div>
        </div>
      </div>
    </section>

    <section class="modeGrid">
      <article class="modeCard solo">
        <div class="modeTop">
          <div class="modeIcon">🥇</div>
          <div class="statusPill ready">พร้อมเล่น</div>
        </div>
        <div class="modeBody">
          <h3 class="modeTitle">Solo</h3>
          <p class="modeSub">
            เล่นคนเดียว ฝึกจับหมวดอาหารให้ถูกต้อง วัดคะแนน ความแม่นยำ และสตรีค
          </p>
          <div class="modeMeta">
            <span>เล่นคนเดียว</span>
            <span>ฝึกพื้นฐาน</span>
            <span>เหมาะเริ่มก่อน</span>
          </div>
        </div>
        <div class="modeActions">
          <button class="modeBtn play" data-mode="solo" type="button">เล่น Solo</button>
          <button class="modeBtn alt" data-mode="solo" data-view="mobile" type="button">เล่นบนมือถือ</button>
        </div>
      </article>

      <article class="modeCard race">
        <div class="modeTop">
          <div class="modeIcon">🏁</div>
          <div class="statusPill ready">พร้อมเล่น</div>
        </div>
        <div class="modeBody">
          <h3 class="modeTitle">Race</h3>
          <p class="modeSub">
            แข่งหลายเครื่อง ใครจัดหมวดได้เร็วและแม่นที่สุดก็ชนะ เหมาะเล่นกับเพื่อน
          </p>
          <div class="modeMeta">
            <span>หลายคน</span>
            <span>มีห้องแข่ง</span>
            <span>มีอันดับผู้ชนะ</span>
          </div>
        </div>
        <div class="modeActions">
          <button class="modeBtn play" data-mode="race" type="button">เข้า Race Lobby</button>
          <button class="modeBtn alt" data-mode="race" data-action="join" type="button">มีรหัสห้องแล้ว</button>
        </div>
      </article>

      <article class="modeCard battle">
        <div class="modeTop">
          <div class="modeIcon">⚔️</div>
          <div class="statusPill soon">เร็ว ๆ นี้</div>
        </div>
        <div class="modeBody">
          <h3 class="modeTitle">Battle</h3>
          <p class="modeSub">
            แข่งกันแบบกดดันขึ้นกว่าเดิม เน้นแพ้ชนะชัดเจนและความตื่นเต้นระหว่างเกม
          </p>
          <div class="modeMeta">
            <span>โหมดแข่งขัน</span>
            <span>กำลังเตรียมเปิด</span>
          </div>
        </div>
        <div class="modeActions">
          <button class="modeBtn disabled" data-soon="battle" type="button">เร็ว ๆ นี้</button>
        </div>
      </article>

      <article class="modeCard duet">
        <div class="modeTop">
          <div class="modeIcon">🤝</div>
          <div class="statusPill soon">เร็ว ๆ นี้</div>
        </div>
        <div class="modeBody">
          <h3 class="modeTitle">Duet</h3>
          <p class="modeSub">
            เล่น 2 คนเป็นคู่ ช่วยกันทำเป้าหมายและฝึกความแม่นยำไปพร้อมกัน
          </p>
          <div class="modeMeta">
            <span>2 คน</span>
            <span>เล่นเป็นคู่</span>
          </div>
        </div>
        <div class="modeActions">
          <button class="modeBtn disabled" data-soon="duet" type="button">เร็ว ๆ นี้</button>
        </div>
      </article>

      <article class="modeCard coop">
        <div class="modeTop">
          <div class="modeIcon">🧩</div>
          <div class="statusPill soon">เร็ว ๆ นี้</div>
        </div>
        <div class="modeBody">
          <h3 class="modeTitle">Coop</h3>
          <p class="modeSub">
            เล่นเป็นทีม ช่วยกันทำเป้าหมายรวม เน้นความร่วมมือและความสนุกของทีม
          </p>
          <div class="modeMeta">
            <span>เล่นเป็นทีม</span>
            <span>เป้าหมายร่วม</span>
          </div>
        </div>
        <div class="modeActions">
          <button class="modeBtn disabled" data-soon="coop" type="button">เร็ว ๆ นี้</button>
        </div>
      </article>
    </section>

    <section class="footerNote">
      ตอนนี้หน้า main นี้ตั้งใจทำเป็น <b>launcher กลาง</b> ของเกม Groups โดยเปิดจริงแค่
      <b>Solo</b> และ <b>Race</b> ก่อน เพื่อให้ flow หลักนิ่งที่สุด แล้วค่อยเปิด Battle, Duet และ Coop ภายหลัง
    </section>
  </main>

  <div class="toast" id="toast">โหมดนี้กำลังเตรียมเปิดเร็ว ๆ นี้</div>

  <script src="./groups-vr.boot.js"></script>
</body>
</html>