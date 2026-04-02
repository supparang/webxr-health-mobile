export function hhaDownloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export function hhaDownloadJson(filename, obj) {
  hhaDownloadText(
    filename,
    JSON.stringify(obj, null, 2),
    'application/json;charset=utf-8'
  );
}

export function createHhaQueueStore(storageKey = 'HHA_PENDING_UPLOADS') {
  function load() {
    try {
      const raw = localStorage.getItem(storageKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function save(arr) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(arr || []));
    } catch {}
  }

  function enqueue(item) {
    const q = load();
    q.push(item);
    save(q);
    return q.length;
  }

  function shift() {
    const q = load();
    const head = q.shift();
    save(q);
    return head;
  }

  function peek() {
    const q = load();
    return q.length ? q[0] : null;
  }

  function clear() {
    save([]);
  }

  function count() {
    return load().length;
  }

  return {
    load,
    save,
    enqueue,
    shift,
    peek,
    clear,
    count
  };
}

export function createHhaSheetsTransport({
  webhook = '',
  queueStore
} = {}) {
  function resolveWebhook() {
    return typeof webhook === 'function' ? webhook() : webhook;
  }

  async function postJson(payload) {
    const url = resolveWebhook();
    if (!url) {
      throw new Error('NO_WEBHOOK');
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP_${res.status}`);
    }

    return await res.json().catch(() => ({}));
  }

  async function sendOrQueue(payload) {
    const url = resolveWebhook();

    if (!url) {
      queueStore?.enqueue(payload);
      return {
        ok: false,
        queued: true,
        reason: 'NO_WEBHOOK',
        queueCount: queueStore?.count?.() || 0
      };
    }

    try {
      const result = await postJson(payload);
      return {
        ok: true,
        queued: false,
        queueCount: queueStore?.count?.() || 0,
        result
      };
    } catch (err) {
      queueStore?.enqueue(payload);
      return {
        ok: false,
        queued: true,
        reason: String(err?.message || err),
        queueCount: queueStore?.count?.() || 0
      };
    }
  }

  async function drain() {
    const url = resolveWebhook();
    if (!url || !queueStore) {
      return { ok: false, drained: 0, remaining: queueStore?.count?.() || 0 };
    }

    let drained = 0;
    while (queueStore.count() > 0) {
      const head = queueStore.peek();
      try {
        await postJson(head);
        queueStore.shift();
        drained += 1;
      } catch {
        break;
      }
    }

    return {
      ok: true,
      drained,
      remaining: queueStore.count()
    };
  }

  return {
    postJson,
    sendOrQueue,
    drain
  };
}