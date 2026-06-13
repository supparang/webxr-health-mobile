/* =========================================================
   EAP Word Quest • Storage Quota Guard Hotfix
   File: /herohealth/eap-word-quest/eap-word-engine-v168-storage-quota-hotfix.js
   Version: v1.6.8-STORAGE-QUOTA-GUARD

   Fix:
   - Prevent game freeze when localStorage quota is exceeded
   - Compact EAP Word Quest stats before retrying save
   - Remove duplicate legacy stats keys safely
   - Preserve session pass/unlock progress
   - No MutationObserver
========================================================= */

"use strict";

(function(){
  const HOTFIX_VERSION = "v1.6.8-STORAGE-QUOTA-GUARD";

  if(window.__EAP_WORD_QUEST_STORAGE_V168_PATCHED__){
    console.info("[EAP Word Quest] Storage quota guard already patched");
    return;
  }

  window.__EAP_WORD_QUEST_STORAGE_V168_PATCHED__ = true;

  const STATS_PREFIX = "EAP_WORD_QUEST_STATS_";
  const CANONICAL_STATS_KEY = "EAP_WORD_QUEST_STATS_V160";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";

  const KNOWN_STATS_KEYS = [
    "EAP_WORD_QUEST_STATS_V161",
    "EAP_WORD_QUEST_STATS_V160",
    "EAP_WORD_QUEST_STATS_V01"
  ];

  const rawSetItem = Storage.prototype.setItem;

  function normalize(value){
    return String(value == null ? "" : value).replace(/\s+/g," ").trim();
  }

  function isQuotaError(err){
    return Boolean(
      err &&
      (
        err.name === "QuotaExceededError" ||
        err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
        String(err.message || "").toLowerCase().includes("quota")
      )
    );
  }

  function isStatsKey(key){
    return String(key || "").startsWith(STATS_PREFIX);
  }

  function safeParseJson(value,fallback){
    try{
      return JSON.parse(value);
    }catch(err){
      return fallback;
    }
  }

  function readProfile(){
    return safeParseJson(localStorage.getItem(PROFILE_KEY) || "{}",{
      studentName:"",
      studentId:"",
      section:"101"
    });
  }

  function listLocalStorageKeys(){
    const keys = [];

    try{
      for(let i = 0; i < localStorage.length; i++){
        const key = localStorage.key(i);
        if(key) keys.push(key);
      }
    }catch(err){
      console.warn("[EAP Word Quest] Cannot list localStorage keys:",err);
    }

    return keys;
  }

  function listStatsKeys(){
    return listLocalStorageKeys().filter(key => key.startsWith(STATS_PREFIX));
  }

  function emptyStats(){
    return {
      version:HOTFIX_VERSION,
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      rounds:0,
      correct:0,
      total:0,
      totalXp:0,
      sessions:{},
      words:{},
      history:[],
      profileSnapshot:readProfile()
    };
  }

  function compactWords(words,limit){
    const source = words && typeof words === "object" ? words : {};

    const rows = Object.entries(source).map(([word,w]) => {
      const item = w && typeof w === "object" ? w : {};

      return {
        word,
        seen:Number(item.seen || 0),
        correct:Number(item.correct || 0),
        wrong:Number(item.wrong || 0),
        levels:item.levels && typeof item.levels === "object" ? item.levels : {},
        types:item.types && typeof item.types === "object" ? item.types : {},
        sessions:item.sessions && typeof item.sessions === "object" ? item.sessions : {},
        lastSeen:item.lastSeen || ""
      };
    });

    rows.sort((a,b) => {
      if(b.wrong !== a.wrong) return b.wrong - a.wrong;
      if(b.seen !== a.seen) return b.seen - a.seen;
      return String(b.lastSeen || "").localeCompare(String(a.lastSeen || ""));
    });

    const out = {};

    rows.slice(0,limit).forEach(row => {
      out[row.word] = {
        seen:row.seen,
        correct:row.correct,
        wrong:row.wrong,
        levels:row.levels,
        types:row.types,
        sessions:row.sessions,
        lastSeen:row.lastSeen || null
      };
    });

    return out;
  }

  function compactHistory(history,limit){
    const rows = Array.isArray(history) ? history.slice() : [];

    rows.sort((a,b) => String(b && b.at || "").localeCompare(String(a && a.at || "")));

    return rows.slice(0,limit).map(row => {
      const r = row && typeof row === "object" ? row : {};

      return {
        at:r.at || new Date().toISOString(),
        section:r.section || (r.profile && r.profile.section) || "101",
        studentName:r.studentName || (r.profile && r.profile.studentName) || "",
        studentId:r.studentId || (r.profile && r.profile.studentId) || "",
        session:r.session || "",
        name:r.name || "",
        mode:r.mode || "",
        questions:Number(r.questions || 0),
        correct:Number(r.correct || 0),
        accuracy:Number(r.accuracy || 0),
        passed:Boolean(r.passed),
        xp:Number(r.xp || 0),
        maxCombo:Number(r.maxCombo || 0),
        weakWords:Array.isArray(r.weakWords) ? r.weakWords.slice(0,8) : [],
        isBoss:Boolean(r.isBoss),
        bossHp:Number(r.bossHp || 0),
        bossMaxHp:Number(r.bossMaxHp || 0)
      };
    });
  }

  function compactStatsObject(stats,aggressive){
    const src = stats && typeof stats === "object" ? stats : emptyStats();

    const sessions = src.sessions && typeof src.sessions === "object" ? src.sessions : {};
    const profile = src.profileSnapshot || readProfile();

    const compact = {
      version:HOTFIX_VERSION,
      createdAt:src.createdAt || new Date().toISOString(),
      updatedAt:new Date().toISOString(),
      rounds:Number(src.rounds || 0),
      correct:Number(src.correct || 0),
      total:Number(src.total || 0),
      totalXp:Number(src.totalXp || 0),
      sessions,
      words:compactWords(src.words,aggressive ? 80 : 220),
      history:compactHistory(src.history,aggressive ? 6 : 18),
      profileSnapshot:{
        studentName:normalize(profile.studentName || ""),
        studentId:normalize(profile.studentId || ""),
        section:normalize(profile.section || "101") || "101"
      },
      compactedBy:HOTFIX_VERSION,
      compactedAt:new Date().toISOString(),
      aggressive:Boolean(aggressive)
    };

    /*
      ถ้า total ใหญ่ผิดปกติจาก smoke/test ซ้ำ ให้คำนวณจาก session stats ใหม่แบบเบา ๆ
    */
    let sessionRounds = 0;
    let sessionCorrect = 0;
    let sessionTotal = 0;
    let sessionXp = 0;

    Object.values(sessions).forEach(s => {
      const row = s && typeof s === "object" ? s : {};
      sessionRounds += Number(row.rounds || 0);
      sessionCorrect += Number(row.correct || 0);
      sessionTotal += Number(row.total || 0);
      sessionXp += Number(row.xp || 0);
    });

    if(sessionTotal > 0){
      compact.rounds = sessionRounds;
      compact.correct = sessionCorrect;
      compact.total = sessionTotal;
      compact.totalXp = sessionXp;
    }

    return compact;
  }

  function compactStatsPayload(value,aggressive){
    const parsed = safeParseJson(String(value || "{}"),emptyStats());
    return JSON.stringify(compactStatsObject(parsed,aggressive));
  }

  function removeOtherStatsKeys(activeKey){
    const removed = [];

    listStatsKeys().forEach(key => {
      if(key === activeKey) return;

      try{
        localStorage.removeItem(key);
        removed.push(key);
      }catch(err){
        console.warn("[EAP Word Quest] Cannot remove legacy stats key:",key,err);
      }
    });

    return removed;
  }

  function mergeSession(a,b){
    const x = a && typeof a === "object" ? a : {};
    const y = b && typeof b === "object" ? b : {};

    return {
      rounds:Math.max(Number(x.rounds || 0),Number(y.rounds || 0)),
      correct:Math.max(Number(x.correct || 0),Number(y.correct || 0)),
      total:Math.max(Number(x.total || 0),Number(y.total || 0)),
      xp:Math.max(Number(x.xp || 0),Number(y.xp || 0)),
      lastPlayed:String(x.lastPlayed || "") > String(y.lastPlayed || "") ? x.lastPlayed : y.lastPlayed,
      bestAccuracy:Math.max(Number(x.bestAccuracy || 0),Number(y.bestAccuracy || 0)),
      bestXp:Math.max(Number(x.bestXp || 0),Number(y.bestXp || 0)),
      played:Boolean(x.played || y.played),
      passed:Boolean(x.passed || y.passed),
      lastPassed:String(x.lastPassed || "") > String(y.lastPassed || "") ? x.lastPassed : y.lastPassed
    };
  }

  function mergeWord(a,b){
    const x = a && typeof a === "object" ? a : {};
    const y = b && typeof b === "object" ? b : {};

    return {
      seen:Math.max(Number(x.seen || 0),Number(y.seen || 0)),
      correct:Math.max(Number(x.correct || 0),Number(y.correct || 0)),
      wrong:Math.max(Number(x.wrong || 0),Number(y.wrong || 0)),
      levels:Object.assign({},x.levels || {},y.levels || {}),
      types:Object.assign({},x.types || {},y.types || {}),
      sessions:Object.assign({},x.sessions || {},y.sessions || {}),
      lastSeen:String(x.lastSeen || "") > String(y.lastSeen || "") ? x.lastSeen : y.lastSeen
    };
  }

  function mergeStatsObjects(list){
    const merged = emptyStats();

    list.forEach(stats => {
      const s = stats && typeof stats === "object" ? stats : {};

      Object.entries(s.sessions || {}).forEach(([sessionId,row]) => {
        merged.sessions[sessionId] = mergeSession(merged.sessions[sessionId],row);
      });

      Object.entries(s.words || {}).forEach(([word,row]) => {
        merged.words[word] = mergeWord(merged.words[word],row);
      });

      if(Array.isArray(s.history)){
        merged.history = merged.history.concat(s.history);
      }
    });

    Object.values(merged.sessions).forEach(row => {
      merged.rounds += Number(row.rounds || 0);
      merged.correct += Number(row.correct || 0);
      merged.total += Number(row.total || 0);
      merged.totalXp += Number(row.xp || 0);
    });

    return compactStatsObject(merged,false);
  }

  function repairEapWordQuestStorage(){
    const keys = listStatsKeys();
    const parsed = [];

    keys.forEach(key => {
      const stats = safeParseJson(localStorage.getItem(key) || "{}",null);
      if(stats && typeof stats === "object"){
        parsed.push(stats);
      }
    });

    const merged = mergeStatsObjects(parsed);
    const compact = compactStatsObject(merged,false);

    /*
      ลบ key ซ้ำก่อน เพื่อคืนพื้นที่ แล้วค่อยเขียน canonical key
    */
    keys.forEach(key => {
      try{
        localStorage.removeItem(key);
      }catch(err){
        console.warn("[EAP Word Quest] Cannot remove stats key during repair:",key,err);
      }
    });

    try{
      rawSetItem.call(localStorage,CANONICAL_STATS_KEY,JSON.stringify(compact));
    }catch(err){
      if(isQuotaError(err)){
        rawSetItem.call(localStorage,CANONICAL_STATS_KEY,JSON.stringify(compactStatsObject(compact,true)));
      }else{
        throw err;
      }
    }

    const result = {
      version:HOTFIX_VERSION,
      canonicalKey:CANONICAL_STATS_KEY,
      removedKeys:keys.filter(key => key !== CANONICAL_STATS_KEY),
      sessions:Object.keys(compact.sessions || {}).length,
      words:Object.keys(compact.words || {}).length,
      history:(compact.history || []).length,
      bytes:JSON.stringify(compact).length,
      repairedAt:new Date().toISOString()
    };

    window.EAP_STORAGE_REPAIR_REPORT = result;

    console.table([result]);
    console.info("[EAP Word Quest] Storage repaired:",result);

    return result;
  }

  function estimateEapWordQuestStorage(){
    const rows = listLocalStorageKeys()
      .filter(key => key.startsWith("EAP_WORD_QUEST"))
      .map(key => {
        const value = localStorage.getItem(key) || "";
        return {
          key,
          chars:value.length,
          kb:Math.round((value.length / 1024) * 10) / 10
        };
      })
      .sort((a,b) => b.chars - a.chars);

    console.table(rows);

    return rows;
  }

  function safeSetStatsItem(storage,key,value){
    const compact1 = compactStatsPayload(value,false);

    removeOtherStatsKeys(key);

    try{
      return rawSetItem.call(storage,key,compact1);
    }catch(err1){
      if(!isQuotaError(err1)) throw err1;

      const compact2 = compactStatsPayload(value,true);

      try{
        return rawSetItem.call(storage,key,compact2);
      }catch(err2){
        if(!isQuotaError(err2)) throw err2;

        /*
          จุดสำคัญ: ไม่ throw ต่อ เพื่อไม่ให้เกมค้าง
          ถ้าบันทึกไม่ได้จริง ๆ ให้เก็บใน memory ชั่วคราว แล้วปล่อย gameplay ไปต่อ
        */
        window.EAP_STORAGE_MEMORY_FALLBACK = {
          version:HOTFIX_VERSION,
          key,
          stats:safeParseJson(compact2,emptyStats()),
          failedAt:new Date().toISOString(),
          error:String(err2 && err2.message || err2)
        };

        console.warn("[EAP Word Quest] localStorage still full. Gameplay will continue with memory fallback:",window.EAP_STORAGE_MEMORY_FALLBACK);

        return undefined;
      }
    }
  }

  Storage.prototype.setItem = function(key,value){
    try{
      return rawSetItem.apply(this,arguments);
    }catch(err){
      if(isQuotaError(err) && isStatsKey(key)){
        console.warn("[EAP Word Quest] Storage quota detected. Compacting stats and retrying:",key);
        return safeSetStatsItem(this,String(key),String(value));
      }

      throw err;
    }
  };

  /*
    Auto-light repair:
    ถ้ามี stats key ซ้ำหลายตัว ให้รวมและลดขนาดทันทีตอนโหลด
    ไม่ลบ profile
  */
  try{
    const statsKeys = listStatsKeys();

    if(statsKeys.length > 1){
      repairEapWordQuestStorage();
    }
  }catch(err){
    console.warn("[EAP Word Quest] Auto storage repair skipped:",err);
  }

  window.repairEapWordQuestStorage = repairEapWordQuestStorage;
  window.estimateEapWordQuestStorage = estimateEapWordQuestStorage;

  window.APP_VERSION = HOTFIX_VERSION;

  const versionPill = document.getElementById("versionPill");
  if(versionPill){
    versionPill.title = HOTFIX_VERSION;
  }

  console.info("[EAP Word Quest] Storage quota guard ready:",{
    version:HOTFIX_VERSION,
    helpers:[
      "repairEapWordQuestStorage()",
      "estimateEapWordQuestStorage()"
    ]
  });
})();
