/* TBK ToolBarOverride.js v7.3.2 (MSFS 2024)
 * - Full toolbar suppression (hide + remove hitbox) with clean restore
 * - Dynamic pass-through strip: auto-measures real toolbar height
 * - Stable ON / OFF / (optional) HIDE
 * - Hotkey (capture-phase): Ctrl+Alt+T toggles OFF <-> ON
 * - Default on load = ON (visible), unless user previously set OFF
 * - ES5-safe; no deps
 */
(function(){
  if (window._tb_hider_injected) { try{ console.log('[TBK] already injected'); }catch(_){ } return; }
  window._tb_hider_injected = true;

  // ----------------------- utils -----------------------
  function q1(s){ try{ return document.querySelector(s); }catch(_){ return null; } }
  function qa(s){ try{ return document.querySelectorAll(s); }catch(_){ return []; } }
  function selOne(s){ try{ return document.querySelector(s); }catch(_){ return null; } }
  function cssPath(node){
    if(!node || node.nodeType!==1) return '';
    var p=[], n=node;
    while(n && n!==document.documentElement){
      var part=n.tagName.toLowerCase();
      if(n.id){ part+='#'+n.id; p.unshift(part); break; }
      var cls=(''+n.className).trim().split(/\s+/).slice(0,2).join('.');
      if(cls) part+='.'+cls;
      var k=1, sib=n;
      while((sib=sib.previousElementSibling) && sib.tagName===n.tagName) k++;
      part+=':nth-of-type('+k+')';
      p.unshift(part);
      n=n.parentElement;
    }
    return p.join(' > ');
  }

  // ---------------- state & helpers ----------------
  window.TBK = window.TBK || {};
  TBK._stack = TBK._stack || [];

  function _remember(el){
    var i; for(i=0;i<TBK._stack.length;i++){ if (TBK._stack[i].el===el) return; }
    var cs=el.style;
    TBK._stack.push({ el: el, prev: {
      opacity: cs.opacity || null,
      pe:      cs.pointerEvents || null,
      tx:      cs.transform || null,
      z:       cs.zIndex || null
    }});
  }
  function _suppressEl(el){
    if(!el) return false;
    _remember(el);
    el.style.opacity='0';
    el.style.pointerEvents='none';
    el.style.transform='translateY(-9999px)';
    el.style.zIndex='0';
    return true;
  }
  function _restoreAll(){
    var i;
    for (i=TBK._stack.length-1; i>=0; i--){
      var item = TBK._stack[i], el=item.el, p=item.prev||{}, st=el && el.style;
      if (st){
        st.opacity       = (p.opacity==null ? '' : p.opacity);
        st.pointerEvents = (p.pe==null ? '' : p.pe);
        st.transform     = (p.tx==null ? '' : p.tx);
        st.zIndex        = (p.z==null ? '' : p.z);
      }
    }
    TBK._stack.length = 0;
  }

  // ---------------- dynamic toolbar measurement ----------------
  TBK._stripPx = (function(){ try { return parseInt(localStorage.getItem('TBK_STRIP_PX')||'0',10)||0; } catch(_) { return 0; } })();

  TBK._measureToolbarRect = function(){
    var candSel = ['.toolbar-list','.toolbar-handle','tool-bar','[class*="toolbar"]','[id*="toolbar"]'];
    var best=null, bestScore=0, i, el, r;

    function scoreRect(rr){
      var w = Math.max(1, (window.innerWidth||1920));
      var s = 0;
      if (rr.top >= 0 && rr.top < Math.min(240, (window.innerHeight||1080)*0.35)) s += 5;
      if (rr.height > 20 && rr.height < 320) s += 3;
      if (rr.width > w*0.4) s += 3;
      return s;
    }

    // 1) Known selectors
    for (i=0;i<candSel.length;i++){
      try { el = document.querySelector(candSel[i]); } catch(_) { el = null; }
      if (!el) continue;
      r = el.getBoundingClientRect();
      var s = scoreRect(r);
      if (s > bestScore) { bestScore = s; best = r; }
    }

    // 2) Sampler fallback (walk up from a few top points)
    if (!best){
      try{
        var xs=[16,128,320,640,960,1280,1600], y=12, seen={}, nodes=[];
        for (i=0;i<xs.length;i++){
          var x=Math.min(xs[i], (window.innerWidth||1600)-8);
          var leaf=document.elementFromPoint(x,y), hops=0, p=leaf;
          while(p && p!==document.documentElement && hops++<8){ if(!seen[p]){ seen[p]=1; nodes.push(p); } p=p.parentElement; }
        }
        var union=null;
        for(i=0;i<nodes.length;i++){
          var n=nodes[i], cs=window.getComputedStyle(n), pos=cs.position;
          if (pos!=='fixed' && pos!=='absolute' && pos!=='sticky') continue;
          r=n.getBoundingClientRect();
          if (r.top > 260 || r.height < 20 || r.height > 320) continue;
          union = union
            ? { top: Math.min(union.top, r.top), bottom: Math.max(union.bottom, r.bottom), left: Math.min(union.left, r.left), right: Math.max(union.right, r.right), width: 0, height: 0 }
            : { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: 0, height: 0 };
        }
        if (union){
          union.width  = Math.max(0, union.right - union.left);
          union.height = Math.max(0, union.bottom - union.top);
          best = union;
        }
      }catch(_){}
    }
    return best; // DOMRect-like or null
  };

  TBK._updateStripCSS = function(){
    var hPx = TBK._stripPx || 0;
    var rect = TBK._measureToolbarRect();
    if (rect && rect.bottom > 0){
      hPx = Math.max( Math.round(rect.bottom), 80 );
      TBK._stripPx = hPx;
      try { localStorage.setItem('TBK_STRIP_PX', String(hPx)); } catch(_){}
    }
    if (!hPx) hPx = 180; // fallback first-run

    var css = [
      'html, body { pointer-events: none !important; }',
      '#tbk-pass { position: fixed; left:0; right:0; top: '+hPx+'px; bottom:0;',
      '  pointer-events: auto !important; z-index: 2147483600; }'
    ].join('\n');

    var st = document.getElementById('tbk-pass-style');
    if (!st){
      st = document.createElement('style'); st.id='tbk-pass-style'; st.type='text/css';
      (document.head||document.documentElement).appendChild(st);
    }
    if (st.textContent !== css) st.textContent = css;
  };

  // ---------------- click-through windowing ----------------
  function winOn(){
    // ensure CSS uses measured height
    try { TBK._updateStripCSS(); } catch(_){}
    try{
      var pane=document.getElementById('tbk-pass');
      if(!pane){
        pane=document.createElement('div'); pane.id='tbk-pass';
        var b=document.body;
        while (b.firstChild) pane.appendChild(b.firstChild);
        b.appendChild(pane);
      }
    }catch(_){}
  }
  function winOff(){
    try{
      var st=document.getElementById('tbk-pass-style'); if(st&&st.parentNode) st.parentNode.removeChild(st);
      var pane=document.getElementById('tbk-pass');
      if(pane && pane.parentNode){
        while(pane.firstChild) document.body.appendChild(pane.firstChild);
        pane.parentNode.removeChild(pane);
      }
      var dbg=document.getElementById('tbk-strip-debug'); if(dbg&&dbg.parentNode) dbg.parentNode.removeChild(dbg);
    }catch(_){}
  }

  // ---------------- suppression strategies ----------------
  function suppressViaStored(){
    var pth=''; try{ pth = localStorage.getItem('TBK_LAST_ROOT')||''; }catch(_){}
    if (!pth) return false;
    var el=null; try{ el = document.querySelector(pth); }catch(_){}
    if(el) return _suppressEl(el);
    return false;
  }
  var KNOWN = ['.toolbar-list','.toolbar-handle','tool-bar','[class*="toolbar"]','[id*="toolbar"]'];
  function suppressViaKnown(){
    var i, el;
    for(i=0;i<KNOWN.length;i++){
      el = selOne(KNOWN[i]);
      if(el && _suppressEl(el)){
        try{ localStorage.setItem('TBK_LAST_ROOT', cssPath(el)); }catch(_){}
        return true;
      }
    }
    return false;
  }
  function suppressViaSampler(){
    try{
      var y=12, w=Math.max(800,(window.innerWidth||1600));
      var xs=[32,160,320,640,960,1280,1600];
      var seen={}, nodes=[], i;
      for(i=0;i<xs.length;i++){
        var x=Math.min(xs[i], w-8), leaf=document.elementFromPoint(x,y);
        var p=leaf, hops=0;
        while(p && p!==document.documentElement && hops++<8){
          if(!seen[p]){ seen[p]=0; nodes.push(p); }
          seen[p]++; p=p.parentElement;
        }
      }
      var best=null, bestScore=0;
      for(i=0;i<nodes.length;i++){
        var n=nodes[i], sc=seen[n]||0, cs=window.getComputedStyle(n), pos=cs.position;
        if(pos!=='fixed' && pos!=='absolute' && pos!=='sticky') continue;
        var r=n.getBoundingClientRect();
        if(r.top>260 || r.height<30 || r.height>260 || r.width<w*0.4) continue;
        if(sc>bestScore){ best=n; bestScore=sc; }
      }
      if (best && _suppressEl(best)) {
        try{ localStorage.setItem('TBK_LAST_ROOT', cssPath(best)); }catch(_){}
        return true;
      }
    }catch(_){}
    return false;
  }

  // ---------------- public API ----------------
  TBK.on = function(){
    winOff();            // disable windowing
    _restoreAll();       // restore any saved styles

    // scrub any leftover inline suppressions anywhere
    var list = qa('[style]'); var i, fixed=0;
    for (i=0;i<list.length;i++){
      var el=list[i], st=el.style, changed=false;
      if (st.opacity==='0'){ st.opacity=''; changed=true; }
      if (st.pointerEvents==='none'){ st.pointerEvents=''; changed=true; }
      if ((st.transform||'').indexOf('-9999px')>=0){ st.transform=''; changed=true; }
      if (st.zIndex==='0'){ st.zIndex=''; changed=true; }
      if (changed) fixed++;
    }
    try{ console.log('[TBK] ON scrubbed nodes =', fixed); }catch(_){}

    // clear stored root to avoid instant re-suppress
    try{ localStorage.removeItem('TBK_LAST_ROOT'); }catch(_){}

    // wake the UI with top-edge mousemoves
    try{
      var w=Math.max(800,(window.innerWidth||1600));
      var XS=[16, Math.min(128,w-16), Math.min(512,w-16)];
      var YS=[6,12,18]; var xi, yi;
      for (xi=0; xi<XS.length; xi++){
        for (yi=0; yi<YS.length; yi++){
          var evt=document.createEvent('MouseEvents');
          evt.initMouseEvent('mousemove', true, true, window, 0, XS[xi], YS[yi], XS[xi], YS[yi],
                             false,false,false,false, 0, null);
          window.dispatchEvent(evt);
        }
      }
    }catch(_){}

    try{
      var efp=document.elementFromPoint(8,8);
      console.log('[TBK] ON done; EFP(8,8)=', efp && (efp.tagName+'#'+(efp.id||'')+'.'+(efp.className||'')));
    }catch(_){}
  };

  TBK.off = function(){
    // measure BEFORE suppression so click-through matches real height
    try {
      TBK._updateStripCSS();
      var r = TBK._measureToolbarRect();
      if (r && r.bottom > 0) {
        TBK._stripPx = Math.max(Math.round(r.bottom), 80);
        try { localStorage.setItem('TBK_STRIP_PX', String(TBK._stripPx)); } catch(_){}
      }
    } catch(_){}

    var ok = suppressViaStored() || suppressViaKnown() || suppressViaSampler();
    winOn(); // enable windowing with updated CSS
    try{ console.log('[TBK] OFF:', ok ? 'suppressed' : 'no candidate (windowing only)'); }catch(_){}
  };

  TBK.hide = function(){
    // optional: opacity/pointer-events only; still keep click-through
    try { TBK._updateStripCSS(); } catch(_){}
    var hit=false, i, el;
    for (i=0;i<KNOWN.length;i++){
      el = selOne(KNOWN[i]);
      if (el && _suppressEl(el)) hit=true;
    }
    if (!hit) suppressViaSampler();
    winOn();
    try{ console.log('[TBK] HIDE: opacity/pointer-events + windowing'); }catch(_){}
  };

  // compatibility alias used earlier
  TBK.full = TBK.off;

  // ---------------- hotkey: Ctrl+Alt+T toggles ON/OFF ----------------
  (function bindSimpleToggle(){
    if (window._tbk_hotkey_simple) return;
    window._tbk_hotkey_simple = true;

    function wantsKeys(){
      var a=document.activeElement;
      if (!a) return true;
      var tag=(a.tagName||'').toLowerCase();
      if (tag==='input' || tag==='textarea') return false;
      if (a.isContentEditable) return false;
      return true;
    }
    function isSuppressed(){ return !!document.getElementById('tbk-pass-style'); }
    var last=0; function debounce(ms){ var now=Date.now(); if(now-last<ms) return true; last=now; return false; }
    function isT(ev){
      var k=(ev.key||'').toLowerCase();
      var code=ev.code||'';
      var kc=ev.keyCode||ev.which||ev.charCode||0;
      if (k==='t') return true;
      if (code==='KeyT') return true;
      if (kc===84) return true;
      if (kc && String.fromCharCode(kc).toLowerCase()==='t') return true;
      return false;
    }
    function handle(ev){
      try{
        if (!wantsKeys()) return;
        if (!(ev.ctrlKey && ev.altKey)) return;
        if (!isT(ev)) return;
        if (debounce(150)) return;

        if (isSuppressed()) { TBK.on();  try{ localStorage.setItem('TBK_MODE','0'); }catch(_){ } }
        else               { TBK.off(); try{ localStorage.setItem('TBK_MODE','2'); }catch(_){ } }
        ev.preventDefault(); ev.stopPropagation();
      }catch(_){}
    }
    var cap=true;
    window.addEventListener('keydown', handle, cap);
    document.addEventListener('keydown', handle, cap);
    if (document.body) document.body.addEventListener('keydown', handle, cap);

    if (!document.body){
      var t=setInterval(function(){
        if (document.body){
          clearInterval(t);
          try{ document.body.addEventListener('keydown', handle, cap); }catch(_){}
        }
      }, 300);
      setTimeout(function(){ try{ clearInterval(t); }catch(_){} }, 5000);
    }
    try{ console.log('[TBK] Ctrl+Alt+T toggle bound'); }catch(_){}
  })();

  // ---------------- re-measure on viewport changes ----------------
  (function bindResize(){
    var t=null;
    function rq(){ if (t) return; t = setTimeout(function(){ t=null; try{ TBK._updateStripCSS(); }catch(_){} }, 120); }
    try { window.addEventListener('resize', rq, {capture:true, passive:true}); } catch(_){}
    try { window.addEventListener('orientationchange', rq, {capture:true, passive:true}); } catch(_){}
  })();

  // ---------------- auto-apply on load (default = ON) ----------------
  try {
    // mode: 0 = ON (visible), 2 = OFF (suppressed). Default to 0.
    var raw  = localStorage.getItem('TBK_MODE');
    var mode = (raw === null ? 0 : Number(raw));
    if (mode === 2) { TBK.off(); }  // previously suppressed
    else            { TBK.on();  }  // default / previously visible
  } catch (_) { TBK.on(); }

  try{ console.log('[TBK] v7.3.2 injected'); }catch(_){}
})();
