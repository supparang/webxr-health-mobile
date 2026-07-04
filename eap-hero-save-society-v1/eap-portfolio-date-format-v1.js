/* =========================================================
   EAP Hero • Portfolio Date Format v1
   One canonical learner-facing timestamp format:
   Thai Buddhist Era + Asia/Bangkok (ICT), minute precision.
   Prevents mixed browser-locale output such as
   "7/4/2026, 1:33:35 PM" beside "4 ก.ค. 2569 13:34".
   ========================================================= */
(function(){
  'use strict';

  var BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
  var THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  var THAI_MONTH_INDEX = {
    'ม.ค.':0,'มค':0,'มกราคม':0,
    'ก.พ.':1,'กพ':1,'กุมภาพันธ์':1,
    'มี.ค.':2,'มีค':2,'มีนาคม':2,
    'เม.ย.':3,'เมย':3,'เมษายน':3,
    'พ.ค.':4,'พค':4,'พฤษภาคม':4,
    'มิ.ย.':5,'มิย':5,'มิถุนายน':5,
    'ก.ค.':6,'กค':6,'กรกฎาคม':6,
    'ส.ค.':7,'สค':7,'สิงหาคม':7,
    'ก.ย.':8,'กย':8,'กันยายน':8,
    'ต.ค.':9,'ตค':9,'ตุลาคม':9,
    'พ.ย.':10,'พย':10,'พฤศจิกายน':10,
    'ธ.ค.':11,'ธค':11,'ธันวาคม':11
  };
  var scheduled = false;

  function clean(value){ return String(value == null ? '' : value).replace(/\s+/g,' ').trim(); }
  function pad(value){ return String(value).padStart(2,'0'); }
  function valid(date){ return date instanceof Date && !Number.isNaN(date.getTime()); }

  function makeBangkokDate(year, monthIndex, day, hour, minute, second){
    return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute, second || 0));
  }

  function parseThai(text){
    var match = clean(text).match(/^(\d{1,2})\s+([^\d\s]+)\s+(\d{4})(?:\s*(?:เวลา)?\s*)?(\d{1,2})[:.](\d{2})(?::(\d{2}))?\s*(?:น\.)?$/i);
    if(!match) return null;
    var monthToken = clean(match[2]).replace(/\s/g,'');
    var month = THAI_MONTH_INDEX[monthToken];
    if(month == null) return null;
    var year = Number(match[3]);
    if(year >= 2400) year -= 543;
    var date = makeBangkokDate(year, month, Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6] || 0));
    return valid(date) ? date : null;
  }

  function parseUsNumeric(text){
    var match = clean(text).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if(!match) return null;
    var hour = Number(match[4]);
    var suffix = String(match[7] || '').toUpperCase();
    if(suffix === 'PM' && hour < 12) hour += 12;
    if(suffix === 'AM' && hour === 12) hour = 0;
    var date = makeBangkokDate(Number(match[3]), Number(match[1]) - 1, Number(match[2]), hour, Number(match[5]), Number(match[6] || 0));
    return valid(date) ? date : null;
  }

  function parseDate(value){
    if(value instanceof Date) return valid(value) ? value : null;
    if(typeof value === 'number'){
      var numeric = value < 100000000000 ? value * 1000 : value;
      var fromNumber = new Date(numeric);
      return valid(fromNumber) ? fromNumber : null;
    }
    var text = clean(value);
    if(!text) return null;
    var thai = parseThai(text);
    if(thai) return thai;
    var us = parseUsNumeric(text);
    if(us) return us;
    var parsed = new Date(text);
    return valid(parsed) ? parsed : null;
  }

  function format(value){
    var date = parseDate(value);
    if(!date) return '';
    var bangkok = new Date(date.getTime() + BANGKOK_OFFSET_MS);
    var day = bangkok.getUTCDate();
    var month = THAI_MONTHS[bangkok.getUTCMonth()];
    var year = bangkok.getUTCFullYear() + 543;
    var hour = pad(bangkok.getUTCHours());
    var minute = pad(bangkok.getUTCMinutes());
    return day + ' ' + month + ' ' + year + ' • ' + hour + ':' + minute + ' น.';
  }

  function isPortfolioTable(table){
    if(!table) return false;
    var labels = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function(cell){ return clean(cell.textContent).toLowerCase(); });
    return labels.indexOf('at') >= 0 && labels.indexOf('session') >= 0 && labels.indexOf('skill') >= 0 && labels.indexOf('score') >= 0;
  }

  function atColumn(table){
    var labels = Array.prototype.slice.call(table.querySelectorAll('thead th')).map(function(cell){ return clean(cell.textContent).toLowerCase(); });
    return labels.indexOf('at');
  }

  function applyTable(table){
    if(!isPortfolioTable(table)) return;
    var index = atColumn(table);
    if(index < 0) return;
    var header = table.querySelectorAll('thead th')[index];
    if(header && header.dataset.eapPortfolioDateHeader !== '1'){
      header.textContent = 'วันที่/เวลา (ICT)';
      header.dataset.eapPortfolioDateHeader = '1';
    }
    Array.prototype.slice.call(table.querySelectorAll('tbody tr')).forEach(function(row){
      var cell = row.querySelectorAll('td')[index];
      if(!cell || cell.dataset.eapPortfolioDateFormatted === '1') return;
      var raw = clean(cell.textContent);
      var normalized = format(raw);
      if(!normalized) return;
      cell.dataset.eapPortfolioDateRaw = raw;
      cell.dataset.eapPortfolioDateFormatted = '1';
      cell.textContent = normalized;
      cell.title = 'เวลาไทย (ICT) • ' + normalized;
      cell.style.whiteSpace = 'nowrap';
      cell.style.fontVariantNumeric = 'tabular-nums';
    });
  }

  function refresh(){
    scheduled = false;
    Array.prototype.slice.call(document.querySelectorAll('#app table')).forEach(applyTable);
  }

  function schedule(){
    if(scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(refresh);
  }

  function boot(){
    schedule();
    new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true});
  }

  window.EAPPortfolioDateFormatV1 = Object.freeze({format:format, parse:parseDate, refresh:schedule});
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();
