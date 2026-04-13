         ta.style.left = '-9999px';
         D.body.appendChild(ta);
         ta.select();
         D.execCommand('copy');
         D.body.removeChild(ta);
         resolve();
       } catch (err) {
         reject(err);
       }
     });
   }
 
   function showToast(message) {
     const toast = byId('toast');
     if (!toast) return;
 
     toast.textContent = message;
     toast.classList.add('show');
 
     if (toast.__hideTimer) W.clearTimeout(toast.__hideTimer);
     toast.__hideTimer = W.setTimeout(function () {
       toast.classList.remove('show');
     }, 1800);
   }
 
   function refreshView() {
     hideLegacyNoise();
     stripUnusedBlocks();
     applyLinks();
     refreshProfile();
     refreshTodayHints();
     refreshHeroQuickline();
     renderRecentPills();
     renderMissionList();
     renderSummaryBox();
     renderMissions();
     renderStickerShelf();
   }
 
   function boot() {
     bindButtons();
     refreshView();
   }
 
   if (D.readyState === 'loading') {
     D.addEventListener('DOMContentLoaded', boot, { once: true });
   } else {
     boot();
   }
 
   W.addEventListener('focus', refreshView);
   W.addEventListener('pageshow', refreshView);
   D.addEventListener('visibilitychange', function () {
     if (!D.hidden) refreshView();
   });
 })(window, document);
