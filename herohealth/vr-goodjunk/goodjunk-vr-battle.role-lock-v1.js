/* HeroHealth • GoodJunk Battle Role Lock v1
   บังคับ role จาก room.hostPid เท่านั้น
*/
(() => {
  'use strict';

  if (window.__GJ_BATTLE_ROLE_LOCK_V1__) return;
  window.__GJ_BATTLE_ROLE_LOCK_V1__ = true;

  const qs = new URLSearchParams(location.search);
  const ROOM = cleanRoom(qs.get('roomId') || qs.get('room') || '');
  const PID = clean(qs.get('pid') || '');
  const LOG = '[GJ Battle Role Lock]';

  let db = null;

  boot();

  async function boot(){
    if (!ROOM || !PID) {
      console.warn(LOG, 'missing room or pid', { ROOM, PID });
      return;
    }

    try{
      await waitForDb();

      db.ref(roomPath(ROOM)).on('value', async snap => {
        const room = snap && snap.val ? snap.val() : null;
        if (!room) return;

        const trueRole = String(room.hostPid || '') === String(PID) ? 'host' : 'guest';
        const key = safeKey(PID);

        fixUrlRole(trueRole);
        fixVisibleRole(trueRole);

        const mine = room.players && room.players[key] ? room.players[key] : null;

        if (mine && mine.role !== trueRole){
          await db.ref(`${roomPath(ROOM)}/players/${key}`).update({
            role: trueRole,
            host: trueRole === 'host',
            lastSeen: Date.now()
          }).catch(err => console.warn(LOG, 'update player role failed', err));
        }

        // กัน runtimePlayers/currentRun participants ผิด
        const updates = {};
        updates[`runtimePlayers/${key}/role`] = trueRole;
        updates[`runtimePlayers/${key}/host`] = trueRole === 'host';
        updates[`activePlayers/${key}/role`] = trueRole;
        updates[`activePlayers/${key}/host`] = trueRole === 'host';
        updates[`currentRun/participants/${key}/role`] = trueRole;
        updates[`currentRun/participants/${key}/host`] = trueRole === 'host';
        updates[`currentRun/runtimePlayers/${key}/role`] = trueRole;
        updates[`currentRun/runtimePlayers/${key}/host`] = trueRole === 'host';

        await db.ref(roomPath(ROOM)).update(updates).catch(() => {});

        console.info(LOG, 'role locked', {
          room: ROOM,
          pid: PID,
          hostPid: room.hostPid,
          trueRole
        });
      });

    }catch(err){
      console.warn(LOG, 'boot failed', err);
    }
  }

  async function waitForDb(){
    for (let i = 0; i < 50; i++){
      if (window.HHA_FIREBASE_READY){
        const fb = await window.HHA_FIREBASE_READY;
        if (fb && fb.db && fb.auth && fb.auth.currentUser){
          db = fb.db;
          return;
        }
      }
      await sleep(250);
    }
    throw new Error('Firebase auth/db not ready');
  }

  function fixUrlRole(role){
    try{
      const u = new URL(location.href);
      u.searchParams.set('role', role);
      u.searchParams.set('host', role === 'host' ? '1' : '0');
      history.replaceState(null, '', u.toString());
    }catch(_){}
  }

  function fixVisibleRole(role){
    const wrongHostText = role === 'guest';

    if (!wrongHostText) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];

    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      const t = String(node.nodeValue || '');
      if (t.includes('KK • host')) node.nodeValue = t.replace('KK • host', 'KK • guest');
      if (t.includes('Guest • host')) node.nodeValue = t.replace('Guest • host', 'Guest • guest');
    });
  }

  function roomPath(roomId){
    return `hha-battle/goodjunk/battleRooms/${safeKey(roomId)}`;
  }

  function safeKey(raw){
    return String(raw || '')
      .trim()
      .replace(/[.#$/\[\]]/g,'_')
      .slice(0,96) || 'key';
  }

  function clean(v){
    return String(v ?? '').trim();
  }

  function cleanRoom(v){
    let s = clean(v).toUpperCase();
    s = s.replace(/\s+/g,'').replace(/[^A-Z0-9-]/g,'');

    if (!s) return '';

    if (!s.startsWith('GJ-BT-')){
      s = 'GJ-BT-' + s
        .replace(/^GJ-BT/i,'')
        .replace(/^GJBT/i,'')
        .replace(/^BT/i,'')
        .replace(/^-/, '');
    }

    return s.slice(0,16);
  }

  function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }
})();
