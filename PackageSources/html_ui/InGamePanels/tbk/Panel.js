(function () {
  try { localStorage.setItem('TBK_AUTO', '1'); } catch (e) {}

  var urls = [
    'coui://html_ui/InGamePanels/tbk/ToolBarOverride.js'
  ];
  var i = 0;
  function next() {
    if (i >= urls.length) { try { console.error('[TBK] panel loader failed all URLs'); } catch (e) {} return; }
    var u = urls[i++] + '?ts=' + (+new Date());
    var s = document.createElement('script');
    s.src = u;
    s.onload  = function () { try { console.log('[TBK] panel loaded runtime:', u); } catch (e) {} };
    s.onerror = function () { try { console.warn('[TBK] 404 panel:', u); } catch (e) {} next(); };
    (document.head || document.documentElement).appendChild(s);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', next);
  } else {
    next();
  }
})();
