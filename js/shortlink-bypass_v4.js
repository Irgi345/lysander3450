/* ================================================================
   IRGXYMODS — SHORTLINK BYPASS V4.2 (CRASH-FIXED EDITION)
   Fix   : self-contained toast, safeOn wrapper, global error handler,
           defensive null checks, AbortController feature detection
   Author: IRGXYMODS Engineering
   ================================================================ */
(function () {
  'use strict';

  /* ================================================================
     ⚡ GLOBAL ERROR HANDLERS — TANGKAP SEMUA CRASH
     ================================================================ */
  window.addEventListener('error', function (e) {
    console.error('[SLB Global Error]', e.error || e.message, 'at', e.filename + ':' + e.lineno);
  });
  window.addEventListener('unhandledrejection', function (e) {
    console.error('[SLB Unhandled Promise]', e.reason);
    try { e.preventDefault(); } catch (_) {}
  });

  /* ================================================================
     🛡️ SAFE HELPERS — JANGAN PERNAH CRASH
     ================================================================ */
  const $  = function (s, ctx) { try { return (ctx || document).querySelector(s); } catch (_) { return null; } };
  const $$ = function (s, ctx) { try { return Array.from((ctx || document).querySelectorAll(s)); } catch (_) { return []; } };

  /** Bind event listener dengan try/catch otomatis */
  function safeOn(el, event, handler) {
    if (!el || typeof handler !== 'function') return;
    try {
      el.addEventListener(event, function (e) {
        try { handler.call(el, e); }
        catch (err) { console.error('[SLB Handler Error]', event, err); }
      });
    } catch (e) { console.error('[SLB Bind Error]', e); }
  }

  /** Safe get localStorage */
  function lsGet(key, fallback) {
    try { const v = localStorage.getItem(key); return v == null ? fallback : v; }
    catch (_) { return fallback; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }
  function lsDel(key) {
    try { localStorage.removeItem(key); return true; } catch (_) { return false; }
  }
  function lsJSON(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (_) { return fallback; }
  }
  function ssGet(key, fallback) {
    try { const v = sessionStorage.getItem(key); return v == null ? fallback : v; }
    catch (_) { return fallback; }
  }
  function ssSet(key, value) {
    try { sessionStorage.setItem(key, value); return true; } catch (_) { return false; }
  }

  /* ================================================================
     🍞 TOAST SELF-CONTAINED — TIDAK DEFER KE main.js
     ================================================================ */
  const toastQueue = [];
  const MAX_TOAST = 3;
  function showToast(msg, type) {
    type = type || 'info';
    if (!getSetting('notifications', true)) return;

    // Cari container: prioritaskan #toastContainer, fallback buat sendiri
    let c = document.getElementById('toastContainer');
    if (!c) {
      c = document.createElement('div');
      c.id = 'toastContainer';
      c.className = 'toast-container';
      c.setAttribute('aria-live', 'polite');
      c.setAttribute('aria-atomic', 'false');
      c.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none;max-width:320px';
      if (document.body) document.body.appendChild(c);
    }
    if (!c) { console.log('[SLB ' + type + ']', msg); return; }

    while (toastQueue.length >= MAX_TOAST) {
      const old = toastQueue.shift();
      if (old && old.parentNode) old.parentNode.removeChild(old);
    }
    const el = document.createElement('div');
    el.className = 'toast-item ' + type;
    el.textContent = String(msg);
    el.style.cssText = 'pointer-events:auto;padding:12px 18px;border-radius:12px;font-size:0.85rem;font-weight:500;box-shadow:0 8px 24px rgba(0,0,0,0.4);background:rgba(30,30,42,0.98);color:#fff;border-left:3px solid #4facfe;animation:slbOverlayFadeIn 0.3s ease';
    if (type === 'success') el.style.borderLeftColor = '#43e97b';
    else if (type === 'error') el.style.borderLeftColor = '#ff416c';
    else if (type === 'warning') el.style.borderLeftColor = '#ffd54f';
    c.appendChild(el);
    toastQueue.push(el);
    setTimeout(function () {
      try {
        if (el.parentNode) el.parentNode.removeChild(el);
        const idx = toastQueue.indexOf(el);
        if (idx >= 0) toastQueue.splice(idx, 1);
      } catch (_) {}
    }, 3200);
  }

  /* ================================================================
     SAFE FETCH — AUTO FALLBACK
     ================================================================ */
  const safeFetch = function (url, opts, timeoutMs) {
    opts = opts || {};
    timeoutMs = timeoutMs || 15000;
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (_) {} }, timeoutMs) : null;
    const finalOpts = ctrl ? Object.assign({}, opts, { signal: ctrl.signal }) : opts;
    return fetch(url, finalOpts).finally(function () {
      if (timer) clearTimeout(timer);
    });
  };

  /* ================================================================
     SETTINGS
     ================================================================ */
  const SETTINGS_KEY = 'slb_settings';
  const DEFAULT_SETTINGS = {
    autoCopy: false, autoOpen: false, saveHistory: true,
    notifications: true, sound: false, autoClipboard: false, lang: 'id'
  };
  function loadSettings() {
    try { return Object.assign({}, DEFAULT_SETTINGS, lsJSON(SETTINGS_KEY, {})); }
    catch (_) { return Object.assign({}, DEFAULT_SETTINGS); }
  }
  function saveSettings(s) { lsSet(SETTINGS_KEY, JSON.stringify(s)); }
  function getSetting(k, dflt) {
    const s = loadSettings();
    return s[k] !== undefined ? s[k] : (dflt !== undefined ? dflt : DEFAULT_SETTINGS[k]);
  }

  /* ================================================================
     CONSTANTS
     ================================================================ */
  const HISTORY_KEY  = 'irgxy_slb_history';
  const HISTORY_MAX  = 15;
  const THEME_KEY    = 'slb_theme';
  const ACCENT_KEY   = 'slb_accent';
  const PROXY_KEY    = 'slb_proxy_mode';
  const ERROR_KEY    = 'slb_errors';
  const ERROR_MAX    = 20;
  const CACHE_TTL    = 5 * 60 * 1000;
  const RATE_LIMIT   = 10;
  const RATE_WINDOW  = 60 * 1000;
  const RATE_KEY     = 'slb_rate';
  const PERF_KEY     = 'slb_perf';

  const BLACKLIST = [
    'google.com','facebook.com','twitter.com','x.com','instagram.com','youtube.com',
    'cloudflare.com','gstatic.com','googleapis.com','jquery.com','fontawesome.com',
    'jsdelivr.net','unpkg.com','cdnjs.cloudflare.com','bootstrapcdn.com','cloudfront.net',
    'doubleclick.net','googlesyndication.com','googletagmanager.com','google-analytics.com',
    'w3.org','schema.org','mozilla.org','microsoft.com','apple.com','wikipedia.org',
    'stackoverflow.com','github.com','githubusercontent.com','gstatic.cn',
    'recaptcha.net','hcaptcha.com','turnstile.cloudflare.com'
  ];

  const VALID_TARGET_HOSTS = [
    'mediafire.com','mega.nz','mega.io','drive.google.com','docs.google.com',
    'dropbox.com','mega4upload.net','mega4upload.com','uploady.io',
    'upfilesgo.com','upfiles.app','upfiles.com','modsfire.com',
    'dailyuploads.net','jioupload.com','jioupload.in','jioupload.net',
    'cloudfam.io','frdl.io','frdl.link','freedl.ink','rapidgator.net',
    '1fichier.com','zippyshare.com','anonfiles.com','gofile.io','pixeldrain.com',
    'workupload.com','bowfile.com','katfile.com','turbobit.net','nitroflare.com'
  ];

  const REDIRECT_PARAMS = [
    'dest','destination','url','target','u','r','redirect','to',
    'goto','go','out','outgoing','link','continue','next'
  ];

  /* ================================================================
     SERVICES DATABASE
     ================================================================ */
  const SERVICES = [
    { name:'AdFly',           cat:'A', layer:'direct', match:['adf.ly','adfly.com','adfly.fr','adfly.it','adfly.es','adfly.mobi'] },
    { name:'Linkvertise',     cat:'A', layer:'api',    match:['linkvertise.com','linkvertise.net','link-to.net','up-to-down.net','direct-link.net','link-hub.net','link-target.net'] },
    { name:'MediaFire',       cat:'A', layer:'proxy',  match:['mediafire.com'] },
    { name:'Safelinku',       cat:'A', layer:'api',    match:['safelinku.com','safelink.me','safelinkconverter.com'] },
    { name:'Shorte.st',       cat:'A', layer:'direct', match:['sh.st','u2ks.com','jnw0.com','shorte.st','ceesty.com','festyy.com'] },
    { name:'Ouo.io',          cat:'A', layer:'api',    match:['ouo.io','ouo.press','uii.io'] },
    { name:'ShrinkMe',        cat:'A', layer:'proxy',  match:['shrinkme.io','shrinkme.click'] },
    { name:'ShrinkEarn',      cat:'A', layer:'info',   match:['shrinkearn.com','shrinkearn.in'] },
    { name:'Exe.io',          cat:'A', layer:'proxy',  match:['exe.io','exey.io','exee.io'] },
    { name:'GPLinks',         cat:'A', layer:'proxy',  match:['gplinks.co','gplinks.in','gplink.in'] },
    { name:'Droplink',        cat:'A', layer:'proxy',  match:['droplink.co'] },
    { name:'LKSFY',           cat:'A', layer:'proxy',  match:['lksfy.com','lksfy.in'] },
    { name:'RockLinks',       cat:'A', layer:'proxy',  match:['rocklinks.in','rocklinks.net'] },
    { name:'VPLink',          cat:'A', layer:'proxy',  match:['vplink.in'] },
    { name:'JRLinks',         cat:'A', layer:'proxy',  match:['jrlinks.in'] },
    { name:'4hi.in',          cat:'A', layer:'proxy',  match:['4hi.in'] },
    { name:'TNSHORT',         cat:'A', layer:'proxy',  match:['tnshort.net','go.tnshort.net'] },
    { name:'Dekhe.click',     cat:'A', layer:'proxy',  match:['dekhe.click'] },
    { name:'CLK Network',     cat:'A', layer:'proxy',  match:['clk.wiki','clk.kim','clk.sh','clk.ink','clk.press'] },
    { name:'SoftURL',         cat:'A', layer:'proxy',  match:['softurl.in'] },
    { name:'LinkShortify',    cat:'A', layer:'proxy',  match:['linkshortify.in'] },
    { name:'ShrinkForEarn',   cat:'A', layer:'proxy',  match:['shrinkforearn.in'] },
    { name:'IndianShortner',  cat:'A', layer:'proxy',  match:['indianshortner.com'] },
    { name:'ModijiURL',       cat:'A', layer:'proxy',  match:['modijiurl.com'] },
    { name:'InstantEarn',     cat:'A', layer:'proxy',  match:['instantearn.in'] },
    { name:'Get2Short',       cat:'A', layer:'proxy',  match:['get2short.com'] },
    { name:'KingURL',         cat:'A', layer:'proxy',  match:['kingurl.in'] },
    { name:'PublicEarn',      cat:'A', layer:'proxy',  match:['publicearn.site'] },
    { name:'TechAtg',         cat:'A', layer:'proxy',  match:['technicalatg.in','f.technicalatg.in'] },
    { name:'TPI/OII Family',  cat:'A', layer:'proxy',  match:['tpi.li','oii.la','tei.ai','tii.ai','iir.ai','oko.sh'] },
    { name:'Sub2Unlock',      cat:'B', layer:'info',   match:['sub2unlock.net','sub2unlock.com','sub2unlock.me','sub2unlock.io'] },
    { name:'Sub2Get',         cat:'B', layer:'info',   match:['sub2get.com'] },
    { name:'Sub4Unlock',      cat:'B', layer:'info',   match:['sub4unlock.com'] },
    { name:'YTSubMe',         cat:'B', layer:'info',   match:['ytsubme.com'] },
    { name:'LetsBoost',       cat:'B', layer:'info',   match:['letsboost.net'] },
    { name:'Boost.ink',       cat:'B', layer:'info',   match:['boost.ink','bst.gg','bst.wtf'] },
    { name:'MBoost',          cat:'B', layer:'info',   match:['mboost.me'] },
    { name:'BoostFused',      cat:'B', layer:'info',   match:['boostfused.com'] },
    { name:'Social-Unlock',   cat:'B', layer:'info',   match:['social-unlock.com'] },
    { name:'LootLabs',        cat:'C', layer:'info',   match:['loot-link.com','loot-links.com','lootlabs.gg','loot-link.net'] },
    { name:'Work.ink',        cat:'C', layer:'info',   match:['work.ink','workink.net'] },
    { name:'Mega4Upload',     cat:'D', layer:'proxy',  match:['mega4upload.net','mega4upload.com'] },
    { name:'Uploady',         cat:'D', layer:'proxy',  match:['uploady.io'] },
    { name:'UpFiles',         cat:'D', layer:'proxy',  match:['upfilesgo.com','upfiles.app','upfiles.com'] },
    { name:'ModsFire',        cat:'D', layer:'proxy',  match:['modsfire.com'] },
    { name:'DailyUploads',    cat:'D', layer:'proxy',  match:['dailyuploads.net'] },
    { name:'JioUpload',       cat:'D', layer:'proxy',  match:['jioupload.com','jioupload.in','jioupload.net'] },
    { name:'CloudFam',        cat:'D', layer:'proxy',  match:['cloudfam.io'] },
    { name:'FRDL',            cat:'D', layer:'proxy',  match:['frdl.io','frdl.link','freedl.ink'] },
    { name:'Rapidgator',      cat:'D', layer:'info',   match:['rapidgator.net'] },
    { name:'Bit.ly',          cat:'E', layer:'direct', match:['bit.ly','bitly.com'] },
    { name:'TinyURL',         cat:'E', layer:'direct', match:['tinyurl.com'] },
    { name:'Google URL',      cat:'E', layer:'direct', match:['goo.gl'] },
    { name:'t.co',            cat:'E', layer:'direct', match:['t.co'] },
    { name:'Shrto',           cat:'E', layer:'direct', match:['shrto.ml'] },
    { name:'Cutt.ly',         cat:'E', layer:'direct', match:['cutt.ly','cuttly.com'] },
    { name:'is.gd',           cat:'E', layer:'direct', match:['is.gd'] },
    { name:'v.gd',            cat:'E', layer:'direct', match:['v.gd'] },
    { name:'s.id',            cat:'E', layer:'direct', match:['s.id'] },
    { name:'SFL.gl',          cat:'E', layer:'api',    match:['sfl.gl'] },
    { name:'AdMaven',         cat:'F', layer:'proxy',  match:['admaven.com'] },
    { name:'Paster.so',       cat:'F', layer:'direct', match:['paster.so'] },
    { name:'Rekonise',        cat:'F', layer:'proxy',  match:['rekonise.com'] },
    { name:'BoostMe',         cat:'F', layer:'info',   match:['boostme.link'] },
    { name:'Shortconnect',    cat:'F', layer:'proxy',  match:['shortconnect.com'] },
    { name:'Short.am',        cat:'F', layer:'proxy',  match:['short.am'] },
    { name:'BC.VC',           cat:'F', layer:'proxy',  match:['bc.vc'] },
    { name:'AdFoc.us',        cat:'F', layer:'proxy',  match:['adfoc.us'] },
    { name:'LinkShrink',      cat:'F', layer:'proxy',  match:['linkshrink.net'] },
    { name:'LinkBucks',       cat:'F', layer:'info',   match:['linkbucks.com'] },
    { name:'AdLinkFly',       cat:'F', layer:'proxy',  match:['adlinkfly.com'] },
    { name:'StFly',           cat:'F', layer:'proxy',  match:['stfly.me','stfly.io','stfly.biz'] },
    { name:'Indobo',          cat:'F', layer:'proxy',  match:['indobo.com'] },
    { name:'Aylink',          cat:'F', layer:'proxy',  match:['aylink.co','ay.gy','ay.lc'] },
    { name:'CPMLink',         cat:'F', layer:'proxy',  match:['cpmlink.pro','cpmlink.net'] },
    { name:'ICutLink',        cat:'F', layer:'proxy',  match:['icutlink.com'] },
    { name:'ShrtFly',         cat:'F', layer:'proxy',  match:['shrtfly.com'] },
    { name:'Shortox',         cat:'F', layer:'proxy',  match:['shortox.com'] },
    { name:'ShortSlug',       cat:'F', layer:'proxy',  match:['shortslug.biz'] },
    { name:'Shortner.in',     cat:'F', layer:'proxy',  match:['shortner.in'] },
    { name:'LinkPays',        cat:'F', layer:'proxy',  match:['linkpays.in'] },
    { name:'TNLink',          cat:'F', layer:'proxy',  match:['tnlink.in','tnvalue.in'] },
    { name:'Try2Link',        cat:'F', layer:'proxy',  match:['try2link.com'] },
    { name:'URLSOpen',        cat:'F', layer:'proxy',  match:['urlsopen.com'] },
    { name:'OMG10',           cat:'F', layer:'proxy',  match:['omg10.com'] },
    { name:'EZ4Short',        cat:'F', layer:'proxy',  match:['ez4short.com'] },
    { name:'Earn4Link',       cat:'F', layer:'proxy',  match:['earn4link.in'] },
    { name:'ToLink',          cat:'F', layer:'proxy',  match:['tolink.in'] },
    { name:'ThotPacks',       cat:'F', layer:'proxy',  match:['thotpacks.xyz'] },
    { name:'MDiskShortner',   cat:'F', layer:'proxy',  match:['mdiskshortner.link'] },
    { name:'FileCrypt',       cat:'F', layer:'info',   match:['filecrypt.cc','filecrypt.co'] },
    { name:'Lnk2',            cat:'F', layer:'proxy',  match:['lnk2.cc'] },
    { name:'VearnBux',        cat:'F', layer:'proxy',  match:['vearnbux.in'] },
    { name:'Hyperlink',       cat:'F', layer:'proxy',  match:['hyperlink.pw'] }
  ];

  /* ================================================================
     UTILITIES
     ================================================================ */
  function isValidUrl(input) {
    if (!input || typeof input !== 'string') return false;
    try {
      const u = new URL(input.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) { return false; }
  }

  function detectService(url) {
    if (!url || typeof url !== 'string') return null;
    try {
      const u = new URL(url.trim());
      const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
      for (let i = 0; i < SERVICES.length; i++) {
        const s = SERVICES[i];
        for (let j = 0; j < s.match.length; j++) {
          const m = s.match[j];
          if (host === m || host.endsWith('.' + m)) return s;
        }
      }
    } catch (_) {}
    return null;
  }

  function isValidShortlink(url) { return !!detectService(url); }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }

  function tryDecode(v) {
    if (!v || typeof v !== 'string') return null;
    const s = v.trim();
    if (/^https?:\/\//i.test(s)) return s;
    try {
      if (/^[A-Za-z0-9+/=_-]+$/.test(s) && s.length >= 8) {
        const norm = s.replace(/-/g, '+').replace(/_/g, '/');
        const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - norm.length % 4);
        const dec = atob(norm + pad);
        if (/^https?:\/\//i.test(dec)) return dec;
        try { const d2 = decodeURIComponent(dec); if (/^https?:\/\//i.test(d2)) return d2; } catch (_) {}
      }
    } catch (_) {}
    try {
      const d = decodeURIComponent(s);
      if (/^https?:\/\//i.test(d) && d !== s) return d;
    } catch (_) {}
    return null;
  }

  function timeAgo(ts) {
    if (!ts || isNaN(ts)) return '—';
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'Baru saja';
    const min = Math.floor(sec / 60);
    if (min < 60) return min + ' menit lalu';
    const hr = Math.floor(min / 60);
    if (hr < 24) return hr + ' jam lalu';
    return Math.floor(hr / 24) + ' hari lalu';
  }

  function isBlacklisted(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    if (VALID_TARGET_HOSTS.some(function (v) { return host === v || host.endsWith('.' + v); })) return false;
    return BLACKLIST.some(function (b) { return host === b || host.endsWith('.' + b); });
  }

  function isFileHoster(host) {
    host = String(host || '').toLowerCase().replace(/^www\./, '');
    return VALID_TARGET_HOSTS.some(function (v) { return host === v || host.endsWith('.' + v); });
  }

  /* ================================================================
     ERROR LOG & PERFORMANCE
     ================================================================ */
  function logError(service, message, stack) {
    try {
      const list = lsJSON(ERROR_KEY, []);
      list.unshift({
        ts: Date.now(),
        service: service || '—',
        message: String(message || ''),
        stack: stack ? String(stack).slice(0, 300) : ''
      });
      lsSet(ERROR_KEY, JSON.stringify(list.slice(0, ERROR_MAX)));
    } catch (_) {}
  }
  function loadErrors() { return lsJSON(ERROR_KEY, []); }

  function logPerf(service, durationMs) {
    try {
      const list = lsJSON(PERF_KEY, []);
      list.unshift({ service: service, ms: durationMs, ts: Date.now() });
      lsSet(PERF_KEY, JSON.stringify(list.slice(0, 50)));
    } catch (_) {}
  }
  function loadPerf() { return lsJSON(PERF_KEY, []); }

  /* ================================================================
     RATE LIMITER
     ================================================================ */
  function checkRateLimit() {
    try {
      const now = Date.now();
      let arr = [];
      try { arr = JSON.parse(ssGet(RATE_KEY, '[]')) || []; } catch (_) { arr = []; }
      arr = arr.filter(function (t) { return now - t < RATE_WINDOW; });
      if (arr.length >= RATE_LIMIT) {
        const wait = Math.ceil((RATE_WINDOW - (now - arr[0])) / 1000);
        return { ok: false, wait: wait };
      }
      arr.push(now);
      ssSet(RATE_KEY, JSON.stringify(arr));
      return { ok: true };
    } catch (_) { return { ok: true }; }
  }

  /* ================================================================
     CACHE
     ================================================================ */
  const CACHE = new Map();
  function getCached(url) {
    const hit = CACHE.get(url);
    if (!hit) return null;
    if (Date.now() - hit.ts > CACHE_TTL) { CACHE.delete(url); return null; }
    return hit;
  }
  function setCache(url, data) {
    CACHE.set(url, Object.assign({}, data, { ts: Date.now() }));
    updateCacheCount();
  }
  function clearCache() {
    CACHE.clear();
    updateCacheCount();
  }
  function updateCacheCount() {
    const el = document.getElementById('slbCacheCount');
    if (el) el.textContent = CACHE.size + ' cache';
  }

  /* ================================================================
     CORS PROXY
     ================================================================ */
  const PROXIES = {
    corsproxy:  function (u) { return 'https://corsproxy.io/?' + encodeURIComponent(u); },
    allorigins: function (u) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u); },
    codetabs:   function (u) { return 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u); },
    thingproxy: function (u) { return 'https://thingproxy.freeboard.io/fetch/' + u; }
  };

  function getProxyList() {
    const mode = lsGet(PROXY_KEY, 'auto');
    if (mode === 'auto') return [PROXIES.corsproxy, PROXIES.allorigins, PROXIES.codetabs, PROXIES.thingproxy];
    return PROXIES[mode] ? [PROXIES[mode]] : [PROXIES.allorigins];
  }

  function fetchWithCorsProxy(url, referer) {
    const list = getProxyList();
    let lastErr = null;
    let ref = referer;
    if (!ref) {
      try { ref = new URL(url).origin + '/'; } catch (_) { ref = undefined; }
    }
    const headers = {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
    };
    if (ref) headers['Referer'] = ref;

    // Chain sequentially
    let idx = 0;
    function tryNext() {
      if (idx >= list.length) return Promise.reject(lastErr || new Error('Semua proxy gagal'));
      const build = list[idx++];
      return safeFetch(build(url), { headers: headers }, 12000)
        .then(function (res) {
          if (res && res.ok) return res.text();
          throw new Error('Proxy ' + idx + ' gagal (status ' + (res ? res.status : '?') + ')');
        })
        .then(function (text) {
          if (text && text.length > 20) return text;
          throw new Error('Response terlalu pendek');
        })
        .catch(function (e) { lastErr = e; return tryNext(); });
    }
    return tryNext();
  }

  /* ================================================================
     LAYER 1 — DIRECT
     ================================================================ */
  async function followRedirects(url, maxHops) {
    maxHops = maxHops || 5;
    let current = url;
    for (let i = 0; i < maxHops; i++) {
      try {
        let res = null;
        try { res = await safeFetch(current, { method: 'HEAD', redirect: 'manual' }, 5000); }
        catch (_) { res = null; }
        if (!res || !res.ok) {
          try { res = await safeFetch(current, { redirect: 'manual' }, 6000); }
          catch (_) { return null; }
        }
        const loc = res.headers.get('location');
        if (!loc) return null;
        const next = new URL(loc, current).href;
        if (next === current) return null;
        if (isFileHoster(new URL(next).hostname)) return next;
        if (!detectService(next)) return next;
        current = next;
      } catch (_) { return null; }
    }
    return null;
  }

  async function bypassDirect(url) {
    try {
      const u = new URL(url);
      for (let i = 0; i < REDIRECT_PARAMS.length; i++) {
        const v = u.searchParams.get(REDIRECT_PARAMS[i]);
        if (v) { const d = tryDecode(v); if (d && isValidUrl(d)) return d; }
      }
      if (u.hash && u.hash.length > 1) {
        try {
          const hp = new URLSearchParams(u.hash.replace(/^#\/?/, ''));
          for (let i = 0; i < REDIRECT_PARAMS.length; i++) {
            const v = hp.get(REDIRECT_PARAMS[i]);
            if (v) { const d = tryDecode(v); if (d && isValidUrl(d)) return d; }
          }
        } catch (_) {}
      }
      const parts = u.pathname.split('/').filter(Boolean);
      for (let i = 0; i < parts.length; i++) {
        const d = tryDecode(parts[i]);
        if (d && isValidUrl(d) && d !== url) return d;
      }
      const chain = await followRedirects(url);
      if (chain) return chain;
      const res = await safeFetch(url, { redirect: 'follow' }, 8000);
      if (res && res.url && res.url !== url && !detectService(res.url) && isValidUrl(res.url)) return res.url;
    } catch (e) { console.warn('[SLB] bypassDirect error:', e.message); }
    return null;
  }

  /* ================================================================
     LAYER 2 — HTML PARSER
     ================================================================ */
  function parseHtmlForTarget(html, sourceHost) {
    if (!html || typeof html !== 'string') return null;
    const candidates = [];
    let m;

    const patterns = [
      /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*?url=([^"'\s>]+)/gi,
      /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,
      /(?:window\.)?location\.replace\(\s*["']([^"']+)["']/gi,
      /<a[^>]+id=["'](btn-main|btn-open|getlink|btn-continue|btn-download|link-button|btn-go|btnNext|btn[^"'\s>]*|download[^"'\s>]*)["'][^>]+href=["']([^"']+)["']/gi,
      /data-(?:url|target|href|link|destination|dest)=["']([^"']+)["']/gi,
      /["'](?:nextUrl|target|destination|dest|url|redirectUrl|redirectTo|link|downloadUrl)["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi,
      /<(?:a|button)[^>]+(?:class|id)=["'][^"']*(?:get-link|btn-continue|btn-go|btn-open|open-link|btn-download|btn-main|goto)[^"']*["'][^>]*(?:href|data-url|data-href|data-target|onclick)=["']([^"']+)["']/gi,
      /<input[^>]+type=["']hidden["'][^>]+(?:name|id)=["'](?:url|target|dest|destination|link|download_url)["'][^>]+value=["']([^"']+)["']/gi,
      /<a[^>]+target=["']_blank["'][^>]+href=["'](https?:\/\/[^"']+)["']/gi,
      /href=["'](https?:\/\/(?:www\.)?(?:mediafire|mega\.nz|mega\.io|drive\.google|docs\.google|dropbox|mega4upload|uploady|upfilesgo|upfiles|modsfire|dailyuploads|jioupload|cloudfam|frdl|freedl|rapidgator|1fichier|zippyshare|gofile|pixeldrain)\.[^"'\s]+)["']/gi,
      /href=["'](https?:\/\/[^"'\s]+)["']/gi
    ];

    for (let p = 0; p < patterns.length; p++) {
      const rx = patterns[p];
      rx.lastIndex = 0;
      while ((m = rx.exec(html)) !== null) {
        if (m[2]) candidates.push(m[2]);
        else if (m[1]) candidates.push(m[1]);
        if (candidates.length > 500) break; // safety limit
      }
    }

    const normalized = [];
    for (let i = 0; i < candidates.length; i++) {
      let c = candidates[i];
      if (!c) continue;
      c = String(c).trim().replace(/&amp;/g, '&').replace(/\\\//g, '/');
      const inner = c.match(/(?:location(?:\.href)?\s*=\s*|replace\s*\(\s*)["'](https?:\/\/[^"']+)["']/);
      if (inner) c = inner[1];
      const dec = tryDecode(c) || c;
      if (/^https?:\/\//i.test(dec)) normalized.push(dec);
    }

    // Pass 1: file hoster
    for (let i = 0; i < normalized.length; i++) {
      try {
        const cu = new URL(normalized[i]);
        const ch = cu.hostname.toLowerCase().replace(/^www\./, '');
        if (sourceHost && (ch === sourceHost || ch.endsWith('.' + sourceHost))) continue;
        if (isFileHoster(ch)) return normalized[i];
      } catch (_) {}
    }

    // Pass 2: any non-blacklist
    for (let i = 0; i < normalized.length; i++) {
      try {
        const cu = new URL(normalized[i]);
        const ch = cu.hostname.toLowerCase().replace(/^www\./, '');
        if (sourceHost && (ch === sourceHost || ch.endsWith('.' + sourceHost))) continue;
        if (isBlacklisted(ch)) continue;
        if (/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico|webp|mp4|mp3)(\?|$)/i.test(cu.pathname)) continue;
        if (detectService(normalized[i])) continue;
        return normalized[i];
      } catch (_) {}
    }
    return null;
  }

  async function bypassHtmlProxy(url, service) {
    try {
      const html = await fetchWithCorsProxy(url);
      try { window.__slbLastHtml = html; } catch (_) {}
      return parseHtmlForTarget(html, service ? service.match[0] : null);
    } catch (e) { console.warn('[SLB] bypassHtmlProxy error:', e.message); return null; }
  }

  /* ================================================================
     LAYER 3 — API HANDLERS
     ================================================================ */
  async function bypassLinkvertise(url) {
    try {
      const m = url.match(/linkvertise\.com\/(?:download\/)?(\d+)/i)
             || url.match(/link-to\.net\/\w+\/(\d+)/i)
             || url.match(/up-to-down\.net\/\w+\/(\d+)/i)
             || url.match(/direct-link\.net\/\w+\/(\d+)/i)
             || url.match(/link-hub\.net\/\w+\/(\d+)/i)
             || url.match(/link-target\.net\/\w+\/(\d+)/i);
      if (!m) return null;
      const id = m[1];
      const api = 'https://publisher.linkvertise.com/api/v1/redirect/link/static/' + id;
      const txt = await fetchWithCorsProxy(api);
      if (!txt) return null;
      try {
        const json = JSON.parse(txt);
        const t = (json && json.data && json.data.link && json.data.link.target)
               || (json && json.data && json.data.target)
               || (json && json.target)
               || (json && json.url);
        if (t && isValidUrl(t)) return t;
      } catch (_) {}
      const t = txt.match(/"target"\s*:\s*"([^"]+)"/);
      if (t && isValidUrl(t[1])) return t[1];
    } catch (e) { console.warn('[SLB] Linkvertise error:', e.message); }
    return null;
  }

  async function bypassOuo(url) {
    try {
      const txt = await fetchWithCorsProxy(url);
      if (!txt) return null;
      const m = txt.match(/["'](?:nextUrl|url|dest(?:ination)?|target)["']\s*:\s*["'](https?:\/\/[^"']+)["']/i);
      if (m) return m[1];
      return parseHtmlForTarget(txt, 'ouo.io');
    } catch (_) { return null; }
  }

  async function bypassSafelinkU(url) {
    try {
      let html = null;
      try { html = await fetchWithCorsProxy(url, 'https://sfl.gl/'); }
      catch (e) { console.warn('[SLB] SafelinkU proxy failed:', e.message); }

      if (!html || html.length < 100) {
        try {
          const res = await safeFetch(url, {
            headers: { 'Referer': 'https://sfl.gl/', 'Accept': 'text/html,*/*;q=0.8' }
          }, 10000);
          if (res && res.ok) html = await res.text();
        } catch (_) {}
      }

      if (!html || html.length < 100) return null;
      try { window.__slbLastHtml = html; } catch (_) {}

      // Parse dengan parser utama
      let target = parseHtmlForTarget(html, 'sfl.gl');
      if (target && isValidUrl(target)) return target;

      // Parse script tag
      const scriptRx = /<script[^>]*>([\s\S]*?)<\/script>/gi;
      let sm;
      while ((sm = scriptRx.exec(html)) !== null) {
        const code = sm[1];
        const urlRx = /["'](?:url|target|destination|dest|link|redirect|href|nextUrl|redirectUrl|downloadUrl|download_url|file_url)["']\s*:\s*["'](https?:\/\/[^"']+)["']/gi;
        let um;
        while ((um = urlRx.exec(code)) !== null) {
          const candidate = um[1].replace(/\\\//g, '/');
          try {
            const ch = new URL(candidate).hostname.toLowerCase().replace(/^www\./, '');
            if (isBlacklisted(ch)) continue;
            if (detectService(candidate) && !isFileHoster(ch)) continue;
            return candidate;
          } catch (_) {}
        }
      }

      const chainTarget = await followRedirects(url, 3);
      if (chainTarget && isValidUrl(chainTarget)) return chainTarget;

      return null;
    } catch (e) {
      console.warn('[SLB] SafelinkU error:', e.message);
      logError('SFL.gl', e.message, e.stack);
      return null;
    }
  }

  async function bypassApi(url, service) {
    if (!service) return null;
    try {
      if (service.name === 'Linkvertise') {
        const t = await bypassLinkvertise(url);
        if (t) return t;
      }
      if (service.name === 'Ouo.io') {
        const t = await bypassOuo(url);
        if (t) return t;
      }
      if (service.name === 'SFL.gl' || service.name === 'Safelinku') {
        const t = await bypassSafelinkU(url);
        if (t) return t;
      }
    } catch (e) { console.warn('[SLB] bypassApi handler error:', e.message); }
    return await bypassHtmlProxy(url, service);
  }

  /* ================================================================
     LAYER 4 — INFORMATIVE
     ================================================================ */
  function bypassInformative(service) {
    const name = (service && service.name) || 'Layanan ini';
    return name + ' tidak dapat di-bypass otomatis saat ini.\n\n' +
      'Kemungkinan penyebab:\n' +
      '• Cloudflare challenge aktif (butuh eksekusi JavaScript di browser)\n' +
      '• Timer + reCAPTCHA server-side\n' +
      '• CORS proxy diblokir oleh target\n' +
      '• Target di dalam iframe yang tidak dapat di-parse\n\n' +
      'Solusi alternatif yang 100% berfungsi:\n' +
      '• Userscript "Bypass SFL" di Greasy Fork / Tampermonkey\n' +
      '• Ekstensi browser FastForward / Bypass Tools\n' +
      '• Buka link di browser lalu ikuti instruksi manual';
  }

  /* ================================================================
     DOM CACHE
     ================================================================ */
  const els = {};
  function cacheEls() {
    els.main         = $('#slbMain');
    els.input        = $('#slbInput');
    els.textarea     = $('#slbTextarea');
    els.badgeRow     = $('#slbBadgeRow');
    els.badge        = $('#slbServiceBadge');
    els.cacheBadge   = $('#slbCacheBadge');
    els.bypassBtn    = $('#slbBypassBtn');
    els.bypassBtnTxt = $('#slbBypassBtnText');
    els.status       = $('#slbStatus');
    els.statusIcon   = $('#slbStatusIcon');
    els.statusText   = $('#slbStatusText');
    els.resultCard   = $('#slbResultCard');
    els.resultSvc    = $('#slbResultService');
    els.resultSrc    = $('#slbResultSource');
    els.resultTgt    = $('#slbResultTarget');
    els.sourceAlias  = $('#slbSourceUrl');
    els.targetAlias  = $('#slbTargetUrl');
    els.resultMeta   = $('#slbResultMeta');
    els.history      = $('#slbHistorySection');
    els.historyList  = $('#slbHistoryList');
    els.stats        = $('#slbStats');
    els.statsGrid    = $('#slbStatsGrid');
    els.statsBars    = $('#slbStatsBars');
    els.debugPre     = $('#slbDebugPre');
    els.qrContainer  = $('#slbQrContainer');
    els.qrUrl        = $('#slbQrUrl');
    els.overlay      = $('#slbLoadingOverlay');
    els.overlayProg  = $('#slbOverlayProgress');
    els.overlayStat  = $('#slbOverlayStatus');
    els.progressBar  = $('#slbProgressBar');
    els.progressFill = $('#slbProgressFill');
  }

  /* ================================================================
     UI HELPERS
     ================================================================ */
  function showStatus(type, message) {
    if (!els.status) return;
    els.status.className = 'slb-status ' + type;
    if (els.statusText) els.statusText.textContent = message || '';
    if (els.statusIcon) {
      if (type === 'loading') els.statusIcon.innerHTML = '<span class="slb-spinner"></span>';
      else if (type === 'success') els.statusIcon.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i>';
      else if (type === 'error') els.statusIcon.innerHTML = '<i class="fas fa-times-circle" aria-hidden="true"></i>';
      else if (type === 'info') els.statusIcon.innerHTML = '<i class="fas fa-info-circle" aria-hidden="true"></i>';
    }
  }
  function hideStatus() { if (els.status) els.status.className = 'slb-status'; }

  function renderResult(source, target, service, meta) {
    if (!els.resultCard) return;
    if (els.resultSvc) {
      els.resultSvc.textContent = service ? (service.name + ' · ' + service.cat + ' · ' + service.layer.toUpperCase()) : '—';
    }
    if (els.resultSrc) els.resultSrc.textContent = source;
    if (els.resultTgt) els.resultTgt.textContent = target;
    if (els.sourceAlias) els.sourceAlias.textContent = source;
    if (els.targetAlias) els.targetAlias.textContent = target;
    if (els.resultMeta) {
      const parts = [];
      if (meta && meta.duration) parts.push('⏱ ' + (meta.duration / 1000).toFixed(2) + 's');
      if (meta && meta.cached) parts.push('⚡ dari cache');
      if (meta && meta.service) parts.push('📦 ' + escapeHtml(meta.service));
      els.resultMeta.innerHTML = parts.map(function (p) { return '<span>' + p + '</span>'; }).join('');
    }
    els.resultCard.classList.add('visible');
    els.resultCard.setAttribute('data-target', target);
    try { els.resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
  }

  function resetUI() {
    if (els.input) { els.input.value = ''; els.input.classList.remove('valid','invalid'); }
    if (els.textarea) els.textarea.value = '';
    hideStatus();
    if (els.resultCard) { els.resultCard.classList.remove('visible'); els.resultCard.removeAttribute('data-target'); }
    if (els.badgeRow) els.badgeRow.classList.remove('visible');
    if (els.cacheBadge) els.cacheBadge.style.display = 'none';
    if (els.input) els.input.focus();
  }

  function updateBadge() {
    if (!els.input || !els.badgeRow || !els.badge) return;
    const v = els.input.value.trim();
    if (!v || !isValidUrl(v)) {
      els.input.classList.remove('valid','invalid');
      els.badgeRow.classList.remove('visible');
      return;
    }
    const svc = detectService(v);
    els.input.classList.add('valid');
    els.input.classList.remove('invalid');
    els.badgeRow.classList.add('visible');
    if (svc) {
      els.badge.textContent = '✓ ' + svc.name + ' · Kategori ' + svc.cat + ' · Layer ' + svc.layer.toUpperCase();
      els.badge.classList.remove('unknown');
    } else {
      els.badge.textContent = '⚠ Layanan tidak dikenal';
      els.badge.classList.add('unknown');
    }
  }

  /* ================================================================
     LOADING OVERLAY
     ================================================================ */
  const LOADING_MESSAGES = [
    'Mendeteksi layanan...','Menyiapkan proxy...','Mengambil data...',
    'Mengekstrak link...','Verifikasi...','Menyelesaikan...'
  ];
  let loadingTimer = null;
  let progressTimer = null;
  let currentProgress = 0;

  function showLoadingOverlay() {
    if (!els.overlay) return;
    currentProgress = 0;
    updateOverlayProgress(0);
    els.overlay.classList.add('visible');
    els.overlay.setAttribute('aria-hidden', 'false');
    if (els.main) els.main.setAttribute('aria-busy', 'true');
    if (els.progressBar) { els.progressBar.classList.add('active'); els.progressBar.setAttribute('aria-valuenow', '0'); }
    if (els.progressFill) els.progressFill.style.width = '0%';

    let msgIdx = 0;
    if (els.overlayStat) els.overlayStat.textContent = LOADING_MESSAGES[0];
    loadingTimer = setInterval(function () {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      if (els.overlayStat) els.overlayStat.textContent = LOADING_MESSAGES[msgIdx];
    }, 800);

    progressTimer = setInterval(function () {
      const step = currentProgress < 30 ? 6 : currentProgress < 60 ? 3 : currentProgress < 85 ? 1.5 : 0.5;
      currentProgress = Math.min(92, currentProgress + step);
      updateOverlayProgress(currentProgress);
    }, 180);
  }
  function updateOverlayProgress(pct) {
    const p = Math.floor(pct);
    if (els.overlayProg) els.overlayProg.textContent = p;
    if (els.progressFill) els.progressFill.style.width = p + '%';
    if (els.progressBar) els.progressBar.setAttribute('aria-valuenow', String(p));
  }
  function hideLoadingOverlay(success) {
    if (loadingTimer) { clearInterval(loadingTimer); loadingTimer = null; }
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    updateOverlayProgress(success ? 100 : 0);
    setTimeout(function () {
      if (els.overlay) {
        els.overlay.classList.remove('visible');
        els.overlay.setAttribute('aria-hidden', 'true');
      }
      if (els.main) els.main.setAttribute('aria-busy', 'false');
      if (els.progressBar) els.progressBar.classList.remove('active');
      setTimeout(function () { if (els.progressFill) els.progressFill.style.width = '0%'; }, 400);
    }, success ? 350 : 0);
  }

  /* ================================================================
     HISTORY
     ================================================================ */
  let historySearchQuery = '';
  let historySortMode = 'newest';

  function loadHistory() {
    const raw = lsJSON(HISTORY_KEY, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(function (item) {
      return {
        source:  String(item.source || ''),
        target:  String(item.target || ''),
        service: String(item.service || 'Unknown'),
        ts:      Number(item.ts || item.timestamp || Date.now()),
        duration: Number(item.duration || 0)
      };
    }).filter(function (x) { return x.source; });
  }
  function saveHistory(item) {
    if (!getSetting('saveHistory', true)) return;
    try {
      const list = loadHistory();
      const dedup = list.filter(function (x) { return x.source !== item.source; });
      dedup.unshift(item);
      lsSet(HISTORY_KEY, JSON.stringify(dedup.slice(0, HISTORY_MAX)));
    } catch (e) { logError('history', e.message, e.stack); }
  }
  function clearHistory() {
    lsDel(HISTORY_KEY);
    renderHistory();
    renderStats();
  }
  function deleteHistoryItem(idx) {
    try {
      const list = loadHistory();
      list.splice(idx, 1);
      lsSet(HISTORY_KEY, JSON.stringify(list));
      renderHistory();
      renderStats();
      showToast('Item dihapus dari riwayat', 'info');
    } catch (_) {}
  }
  function getFilteredHistory() {
    let list = loadHistory();
    if (historySearchQuery) {
      const q = historySearchQuery.toLowerCase();
      list = list.filter(function (x) {
        return x.source.toLowerCase().indexOf(q) >= 0 ||
               x.target.toLowerCase().indexOf(q) >= 0 ||
               x.service.toLowerCase().indexOf(q) >= 0;
      });
    }
    if (historySortMode === 'oldest') list = list.slice().reverse();
    else if (historySortMode === 'service') list = list.slice().sort(function (a, b) { return a.service.localeCompare(b.service); });
    return list;
  }
  function renderHistory() {
    if (!els.history || !els.historyList) return;
    const list = getFilteredHistory();
    if (!list.length) { els.history.classList.remove('visible'); return; }
    els.history.classList.add('visible');
    const fullList = loadHistory();
    els.historyList.innerHTML = list.map(function (item) {
      const idx = fullList.findIndex(function (x) { return x.source === item.source && x.ts === item.ts; });
      const src = escapeHtml(item.source.length > 60 ? item.source.slice(0, 60) + '…' : item.source);
      const tgt = escapeHtml(item.target.length > 70 ? item.target.slice(0, 70) + '…' : item.target);
      const svc = escapeHtml(item.service);
      return '<div class="slb-history-item" data-idx="' + idx + '" role="button" tabindex="0">' +
        '<div class="slb-history-icon"><i class="fas fa-unlink" aria-hidden="true"></i></div>' +
        '<div class="slb-history-info">' +
          '<div class="slb-history-source">' + src + '</div>' +
          '<div class="slb-history-target">→ ' + tgt + '</div>' +
          '<div class="slb-history-time">' + svc + ' • ' + timeAgo(item.ts) +
            (item.duration ? ' • ' + (item.duration / 1000).toFixed(1) + 's' : '') + '</div>' +
        '</div>' +
        '<div class="slb-history-actions-inline">' +
          '<button type="button" class="slb-history-btn" data-action="copy" title="Copy" aria-label="Copy"><i class="fas fa-copy" aria-hidden="true"></i></button>' +
          '<button type="button" class="slb-history-btn danger" data-action="delete" title="Hapus" aria-label="Hapus"><i class="fas fa-trash" aria-hidden="true"></i></button>' +
        '</div>' +
      '</div>';
    }).join('');
  }
  function handleHistoryClick(e) {
    const target = e.target;
    if (!target || !target.closest) return;
    const item = target.closest('.slb-history-item');
    if (!item) return;
    const idx = parseInt(item.getAttribute('data-idx'), 10);
    const list = loadHistory();
    const data = list[idx];
    if (!data) return;
    const btn = target.closest('[data-action]');
    if (btn) {
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      if (action === 'copy') {
        try {
          navigator.clipboard.writeText(data.source).then(
            function () { showToast('URL sumber disalin', 'success'); },
            function () { showToast('Gagal menyalin', 'error'); }
          );
        } catch (_) { showToast('Clipboard tidak tersedia', 'error'); }
      } else if (action === 'delete') {
        deleteHistoryItem(idx);
      }
      return;
    }
    if (els.input) {
      els.input.value = data.source;
      if (els.textarea) els.textarea.value = data.source;
      updateBadge();
      els.input.focus();
      showToast('URL dimuat. Klik Bypass untuk memproses.', 'info');
    }
  }

  /* ================================================================
     STATS
     ================================================================ */
  function renderStats() {
    if (!els.stats || !els.statsGrid) return;
    const list = loadHistory();
    if (list.length < 2) { els.stats.classList.remove('visible'); return; }
    els.stats.classList.add('visible');
    const total = list.length;
    const success = list.filter(function (x) { return x.target && x.target.indexOf('❌') !== 0; }).length;
    const rate = total ? Math.round((success / total) * 100) : 0;
    const counts = {};
    list.forEach(function (x) { counts[x.service] = (counts[x.service] || 0) + 1; });
    const top = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 5);
    els.statsGrid.innerHTML = [
      ['Total Bypass', total],
      ['Berhasil', success],
      ['Success Rate', rate + '%'],
      ['Layanan Unik', Object.keys(counts).length]
    ].map(function (pair) {
      return '<div class="slb-stat-box"><div class="slb-stat-value">' + pair[1] + '</div>' +
        '<div class="slb-stat-label">' + pair[0] + '</div></div>';
    }).join('');
    els.statsBars.innerHTML = top.map(function (pair) {
      const pct = Math.round((pair[1] / total) * 100);
      return '<div style="margin-top:10px">' +
        '<div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--slb-muted);margin-bottom:4px">' +
          '<span>' + escapeHtml(pair[0]) + '</span><span>' + pair[1] + '× (' + pct + '%)</span>' +
        '</div>' +
        '<div class="slb-stat-bar"><div class="slb-stat-bar-fill" style="width:' + pct + '%"></div></div>' +
      '</div>';
    }).join('');
  }

  /* ================================================================
     SERVICE LIST
     ================================================================ */
  function renderServiceList() {
    const body = document.getElementById('slbServiceListBody');
    const countEl = document.getElementById('slbServiceCount');
    if (!body) return;
    const q = (document.getElementById('slbServiceSearch') || {}).value || '';
    const cat = (document.getElementById('slbServiceCat') || {}).value || '';
    const layer = (document.getElementById('slbServiceLayer') || {}).value || '';
    const qLower = q.toLowerCase();
    const filtered = SERVICES.filter(function (s) {
      if (q && s.name.toLowerCase().indexOf(qLower) < 0 && !s.match.some(function (m) { return m.indexOf(qLower) >= 0; })) return false;
      if (cat && s.cat !== cat) return false;
      if (layer && s.layer !== layer) return false;
      return true;
    });
    body.innerHTML = filtered.map(function (s) {
      return '<div class="slb-service-item" data-service-idx="' + SERVICES.indexOf(s) + '" tabindex="0" role="button">' +
        '<span class="slb-service-name" title="' + escapeHtml(s.match.join(', ')) + '">' + escapeHtml(s.name) + '</span>' +
        '<span class="slb-service-layer ' + s.layer + '">' + s.layer + '</span>' +
      '</div>';
    }).join('');
    if (countEl) countEl.textContent = 'Menampilkan ' + filtered.length + ' dari ' + SERVICES.length + ' layanan';

    $$('.slb-service-item', body).forEach(function (item) {
      const handler = function () {
        const idx = parseInt(item.getAttribute('data-service-idx'), 10);
        const svc = SERVICES[idx];
        if (!svc) return;
        const example = 'https://' + svc.match[0] + '/contoh';
        if (els.input) {
          els.input.value = example;
          updateBadge();
          els.input.focus();
        }
        closeAllModals();
        showToast('Contoh URL untuk ' + svc.name + ' dimuat', 'info');
      };
      safeOn(item, 'click', handler);
      safeOn(item, 'keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); }
      });
    });
  }

  /* ================================================================
     FOCUS TRAP & MODALS
     ================================================================ */
  let lastFocusedEl = null;
  function trapFocus(modalEl) {
    try {
      const focusable = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const handler = function (e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      };
      modalEl.addEventListener('keydown', handler);
      modalEl.__focusTrap = handler;
    } catch (_) {}
  }
  function releaseFocusTrap(modalEl) {
    if (modalEl.__focusTrap) {
      try { modalEl.removeEventListener('keydown', modalEl.__focusTrap); } catch (_) {}
      delete modalEl.__focusTrap;
    }
  }
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    try { lastFocusedEl = document.activeElement; } catch (_) { lastFocusedEl = null; }
    m.classList.add('visible');
    m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    trapFocus(m);
    const closeBtn = m.querySelector('[data-close-modal]');
    if (closeBtn) setTimeout(function () { try { closeBtn.focus(); } catch (_) {} }, 50);
  }
  function closeAllModals() {
    $$('.slb-modal').forEach(function (m) {
      if (m.classList.contains('visible')) {
        releaseFocusTrap(m);
        m.classList.remove('visible');
        m.setAttribute('aria-hidden', 'true');
      }
    });
    document.body.style.overflow = '';
    if (lastFocusedEl && lastFocusedEl.focus) {
      try { lastFocusedEl.focus(); } catch (_) {}
    }
  }
  function closeAllDropdowns() {
    $$('.slb-dropdown').forEach(function (d) { d.classList.remove('open'); });
  }

  /* ================================================================
     MAIN BYPASS FLOW
     ================================================================ */
  async function performBypassForUrl(url) {
    const service = detectService(url);
    if (!service) return { ok: false, error: 'Layanan tidak didukung', service: null };
    if (service.layer === 'info') {
      return { ok: false, error: bypassInformative(service), service: service, info: true };
    }
    let target = null;
    const t0 = performance.now();
    try {
      if (service.layer === 'direct') {
        target = await bypassDirect(url);
        if (!target) target = await bypassHtmlProxy(url, service);
      } else if (service.layer === 'proxy') {
        target = await bypassHtmlProxy(url, service);
      } else if (service.layer === 'api') {
        target = await bypassApi(url, service);
        if (!target) target = await bypassHtmlProxy(url, service);
      }
    } catch (e) {
      logError(service.name, e.message, e.stack);
      return { ok: false, error: e.message || 'Network error', service: service };
    }
    const duration = Math.round(performance.now() - t0);
    if (target && isValidUrl(target)) {
      logPerf(service.name, duration);
      return { ok: true, target: target, service: service, duration: duration };
    }
    if (service.layer === 'api' && !target) {
      return { ok: false, error: bypassInformative(service), service: service, info: true };
    }
    return { ok: false, error: 'Link tidak bisa di-bypass (CAPTCHA/server-side).', service: service };
  }

  async function performBypass() {
    try {
      const url = (els.input ? els.input.value.trim() : '');
      if (!url) { showToast('Masukkan URL terlebih dahulu', 'error'); return; }
      if (!isValidUrl(url)) { showToast('Format URL tidak valid', 'error'); return; }

      const rl = checkRateLimit();
      if (!rl.ok) {
        showToast('Terlalu banyak request. Tunggu ' + rl.wait + 's.', 'warning');
        return;
      }

      const cached = getCached(url);
      if (cached) {
        if (els.cacheBadge) els.cacheBadge.style.display = 'inline-flex';
        renderResult(url, cached.target, cached.service, { duration: 0, cached: true, service: cached.service.name });
        showStatus('success', '⚡ Link diambil dari cache (instan).');
        showToast('⚡ Dari cache — instan!', 'success');
        if (getSetting('autoCopy') && navigator.clipboard) {
          try { navigator.clipboard.writeText(cached.target).catch(function(){}); } catch (_) {}
        }
        if (getSetting('autoOpen')) { try { window.open(cached.target, '_blank', 'noopener'); } catch (_) {} }
        return;
      }
      if (els.cacheBadge) els.cacheBadge.style.display = 'none';

      if (els.bypassBtn) {
        els.bypassBtn.disabled = true;
        if (els.bypassBtnTxt) els.bypassBtnTxt.textContent = 'Memproses...';
      }
      if (els.resultCard) els.resultCard.classList.remove('visible');
      hideStatus();
      showStatus('loading', 'Mendeteksi layanan...');
      showLoadingOverlay();

      const result = await performBypassForUrl(url);
      if (result.ok) {
        setCache(url, { target: result.target, service: result.service });
        renderResult(url, result.target, result.service, {
          duration: result.duration, cached: false, service: result.service.name
        });
        showStatus('success', 'Bypass berhasil dalam ' + (result.duration / 1000).toFixed(2) + 's!');
        saveHistory({
          source: url, target: result.target,
          service: result.service.name, ts: Date.now(), duration: result.duration
        });
        renderHistory();
        renderStats();
        showToast('Bypass berhasil!', 'success');
        hideLoadingOverlay(true);
        if (getSetting('autoCopy') && navigator.clipboard) {
          try { navigator.clipboard.writeText(result.target).catch(function(){}); } catch (_) {}
        }
        if (getSetting('autoOpen')) { try { window.open(result.target, '_blank', 'noopener'); } catch (_) {} }
      } else if (result.info) {
        hideLoadingOverlay(false);
        showStatus('info', result.error);
        showToast('Layanan ini butuh solusi manual', 'warning');
        saveHistory({
          source: url, target: '❌ ' + result.service.name + ' (info)',
          service: result.service.name, ts: Date.now(), duration: 0
        });
        renderHistory();
        renderStats();
      } else {
        hideLoadingOverlay(false);
        showStatus('error', result.error || 'Bypass gagal');
        showToast(result.error || 'Bypass gagal', 'error');
        if (result.service) logError(result.service.name, result.error);
      }
    } catch (e) {
      try { hideLoadingOverlay(false); } catch (_) {}
      console.error('[SLB] performBypass error:', e);
      logError('performBypass', e.message, e.stack);
      const msg = (e && e.name === 'AbortError') ? 'Koneksi timeout. Periksa jaringan.' : 'Gagal mengambil data. Coba lagi.';
      showStatus('error', msg);
      showToast(msg, 'error');
    } finally {
      if (els.bypassBtn) {
        els.bypassBtn.disabled = false;
        if (els.bypassBtnTxt) els.bypassBtnTxt.textContent = 'Bypass Sekarang';
      }
    }
  }

  /* ================================================================
     BATCH MODE
     ================================================================ */
  let batchAbortController = null;
  async function performBatchBypass() {
    try {
      if (!els.textarea) return;
      const raw = els.textarea.value.trim();
      if (!raw) { showToast('Masukkan minimal satu URL', 'error'); return; }
      const urls = raw.split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean);
      const valid = urls.filter(function (u) { return isValidUrl(u) && isValidShortlink(u); });
      if (!valid.length) { showToast('Tidak ada URL shortlink valid', 'error'); return; }

      if (batchAbortController) { try { batchAbortController.abort(); } catch (_) {} }
      batchAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const signal = batchAbortController ? batchAbortController.signal : null;

      if (els.bypassBtn) {
        els.bypassBtn.disabled = true;
        if (els.bypassBtnTxt) els.bypassBtnTxt.textContent = '0/' + valid.length + '...';
      }
      hideStatus();
      if (els.resultCard) els.resultCard.classList.remove('visible');
      showStatus('loading', 'Batch: 0/' + valid.length + ' diproses...');

      const results = [];
      for (let i = 0; i < valid.length; i++) {
        if (signal && signal.aborted) { showToast('Batch dibatalkan', 'warning'); break; }
        const u = valid[i];
        try {
          const r = await performBypassForUrl(u);
          results.push(Object.assign({ url: u }, r));
        } catch (e) { results.push({ url: u, ok: false, error: e.message }); }
        if (els.bypassBtnTxt) els.bypassBtnTxt.textContent = (i + 1) + '/' + valid.length + '...';
        showStatus('loading', 'Batch: ' + (i + 1) + '/' + valid.length + ' diproses...');
      }

      const csv = ['source,target,status'].concat(results.map(function (r) {
        return '"' + r.url + '","' + (r.ok ? r.target : '') + '","' + (r.ok ? 'OK' : (r.error || 'FAIL')) + '"';
      })).join('\n');

      if (els.resultSrc) els.resultSrc.textContent = valid.length + ' URL diproses';
      if (els.resultTgt) els.resultTgt.textContent = results.filter(function (r) { return r.ok; }).length + ' berhasil, ' + results.filter(function (r) { return !r.ok; }).length + ' gagal';
      if (els.resultSvc) els.resultSvc.textContent = 'Batch Mode';
      if (els.resultMeta) els.resultMeta.innerHTML = '';
      if (els.resultCard) {
        els.resultCard.classList.add('visible');
        els.resultCard.setAttribute('data-target', csv);
      }
      showStatus('success', 'Batch selesai.');
      showToast('Batch selesai!', 'success');
    } catch (e) {
      console.error('[SLB] performBatchBypass error:', e);
      showToast('Batch error: ' + e.message, 'error');
    } finally {
      if (els.bypassBtn) {
        els.bypassBtn.disabled = false;
        if (els.bypassBtnTxt) els.bypassBtnTxt.textContent = 'Bypass Sekarang';
      }
      batchAbortController = null;
    }
  }

  /* ================================================================
     COPY / EXPORT / IMPORT / QR / SHARE
     ================================================================ */
  function copyAs(format) {
    const url = els.resultCard ? els.resultCard.getAttribute('data-target') : null;
    if (!url) return;
    const formats = {
      plain: url,
      markdown: '[Link](' + url + ')',
      html: '<a href="' + url + '" target="_blank" rel="noopener">Link</a>',
      bbcode: '[url=' + url + ']Link[/url]'
    };
    const text = formats[format] || url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        function () { showToast('Disalin sebagai ' + format.toUpperCase(), 'success'); },
        function () { window.prompt('Copy manual:', text); }
      );
    } else {
      window.prompt('Copy manual:', text);
    }
    closeAllDropdowns();
  }

  function exportHistory(format) {
    const list = loadHistory();
    if (!list.length) { showToast('Riwayat kosong', 'warning'); return; }
    let content, mime, ext;
    if (format === 'csv') {
      content = 'source,target,service,ts\n' + list.map(function (x) {
        return '"' + x.source + '","' + x.target + '","' + x.service + '","' + new Date(x.ts).toISOString() + '"';
      }).join('\n');
      mime = 'text/csv'; ext = 'csv';
    } else {
      content = JSON.stringify(list, null, 2);
      mime = 'application/json'; ext = 'json';
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'slb-history-' + Date.now() + '.' + ext;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    showToast('Riwayat diexport sebagai ' + ext.toUpperCase(), 'success');
  }

  function importHistory(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error('Bukan array');
        const current = loadHistory();
        const merged = data.concat(current).slice(0, HISTORY_MAX);
        lsSet(HISTORY_KEY, JSON.stringify(merged));
        renderHistory();
        renderStats();
        showToast('Imported ' + data.length + ' item', 'success');
      } catch (_) { showToast('File tidak valid', 'error'); }
    };
    reader.readAsText(file);
  }

  function showQR(url) {
    if (!url || !els.qrContainer) return;
    els.qrContainer.innerHTML = '';
    if (typeof window.QRCode === 'undefined') { showToast('QR library belum dimuat', 'error'); return; }
    try {
      new window.QRCode(els.qrContainer, {
        text: url, width: 220, height: 220,
        colorDark: '#000', colorLight: '#fff',
        correctLevel: window.QRCode.CorrectLevel.M
      });
      if (els.qrUrl) els.qrUrl.textContent = url;
      openModal('slbQrModal');
    } catch (e) { showToast('QR error: ' + e.message, 'error'); }
  }

  function shareTarget() {
    const url = els.resultCard ? els.resultCard.getAttribute('data-target') : null;
    if (!url) return;
    if (navigator.share) {
      navigator.share({ title: 'Shortlink Bypass V4.2', text: 'Link hasil bypass:', url }).catch(function () { copyAs('plain'); });
    } else {
      copyAs('plain');
    }
  }

  function downloadResult() {
    const url = els.resultCard ? els.resultCard.getAttribute('data-target') : null;
    if (!url) return;
    if (url.indexOf('source,target,status') === 0) {
      const blob = new Blob([url], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'slb-batch-' + Date.now() + '.csv';
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      showToast('Batch CSV didownload', 'success');
      return;
    }
    const content = 'Shortlink Bypass V4.2 — Result\nGenerated: ' + new Date().toISOString() + '\nTarget: ' + url + '\n';
    const blob = new Blob([content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'slb-result-' + Date.now() + '.txt';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    showToast('Hasil didownload', 'success');
  }

  /* ================================================================
     THEME
     ================================================================ */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-slb-theme', theme);
    lsSet(THEME_KEY, theme);
  }
  function toggleTheme() {
    const cur = lsGet(THEME_KEY, 'dark');
    applyTheme(cur === 'dark' ? 'light' : 'dark');
    showToast('Tema: ' + (cur === 'dark' ? 'Light' : 'Dark'), 'info');
  }
  function applyAccent(accent) {
    document.documentElement.setAttribute('data-slb-accent', accent);
    lsSet(ACCENT_KEY, accent);
    $$('.slb-accent-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-accent') === accent);
    });
  }

  /* ================================================================
     DEBUG PANEL
     ================================================================ */
  function switchDebugTab(tab) {
    const htmlEl = document.getElementById('slbDebugPre');
    const errEl = document.getElementById('slbDebugErrors');
    const statEl = document.getElementById('slbDebugStats');
    if (!htmlEl || !errEl || !statEl) return;
    htmlEl.hidden = tab !== 'html';
    errEl.hidden = tab !== 'errors';
    statEl.hidden = tab !== 'stats';
    $$('.slb-tab').forEach(function (t) {
      const active = t.getAttribute('data-tab') === tab;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (tab === 'errors') {
      const errs = loadErrors();
      errEl.innerHTML = errs.length
        ? errs.map(function (e) {
            return '<div class="slb-error-item">' +
              '<div class="ts">' + new Date(e.ts).toLocaleString('id-ID') + '</div>' +
              '<div class="svc">' + escapeHtml(e.service) + '</div>' +
              '<div>' + escapeHtml(e.message) + '</div></div>';
          }).join('')
        : 'Tidak ada error.';
    } else if (tab === 'stats') {
      const perf = loadPerf();
      if (!perf.length) { statEl.innerHTML = 'Belum ada data performa.'; return; }
      const grouped = {};
      perf.forEach(function (p) {
        if (!grouped[p.service]) grouped[p.service] = [];
        grouped[p.service].push(p.ms);
      });
      statEl.innerHTML = Object.entries(grouped).map(function (pair) {
        const arr = pair[1];
        const avg = Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length);
        const min = Math.min.apply(null, arr);
        const max = Math.max.apply(null, arr);
        return '<div class="slb-perf-item"><span>' + escapeHtml(pair[0]) + '</span>' +
          '<span>avg ' + avg + 'ms • min ' + min + 'ms • max ' + max + 'ms</span></div>';
      }).join('');
    }
  }

  function openDebugPanel() {
    if (els.debugPre) {
      const html = window.__slbLastHtml || '';
      els.debugPre.textContent = html
        ? (html.length > 5000 ? html.slice(0, 5000) + '\n\n... (truncated ' + (html.length - 5000) + ' chars)' : html)
        : 'Belum ada data. Lakukan bypass terlebih dahulu.';
    }
    switchDebugTab('html');
    openModal('slbDebugModal');
  }

  /* ================================================================
     CHANGELOG
     ================================================================ */
  const CHANGELOG = [
    { v:'4.2', date:'2026 — Crash Fixed', notes:[
      'FIX CRASH: showToast sekarang self-contained (tidak defer main.js)',
      'FIX CRASH: semua event handler dibungkus safeOn() + try/catch',
      'FIX CRASH: global error handler untuk tangkap semua error',
      'FIX: guard document.activeElement (potensi null)',
      'FIX: navigator.clipboard feature detection',
      'FIX: AbortController feature detection',
      'FIX: localStorage/sessionStorage safe wrappers',
      'FIX: defensive null checks di semua tempat',
      'IMPROVED: logging verbose untuk debug'
    ]},
    { v:'4.1', date:'2026', notes:[
      'FIX: sfl.gl layer info → api + handler SafelinkU',
      'FIX: parseHtmlForTarget selector SafelinkU',
      'FIX: Referer header di CORS proxy',
      'FIX: a11y + CSS fallback'
    ]},
    { v:'4.0', date:'2025', notes:['Merge V2 + V3 + fitur baru'] },
    { v:'3.0', date:'2024-12', notes:['Rewrite engine'] },
    { v:'2.0', date:'2024-11', notes:['Modal lengkap'] },
    { v:'1.0', date:'2024-11', notes:['Initial release'] }
  ];

  function renderChangelog() {
    const body = document.getElementById('slbChangelogBody');
    if (!body) return;
    body.innerHTML = CHANGELOG.map(function (c) {
      return '<div class="slb-changelog-entry">' +
        '<div class="slb-changelog-version">v' + c.v + '</div>' +
        '<div class="slb-changelog-date">' + c.date + '</div>' +
        '<ul>' + c.notes.map(function (n) { return '<li>' + escapeHtml(n) + '</li>'; }).join('') + '</ul></div>';
    }).join('');
  }

  /* ================================================================
     BATCH TOGGLE
     ================================================================ */
  function toggleBatchMode() {
    if (!els.input || !els.textarea) return;
    const isBatch = els.textarea.style.display === 'none' || !els.textarea.style.display;
    els.textarea.style.display = isBatch ? 'block' : 'none';
    els.input.style.display = isBatch ? 'none' : 'block';
    const btn = document.getElementById('slbBatchToggle');
    if (btn) {
      btn.classList.toggle('active', isBatch);
      btn.setAttribute('aria-pressed', isBatch ? 'true' : 'false');
    }
    if (isBatch) els.textarea.focus();
    else els.input.focus();
  }

  /* ================================================================
     KEYBOARD SHORTCUTS
     ================================================================ */
  function initKeyboard() {
    safeOn(document, 'keydown', function (e) {
      const mod = e.ctrlKey || e.metaKey;
      const ae = document.activeElement;
      const aeTag = ae && ae.tagName ? ae.tagName : '';
      if (mod && e.key === 'Enter') {
        e.preventDefault();
        if (els.textarea && els.textarea.style.display === 'block') performBatchBypass();
        else performBypass();
        return;
      }
      if (e.key === 'Escape') {
        const anyOpen = document.querySelector('.slb-modal.visible');
        if (anyOpen) { closeAllModals(); return; }
        closeAllDropdowns();
        return;
      }
      if (e.key === '?' && !mod && aeTag !== 'INPUT' && aeTag !== 'TEXTAREA') {
        e.preventDefault(); openModal('slbHelpModal'); return;
      }
      if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleBatchMode(); return; }
      if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); openModal('slbServiceListModal'); renderServiceList(); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        const pb = document.getElementById('slbPasteBtn');
        if (pb) pb.click();
      }
    });
  }

  /* ================================================================
     SETTINGS UI
     ================================================================ */
  function syncSettingsUI() {
    const s = loadSettings();
    const map = {
      setAutoCopy: 'autoCopy', setAutoOpen: 'autoOpen',
      setSaveHistory: 'saveHistory', setNotifications: 'notifications',
      setSound: 'sound', setAutoClipboard: 'autoClipboard'
    };
    Object.keys(map).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.checked = !!s[map[id]];
    });
    const langEl = document.getElementById('setLang');
    if (langEl) langEl.value = s.lang || 'id';
  }
  function bindSettingsUI() {
    const map = {
      setAutoCopy: 'autoCopy', setAutoOpen: 'autoOpen',
      setSaveHistory: 'saveHistory', setNotifications: 'notifications',
      setSound: 'sound', setAutoClipboard: 'autoClipboard'
    };
    Object.keys(map).forEach(function (id) {
      const el = document.getElementById(id);
      if (el) safeOn(el, 'change', function () {
        const s = loadSettings(); s[map[id]] = el.checked; saveSettings(s);
        showToast(map[id] + ': ' + (el.checked ? 'ON' : 'OFF'), 'info');
      });
    });
    const langEl = document.getElementById('setLang');
    if (langEl) safeOn(langEl, 'change', function () {
      const s = loadSettings(); s.lang = langEl.value; saveSettings(s);
    });
  }

  /* ================================================================
     INIT
     ================================================================ */
  function init() {
    try {
      cacheEls();
      if (!els.bypassBtn) { console.warn('[SLB] Bypass button tidak ditemukan'); return; }

      applyTheme(lsGet(THEME_KEY, 'dark'));
      applyAccent(lsGet(ACCENT_KEY, 'gold'));
      updateCacheCount();

      // Proxy select
      const proxySel = document.getElementById('slbProxySelect');
      if (proxySel) {
        proxySel.value = lsGet(PROXY_KEY, 'auto');
        safeOn(proxySel, 'change', function () {
          lsSet(PROXY_KEY, proxySel.value);
          showToast('Proxy: ' + proxySel.value, 'info');
        });
      }

      // Bypass button
      safeOn(els.bypassBtn, 'click', function () {
        if (els.textarea && els.textarea.style.display === 'block') performBatchBypass();
        else performBypass();
      });

      // Input events
      if (els.input) {
        let debounceTimer = null;
        safeOn(els.input, 'input', function () {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(updateBadge, 200);
        });
        safeOn(els.input, 'keydown', function (e) {
          if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); performBypass(); }
        });
        if (getSetting('autoClipboard', false)) {
          safeOn(els.input, 'focus', async function () {
            if (els.input.value) return;
            try {
              const t = await navigator.clipboard.readText();
              if (t && isValidUrl(t.trim()) && isValidShortlink(t.trim())) {
                els.input.value = t.trim(); updateBadge();
                showToast('URL terdeteksi dari clipboard', 'info');
              }
            } catch (_) {}
          });
        }
      }

      // Paste
      const pasteBtn = document.getElementById('slbPasteBtn');
      safeOn(pasteBtn, 'click', async function () {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            if (els.textarea && els.textarea.style.display === 'block') {
              els.textarea.value = text; els.textarea.focus();
            } else if (els.input) {
              els.input.value = text.trim(); updateBadge(); els.input.focus();
            }
            showToast('Berhasil paste dari clipboard', 'success');
          }
        } catch (_) { showToast('Gagal akses clipboard. Paste manual (Ctrl+V).', 'warning'); }
      });

      // Clear
      safeOn(document.getElementById('slbClearBtn'), 'click', resetUI);

      // Cache clear
      safeOn(document.getElementById('slbCacheClearBtn'), 'click', function () {
        clearCache(); showToast('Cache dibersihkan', 'success');
      });

      // Copy dropdown
      const copyDropdown = document.getElementById('slbCopyDropdown');
      if (copyDropdown) {
        safeOn(document.getElementById('slbCopyBtn'), 'click', function (e) {
          e.stopPropagation();
          copyDropdown.classList.toggle('open');
        });
        $$('[data-copy]', copyDropdown).forEach(function (item) {
          safeOn(item, 'click', function () { copyAs(item.getAttribute('data-copy')); });
        });
      }

      // Result actions
      safeOn(document.getElementById('slbOpenBtn'), 'click', function () {
        const t = els.resultCard ? els.resultCard.getAttribute('data-target') : null;
        if (!t) return;
        if (t.indexOf('source,target,status') === 0) { downloadResult(); return; }
        try { window.open(t, '_blank', 'noopener'); } catch (_) {}
      });
      safeOn(document.getElementById('slbResetBtn'), 'click', resetUI);
      safeOn(document.getElementById('slbQrBtn'), 'click', function () {
        const t = els.resultCard ? els.resultCard.getAttribute('data-target') : null;
        if (t && t.indexOf('source,target,status') !== 0) showQR(t);
      });
      safeOn(document.getElementById('slbShareBtn'), 'click', shareTarget);
      safeOn(document.getElementById('slbDownloadBtn'), 'click', downloadResult);

      // Batch toggle
      safeOn(document.getElementById('slbBatchToggle'), 'click', toggleBatchMode);

      // History
      if (els.historyList) {
        safeOn(els.historyList, 'click', handleHistoryClick);
        safeOn(els.historyList, 'keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleHistoryClick(e); }
        });
      }
      safeOn(document.getElementById('slbHistorySearch'), 'input', function (e) {
        historySearchQuery = e.target.value.trim();
        renderHistory();
      });
      safeOn(document.getElementById('slbHistorySort'), 'change', function (e) {
        historySortMode = e.target.value; renderHistory();
      });
      safeOn(document.getElementById('slbClearHistoryBtn'), 'click', function () {
        if (confirm('Hapus semua riwayat bypass?')) { clearHistory(); showToast('Riwayat dihapus', 'success'); }
      });

      // Export/Import
      safeOn(document.getElementById('slbExportBtn'), 'click', function () { exportHistory('json'); });
      safeOn(document.getElementById('slbExportCsvBtn'), 'click', function () { exportHistory('csv'); });
      const importBtn = document.getElementById('slbImportBtn');
      const importFile = document.getElementById('slbImportFile');
      if (importBtn && importFile) {
        safeOn(importBtn, 'click', function () { importFile.click(); });
        safeOn(importFile, 'change', function () {
          const f = importFile.files[0];
          if (f) importHistory(f);
          importFile.value = '';
        });
      }

      // Theme/Settings
      safeOn(document.getElementById('slbThemeBtn'), 'click', toggleTheme);
      safeOn(document.getElementById('slbSettingsBtn'), 'click', function () {
        syncSettingsUI(); openModal('slbSettingsModal');
      });
      bindSettingsUI();

      // Accent picker
      $$('.slb-accent-btn').forEach(function (btn) {
        safeOn(btn, 'click', function () { applyAccent(btn.getAttribute('data-accent')); });
      });

      // Debug
      safeOn(document.getElementById('slbDebugBtn'), 'click', openDebugPanel);
      $$('.slb-tab').forEach(function (t) {
        safeOn(t, 'click', function () { switchDebugTab(t.getAttribute('data-tab')); });
      });

      // Help/Changelog
      safeOn(document.getElementById('slbHelpBtn'), 'click', function () { openModal('slbHelpModal'); });
      safeOn(document.getElementById('slbChangelogBtn'), 'click', function () {
        renderChangelog(); openModal('slbChangelogModal');
      });

      // Service list
      const handlerSvc = function () { renderServiceList(); openModal('slbServiceListModal'); };
      safeOn(document.getElementById('slbOpenServiceList'), 'click', handlerSvc);
      safeOn(document.getElementById('slbOpenServiceList2'), 'click', handlerSvc);
      ['slbServiceSearch','slbServiceCat','slbServiceLayer'].forEach(function (id) {
        const el = document.getElementById(id);
        safeOn(el, 'input', renderServiceList);
        safeOn(el, 'change', renderServiceList);
      });

      // Quick actions
      $$('.slb-quick-btn[data-quick]').forEach(function (btn) {
        safeOn(btn, 'click', function () {
          const host = btn.getAttribute('data-quick');
          if (els.input) {
            els.input.value = 'https://' + host + '/';
            updateBadge(); els.input.focus();
          }
          showToast('Contoh: ' + host + ' dimuat', 'info');
        });
      });

      // FAQ accordion
      safeOn(document, 'click', function (e) {
        const q = e.target && e.target.closest ? e.target.closest('.slb-faq-q') : null;
        if (q) {
          e.preventDefault();
          const item = q.closest('.slb-faq-item');
          if (item) {
            const open = item.classList.toggle('open');
            q.setAttribute('aria-expanded', open ? 'true' : 'false');
          }
        }
      });

      // Modal close / dropdown close
      safeOn(document, 'click', function (e) {
        if (!e.target || !e.target.matches) return;
        if (e.target.matches('[data-close-modal]')) { closeAllModals(); return; }
        if (e.target.classList.contains('slb-modal')) { closeAllModals(); return; }
        if (!e.target.closest || !e.target.closest('.slb-dropdown')) closeAllDropdowns();
      });

      // V2 modal close
      safeOn(document.getElementById('loginModalClose'), 'click', function () {
        const m = document.getElementById('loginModal');
        if (m) { m.style.display = 'none'; m.setAttribute('aria-hidden', 'true'); }
      });
      safeOn(document.getElementById('profileModalClose'), 'click', function () {
        const m = document.getElementById('profileModal');
        if (m) { m.style.display = 'none'; m.setAttribute('aria-hidden', 'true'); }
      });
      safeOn(document.getElementById('recaptchaModalClose'), 'click', function () {
        const m = document.getElementById('recaptchaModal');
        if (m) { m.style.display = 'none'; m.setAttribute('aria-hidden', 'true'); }
      });

      initKeyboard();

      renderHistory();
      renderStats();
      updateBadge();

      console.log('[SLB] Init OK — ' + SERVICES.length + ' services loaded');
    } catch (e) {
      console.error('[SLB Init Failed]', e);
      // Tampilkan error di halaman agar user sadar
      try {
        const status = document.getElementById('slbStatus');
        const statusText = document.getElementById('slbStatusText');
        if (status && statusText) {
          status.className = 'slb-status error';
          statusText.textContent = 'Inisialisasi gagal: ' + e.message;
        }
      } catch (_) {}
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ================================================================
     EXPOSE API
     ================================================================ */
  window.IRGXY_SLB = {
    version: '4.2',
    SERVICES: SERVICES,
    detectService: detectService,
    isValidUrl: isValidUrl,
    isValidShortlink: isValidShortlink,
    bypassDirect: bypassDirect,
    bypassHtmlProxy: bypassHtmlProxy,
    bypassApi: bypassApi,
    bypassInformative: bypassInformative,
    bypassOuo: bypassOuo,
    bypassLinkvertise: bypassLinkvertise,
    bypassSafelinkU: bypassSafelinkU,
    followRedirects: followRedirects,
    performBypass: performBypass,
    performBatchBypass: performBatchBypass,
    performBypassForUrl: performBypassForUrl,
    loadHistory: loadHistory,
    clearHistory: clearHistory,
    deleteHistoryItem: deleteHistoryItem,
    loadErrors: loadErrors,
    logError: logError,
    loadPerf: loadPerf,
    getCache: function () { return CACHE; },
    clearCache: clearCache,
    showToast: showToast
  };

  console.log(
    '%c✅ Shortlink Bypass V4.2 (Crash-Fixed) %cloaded — ' + SERVICES.length + ' services',
    'background:linear-gradient(135deg,#c9a96e,#7c5cfc);color:#fff;padding:3px 8px;border-radius:4px;font-weight:bold',
    'color:inherit'
  );
})();