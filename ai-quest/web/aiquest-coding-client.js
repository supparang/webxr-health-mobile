(function(global){
  'use strict';

  function CodingClient(options) {
    options = options || {};
    this.endpoint = options.endpoint || '';
    this.timeoutMs = Number(options.timeoutMs || 45000);
  }

  CodingClient.prototype.buildPayload_ = function(payload) {
    return Object.assign({}, payload || {}, {
      module: 'AIQCODING',
      action: 'SUBMIT_CODING_LAB'
    });
  };

  CodingClient.prototype.submitByFetch_ = async function(body) {
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, this.timeoutMs);

    try {
      var res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(body),
        redirect: 'follow',
        signal: controller.signal
      });

      var raw = await res.text();
      var data = null;
      try { data = raw ? JSON.parse(raw) : {}; }
      catch (parseErr) {
        var invalid = new Error('INVALID_JSON_RESPONSE');
        invalid.code = 'INVALID_JSON_RESPONSE';
        invalid.httpStatus = res.status;
        invalid.rawResponse = raw.slice(0, 2000);
        throw invalid;
      }

      if (!res.ok) {
        var httpErr = new Error(data.message || data.code || ('HTTP_' + res.status));
        httpErr.code = data.code || ('HTTP_' + res.status);
        httpErr.httpStatus = res.status;
        httpErr.serverResponse = data;
        throw httpErr;
      }

      if (!data.ok) {
        var err = new Error(data.message || data.code || data.error || 'SUBMIT_FAILED');
        err.code = data.code || data.error || 'SUBMIT_FAILED';
        err.serverResponse = data;
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  };

  CodingClient.prototype.submitByForm_ = function(body, reason) {
    var endpoint = this.endpoint;
    return new Promise(function(resolve, reject){
      if (!endpoint) {
        reject(new Error('MISSING_ENDPOINT'));
        return;
      }

      var frameName = 'aiqCodingFrame_' + Date.now();
      var iframe = document.createElement('iframe');
      iframe.name = frameName;
      iframe.style.display = 'none';
      iframe.setAttribute('aria-hidden', 'true');

      var form = document.createElement('form');
      form.method = 'POST';
      form.action = endpoint;
      form.target = frameName;
      form.style.display = 'none';

      Object.keys(body).forEach(function(key){
        var input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        var value = body[key];
        input.value = value != null && typeof value === 'object'
          ? JSON.stringify(value)
          : String(value == null ? '' : value);
        form.appendChild(input);
      });

      var finished = false;
      function cleanup(){
        setTimeout(function(){
          if (form.parentNode) form.parentNode.removeChild(form);
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 1500);
      }

      iframe.onload = function(){
        if (finished) return;
        finished = true;
        cleanup();
        resolve({
          ok: true,
          accepted: true,
          transport: 'form-post-fallback',
          fallbackReason: reason || '',
          pendingVerification: true,
          codingAttemptId: body.codingAttemptId || '',
          message: 'ส่งข้อมูลไปยัง Apps Script แล้ว กรุณาตรวจสอบแท็บ coding_attempts'
        });
      };

      document.body.appendChild(iframe);
      document.body.appendChild(form);

      try {
        form.submit();
      } catch (err) {
        cleanup();
        reject(err);
        return;
      }

      setTimeout(function(){
        if (finished) return;
        finished = true;
        cleanup();
        resolve({
          ok: true,
          accepted: true,
          transport: 'form-post-fallback',
          fallbackReason: reason || '',
          pendingVerification: true,
          codingAttemptId: body.codingAttemptId || '',
          message: 'ส่งคำขอแล้ว แต่ Browser ไม่อนุญาตให้อ่านผลตอบกลับข้ามโดเมน กรุณาตรวจสอบแท็บ coding_attempts'
        });
      }, 7000);
    });
  };

  CodingClient.prototype.submit = async function(payload) {
    var body = this.buildPayload_(payload);

    try {
      return await this.submitByFetch_(body);
    } catch (err) {
      var msg = String(err && (err.message || err) || '');
      var name = String(err && err.name || '');
      var code = String(err && err.code || '');
      var fallbackAllowed =
        err instanceof TypeError ||
        name === 'AbortError' ||
        code === '20' ||
        msg.indexOf('signal is aborted') >= 0 ||
        msg.indexOf('Failed to fetch') >= 0 ||
        msg.indexOf('NetworkError') >= 0 ||
        msg.indexOf('Load failed') >= 0 ||
        msg.indexOf('timed out') >= 0;

      if (!fallbackAllowed) throw err;
      return this.submitByForm_(body, name || code || msg || 'network-fallback');
    }
  };

  global.AIQCodingClient = CodingClient;
})(window);
