/* =====================================================
 * /herohealth/hygiene-zone/handwash-result-delivery.js
 * HeroHealth Handwash Result Delivery Assurance
 * V1: IndexedDB Outbox + JSONP Receipt + Auto Retry
 * ===================================================== */
(() => {
  "use strict";

  const VERSION = "20260623-HANDWASH-DELIVERY-ASSURANCE-V1";
  const DB_NAME = "herohealth-handwash-delivery";
  const DB_VERSION = 1;
  const STORE_NAME = "outbox";
  const MAX_ATTEMPTS = 8;
  const EVENT_BATCH_SIZE = 80;
  const RECEIPT_DELAYS = [1400, 2600, 4200, 6500];
  const RETRY_DELAY_MS = 45 * 1000;

  let dbPromise = null;
  const processing = new Set();

  function nowIso(){
    return new Date().toISOString();
  }

  function randomId(){
    return Math.random().toString(16).slice(2, 10);
  }

  function delay(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function normalizeEndpoint(value){
    return String(value || "").trim();
  }

  function emit(onStatus, payload){
    try{
      if(typeof onStatus === "function"){
        onStatus(Object.assign({ version: VERSION }, payload || {}));
      }
    }catch(error){}
  }

  function openDb(){
    if(dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      if(!window.indexedDB){
        reject(new Error("IndexedDB unavailable"));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;

        if(!db.objectStoreNames.contains(STORE_NAME)){
          db.createObjectStore(STORE_NAME, {
            keyPath: "id"
          });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(
        request.error || new Error("IndexedDB open failed")
      );
    });

    return dbPromise;
  }

  async function putPackage(item){
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(item);

      req.onsuccess = () => resolve(item);
      req.onerror = () => reject(
        req.error || new Error("Outbox write failed")
      );
    });
  }

  async function getPackage(id){
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(
        req.error || new Error("Outbox read failed")
      );
    });
  }

  async function getAllPackages(){
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(
        req.error || new Error("Outbox list failed")
      );
    });
  }

  async function removePackage(id){
    const db = await openDb();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(
        req.error || new Error("Outbox delete failed")
      );
    });
  }

  function chunk(items, size){
    const parts = [];
    const safeSize = Math.max(1, Number(size) || EVENT_BATCH_SIZE);

    for(let index = 0; index < items.length; index += safeSize){
      parts.push(items.slice(index, index + safeSize));
    }

    return parts;
  }

  function buildEventBatches(summary, events){
    const safeEvents = Array.isArray(events) ? events : [];

    const meta = {
      sessionId: summary.sessionId || "",
      participantId: summary.participantId || "anon",
      studentName: summary.studentName || "Hero",
      classLevel: summary.classLevel || "",
      classId: summary.classId || "",
      section: summary.section || "",
      studyId: summary.studyId || "HYGIENE-P5-2026"
    };

    return chunk(safeEvents, EVENT_BATCH_SIZE).map(eventsPart => ({
      api: "handwash_research",
      type: "handwash_event_batch",
      meta,
      events: eventsPart
    }));
  }

  async function sendOpaque(endpoint, body){
    const url = normalizeEndpoint(endpoint);

    if(!url){
      return { ok: false, skipped: true };
    }

    const text = JSON.stringify(body || {});

    try{
      if(
        navigator.sendBeacon &&
        text.length < 56000
      ){
        const sent = navigator.sendBeacon(
          url,
          new Blob([text], {
            type: "text/plain;charset=utf-8"
          })
        );

        if(sent){
          return { ok: true, transport: "beacon" };
        }
      }
    }catch(error){}

    try{
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        credentials: "omit",
        keepalive: true,
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: text
      });

      return { ok: true, transport: "fetch" };
    }catch(error){
      return {
        ok: false,
        error: error && error.message ? error.message : String(error)
      };
    }
  }

  function jsonp(endpoint, params, timeoutMs = 9000){
    return new Promise((resolve, reject) => {
      const callback =
        "__hhReceipt_" + Date.now() + "_" + randomId();

      const script = document.createElement("script");

      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("receipt_timeout"));
      }, timeoutMs);

      function cleanup(){
        window.clearTimeout(timeout);

        try{
          delete window[callback];
        }catch(error){
          window[callback] = undefined;
        }

        if(script.parentNode){
          script.parentNode.removeChild(script);
        }
      }

      window[callback] = payload => {
        cleanup();
        resolve(payload || {});
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("receipt_network_error"));
      };

      try{
        const url = new URL(endpoint, window.location.href);

        Object.entries(params || {}).forEach(([key, value]) => {
          if(value !== undefined && value !== null && value !== ""){
            url.searchParams.set(key, String(value));
          }
        });

        url.searchParams.set("callback", callback);
        url.searchParams.set("_", String(Date.now()));

        script.async = true;
        script.src = url.toString();

        document.head.appendChild(script);
      }catch(error){
        cleanup();
        reject(error);
      }
    });
  }

  async function pollReceipt(item, onStatus){
    const endpoint = normalizeEndpoint(item.researchEndpoint);

    if(!endpoint){
      return {
        ok: false,
        unavailable: true,
        summaryConfirmed: false,
        eventsConfirmed: false
      };
    }

    let latest = null;

    for(const waitMs of RECEIPT_DELAYS){
      await delay(waitMs);

      try{
        const response = await jsonp(endpoint, {
          api: "hygiene",
          type: "handwash_research_receipt",
          sessionId: item.sessionId,
          expectedEvents: item.expectedEventCount
        });

        latest = response || {};

        const summaryConfirmed = !!latest.summaryFound;
        const eventsConfirmed = !!latest.eventsConfirmed;

        emit(onStatus, {
          id: item.id,
          status: summaryConfirmed && eventsConfirmed
            ? "confirmed"
            : summaryConfirmed
              ? "summary_confirmed"
              : "awaiting_receipt",
          summaryConfirmed,
          eventsConfirmed,
          eventCount: Number(latest.eventCount || 0),
          expectedEventCount: Number(item.expectedEventCount || 0),
          message: summaryConfirmed && eventsConfirmed
            ? "บันทึก Research Summary และ Event Log แล้ว"
            : summaryConfirmed
              ? "บันทึก Summary แล้ว กำลังตรวจ Event Log"
              : "กำลังรอใบยืนยันจาก Research Server"
        });

        if(summaryConfirmed && eventsConfirmed){
          return Object.assign({}, latest, {
            confirmed: true,
            summaryConfirmed,
            eventsConfirmed
          });
        }
      }catch(error){
        latest = {
          ok: false,
          error: error && error.message
            ? error.message
            : String(error)
        };
      }
    }

    return Object.assign({}, latest || {}, {
      confirmed: false,
      summaryConfirmed: !!(latest && latest.summaryFound),
      eventsConfirmed: !!(latest && latest.eventsConfirmed)
    });
  }

  async function deliverItem(item, onStatus){
    if(!item || !item.id) return;
    if(processing.has(item.id)) return;

    processing.add(item.id);

    try{
      if(!navigator.onLine){
        item.status = "offline";
        item.nextAttemptAt = Date.now() + RETRY_DELAY_MS;
        item.updatedAt = nowIso();

        await putPackage(item);

        emit(onStatus, {
          id: item.id,
          status: "offline",
          summaryConfirmed: false,
          eventsConfirmed: false,
          eventCount: 0,
          expectedEventCount: item.expectedEventCount,
          message: "ไม่มีอินเทอร์เน็ต เก็บผลไว้ใน Outbox แล้ว"
        });

        return;
      }

      item.status = "sending";
      item.updatedAt = nowIso();

      await putPackage(item);

      emit(onStatus, {
        id: item.id,
        status: "sending",
        summaryConfirmed: false,
        eventsConfirmed: false,
        eventCount: 0,
        expectedEventCount: item.expectedEventCount,
        message: "กำลังส่งผลการเล่นไปยัง Research Server"
      });

      if(
        !item.normalSent &&
        item.normalEndpoint &&
        item.normalPayload
      ){
        await sendOpaque(
          item.normalEndpoint,
          item.normalPayload
        );

        item.normalSent = true;
      }

      const summaryBody = {
        api: "handwash_research",
        type: "handwash_session_summary",
        payload: item.researchSummary
      };

      const summaryResult = await sendOpaque(
        item.researchEndpoint,
        summaryBody
      );

      const batches = Array.isArray(item.eventBatches)
        ? item.eventBatches
        : [];

      const batchResults = await Promise.all(
        batches.map(batch => {
          return sendOpaque(item.researchEndpoint, batch);
        })
      );

      item.researchSent = !!summaryResult.ok;
      item.eventBatchesSent = batchResults.filter(result => {
        return result.ok;
      }).length;

      item.attempts = Number(item.attempts || 0) + 1;
      item.updatedAt = nowIso();
      item.status = "awaiting_receipt";

      await putPackage(item);

      emit(onStatus, {
        id: item.id,
        status: "awaiting_receipt",
        summaryConfirmed: false,
        eventsConfirmed: false,
        eventCount: 0,
        expectedEventCount: item.expectedEventCount,
        message: "ส่งแล้ว กำลังตรวจสอบใบยืนยันจาก Research Server"
      });

      const receipt = await pollReceipt(item, onStatus);

      if(receipt.confirmed){
        await removePackage(item.id);

        emit(onStatus, {
          id: item.id,
          status: "confirmed",
          summaryConfirmed: true,
          eventsConfirmed: true,
          eventCount: Number(
            receipt.eventCount ||
            item.expectedEventCount ||
            0
          ),
          expectedEventCount: item.expectedEventCount,
          message: "บันทึก Research Summary และ Event Log แล้ว ✓"
        });

        return;
      }

      item.status = "retry_scheduled";
      item.nextAttemptAt = Date.now() + RETRY_DELAY_MS;
      item.updatedAt = nowIso();

      if(item.attempts >= MAX_ATTEMPTS){
        item.status = "queued_manual_retry";
        item.nextAttemptAt = Date.now() + (5 * 60 * 1000);
      }

      await putPackage(item);

      emit(onStatus, {
        id: item.id,
        status: item.status,
        summaryConfirmed: !!receipt.summaryConfirmed,
        eventsConfirmed: !!receipt.eventsConfirmed,
        eventCount: Number(receipt.eventCount || 0),
        expectedEventCount: item.expectedEventCount,
        message: receipt.summaryConfirmed
          ? "บันทึก Summary แล้ว แต่ Event Log ยังไม่ครบ ระบบจะลองส่งซ้ำอัตโนมัติ"
          : "ยังไม่ได้รับใบยืนยัน ระบบเก็บผลไว้และจะลองส่งซ้ำอัตโนมัติ"
      });
    }catch(error){
      item.attempts = Number(item.attempts || 0) + 1;
      item.status = "retry_scheduled";
      item.nextAttemptAt = Date.now() + RETRY_DELAY_MS;
      item.updatedAt = nowIso();

      try{
        await putPackage(item);
      }catch(innerError){}

      emit(onStatus, {
        id: item.id,
        status: "retry_scheduled",
        summaryConfirmed: false,
        eventsConfirmed: false,
        eventCount: 0,
        expectedEventCount: item.expectedEventCount,
        message: "ส่งไม่สมบูรณ์ เก็บผลไว้ใน Outbox และจะลองส่งซ้ำอัตโนมัติ"
      });
    }finally{
      processing.delete(item.id);
    }
  }

  async function enqueue(input){
    const summary = input && input.researchSummary
      ? input.researchSummary
      : {};

    const sessionId = String(
      input && input.sessionId ||
      summary.sessionId ||
      ""
    ).trim();

    if(!sessionId){
      throw new Error("missing_session_id");
    }

    const events = Array.isArray(input.events)
      ? input.events
      : [];

    const item = {
      id: "hwd-" + sessionId,
      version: VERSION,
      sessionId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: "queued",
      attempts: 0,
      nextAttemptAt: 0,

      normalEndpoint: normalizeEndpoint(input.normalEndpoint),
      researchEndpoint: normalizeEndpoint(input.researchEndpoint),

      normalPayload: input.normalPayload || null,
      researchSummary: summary,
      eventBatches: buildEventBatches(summary, events),
      expectedEventCount: events.length,

      normalSent: false,
      researchSent: false,
      eventBatchesSent: 0
    };

    await putPackage(item);

    emit(input.onStatus, {
      id: item.id,
      status: "queued",
      summaryConfirmed: false,
      eventsConfirmed: false,
      eventCount: 0,
      expectedEventCount: item.expectedEventCount,
      message: "เก็บผลลง Local Outbox แล้ว"
    });

    deliverItem(item, input.onStatus);

    return {
      id: item.id,
      sessionId: item.sessionId,
      expectedEventCount: item.expectedEventCount
    };
  }

  async function retry(id, onStatus){
    const item = await getPackage(id);

    if(!item){
      emit(onStatus, {
        id,
        status: "confirmed",
        summaryConfirmed: true,
        eventsConfirmed: true,
        message: "ไม่พบรายการค้างส่งใน Outbox"
      });

      return;
    }

    item.nextAttemptAt = 0;
    item.status = "queued";
    item.updatedAt = nowIso();

    await putPackage(item);

    return deliverItem(item, onStatus);
  }

  async function resume(){
    let items = [];

    try{
      items = await getAllPackages();
    }catch(error){
      return;
    }

    const now = Date.now();

    items
      .filter(item => {
        return !item.nextAttemptAt ||
          Number(item.nextAttemptAt) <= now;
      })
      .forEach(item => {
        deliverItem(item, null);
      });
  }

  async function getStatus(id){
    const item = await getPackage(id);

    if(!item){
      return {
        id,
        status: "not_in_outbox"
      };
    }

    return {
      id: item.id,
      status: item.status,
      sessionId: item.sessionId,
      expectedEventCount: item.expectedEventCount,
      attempts: item.attempts,
      nextAttemptAt: item.nextAttemptAt
    };
  }

  window.addEventListener("online", () => {
    resume();
  });

  document.addEventListener("visibilitychange", () => {
    if(document.visibilityState === "visible"){
      resume();
    }
  });

  window.HHHandwashDelivery = {
    version: VERSION,
    enqueue,
    retry,
    resume,
    getStatus
  };

  resume();
})();
