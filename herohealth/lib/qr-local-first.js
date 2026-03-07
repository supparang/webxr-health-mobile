// === /herohealth/lib/qr-local-first.js ===
// HeroHealth QR local-first helper
// PATCH v20260307-QR-LOCAL-FIRST
(function(){
  'use strict';

  function isCanvas(el){
    return !!el && String(el.tagName || '').toLowerCase() === 'canvas';
  }
  function isImg(el){
    return !!el && String(el.tagName || '').toLowerCase() === 'img';
  }

  function clearEl(el){
    if(!el) return;
    if(isCanvas(el)){
      const ctx = el.getContext('2d');
      if(ctx) ctx.clearRect(0, 0, el.width, el.height);
    }else if(isImg(el)){
      el.removeAttribute('src');
    }else{
      el.innerHTML = '';
    }
  }

  function fallbackUrl(text, size){
    const u = new URL('https://api.qrserver.com/v1/create-qr-code/');
    u.searchParams.set('size', `${size}x${size}`);
    u.searchParams.set('margin', '8');
    u.searchParams.set('data', String(text || ''));
    return u.toString();
  }

  function tryRenderWithGlobalQRCode(el, text, size){
    const QRCode = window.QRCode;
    if(!QRCode) return false;

    try{
      if(typeof QRCode === 'function' && !QRCode.toCanvas){
        let holder = el;
        if(isImg(el) || isCanvas(el)){
          holder = document.createElement('div');
        }else{
          holder.innerHTML = '';
        }

        new QRCode(holder, {
          text: String(text || ''),
          width: size,
          height: size
        });

        if(isImg(el)){
          const img = holder.querySelector('img');
          const canvas = holder.querySelector('canvas');
          if(img){
            el.src = img.src;
            return true;
          }
          if(canvas){
            el.src = canvas.toDataURL('image/png');
            return true;
          }
        }else if(isCanvas(el)){
          const canvas = holder.querySelector('canvas');
          const img = holder.querySelector('img');
          const ctx = el.getContext('2d');
          el.width = size;
          el.height = size;
          if(canvas && ctx){
            ctx.clearRect(0,0,size,size);
            ctx.drawImage(canvas, 0, 0, size, size);
            return true;
          }
          if(img && ctx){
            const im = new Image();
            im.onload = ()=> {
              ctx.clearRect(0,0,size,size);
              ctx.drawImage(im, 0, 0, size, size);
            };
            im.src = img.src;
            return true;
          }
        }else{
          el.innerHTML = '';
          while(holder.firstChild) el.appendChild(holder.firstChild);
          return true;
        }
      }

      if(QRCode && typeof QRCode.toCanvas === 'function'){
        if(isCanvas(el)){
          el.width = size;
          el.height = size;
          QRCode.toCanvas(el, String(text || ''), { width:size, margin:1 }, function(){});
          return true;
        }

        if(isImg(el)){
          const c = document.createElement('canvas');
          c.width = size;
          c.height = size;
          QRCode.toCanvas(c, String(text || ''), { width:size, margin:1 }, function(err){
            if(!err) el.src = c.toDataURL('image/png');
          });
          return true;
        }

        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        QRCode.toCanvas(c, String(text || ''), { width:size, margin:1 }, function(err){
          if(!err){
            const img = new Image();
            img.src = c.toDataURL('image/png');
            el.innerHTML = '';
            el.appendChild(img);
          }
        });
        return true;
      }

      return false;
    }catch(err){
      console.warn('[HHQr] local QR render failed', err);
      return false;
    }
  }

  function render(el, text, opts){
    opts = opts || {};
    const size = Math.max(120, Math.min(1024, Number(opts.size || 240) || 240));

    clearEl(el);

    if(tryRenderWithGlobalQRCode(el, text, size)){
      return { mode:'local' };
    }

    const url = fallbackUrl(text, size);
    if(isImg(el)){
      el.src = url;
    }else if(isCanvas(el)){
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function(){
        const ctx = el.getContext('2d');
        el.width = size;
        el.height = size;
        ctx.clearRect(0,0,size,size);
        ctx.drawImage(img, 0, 0, size, size);
      };
      img.src = url;
    }else{
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'QR Code';
      img.style.maxWidth = `${size}px`;
      img.style.width = '100%';
      img.style.height = 'auto';
      el.innerHTML = '';
      el.appendChild(img);
    }
    return { mode:'fallback' };
  }

  window.HHQr = { render };
})();