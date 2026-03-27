<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>HeroHealth • Hydration Duet</title>
  <meta name="color-scheme" content="light" />
  <meta name="theme-color" content="#cbf0ff" />
  <link rel="icon" href="./favicon.ico" />
  <style>
    :root{
      --sky1:#e9fbff;
      --sky2:#c9f0ff;
      --sky3:#afe3ff;

      --card:#fffef9;
      --card2:#f6fff5;
      --line:#d7eef7;

      --text:#294d67;
      --muted:#7292a7;

      --green1:#8bdd69;
      --green2:#59be43;
      --blue1:#80d1ff;
      --blue2:#4fa9ef;
      --yellow1:#ffe283;
      --yellow2:#f6bf47;
      --pink1:#ffe0eb;
      --pink2:#ffc7da;

      --shadow:0 14px 34px rgba(90,145,180,.16);
      --shadow-lg:0 22px 56px rgba(90,145,180,.22);

      --r-xl:30px;
      --r-lg:24px;
      --r-md:18px;
      --r-sm:14px;
    }

    *{ box-sizing:border-box; }
    html,body{
      margin:0;
      min-height:100%;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,TH Sarabun New,sans-serif;
      color:var(--text);
      background:
        radial-gradient(circle at 15% 12%, rgba(255,255,255,.75), transparent 15%),
        radial-gradient(circle at 85% 14%, rgba(255,255,255,.58), transparent 14%),
        linear-gradient(180deg,var(--sky1),var(--sky2) 48%,var(--sky3));
    }

    body{
      padding:16px;
    }

    button,input,select{
      font:inherit;
    }

    button{
      -webkit-tap-highlight-color:transparent;
      cursor:pointer;
    }

    .page{
      width:min(1160px,100%);
      margin:0 auto;
      display:grid;
      gap:14px;
    }

    .hero,
    .panel,
    .card,
    .big-card,
    .bubble-note{
      background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(248,255,251,.96));
      border:1px solid rgba(255,255,255,.96);
      box-shadow:
        0 18px 40px rgba(90,145,180,.14),
        inset 0 1px 0 rgba(255,255,255,.92);
    }

    .hero{
      position:relative;
      overflow:hidden;
      border-radius:var(--r-xl);
      padding:16px;
      display:grid;
      gap:14px;
    }

    .hero::after{
      content:"";
      position:absolute;
      left:0; right:0; bottom:0;
      height:92px;
      background:
        radial-gradient(circle at 10% 76%, #d4f3ad 0 18%, transparent 19%),
        radial-gradient(circle at 34% 100%, #a8e37f 0 12%, transparent 13%),
        radial-gradient(circle at 84% 74%, #d4f3ad 0 18%, transparent 19%),
        linear-gradient(180deg, rgba(255,255,255,0), rgba(125,209,92,.12) 40%, rgba(104,191,70,.24) 100%);
      pointer-events:none;
    }

    .hero > *{
      position:relative;
      z-index:1;
    }

    .hero-top{
      display:flex;
      justify-content:space-between;
      align-items:center;
      gap:12px;
    }

    .chip-row{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
      justify-content:flex-end;
    }

    .chip{
      min-height:34px;
      padding:7px 12px;
      border-radius:999px;
      background:rgba(255,255,255,.84);
      border:1px solid rgba(255,255,255,.96);
      box-shadow:var(--shadow);
      color:#64889f;
      font-size:12px;
      font-weight:1000;
    }

    .brand{
      display:grid;
      grid-template-columns:auto 1fr auto;
      gap:14px;
      align-items:center;
    }

    .brand-avatar{
      width:82px;
      height:82px;
      border-radius:26px;
      display:grid;
      place-items:center;
      overflow:hidden;
      background:linear-gradient(180deg,#fff7e5,#ffe8bf);
      box-shadow:var(--shadow);
    }

    .avatar-illust{
      position:relative;
      width:62px;
      height:62px;
    }

    .av-head{
      position:absolute;
      left:18px; top:10px;
      width:24px; height:24px;
      border-radius:999px;
      background:#ffd7b5;
      z-index:3;
    }

    .av-hair{
      position:absolute;
      left:15px; top:6px;
      width:28px; height:16px;
      border-radius:16px 16px 10px 10px;
      background:linear-gradient(180deg,#7d4124,#5f2f18);
      transform:rotate(-8deg);
      z-index:4;
    }

    .av-body{
      position:absolute;
      left:14px; top:30px;
      width:30px; height:20px;
      border-radius:16px 16px 12px 12px;
      background:linear-gradient(180deg,#7ecfff,#4ea8ef);
      z-index:2;
    }

    .av-cape{
      position:absolute;
      left:4px; top:25px;
      width:18px; height:26px;
      border-radius:14px 0 14px 14px;
      background:linear-gradient(180deg,#ff7f63,#ef5d45);
      transform:rotate(-24deg);
      z-index:1;
    }

    .av-drop{
      position:absolute;
      right:2px; bottom:5px;
      width:20px; height:20px;
      border-radius:999px;
      display:grid;
      place-items:center;
      font-size:12px;
      color:#fff;
      background:linear-gradient(180deg,#8add68,#59be43);
      z-index:5;
      box-shadow:0 6px 12px rgba(86,185,67,.22);
    }

    .brand-text{
      min-width:0;
    }

    .brand-logo{
      display:flex;
      flex-wrap:wrap;
      align-items:center;
      gap:2px;
      font-size:clamp(36px,6vw,56px);
      line-height:1;
      font-weight:1000;
      letter-spacing:-.03em;
      text-shadow:0 3px 0 rgba(255,255,255,.72);
    }

    .brand-logo .hero-word{ color:#90be20; }
    .brand-logo .health-word{
      color:#fff;
      text-shadow:
        0 3px 0 rgba(89,145,180,.22),
        0 0 1px rgba(89,145,180,.18);
    }

    .brand-sub{
      color:#6e8fa3;
      font-size:15px;
      font-weight:900;
      margin-top:4px;
    }

    .home-btn{
      border:0;
      width:54px;
      height:54px;
      border-radius:18px;
      display:grid;
      place-items:center;
      background:linear-gradient(180deg,#fff,#eefcff);
      box-shadow:var(--shadow);
      color:#608aa2;
      font-size:24px;
    }

    .layout{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:14px;
    }

    .panel{
      border-radius:var(--r-xl);
      padding:16px;
      display:grid;
      gap:14px;
      align-content:start;
    }

    .section-title{
      margin:0;
      font-size:30px;
      line-height:1.06;
      color:#2c516a;
      font-weight:1000;
    }

    .section-sub{
      margin:0;
      color:var(--muted);
      font-size:15px;
      line-height:1.55;
      font-weight:700;
    }

    .big-card{
      border-radius:28px;
      padding:18px;
      display:grid;
      gap:16px;
      min-height:420px;
    }

    .duet-scene{
      position:relative;
      min-height:230px;
      border-radius:28px;
      overflow:hidden;
      background:
        radial-gradient(circle at 14% 14%, rgba(255,255,255,.92), transparent 10%),
        radial-gradient(circle at 84% 16%, rgba(255,255,255,.72), transparent 12%),
        linear-gradient(180deg, #e9fbff 0%, #c9f0ff 42%, #afe3ff 100%);
      border:1px solid rgba(255,255,255,.96);
      box-shadow:var(--shadow);
      display:grid;
      place-items:center;
      padding:18px;
    }

    .duet-scene::after{
      content:"";
      position:absolute;
      left:0; right:0; bottom:0;
      height:84px;
      background:
        radial-gradient(circle at 10% 76%, #d4f3ad 0 18%, transparent 19%),
        radial-gradient(circle at 34% 100%, #a8e37f 0 12%, transparent 13%),
        radial-gradient(circle at 84% 74%, #d4f3ad 0 18%, transparent 19%),
        linear-gradient(180deg, rgba(255,255,255,0), rgba(125,209,92,.12) 40%, rgba(104,191,70,.24) 100%);
      pointer-events:none;
    }

    .duet-stage{
      position:relative;
      z-index:1;
      display:grid;
      grid-template-columns:1fr auto 1fr;
      align-items:center;
      gap:16px;
      width:100%;
    }

    .duet-player{
      display:grid;
      justify-items:center;
      gap:10px;
      text-align:center;
    }

    .duet-avatar{
      width:90px;
      height:90px;
      border-radius:28px;
      display:grid;
      place-items:center;
      background:linear-gradient(180deg,#f2fbff,#dff3ff);
      box-shadow:var(--shadow);
    }

    .duet-name{
      font-size:22px;
      font-weight:1000;
      color:#294d67;
      line-height:1.05;
    }

    .duet-role{
      color:#6f90a5;
      font-size:14px;
      font-weight:800;
    }

    .middle-badge{
      width:84px;
      height:84px;
      border-radius:999px;
      display:grid;
      place-items:center;
      background:linear-gradient(180deg,#fff7db,#ffefbd);
      box-shadow:var(--shadow);
      font-size:34px;
    }

    .bubble-note{
      padding:12px 16px;
      border-radius:20px;
      color:#6a5a21;
      background:linear-gradient(180deg,#fff7db,#ffefbd);
      border:1px solid #ffe39a;
      font-size:15px;
      line-height:1.5;
      font-weight:900;
    }

    .form-grid{
      display:grid;
      gap:12px;
    }

    .field{
      display:grid;
      gap:8px;
    }

    .field label{
      color:#7094ab;
      font-size:14px;
      font-weight:1000;
    }

    .field input,
    .field select{
      width:100%;
      min-height:52px;
      border-radius:16px;
      border:1px solid #cfe8f3;
      background:#fff;
      color:var(--text);
      padding:12px 14px;
      outline:none;
      font-size:16px;
      font-weight:800;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.7);
    }

    .two-col{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:12px;
    }

    .btn-row{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }

    .ui-btn{
      border:0;
      min-height:54px;
      padding:12px 18px;
      border-radius:18px;
      font-size:18px;
      font-weight:1000;
      box-shadow:
        0 12px 26px rgba(90,145,180,.14),
        inset 0 1px 0 rgba(255,255,255,.18);
    }

    .ui-btn.green{ background:linear-gradient(180deg,var(--green1),var(--green2)); color:#fff; }
    .ui-btn.blue{ background:linear-gradient(180deg,var(--blue1),var(--blue2)); color:#fff; }
    .ui-btn.soft{ background:linear-gradient(180deg,#fff,#eefcff); color:var(--text); border:1px solid rgba(255,255,255,.96); }

    .note-list{
      display:grid;
      gap:10px;
    }

    .card{
      border-radius:22px;
      padding:14px;
      display:grid;
      gap:8px;
    }

    .card-title{
      color:#315873;
      font-size:18px;
      font-weight:1000;
      line-height:1.1;
    }

    .card-text{
      color:#6e8ea4;
      font-size:15px;
      line-height:1.55;
      font-weight:700;
    }

    .hint{
      color:#7898ac;
      font-size:13px;
      line-height:1.5;
      font-weight:800;
    }

    @media (max-width:960px){
      .layout{
        grid-template-columns:1fr;
      }
    }

    @media (max-width:640px){
      body{
        padding:12px;
      }

      .page{
        gap:12px;
      }

      .hero,
      .panel,
      .big-card{
        border-radius:24px;
      }

      .brand{
        grid-template-columns:auto 1fr;
      }

      .home-btn{
        grid-column:1 / -1;
        justify-self:start;
      }

      .brand-logo{
        font-size:clamp(28px,10vw,40px);
      }

      .brand-avatar{
        width:66px;
        height:66px;
        border-radius:22px;
      }

      .avatar-illust{
        width:52px;
        height:52px;
      }

      .av-head{ left:15px; top:8px; width:20px; height:20px; }
      .av-hair{ left:12px; top:5px; width:24px; height:14px; }
      .av-body{ left:12px; top:25px; width:24px; height:17px; }
      .av-cape{ left:4px; top:21px; width:15px; height:21px; }
      .av-drop{ width:17px; height:17px; font-size:10px; }

      .duet-stage{
        grid-template-columns:1fr;
      }

      .middle-badge{
        justify-self:center;
      }

      .two-col{
        grid-template-columns:1fr;
      }

      .btn-row{
        flex-direction:column;
      }

      .ui-btn{
        width:100%;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div class="hero-top">
        <div class="chip-row">
          <span class="chip">💧 Hydration</span>
          <span class="chip">👥 Duet</span>
          <span class="chip">⭐ Child-friendly</span>
        </div>
      </div>

      <div class="brand">
        <div class="brand-avatar">
          <div class="avatar-illust">
            <div class="av-head"></div>
            <div class="av-hair"></div>
            <div class="av-body"></div>
            <div class="av-cape"></div>
            <div class="av-drop">💧</div>
          </div>
        </div>

        <div class="brand-text">
          <div class="brand-logo">
            <span class="hero-word">Hero</span><span class="health-word">Health</span>
          </div>
          <div class="brand-sub">Hydration Duet • Learn Health Through Play!</div>
        </div>

        <button id="btnHubTop" class="home-btn" type="button" aria-label="กลับ HUB">🏠</button>
      </div>
    </section>

    <section class="layout">
      <section class="panel">
        <div>
          <h1 class="section-title">เล่นเป็นคู่</h1>
          <p class="section-sub">สร้างห้องใหม่หรือใส่ room code เพื่อเข้าไปที่ duet lobby แล้วเริ่มนับถอยหลังพร้อมกัน</p>
        </div>

        <div class="big-card">
          <div class="duet-scene">
            <div class="duet-stage">
              <div class="duet-player">
                <div class="duet-avatar">
                  <div class="avatar-illust">
                    <div class="av-head"></div>
                    <div class="av-hair"></div>
                    <div class="av-body"></div>
                    <div class="av-cape"></div>
                    <div class="av-drop">💧</div>
                  </div>
                </div>
                <div class="duet-name">Player 1</div>
                <div class="duet-role">สร้างห้อง</div>
              </div>

              <div class="middle-badge">🤝</div>

              <div class="duet-player">
                <div class="duet-avatar">
                  <div class="avatar-illust">
                    <div class="av-head"></div>
                    <div class="av-hair"></div>
                    <div class="av-body"></div>
                    <div class="av-cape"></div>
                    <div class="av-drop">💧</div>
                  </div>
                </div>
                <div class="duet-name">Player 2</div>
                <div class="duet-role">เข้าห้อง</div>
              </div>
            </div>
          </div>

          <div class="bubble-note">
            ทั้งสองคนจะเข้า lobby เดียวกัน ใช้ seed เดียวกัน แล้วเริ่มรอบพร้อมกัน
          </div>

          <div class="form-grid">
            <div class="field">
              <label for="nickInput">ชื่อเล่น</label>
              <input id="nickInput" type="text" maxlength="64" placeholder="เช่น Rocky" />
            </div>

            <div class="field">
              <label for="roomInput">Room Code (ถ้ามี)</label>
              <input id="roomInput" type="text" maxlength="6" placeholder="เช่น AB12CD" />
            </div>

            <div class="two-col">
              <div class="field">
                <label for="diffSel">ระดับ</label>
                <select id="diffSel">
                  <option value="normal">Normal</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div class="field">
                <label for="viewSel">มุมมอง</label>
                <select id="viewSel">
                  <option value="mobile">Mobile</option>
                  <option value="cvr">Cardboard / cVR</option>
                </select>
              </div>
            </div>

            <div class="two-col">
              <div class="field">
                <label for="timeSel">เวลา</label>
                <select id="timeSel">
                  <option value="80">80 วินาที</option>
                  <option value="90">90 วินาที</option>
                  <option value="120">120 วินาที</option>
                  <option value="150">150 วินาที</option>
                </select>
              </div>

              <div class="field">
                <label for="pidInput">PID</label>
                <input id="pidInput" type="text" maxlength="80" placeholder="เช่น anon หรือ p-abc123" />
              </div>
            </div>

            <div class="btn-row">
              <button id="btnCreate" class="ui-btn green" type="button">✨ สร้างห้องใหม่</button>
              <button id="btnJoin" class="ui-btn blue" type="button">🚪 เข้าห้อง</button>
              <button id="btnHub" class="ui-btn soft" type="button">🏠 กลับ HUB</button>
            </div>

            <div class="hint">
              ถ้าไม่ใส่ room code ระบบจะสร้างห้องใหม่ให้เอง ถ้าใส่ room code ระบบจะพาเข้าไป join ห้องนั้น
            </div>
          </div>
        </div>
      </section>

      <aside class="panel">
        <div>
          <h2 class="section-title">วิธีใช้แบบเร็ว</h2>
          <p class="section-sub">หน้า launcher นี้จะส่งค่าต่อไปที่ duet lobby แล้วค่อยเข้า run พร้อมกัน</p>
        </div>

        <div class="note-list">
          <div class="card">
            <div class="card-title">1) ผู้เล่นคนแรกกด “สร้างห้องใหม่”</div>
            <div class="card-text">ระบบจะพาไปหน้า lobby พร้อม room code สำหรับส่งให้เพื่อน</div>
          </div>

          <div class="card">
            <div class="card-title">2) ผู้เล่นคนที่สองใส่ room code แล้วกด “เข้าห้อง”</div>
            <div class="card-text">ถ้า room code ถูก ทั้งสองคนจะมาเจอกันใน lobby เดียวกัน</div>
          </div>

          <div class="card">
            <div class="card-title">3) ทั้งคู่กดพร้อมในหน้า lobby</div>
            <div class="card-text">host จะเริ่ม countdown แล้วเข้า run พร้อมกันโดยใช้ seed เดียวกัน</div>
          </div>

          <div class="card">
            <div class="card-title">4) path เป้าหมาย</div>
            <div class="card-text"><code>/herohealth/hydration-vr/hydration-duet-run.html</code></div>
          </div>
        </div>
      </aside>
    </section>
  </main>

  <script>
    (function(){
      'use strict';

      const qs = new URLSearchParams(location.search);
      const $ = (id) => document.getElementById(id);

      const nickInput = $('nickInput');
      const roomInput = $('roomInput');
      const diffSel = $('diffSel');
      const viewSel = $('viewSel');
      const timeSel = $('timeSel');
      const pidInput = $('pidInput');

      function q(name, fallback=''){
        const v = qs.get(name);
        return v == null || v === '' ? fallback : v;
      }

      function normalizePid(v){
        return String(v || 'anon').trim().replace(/[.#$[\]/]/g, '-').slice(0, 80) || 'anon';
      }

      function ensurePid(){
        const raw = normalizePid(pidInput.value || q('pid', ''));
        if (raw && raw !== 'anon') return raw;

        const KEY = 'HHA_DEVICE_PID';
        try{
          let pid = localStorage.getItem(KEY);
          if(!pid){
            pid = `p-${Math.random().toString(36).slice(2,10)}`;
            localStorage.setItem(KEY, pid);
          }
          return normalizePid(pid);
        }catch(e){
          return `p-${Math.random().toString(36).slice(2,10)}`;
        }
      }

      function ensureNick(){
        const raw = String(nickInput.value || q('nick', q('name', 'Player'))).trim().slice(0, 64);
        return raw || 'Player';
      }

      function generateRoomCode(){
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let s = '';
        for(let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
        return s;
      }

      function makeSeed(){
        return String(q('seed', Date.now()));
      }

      function hubUrl(){
        return q('hub', new URL('./hub.html', location.href).href);
      }

      function duetRunTarget(){
        return './hydration-vr/hydration-duet-run.html';
      }

      function buildLobbyUrl(roomCode){
        const u = new URL(duetRunTarget(), location.href);

        u.searchParams.set('roomCode', String(roomCode || '').trim().toUpperCase());
        u.searchParams.set('game', 'hydration');
        u.searchParams.set('mode', 'duet');
        u.searchParams.set('theme', q('theme', 'hydration'));
        u.searchParams.set('zone', q('zone', 'nutrition'));
        u.searchParams.set('cat', q('cat', q('zone', 'nutrition')));
        u.searchParams.set('diff', diffSel.value || q('diff', 'normal'));
        u.searchParams.set('time', timeSel.value || q('time', '80'));
        u.searchParams.set('seed', makeSeed());
        u.searchParams.set('view', viewSel.value || q('view', 'mobile'));
        u.searchParams.set('run', q('run', 'play'));
        u.searchParams.set('target', './hydration-vr.html');
        u.searchParams.set('hub', hubUrl());
        u.searchParams.set('pid', ensurePid());
        u.searchParams.set('nick', ensureNick());

        const passthrough = [
          'studyId',
          'phase',
          'conditionGroup',
          'studentKey',
          'schoolCode',
          'classRoom',
          'studentNo'
        ];
        for(const key of passthrough){
          const v = qs.get(key);
          if(v) u.searchParams.set(key, v);
        }

        return u.toString();
      }

      function createRoom(){
        const code = generateRoomCode();
        location.href = buildLobbyUrl(code);
      }

      function joinRoom(){
        const code = String(roomInput.value || '').trim().toUpperCase();
        if(!code){
          alert('กรุณาใส่ Room Code ก่อน');
          roomInput.focus();
          return;
        }
        location.href = buildLobbyUrl(code);
      }

      function goHub(){
        location.href = hubUrl();
      }

      nickInput.value = q('nick', q('name', ''));
      roomInput.value = q('roomCode', q('room', ''));
      diffSel.value = q('diff', 'normal');
      viewSel.value = q('view', 'mobile');
      timeSel.value = q('time', q('diff', 'normal') === 'hard' ? '90' : '80');
      pidInput.value = q('pid', '');

      $('btnCreate').addEventListener('click', createRoom);
      $('btnJoin').addEventListener('click', joinRoom);
      $('btnHub').addEventListener('click', goHub);
      $('btnHubTop').addEventListener('click', goHub);

      roomInput.addEventListener('input', () => {
        roomInput.value = roomInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      });
    })();
  </script>
</body>
</html>
