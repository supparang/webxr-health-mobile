(function(global){
  'use strict';

  /* =========================================================
   * CSAI2102 AI Quest Coding Client v3.2.8
   * Compatibility guard for production Apps Script deployments
   * that do not yet route GET_LAB_CONFIG.
   *
   * IMPORTANT:
   * - This fallback is used only for client-side guidance/validation.
   * - Official submission still goes to Apps Script with
   *   action=SUBMIT_CODING_LAB and must be validated by the server.
   * ========================================================= */

  var ORIGINAL_FETCH = global.fetch ? global.fetch.bind(global) : null;

  var LAB_CONFIG_FALLBACK = Object.freeze({
    S1:{expected:'High temperature alert',pg:[['rule-based automation','rule based automation','rule-based ai','rule based ai','ระบบอัตโนมัติแบบกฎ','ระบบตามกฎ','กฎตายตัว']]},
    S2:{expected:'clean',pg:[['model-based','model based','internal state','สถานะภายใน','ตัวแทนแบบใช้แบบจำลอง']]},
    S3:{expected:"['A', 'B', 'C', 'D', 'E']",pg:[['bfs'],['dfs']]},
    B1:{expected:'search_new_route',pg:[['agent','ตัวแทน'],['search','bfs','การค้นหา']]},
    S4:{expected:'D 6',pg:[['d'],['6']]},
    S5:{expected:'B 4',pg:[['b'],['4']]},
    S6:{expected:'3',pg:[['3']]},
    B2:{expected:'A*',pg:[['a*','astar','a star']]},
    S7:{expected:'can_fly',pg:[['can_fly','can fly','บินได้']]},
    S8:{expected:'0.154',pg:[['0.154']]},
    S9:{expected:'recommend_checkup',pg:[['recommend_checkup','recommend checkup','ตรวจสุขภาพ','แนะนำตรวจ']]},
    B3:{expected:'high_risk_with_evidence',pg:[['high_risk_with_evidence','high risk','ความเสี่ยงสูง'],['evidence','หลักฐาน']]},
    S10:{expected:'8 2',pg:[['8'],['2']]},
    S11:{expected:'[0, 1, 1]',pg:[['[0, 1, 1]','0 1 1']]},
    S12:{expected:'[0, 0, 1, 1]',pg:[['[0, 0, 1, 1]','0 0 1 1']]},
    B4:{expected:'overfitting',pg:[['overfitting','overfit','เรียนเกิน','โอเวอร์ฟิต']]},
    S13:{expected:'0.1',pg:[['0.1']]},
    S14:{expected:'0.55',pg:[['0.55']]},
    S15:{expected:'RAG retrieves evidence',pg:[['rag'],['retriev','evidence','หลักฐาน','ค้นคืน']]},
    B5:{expected:'review_with_evidence',pg:[['review_with_evidence','human review','human_review','ตรวจโดยมนุษย์','ทบทวนโดยมนุษย์'],['evidence','หลักฐาน']]}
  });

  function safeJson_(value){
    try { return typeof value === 'string' ? JSON.parse(value) : value; }
    catch (_) { return null; }
  }

  function sessionKey_(value){
    var s = String(value || '').trim().toUpperCase().replace(/[\s_:\-]+/g,'');
    var m = s.match(/^(?:MISSION|SESSION|M)?(S?(?:[1-9]|1[0-5])|B[1-5])$/);
    if (!m) return '';
    var x = m[1];
    if (/^\d+$/.test(x)) x = 'S' + x;
    return x;
  }

  function fallbackConfigResponse_(sessionId, reason){
    var key = sessionKey_(sessionId);
    var config = LAB_CONFIG_FALLBACK[key];
    var body = config ? {
      ok:true,
      sessionId:key,
      config:config,
      challengePolicy:'optional-bonus-20',
      compatibilityFallback:true,
      fallbackReason:String(reason || 'legacy-router'),
      version:'20260901-AIQ-CODING-CLIENT-V3.2.8-CONFIG-FALLBACK'
    } : {
      ok:false,
      code:'LAB_NOT_AVAILABLE',
      sessionId:key,
      compatibilityFallback:true
    };

    return new Response(JSON.stringify(body), {
      status:200,
      headers:{'Content-Type':'application/json;charset=UTF-8'}
    });
  }

  /*
   * coding-lab-v3.html currently calls fetch() directly for GET_LAB_CONFIG.
   * Intercept ONLY that read-only request. If the production Apps Script
   * router is older and returns AIQCODING_UNKNOWN_ACTION (or the config
   * request cannot be read), provide the same expected/pg rules bundled
   * with the current receiver. All other fetch requests pass through.
   */
  if (ORIGINAL_FETCH && !global.__AIQ_CODING_CONFIG_FETCH_PATCHED__) {
    global.__AIQ_CODING_CONFIG_FETCH_PATCHED__ = true;
    global.fetch = async function(input, init){
      var payload = null;
      try {
        payload = safeJson_(init && init.body);
      } catch (_) {}

      var isConfigRead = payload &&
        String(payload.module || '').trim().toUpperCase() === 'AIQCODING' &&
        String(payload.action || '').trim().toUpperCase() === 'GET_LAB_CONFIG';

      if (!isConfigRead) return ORIGINAL_FETCH(input, init);

      var sessionId = payload.sessionId || payload.session || payload.missionId || payload.mission || '';
      try {
        var response = await ORIGINAL_FETCH(input, init);
        var clone = response.clone();
        var data = null;
        try { data = await clone.json(); } catch (_) {}

        if (response.ok && data && data.ok !== false && data.config) {
          return response;
        }

        var code = String(data && (data.code || data.error || data.message) || '');
        if (
          !response.ok ||
          !data ||
          data.ok === false ||
          /UNKNOWN_ACTION|UNKNOWN_CODING_ACTION|AIQCODING_UNKNOWN_ACTION|MODULE_MISSING|NOT_AVAILABLE/i.test(code)
        ) {
          console.warn('[AIQ Coding] GET_LAB_CONFIG compatibility fallback:', code || ('HTTP_' + response.status));
          return fallbackConfigResponse_(sessionId, code || ('HTTP_' + response.status));
        }
        return response;
      } catch (err) {
        console.warn('[AIQ Coding] GET_LAB_CONFIG network fallback:', err);
        return fallbackConfigResponse_(sessionId, err && (err.message || err));
      }
    };
  }

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
      var res = await global.fetch(this.endpoint, {
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

  CodingClient.getFallbackLabConfig = function(sessionId){
    return LAB_CONFIG_FALLBACK[sessionKey_(sessionId)] || null;
  };

  global.AIQCodingClient = CodingClient;
})(window);
