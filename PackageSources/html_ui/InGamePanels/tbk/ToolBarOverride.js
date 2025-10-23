(function() {
  if (window._tb_hider_injected) return;
  window._tb_hider_injected = true;

  // Configurable selectors
  const PANEL_SELECTOR = 'ui-panel[name="Panel"]';
  const CONTAINER_SELECTORS = ['html', 'body', '.panels-viewer', '.panels-viewer__panel'];

  // State
  window.TBK = window.TBK || {};
  TBK._stack = TBK._stack || [];

  // Utils
  function qa(s) { try { return document.querySelectorAll(s); } catch (_) { return []; } }
  function selOne(s) { try { return document.querySelector(s); } catch (_) { return null; } }
  // Suppression and restoration
  function _remember(el) {
    if (TBK._stack.some(item => item.el === el)) return;
    const cs = el.style;
    TBK._stack.push({
      el,
      prev: { display: cs.display || null, pointerEvents: cs.pointerEvents || null }
    });
  }

  function suppressSlab() {
    try {
      const nodes = qa(PANEL_SELECTOR);
      for (let i = 0; i < nodes.length; i++) {
        const el = nodes[i];
        _remember(el);
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      }
      CONTAINER_SELECTORS.forEach(sel => {
        const list = sel[0] === '.' ? qa(sel) : [selOne(sel)];
        for (let j = 0; j < list.length; j++) {
          const n = list[j];
          if (n) n.style.setProperty('pointer-events', 'none', 'important');
        }
      });
      DataStore.SetStoredData('TBK_MODE', '2');
      console.log('TBK: slab suppressed + click-through forced');
    } catch (e) {
      console.error('TBK: Error suppressing slab', e);
    }
  }

  function restoreSlab() {
    try {
      TBK._stack.forEach(item => {
        const { el, prev } = item;
        if (el && el.style) {
          el.style.display = prev.display || '';
          el.style.pointerEvents = prev.pointerEvents || '';
        }
      });
      TBK._stack.length = 0;
      CONTAINER_SELECTORS.forEach(sel => {
        const list = sel[0] === '.' ? qa(sel) : [selOne(sel)];
        for (let j = 0; j < list.length; j++) {
          const n = list[j];
          if (n) n.style.pointerEvents = '';
        }
      });
      TBK._scrubWidthConstraints();
      TBK._wakeTopEdge();
      DataStore.SetStoredData('TBK_MODE', '0');
      console.log('TBK: slab restored');
    } catch (e) {
      console.error('TBK: Error restoring slab', e);
    }
  }

  // Layout fixes (unchanged)
  TBK._scrubWidthConstraints = function() {
    try {
      const selectors = ['.toolbar-list', '.toolbar-handle', 'tool-bar', '.panels-viewer', '[class*="toolbar"]', '[id*="toolbar"]'];
      const list = qa(selectors.join(','));
      for (let i = 0; i < list.length; i++) {
        const el = list[i];
        const st = el.style;
        ['width', 'maxWidth', 'minWidth', 'clipPath', 'clip', 'mask'].forEach(k => st[k] = '');
        if (st.overflow !== 'visible') st.overflow = 'visible';
        if (st.overflowX !== 'visible') st.overflowX = 'visible';
        if (st.left === '0px' || st.right === '0px') { st.left = ''; st.right = ''; }
      }
    } catch (e) { console.error('TBK: Error scrubbing constraints', e); }
  };

  TBK._wakeTopEdge = function() {
    try {
      const w = Math.max(800, window.innerWidth || 1600);
      const xs = [2, 8, 24, 48, 96, 160, w - 96, w - 48, w - 8, w - 2];
      const ys = [6, 10, 14, 18];
      for (let i = 0; i < xs.length; i++) {
        for (let j = 0; j < ys.length; j++) {
          const evt = new MouseEvent('mousemove', {
            bubbles: true,
            cancelable: true,
            clientX: xs[i],
            clientY: ys[j],
            screenX: xs[i],
            screenY: ys[j]
          });
          window.dispatchEvent(evt);
        }
      }
    } catch (e) { console.error('TBK: Error waking top edge', e); }
  };

  // Public API (simple: on/off only)
  TBK.on = restoreSlab;
  TBK.off = suppressSlab;

  // Cleanup function
  TBK.cleanup = function() {
    try {
      window.removeEventListener('keydown', handle, true);
      TBK._stack = [];
      DataStore.SetStoredData('TBK_MODE', '0');  // Reset to visible
      console.log('TBK: Cleaned up');
    } catch (e) {
      console.error('TBK: Error during cleanup', e);
    }
  };

  // Hotkey toggle (unchanged, with robust key detection)
  let handle;
  (function bindToggle() {
    if (window._tbk_hotkey_simple) return;
    window._tbk_hotkey_simple = true;
    function wantsKeys() {
      const a = document.activeElement;
      if (!a) return true;
      const tag = (a.tagName || '').toLowerCase();
      return !(tag === 'input' || tag === 'textarea' || a.isContentEditable);
    }
    let last = 0;
    function debounce(ms) {
      const now = Date.now();
      if (now - last < ms) return true;
      last = now;
      return false;
    }
    handle = function(ev) {
  try {
    if (!wantsKeys() || !(ev.ctrlKey && ev.altKey) || (ev.keyCode || ev.which) !== 84 || debounce(150)) return;
    TBK[TBK._stack.length ? 'on' : 'off']();
    ev.preventDefault();
    ev.stopPropagation();
  } catch (e) {
    console.error('TBK: Error in hotkey handler', e);
  }
};
    window.addEventListener('keydown', handle, true);
    console.log('[TBK] Ctrl+Alt+T toggle bound');
  })();

  // Auto-apply on load (now using DataStore)
  try {
    const mode = DataStore.GetStoredData('TBK_MODE') || '2';
    if (mode === '0') TBK.on();
    else TBK.off();
  } catch (e) {
    console.error('TBK: Error on load', e);
    TBK.off();
  }

  console.log('[TBK] v2.3 injected (DataStore persistent)');
})();