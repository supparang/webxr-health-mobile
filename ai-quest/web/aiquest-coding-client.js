
(function(global){
  'use strict';

  function CodingClient(options) {
    options = options || {};
    this.endpoint = options.endpoint || '';
    this.timeoutMs = Number(options.timeoutMs || 20000);
  }

  CodingClient.prototype.submit = async function(payload) {
    var controller = new AbortController();
    var timer = setTimeout(function(){ controller.abort(); }, this.timeoutMs);

    try {
      var body = Object.assign({}, payload, {
        module: 'AIQCODING',
        action: 'SUBMIT_CODING_LAB'
      });

      var res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {'Content-Type':'text/plain;charset=utf-8'},
        body: JSON.stringify(body),
        signal: controller.signal
      });

      if (!res.ok) throw new Error('HTTP_' + res.status);
      var data = await res.json();
      if (!data.ok) {
        var err = new Error(data.message || data.code || 'SUBMIT_FAILED');
        err.code = data.code || 'SUBMIT_FAILED';
        throw err;
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  };

  global.AIQCodingClient = CodingClient;
})(window);
