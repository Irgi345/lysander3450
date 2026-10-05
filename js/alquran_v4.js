/* ================================================================
   AL-QUR'AN DIGITAL v4 ULTIMATE — IRGXYMODS
   Fitur: v3 + Mushaf mode, Juz navigator, 8 qari, A-B repeat,
          Sleep timer, Mode hafalan, Kartu ayat, Statistik,
          Fokus mode, Shortcut help, 6 tema, Auto-scroll, Hijri.
   ================================================================ */
(function () {
  'use strict';

  /* ---------- Guard IRGXY ---------- */
  const IRGXY = window.IRGXY || {};
  const $  = IRGXY.$  || ((s, c = document) => c.querySelector(s));
  const $$ = IRGXY.$$ || ((s, c = document) => Array.from(c.querySelectorAll(s)));
  const showToast = IRGXY.showToast || ((m, t) => console.log('[Toast]', t || 'info', m));

  const API_BASE = 'https://equran.id/api/v2';
  const LS = {
    BOOKMARKS: 'irgxy_quran_v4_bookmarks',
    LAST:      'irgxy_quran_v4_last',
    SETTINGS:  'irgxy_quran_v4_settings',
    TASBIH:    'irgxy_quran_v4_tasbih',
    THEME:     'irgxy_quran_v4_theme',
    DAILY:     'irgxy_quran_v4_dailyverse',
    STATS:     'irgxy_quran_v4_stats',
    DOA_FAV:   'irgxy_quran_v4_doa_fav',
    PLAYLIST:  'irgxy_quran_v4_playlist'
  };

  /* ═══ STATE (single source of truth) ═══ */
  const S = {
    surahs: [],
    surahCache: {},
    tafsirCache: {},         // BUGFIX: dideklarasi eksplisit
    currentSurah: null,
    currentVerse: null,
    filter: 'all',
    searchCancelled: false,
    playing: false,
    miniMode: false,
    mushafMode: false,
    hifzMode: false,
    abLoop: { a: null, b: null },
    sleepTimer: null,
    autoScroll: false,
    doaCategory: 'all',
    doaFav: [],
    stats: { streak: 0, totalVerses: 0, lastDate: null, dailyTarget: 10, todayVerses: 0 },
    settings: {
      fontSize: 30, fontFamily: 'Amiri', qari: '05',
      showLatin: true, showTrans: true, showTafsir: false,
      autoplay: true, vibrate: true,
      theme: 'dark', speed: 1, volume: 1, repeat: false,
      lineHeight: 2.2, letterSpacing: 0
    },
    bookmarks: [],
    lastRead: null,
    tasbih: { count: 0, target: 99, dhikr: 'Subhanallah' }
  };

  const audio = new Audio();
  audio.preload = 'metadata';

  /* ═══ HELPERS ═══ */
  const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const escRx = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripDiacritics = (s) => (s || '').replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '').trim();
  const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const fmtTime = (s) => { if (!isFinite(s) || s < 0) return '0:00'; const m = Math.floor(s/60); const x = Math.floor(s%60); return m + ':' + String(x).padStart(2,'0'); };
  const pad = (n, w = 3) => String(n).padStart(w, '0');
  const debounce = (fn, ms = 220) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; };

  const safeFetch = IRGXY.safeFetch || (async (url, ms = 15000) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    } finally { clearTimeout(timer); }
  });

  /* ═══ QARI (8 pilihan) ═══ */
  const QARI_MAP = {
    '01': 'Abdullah-Al-Juhany',
    '02': 'Abdul-Muhsin-Al-Qasim',
    '03': 'Abdurrahman-as-Sudais',
    '04': 'Ibrahim-Al-Dossari',
    '05': 'Misyari-Rasyid-Al-Afasi',
    '06': 'Yasser-Al-Dosari',
    '07': 'Maher-Al-Muaiqly',
    '08': 'Saad-Al-Ghamdi'
  };
  const QARI_NAMES = {
    '01': 'Abdullah Al-Juhany',
    '02': 'Abdul Muhsin Al-Qasim',
    '03': 'Abdurrahman As-Sudais',
    '04': 'Ibrahim Al-Dossari',
    '05': 'Misyari Rasyid Al-Afasi',
    '06': 'Yasser Al-Dosari',
    '07': 'Maher Al-Muaiqly',
    '08': 'Saad Al-Ghamdi'
  };

  const ayahAudio = (s, a, q) => `https://cdn.equran.id/audio-partial/${QARI_MAP[q] || QARI_MAP['05']}/${pad(s)}${pad(a)}.mp3`;
  const surahAudio = (s, q) => `https://cdn.equran.id/audio-full/${QARI_MAP[q] || QARI_MAP['05']}/${pad(s)}.mp3`;

  /* ═══ INIT ═══ */
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    loadLocal();
    applySettings();
    renderHijriDate();

    bindTabs();
    bindSurahSearch();
    bindFilterChips();
    bindReaderControls();
    bindSettingsDrawer();
    bindAudioPlayer();
    bindVerseSearch();
    bindDetailActions();
    bindBookmarkActions();
    bindTasbih();
    bindDoaSearch();
    bindAsmaulSearch();
    bindKeyboard();
    bindMiniPlayer();
    bindDailyVerse();
    bindThemeButtons();
    bindFocusMode();
    bindShortcutModal();
    bindSleepModal();
    bindCardModal();
    bindExportAll();

    renderStaticContent();
    renderDoa();
    renderAsmaul();
    renderStats();

    await loadSurahList();
    renderDailyVerse();

    setTimeout(() => {
      const loader = $('#quranLoader');
      const fill = $('#qlBarFill');
      if (fill) fill.style.width = '100%';
      if (loader) loader.classList.add('quran-hidden');
      setTimeout(() => loader?.remove?.(), 700);
    }, 900);

    console.log('%c📖 Al-Qur\'an v4 Ultimate — ready', 'background:linear-gradient(135deg,#C9A96E,#D4B98C);color:#1a1a2e;font-weight:700;padding:4px 10px;border-radius:6px;');
  }

  /* ═══ STORAGE ═══ */
  function loadLocal() {
    const bm = lsGet(LS.BOOKMARKS, []); if (Array.isArray(bm)) S.bookmarks = bm;
    S.lastRead = lsGet(LS.LAST, null);
    const st = lsGet(LS.SETTINGS, {}); if (st && typeof st === 'object') S.settings = { ...S.settings, ...st };
    const th = lsGet(LS.THEME, null); if (th) S.settings.theme = th;
    const ts = lsGet(LS.TASBIH, null); if (ts && typeof ts === 'object') S.tasbih = { ...S.tasbih, ...ts };
    const stats = lsGet(LS.STATS, null); if (stats && typeof stats === 'object') S.stats = { ...S.stats, ...stats };
    const df = lsGet(LS.DOA_FAV, []); if (Array.isArray(df)) S.doaFav = df;
  }
  const saveBookmarks = () => lsSet(LS.BOOKMARKS, S.bookmarks);
  const saveLastRead = () => lsSet(LS.LAST, S.lastRead);
  const saveSettings = () => lsSet(LS.SETTINGS, S.settings);
  const saveTasbih = () => lsSet(LS.TASBIH, S.tasbih);
  const saveStats = () => lsSet(LS.STATS, S.stats);
  const saveDoaFav = () => lsSet(LS.DOA_FAV, S.doaFav);

  /* ═══ APPLY SETTINGS ═══ */
  function applySettings() {
    $$('.verse-arabic').forEach(el => {
      el.style.fontSize = S.settings.fontSize + 'px';
      el.style.fontFamily = `'${S.settings.fontFamily}', serif`;
      el.style.lineHeight = S.settings.lineHeight;
      el.style.letterSpacing = S.settings.letterSpacing + 'px';
    });
    document.body.classList.remove('quran-font-scheherazade','quran-font-lateef','quran-font-noto');
    if (S.settings.fontFamily === 'Scheherazade New') document.body.classList.add('quran-font-scheherazade');
    if (S.settings.fontFamily === 'Lateef') document.body.classList.add('quran-font-lateef');
    if (S.settings.fontFamily === 'Noto Naskh Arabic') document.body.classList.add('quran-font-noto');
    document.body.setAttribute('data-theme', S.settings.theme || 'dark');

    setVal('#setFontSize', S.settings.fontSize);
    setText('#setFontSizeVal', S.settings.fontSize + 'px');
    setVal('#setLineHeight', S.settings.lineHeight);
    setText('#setLineHeightVal', S.settings.lineHeight);
    setVal('#setLetterSpacing', S.settings.letterSpacing);
    setText('#setLetterSpacingVal', S.settings.letterSpacing);
    setVal('#setFontFamily', S.settings.fontFamily);
    setVal('#setQari', S.settings.qari);
    setCheck('#setShowLatin', S.settings.showLatin);
    setCheck('#setShowTrans', S.settings.showTrans);
    setCheck('#setShowTafsir', S.settings.showTafsir);
    setCheck('#setAutoplay', S.settings.autoplay);
    setCheck('#setVibrate', S.settings.vibrate);
    setCheck('#setAutoScroll', S.autoScroll);
    setVal('#qapVolume', S.settings.volume);
    setText('#qapSpeed', S.settings.speed + 'x');
    toggleClass('#qapAutoplay', 'active', S.settings.autoplay);
    toggleClass('#qapRepeat', 'active', S.settings.repeat);
    audio.volume = S.settings.volume;
    audio.playbackRate = S.settings.speed;
    $$('.rd-theme').forEach(b => b.classList.toggle('active', b.dataset.theme === S.settings.theme));
    $$('.rd-preset').forEach(b => b.classList.toggle('active', Number(b.dataset.size) === S.settings.fontSize));
  }
  const setVal = (s, v) => { const e = $(s); if (e) e.value = v; };
  const setText = (s, v) => { const e = $(s); if (e) e.textContent = v; };
  const setCheck = (s, v) => { const e = $(s); if (e) e.checked = v; };
  const toggleClass = (s, c, v) => { const e = $(s); if (e) e.classList.toggle(c, v); };

  /* ═══ HIJRI DATE ═══ */
  function renderHijriDate() {
    const el = $('#hijriPill'); if (!el) return;
    try {
      const d = new Date();
      const hijri = new Intl.DateTimeFormat('id-ID-u-ca-islamic', {
        day: 'numeric', month: 'long', year: 'numeric'
      }).format(d);
      el.innerHTML = `<i class="fas fa-moon"></i> ${esc(hijri)}`;
    } catch (_) {
      el.innerHTML = `<i class="fas fa-moon"></i> ${new Date().toLocaleDateString('id-ID')}`;
    }
  }

  /* ═══ LOAD SURAH LIST ═══ */
  async function loadSurahList() {
    const fill = $('#qlBarFill');
    try {
      if (fill) fill.style.width = '30%';
      const json = await safeFetch(API_BASE + '/surat');
      if (fill) fill.style.width = '80%';
      S.surahs = Array.isArray(json?.data) ? json.data : [];
      renderSurahGrid();
      renderContinueReading();
      populateTafsirSelect();
      populateQariSelect();
      if (fill) fill.style.width = '100%';
    } catch (err) {
      console.warn('[Quran] loadSurahList error', err);
      const grid = $('#surahGrid');
      if (grid) grid.innerHTML = `
        <div class="quran-no-results" style="grid-column:1/-1;">
          <i class="fas fa-exclamation-triangle"></i>
          <h4>Gagal memuat data Al-Qur'an</h4>
          <p>Periksa koneksi internet Anda, lalu coba lagi.</p>
          <button class="search-btn-primary" style="margin-top:1rem;" onclick="location.reload()">
            <i class="fas fa-redo"></i> Coba Lagi
          </button>
        </div>`;
    }
  }

  function renderSurahGrid() {
    const grid = $('#surahGrid'); const noRes = $('#surahNoResults');
    if (!grid) return;
    const q = ($('#surahSearchInput')?.value || '').trim().toLowerCase();
    const qStrip = stripDiacritics(q);
    let list = S.surahs;
    if (S.filter !== 'all') list = list.filter(s => s.tempatTurun === S.filter);
    if (q) {
      list = list.filter(s => {
        const hay = [s.namaLatin, s.arti, s.nama, stripDiacritics(s.nama), String(s.nomor), String(s.jumlahAyat)]
          .map(x => (x || '').toLowerCase());
        return hay.some(h => h.includes(q) || h.includes(qStrip));
      });
    }
    if (!list.length) { grid.innerHTML = ''; if (noRes) noRes.style.display = 'block'; return; }
    if (noRes) noRes.style.display = 'none';

    const frag = document.createDocumentFragment();
    list.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'quran-surah-card';
      card.style.animationDelay = Math.min(i * 0.006, 0.6) + 's';
      card.dataset.nomor = s.nomor;
      const hasBm = S.bookmarks.some(b => b.surah === s.nomor);
      card.innerHTML = `
        ${hasBm ? '<i class="fas fa-bookmark qsc-bookmark"></i>' : ''}
        <div class="qsc-num">${s.nomor}</div>
        <div class="qsc-body">
          <div class="qsc-name">${esc(s.namaLatin)}</div>
          <div class="qsc-meta">
            <span><i class="fas fa-book"></i> ${s.jumlahAyat} Ayat</span>
            <span><i class="fas fa-map-marker-alt"></i> ${esc(s.tempatTurun)}</span>
            <span><i class="fas fa-language"></i> ${esc(s.arti)}</span>
          </div>
        </div>
        <div class="qsc-arabic">${esc(s.nama)}</div>`;
      card.addEventListener('click', () => openSurah(s.nomor));
      card.addEventListener('mouseenter', () => prefetchNeighbor(s.nomor));
      frag.appendChild(card);
    });
    grid.innerHTML = '';
    grid.appendChild(frag);
  }

  function prefetchNeighbor(nomor) {
    [nomor - 1, nomor + 1].forEach(n => {
      if (n >= 1 && n <= 114 && !S.surahCache[n]) {
        safeFetch(API_BASE + '/surat/' + n).then(j => { if (j?.data) S.surahCache[n] = j.data; }).catch(() => {});
      }
    });
  }

  /* ═══ OPEN SURAH ═══ */
  async function openSurah(nomor, verseTarget = null) {
    const listView = $('#surahListView'), readerView = $('#readerView');
    if (!listView || !readerView) return;
    listView.style.display = 'none';
    readerView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const nameEl = $('#readerSurahName');
    if (nameEl) nameEl.textContent = 'Memuat…';

    try {
      let data = S.surahCache[nomor];
      if (!data) {
        const json = await safeFetch(API_BASE + '/surat/' + nomor);
        data = json?.data;
        if (!data) throw new Error('Invalid surah data');
        S.surahCache[nomor] = data;
      }
      S.currentSurah = data;
      renderReader(data, verseTarget);
      saveLastRead({ surah: nomor, surahName: data.namaLatin, verse: verseTarget || 1, time: Date.now() });
      renderContinueReading();
      prefetchNeighbor(nomor);
      trackReadProgress(data.ayat?.length || 0);
    } catch (err) {
      console.warn('[Quran] openSurah error', err);
      showToast('Gagal memuat surah', 'error');
      closeReader();
    }
  }

  /** Track progress baca harian */
  function trackReadProgress(count) {
    const today = new Date().toISOString().slice(0, 10);
    if (S.stats.lastDate !== today) {
      // Reset daily counter / update streak
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      S.stats.streak = (S.stats.lastDate === yesterday) ? (S.stats.streak + 1) : 1;
      S.stats.lastDate = today;
      S.stats.todayVerses = 0;
    }
    S.stats.todayVerses += count;
    S.stats.totalVerses += count;
    saveStats();
    renderStats();
  }

  function renderReader(data, verseTarget) {
    if (!data?.ayat) return;  // BUGFIX: guard
    const nameEl = $('#readerSurahName'), subEl = $('#readerSurahSub');
    const infoName = $('#readerInfoName'), infoDesc = $('#readerInfoDesc');
    const bismillah = $('#readerBismillah'), list = $('#readerVerseList');
    if (!list) return;

    if (nameEl) nameEl.textContent = data.namaLatin;
    if (subEl) subEl.textContent = `Surah ke-${data.nomor} • ${data.jumlahAyat} Ayat • ${data.tempatTurun}`;
    if (infoName) infoName.textContent = `QS. ${data.namaLatin} — ${data.arti}`;
    if (infoDesc) infoDesc.textContent = data.deskripsi || '';
    if (bismillah) bismillah.style.display = (data.nomor === 1 || data.nomor === 9) ? 'none' : 'block';

    const frag = document.createDocumentFragment();
    (data.ayat || []).forEach((a, idx) => {
      const card = document.createElement('div');
      card.className = 'verse-card';
      card.dataset.verse = a.nomorAyat;
      card.style.animation = `qFade 0.35s ease ${Math.min(idx * 0.008, 0.4)}s both`;
      const isBm = S.bookmarks.some(b => b.surah === data.nomor && b.verse === a.nomorAyat);
      card.innerHTML = `
        <div class="verse-head">
          <span class="verse-badge"><i class="fas fa-bookmark"></i> ${data.nomor}:${a.nomorAyat}</span>
          <div class="verse-actions">
            <button class="verse-action-btn verse-play" data-act="play" aria-label="Putar"><i class="fas fa-play"></i></button>
            <button class="verse-action-btn verse-bm ${isBm ? 'active' : ''}" data-act="bookmark" aria-label="Bookmark"><i class="fas fa-bookmark"></i></button>
            <button class="verse-action-btn" data-act="tafsir" aria-label="Tafsir"><i class="fas fa-book-reader"></i></button>
            <button class="verse-action-btn" data-act="card" aria-label="Kartu"><i class="fas fa-image"></i></button>
            <button class="verse-action-btn" data-act="copy" aria-label="Salin"><i class="fas fa-copy"></i></button>
            <button class="verse-action-btn" data-act="share" aria-label="Bagikan"><i class="fas fa-share-alt"></i></button>
          </div>
        </div>
        <div class="verse-arabic" data-verse-arabic>${esc(a.teksArab || '')}<span class="verse-num-inline">${a.nomorAyat}</span></div>
        ${S.settings.showLatin ? `<div class="verse-latin">${esc(a.teksLatin || '')}</div>` : ''}
        ${S.settings.showTrans ? `<div class="verse-trans">${esc(a.teksIndonesia || '')}</div>` : ''}
        ${S.settings.showTafsir ? `<div class="verse-tafsir" data-tafsir-for="${a.nomorAyat}">Memuat tafsir…</div>` : ''}`;

      // Mode hafalan: blur arabic, klik untuk reveal
      if (S.hifzMode) {
        card.classList.add('hifz-hidden');
        card.querySelector('.verse-arabic')?.addEventListener('click', (e) => {
          e.target.classList.add('revealed');
        });
      }

      card.querySelectorAll('.verse-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const act = btn.dataset.act;
          if (act === 'play') playVerse(data.nomor, a.nomorAyat);
          else if (act === 'bookmark') toggleBookmark(data.nomor, data.namaLatin, a.nomorAyat, card);
          else if (act === 'tafsir') openTafsir(data.nomor, a.nomorAyat, a);
          else if (act === 'card') generateCard(data.nomor, data.namaLatin, a);
          else if (act === 'copy') copyVerse(data.nomor, data.namaLatin, a);
          else if (act === 'share') shareVerse(data.nomor, data.namaLatin, a);
        });
      });
      frag.appendChild(card);
    });
    list.innerHTML = '';
    list.appendChild(frag);

    applySettings();
    updateNavButtons(data.nomor);
    if (S.settings.showTafsir) loadTafsirInline(data.nomor);

    if (verseTarget) {
      setTimeout(() => {
        const el = list.querySelector(`.verse-card[data-verse="${verseTarget}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.style.boxShadow = '0 0 40px rgba(201,169,110,0.7)';
          setTimeout(() => el.style.boxShadow = '', 2400);
        }
      }, 250);
    }
  }

  function closeReader() {
    const listView = $('#surahListView'), readerView = $('#readerView');
    if (listView) listView.style.display = 'block';
    if (readerView) readerView.style.display = 'none';
    stopAudio(); hidePlayer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    renderSurahGrid();
  }

  function updateNavButtons(nomor) {
    const prev = $('#readerPrevSurah'), next = $('#readerNextSurah');
    if (prev) prev.disabled = nomor <= 1;
    if (next) next.disabled = nomor >= 114;
  }

  /* ═══ POPULATE SELECTS ═══ */
  function populateQariSelect() {
    const sel = $('#setQari'); if (!sel) return;
    sel.innerHTML = Object.entries(QARI_NAMES).map(([k, v]) =>
      `<option value="${k}"${k === S.settings.qari ? ' selected' : ''}>${v}</option>`
    ).join('');
  }

  /* ═══ AUDIO PLAYER ═══ */
  function playVerse(surahNomor, verseNum) {
    const data = S.surahCache[surahNomor];
    if (!data) return;
    const ayat = (data.ayat || []).find(a => a.nomorAyat === verseNum);
    if (!ayat) return;
    const url = ayahAudio(surahNomor, verseNum, S.settings.qari);
    S.currentVerse = { surah: surahNomor, verse: verseNum, isSingle: true };
    saveLastRead({ surah: surahNomor, surahName: data.namaLatin, verse: verseNum, time: Date.now() });
    renderContinueReading();

    audio.src = url;
    audio.playbackRate = S.settings.speed;
    audio.volume = S.settings.volume;
    audio.play().then(() => {
      S.playing = true;
      showPlayer();
      updatePlayerUI(surahNomor, data.namaLatin, verseNum, data.jumlahAyat);
      markPlayingCard(verseNum);
      updateMediaSession(surahNomor, data.namaLatin, verseNum, ayat.teksIndonesia);
      if (S.autoScroll) scrollToPlaying();
    }).catch(err => {
      console.warn('[Quran] play error', err);
      showToast('Gagal memutar audio', 'error');
    });
  }

  function playFullSurah(surahNomor) {
    const data = S.surahCache[surahNomor];
    const url = surahAudio(surahNomor, S.settings.qari);
    S.currentVerse = { surah: surahNomor, verse: null, isSingle: false };
    audio.src = url;
    audio.playbackRate = S.settings.speed;
    audio.volume = S.settings.volume;
    audio.play().then(() => {
      S.playing = true;
      showPlayer();
      const t = $('#qapTitle'), s = $('#qapSub');
      if (t) t.textContent = `QS. ${data?.namaLatin || surahNomor} — Full Murottal`;
      if (s) s.textContent = QARI_NAMES[S.settings.qari] || 'Qari';
      $$('.verse-card.playing').forEach(c => c.classList.remove('playing'));
      updateMediaSession(surahNomor, data?.namaLatin, 'Full', 'Murottal Surah Lengkap');
    }).catch(err => {
      console.warn('[Quran] playFull error', err);
      showToast('Gagal memutar full surah', 'error');
    });
  }

  function updatePlayerUI(surahNum, surahName, verseNum, totalVerses) {
    const t = $('#qapTitle'), s = $('#qapSub');
    if (t) t.textContent = `QS. ${surahName} : ${verseNum}`;
    if (s) s.textContent = `${QARI_NAMES[S.settings.qari] || 'Qari'} · Ayat ${verseNum} dari ${totalVerses}`;
  }

  function markPlayingCard(verseNum) {
    $$('.verse-card').forEach(c => c.classList.remove('playing'));
    const el = $(`.verse-card[data-verse="${verseNum}"]`);
    if (el) {
      el.classList.add('playing');
      const icon = el.querySelector('.verse-play i');
      if (icon) icon.className = 'fas fa-pause';
    }
  }

  function scrollToPlaying() {
    const el = $('.verse-card.playing');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function showPlayer() {
    const p = $('#audioPlayer');
    if (p) p.classList.add('qap-visible', 'playing');
  }
  function hidePlayer() {
    const p = $('#audioPlayer');
    if (p) p.classList.remove('qap-visible', 'playing');
    const mp = $('#miniPlayer');
    if (mp) mp.style.display = 'none';
  }

  function bindAudioPlayer() {
    const toggle = $('#qapToggle'), prev = $('#qapPrev'), next = $('#qapNext');
    const auto = $('#qapAutoplay'), repeat = $('#qapRepeat');
    const close = $('#qapClose'), prog = $('#qapProgress');
    const cur = $('#qapCurrent'), dur = $('#qapDuration');
    const rw = $('#qapRewind'), fw = $('#qapForward');
    const spd = $('#qapSpeed'), vol = $('#qapVolume');
    const volBtn = $('#qapVolumeBtn'), mini = $('#qapMinimize');
    const abBtn = $('#qapABLoop'), sleepBtn = $('#qapSleep');

    toggle?.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => showToast('Gagal memutar', 'error'));
      else audio.pause();
    });
    prev?.addEventListener('click', () => stepVerse(-1));
    next?.addEventListener('click', () => stepVerse(1));
    rw?.addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
    fw?.addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
    auto?.addEventListener('click', () => {
      S.settings.autoplay = !S.settings.autoplay;
      auto.classList.toggle('active', S.settings.autoplay);
      setCheck('#setAutoplay', S.settings.autoplay);
      saveSettings();
      showToast(S.settings.autoplay ? 'Autoplay aktif' : 'Autoplay nonaktif', 'info');
    });
    repeat?.addEventListener('click', () => {
      S.settings.repeat = !S.settings.repeat;
      repeat.classList.toggle('active', S.settings.repeat);
      saveSettings();
    });
    close?.addEventListener('click', () => { stopAudio(); hidePlayer(); });
    mini?.addEventListener('click', () => toggleMiniPlayer());

    // A-B Loop
    abBtn?.addEventListener('click', () => {
      if (S.abLoop.a === null) {
        S.abLoop.a = audio.currentTime;
        abBtn.classList.add('active');
        showToast('A ditandai pada ' + fmtTime(S.abLoop.a), 'info');
      } else if (S.abLoop.b === null) {
        S.abLoop.b = audio.currentTime;
        showToast('B ditandai. Loop aktif.', 'success');
      } else {
        S.abLoop = { a: null, b: null };
        abBtn.classList.remove('active');
        showToast('Loop A-B dibatalkan', 'info');
      }
    });

    // Sleep Timer
    sleepBtn?.addEventListener('click', () => {
      const m = $('#sleepModal');
      if (m) m.style.display = 'flex';
    });

    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    spd?.addEventListener('click', () => {
      const idx = speeds.indexOf(S.settings.speed);
      const nx = speeds[(idx + 1) % speeds.length];
      S.settings.speed = nx;
      spd.textContent = nx + 'x';
      audio.playbackRate = nx;
      saveSettings();
    });
    vol?.addEventListener('input', () => {
      const v = parseFloat(vol.value) || 0;
      S.settings.volume = v;
      audio.volume = v;
      if (volBtn) volBtn.innerHTML = v === 0 ? '<i class="fas fa-volume-xmark"></i>'
        : v < 0.5 ? '<i class="fas fa-volume-low"></i>' : '<i class="fas fa-volume-high"></i>';
      saveSettings();
    });
    volBtn?.addEventListener('click', () => {
      if (audio.volume > 0) { audio.volume = 0; S.settings.volume = 0; volBtn.innerHTML = '<i class="fas fa-volume-xmark"></i>'; }
      else { audio.volume = 1; S.settings.volume = 1; volBtn.innerHTML = '<i class="fas fa-volume-high"></i>'; }
      if (vol) vol.value = S.settings.volume;
      saveSettings();
    });

    audio.addEventListener('play', () => {
      S.playing = true;
      const i = $('#qapToggle i'); if (i) i.className = 'fas fa-pause';
      const mp = $('#mpPlay i'); if (mp) mp.className = 'fas fa-pause';
      $('#audioPlayer')?.classList.add('playing');
      updatePlayingIcon(true);
    });
    audio.addEventListener('pause', () => {
      S.playing = false;
      const i = $('#qapToggle i'); if (i) i.className = 'fas fa-play';
      const mp = $('#mpPlay i'); if (mp) mp.className = 'fas fa-play';
      $('#audioPlayer')?.classList.remove('playing');
      updatePlayingIcon(false);
    });
    audio.addEventListener('loadedmetadata', () => {
      if (dur) dur.textContent = fmtTime(audio.duration);
      if (prog) prog.value = 0;
    });
    audio.addEventListener('timeupdate', () => {
      // A-B Loop check
      if (S.abLoop.a !== null && S.abLoop.b !== null && audio.currentTime >= S.abLoop.b) {
        audio.currentTime = S.abLoop.a;
      }
      if (cur) cur.textContent = fmtTime(audio.currentTime);
      if (dur && isFinite(audio.duration)) dur.textContent = fmtTime(audio.duration);
      if (prog && audio.duration) prog.value = (audio.currentTime / audio.duration) * 100;
    });
    audio.addEventListener('ended', () => {
      if (S.settings.repeat && S.currentVerse?.isSingle) {
        audio.currentTime = 0; audio.play().catch(() => {});
        return;
      }
      if (S.settings.autoplay && S.currentVerse?.verse) {
        setTimeout(() => stepVerse(1), 250);
      } else {
        const i = $('#qapToggle i'); if (i) i.className = 'fas fa-play';
      }
    });
    audio.addEventListener('error', () => {
      console.warn('[Quran] audio error');
      showToast('Audio gagal dimuat', 'error');
    });
    prog?.addEventListener('input', () => {
      if (audio.duration) audio.currentTime = (Number(prog.value) / 100) * audio.duration;
    });
  }

  function updatePlayingIcon(isPlaying) {
    const cv = S.currentVerse; if (!cv || !cv.verse) return;
    const el = $(`.verse-card[data-verse="${cv.verse}"]`);
    if (!el) return;
    const icon = el.querySelector('.verse-play i');
    if (icon) icon.className = isPlaying ? 'fas fa-pause' : 'fas fa-play';
  }

  function stepVerse(dir) {
    const cv = S.currentVerse; if (!cv) return;
    const data = S.surahCache[cv.surah]; if (!data) return;
    let target = (cv.verse || 0) + dir;
    if (target < 1) {
      if (cv.surah > 1) { openSurah(cv.surah - 1, 1); setTimeout(() => playVerse(cv.surah - 1, 1), 500); }
      else showToast("Sudah di awal Al-Qur'an", 'info');
      return;
    }
    if (target > data.jumlahAyat) {
      if (cv.surah < 114) { openSurah(cv.surah + 1, 1); setTimeout(() => playVerse(cv.surah + 1, 1), 500); }
      else showToast("Sudah di akhir Al-Qur'an", 'info');
      return;
    }
    playVerse(cv.surah, target);
  }

  function stopAudio() {
    try { audio.pause(); audio.currentTime = 0; audio.removeAttribute('src'); audio.load(); } catch (_) {}
    S.currentVerse = null;
    S.abLoop = { a: null, b: null };
    $('#qapABLoop')?.classList.remove('active');
    $$('.verse-card.playing').forEach(c => c.classList.remove('playing'));
  }

  /* ═══ SLEEP TIMER ═══ */
  function bindSleepModal() {
    const m = $('#sleepModal');
    if (!m) return;
    $('#sleepModalClose')?.addEventListener('click', () => m.style.display = 'none');
    m.addEventListener('click', (e) => { if (e.target === m) m.style.display = 'none'; });
    $$('#sleepModal .sleep-options button').forEach(btn => {
      btn.addEventListener('click', () => {
        const min = Number(btn.dataset.min);
        if (S.sleepTimer) clearTimeout(S.sleepTimer);
        if (min === 0) {
          S.sleepTimer = null;
          setText('#sleepStatus', 'Timer: —');
          showToast('Sleep timer dimatikan', 'info');
        } else {
          S.sleepTimer = setTimeout(() => {
            audio.pause();
            showToast('Sleep timer: audio dihentikan', 'info');
            setText('#sleepStatus', 'Timer: —');
          }, min * 60000);
          setText('#sleepStatus', `Timer: ${min} menit`);
          showToast(`Sleep timer: ${min} menit`, 'success');
        }
        m.style.display = 'none';
      });
    });
  }

  /* ═══ MINI PLAYER ═══ */
  function bindMiniPlayer() {
    const mp = $('#miniPlayer');
    const expand = $('#mpExpand'), play = $('#mpPlay');
    expand?.addEventListener('click', toggleMiniPlayer);
    play?.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => {}); else audio.pause();
    });
    if (mp) {
      let dragging = false, startX, startY, startLeft, startTop;
      const onDown = (e) => {
        if (e.target.closest('button')) return;
        dragging = true;
        const rect = mp.getBoundingClientRect();
        const point = e.touches ? e.touches[0] : e;
        startX = point.clientX; startY = point.clientY;
        startLeft = rect.left; startTop = rect.top;
        mp.style.left = rect.left + 'px';
        mp.style.top = rect.top + 'px';
        mp.style.right = 'auto'; mp.style.bottom = 'auto';
      };
      const onMove = (e) => {
        if (!dragging) return;
        const point = e.touches ? e.touches[0] : e;
        mp.style.left = (startLeft + point.clientX - startX) + 'px';
        mp.style.top = (startTop + point.clientY - startY) + 'px';
      };
      const onUp = () => { dragging = false; };
      // BUGFIX: touch + mouse support
      mp.addEventListener('mousedown', onDown);
      mp.addEventListener('touchstart', onDown, { passive: true });
      document.addEventListener('mousemove', onMove);
      document.addEventListener('touchmove', onMove, { passive: true });
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchend', onUp);
    }
  }
  function toggleMiniPlayer() {
    const mp = $('#miniPlayer');
    const full = $('#audioPlayer');
    if (!mp || !full) return;
    if (S.miniMode) {
      mp.style.display = 'none';
      full.classList.add('qap-visible');
      S.miniMode = false;
    } else {
      setText('#mpTitle', $('#qapTitle')?.textContent || '—');
      setText('#mpSub', $('#qapSub')?.textContent || '—');
      const i = $('#mpPlay i'); if (i) i.className = audio.paused ? 'fas fa-play' : 'fas fa-pause';
      mp.style.display = 'flex';
      full.classList.remove('qap-visible');
      S.miniMode = true;
    }
  }

  /* ═══ MEDIA SESSION ═══ */
  function updateMediaSession(surahNomor, surahName, verseNum, snippet) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: `QS. ${surahName || ''} : ${verseNum}`,
        artist: QARI_NAMES[S.settings.qari] || 'Qari',
        album: "Al-Qur'an Digital IRGXYMODS",
        artwork: [
          { src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect fill="%23C9A96E" width="512" height="512"/><text x="256" y="330" font-size="240" text-anchor="middle" fill="%231a1a2e" font-family="serif">☾</text></svg>', sizes: '512x512', type: 'image/svg+xml' }
        ]
      });
      navigator.mediaSession.setActionHandler('play', () => audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => stepVerse(-1));
      navigator.mediaSession.setActionHandler('nexttrack', () => stepVerse(1));
      navigator.mediaSession.setActionHandler('seekbackward', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
      navigator.mediaSession.setActionHandler('seekforward', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });
    } catch (_) {}
  }

  /* ═══ BOOKMARK ═══ */
  function toggleBookmark(surahNomor, surahName, verse, card) {
    const idx = S.bookmarks.findIndex(b => b.surah === surahNomor && b.verse === verse);
    const btn = card?.querySelector('.verse-bm');
    if (idx >= 0) {
      S.bookmarks.splice(idx, 1);
      showToast('Bookmark dihapus', 'info');
      btn?.classList.remove('active');
    } else {
      const a = (S.surahCache[surahNomor]?.ayat || []).find(x => x.nomorAyat === verse);
      S.bookmarks.push({ surah: surahNomor, surahName, verse, teks: a?.teksIndonesia || '', arab: a?.teksArab || '', time: Date.now() });
      showToast('Ayat ditandai', 'success');
      btn?.classList.add('active');
    }
    saveBookmarks();
    renderBookmarks();
  }
  function renderBookmarks() {
    const list = $('#bookmarkList'), empty = $('#bookmarkEmpty');
    if (!list) return;
    if (!S.bookmarks.length) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';
    list.innerHTML = S.bookmarks.map(b => `
      <div class="bookmark-item" data-surah="${b.surah}" data-verse="${b.verse}">
        <div class="bookmark-icon">${b.surah}</div>
        <div class="bookmark-body">
          <div class="bookmark-surah">QS. ${esc(b.surahName)} : ${b.verse}</div>
          <div class="bookmark-text">${esc((b.teks || '').slice(0, 140))}…</div>
        </div>
        <button class="bookmark-remove" data-remove="${b.surah}:${b.verse}" aria-label="Hapus"><i class="fas fa-trash"></i></button>
      </div>`).join('');
    list.querySelectorAll('.bookmark-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]')) return;
        const sn = Number(item.dataset.surah), v = Number(item.dataset.verse);
        switchTab('baca'); openSurah(sn, v);
      });
    });
    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const [sn, v] = btn.dataset.remove.split(':').map(Number);
        S.bookmarks = S.bookmarks.filter(b => !(b.surah === sn && b.verse === v));
        saveBookmarks();
        renderBookmarks();
        renderSurahGrid();
      });
    });
  }
  function bindBookmarkActions() {
    $('#exportBmBtn')?.addEventListener('click', exportBookmarks);
    $('#importBmBtn')?.addEventListener('click', () => $('#importBmFile')?.click());
    $('#importBmFile')?.addEventListener('change', importBookmarks);
  }
  function exportBookmarks() {
    const data = JSON.stringify({ version: 4, bookmarks: S.bookmarks }, null, 2);
    downloadJSON(data, `irgxy-quran-bookmarks-${Date.now()}.json`);
    showToast('Bookmark diexport', 'success');
  }
  function importBookmarks(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        const list = Array.isArray(json) ? json : (json.bookmarks || []);
        if (!Array.isArray(list)) throw new Error('Invalid format');
        const map = new Map();
        [...S.bookmarks, ...list].forEach(b => {
          if (b && typeof b.surah === 'number' && typeof b.verse === 'number') {
            map.set(`${b.surah}:${b.verse}`, b);
          }
        });
        S.bookmarks = Array.from(map.values());
        saveBookmarks();
        renderBookmarks(); renderSurahGrid();
        showToast(`Import berhasil: ${list.length} bookmark`, 'success');
      } catch (err) { showToast('File tidak valid', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  /* ═══ EXPORT / IMPORT ALL ═══ */
  function bindExportAll() {
    $('#exportAllBtn')?.addEventListener('click', () => {
      const dump = {
        version: 4,
        exportedAt: new Date().toISOString(),
        bookmarks: S.bookmarks,
        settings: S.settings,
        tasbih: S.tasbih,
        stats: S.stats,
        doaFav: S.doaFav,
        lastRead: S.lastRead
      };
      downloadJSON(JSON.stringify(dump, null, 2), `irgxy-quran-backup-${Date.now()}.json`);
      showToast('Backup diexport', 'success');
    });
    $('#importAllBtn')?.addEventListener('click', () => $('#importAllFile')?.click());
    $('#importAllFile')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const d = JSON.parse(reader.result);
          if (d.bookmarks) S.bookmarks = d.bookmarks;
          if (d.settings) S.settings = { ...S.settings, ...d.settings };
          if (d.tasbih) S.tasbih = { ...S.tasbih, ...d.tasbih };
          if (d.stats) S.stats = { ...S.stats, ...d.stats };
          if (d.doaFav) S.doaFav = d.doaFav;
          if (d.lastRead) S.lastRead = d.lastRead;
          saveBookmarks(); saveSettings(); saveTasbih(); saveStats(); saveDoaFav(); saveLastRead();
          applySettings();
          renderBookmarks(); renderDoa(); renderStats(); renderContinueReading(); renderSurahGrid();
          showToast('Restore berhasil', 'success');
        } catch (err) { showToast('File tidak valid', 'error'); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  function downloadJSON(content, filename) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  /* ═══ COPY / SHARE ═══ */
  function copyVerse(s, name, a) {
    const text = `${a.teksArab}\n\n${a.teksLatin}\n\n"${a.teksIndonesia}"\n(QS. ${name}: ${a.nomorAyat})\n— IRGXYMODS`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => showToast('Ayat disalin', 'success')).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('Ayat disalin', 'success'); }
    catch { showToast('Gagal menyalin', 'error'); }
    document.body.removeChild(ta);
  }
  function shareVerse(s, name, a) {
    const text = `${a.teksArab}\n\n${a.teksLatin}\n\n"${a.teksIndonesia}"\n(QS. ${name}: ${a.nomorAyat})`;
    const url = `${location.origin}${location.pathname}#s=${s}&v=${a.nomorAyat}`;
    if (navigator.share) {
      navigator.share({ title: `QS. ${name}: ${a.nomorAyat}`, text, url }).catch(() => {});
    } else copyVerse(s, name, a);
  }

  /* ═══ LAST READ ═══ */
  function renderContinueReading() {
    const wrap = $('#continueReadingWrap'), txt = $('#continueReadingText'), btn = $('#continueReadingBtn');
    if (!wrap || !S.lastRead?.surah) { if (wrap) wrap.style.display = 'none'; return; }
    wrap.style.display = 'flex';
    if (txt) txt.textContent = `QS. ${S.lastRead.surahName} · Ayat ${S.lastRead.verse}`;
    if (btn) btn.onclick = () => openSurah(S.lastRead.surah, S.lastRead.verse);
  }

  /* ═══ TABS ═══ */
  function bindTabs() {
    $$('.quran-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        $$('.quran-tab').forEach(b => b.classList.toggle('active', b === btn));
        $$('.quran-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tab));
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (tab === 'statistik') renderStats();
      });
    });
  }
  function switchTab(name) {
    $$('.quran-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.quran-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === name));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ═══ SURAH SEARCH / FILTER ═══ */
  function bindSurahSearch() {
    const inp = $('#surahSearchInput'), clr = $('#surahSearchClear');
    if (!inp) return;
    let t;
    inp.addEventListener('input', () => {
      clr?.classList.toggle('visible', inp.value.trim().length > 0);
      clearTimeout(t); t = setTimeout(renderSurahGrid, 120);
    });
    clr?.addEventListener('click', () => {
      inp.value = ''; clr.classList.remove('visible'); inp.focus(); renderSurahGrid();
    });
  }
  function bindFilterChips() {
    $$('#surahFilterChips .quran-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        if (chip.id === 'juzNavChip') {
          showJuzNav();
          return;
        }
        $$('#surahFilterChips .quran-chip').forEach(c => c.classList.toggle('active', c === chip));
        S.filter = chip.dataset.filter || 'all';
        renderSurahGrid();
      });
    });
  }

  /** Juz navigator — tampilkan pilihan 1-30 */
  function showJuzNav() {
    const JUZ_START = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30];
    // Peta surah awal setiap juz
    const JUZ_MAP = {
      1:'1:1',2:'2:142',3:'2:253',4:'3:93',5:'4:24',6:'4:148',7:'5:82',8:'6:111',9:'7:88',10:'8:41',
      11:'9:93',12:'11:6',13:'12:53',14:'15:1',15:'17:1',16:'18:75',17:'21:1',18:'23:1',19:'25:21',20:'27:56',
      21:'29:46',22:'33:31',23:'36:28',24:'39:32',25:'41:47',26:'46:1',27:'51:31',28:'58:1',29:'67:1',30:'78:1'
    };
    const grid = $('#surahGrid');
    if (!grid) return;
    grid.innerHTML = JUZ_START.map(j => `
      <div class="quran-surah-card" data-juz="${j}">
        <div class="qsc-num">${j}</div>
        <div class="qsc-body">
          <div class="qsc-name">Juz ${j}</div>
          <div class="qsc-meta"><span><i class="fas fa-book-open"></i> Mulai ${JUZ_MAP[j]}</span></div>
        </div>
      </div>`).join('');
    grid.querySelectorAll('[data-juz]').forEach(card => {
      card.addEventListener('click', () => {
        const j = card.dataset.juz;
        const [sn, v] = JUZ_MAP[j].split(':').map(Number);
        openSurah(sn, v);
      });
    });
  }

  /* ═══ READER CONTROLS ═══ */
  function bindReaderControls() {
    $('#readerBack')?.addEventListener('click', closeReader);
    $('#readerPrevSurah')?.addEventListener('click', () => {
      if (!S.currentSurah || S.currentSurah.nomor <= 1) return;
      openSurah(S.currentSurah.nomor - 1);
    });
    $('#readerNextSurah')?.addEventListener('click', () => {
      if (!S.currentSurah || S.currentSurah.nomor >= 114) return;
      openSurah(S.currentSurah.nomor + 1);
    });
    // Mushaf mode
    $('#mushafToggle')?.addEventListener('click', () => {
      S.mushafMode = !S.mushafMode;
      document.body.setAttribute('data-mode', S.mushafMode ? 'mushaf' : 'normal');
      $('#mushafToggle')?.classList.toggle('active', S.mushafMode);
      showToast(S.mushafMode ? 'Mode Mushaf aktif' : 'Mode Normal', 'info');
    });
  }

  /* ═══ DETAIL ACTIONS ═══ */
  function bindDetailActions() {
    $('#playFullSurahBtn')?.addEventListener('click', () => {
      if (S.currentSurah) playFullSurah(S.currentSurah.nomor);
    });
    const toggle = $('#detailSearchToggle'), wrap = $('#detailSearchWrap'), inp = $('#detailSearchInput');
    toggle?.addEventListener('click', () => {
      const show = wrap.style.display === 'none';
      wrap.style.display = show ? 'block' : 'none';
      if (show) inp?.focus();
    });
    if (inp) {
      const onInput = debounce(() => {
        const q = inp.value.trim().toLowerCase();
        if (!q) { renderReader(S.currentSurah); return; }
        const filtered = (S.currentSurah.ayat || []).filter(a =>
          (a.teksIndonesia || '').toLowerCase().includes(q) ||
          (a.teksLatin || '').toLowerCase().includes(q) ||
          (a.teksArab || '').includes(inp.value.trim())
        );
        const clone = { ...S.currentSurah, ayat: filtered };
        renderReader(clone);
      }, 180);
      inp.addEventListener('input', onInput);
    }
    // Mode Hafalan
    $('#hifzToggle')?.addEventListener('click', () => {
      S.hifzMode = !S.hifzMode;
      const btn = $('#hifzToggle');
      btn?.setAttribute('aria-pressed', S.hifzMode);
      showToast(S.hifzMode ? 'Mode Hafalan aktif — klik ayat untuk reveal' : 'Mode Hafalan nonaktif', 'info');
      if (S.currentSurah) renderReader(S.currentSurah, S.currentVerse?.verse);
    });
    // Kartu ayat dari ayat terakhir
    $('#cardAyatBtn')?.addEventListener('click', () => {
      if (!S.currentSurah) return;
      const v = S.currentVerse?.verse || 1;
      const a = (S.currentSurah.ayat || []).find(x => x.nomorAyat === v);
      if (a) generateCard(S.currentSurah.nomor, S.currentSurah.namaLatin, a);
    });
  }

  /* ═══ VERSE SEARCH (GLOBAL) ═══ */
  function bindVerseSearch() {
    const inp = $('#verseSearchInput'), clr = $('#verseSearchClear');
    const btn = $('#verseSearchBtn'), cancel = $('#verseSearchCancel');
    if (!inp) return;
    inp.addEventListener('input', () => clr?.classList.toggle('visible', inp.value.trim().length > 0));
    inp.addEventListener('keypress', (e) => { if (e.key === 'Enter') runVerseSearch(); });
    clr?.addEventListener('click', () => {
      inp.value = ''; clr.classList.remove('visible');
      $('#verseSearchResults').innerHTML = '';
      $('#verseSearchProgress').style.display = 'none';
    });
    btn?.addEventListener('click', runVerseSearch);
    cancel?.addEventListener('click', () => { S.searchCancelled = true; showToast('Pencarian dibatalkan', 'info'); });
  }

  async function runVerseSearch() {
    const q = ($('#verseSearchInput')?.value || '').trim();
    if (q.length < 2) { showToast('Minimal 2 karakter', 'warning'); return; }
    const scope = $('input[name="vscope"]:checked')?.value || 'indonesia';
    const results = $('#verseSearchResults');
    const progWrap = $('#verseSearchProgress'), progFill = $('#verseSearchProgressFill');
    const progText = $('#verseSearchProgressText');
    const btn = $('#verseSearchBtn'), cancel = $('#verseSearchCancel');

    S.searchCancelled = false;
    btn.disabled = true;
    cancel.style.display = 'inline-flex';
    progWrap.style.display = 'block';
    progFill.style.width = '0%';
    progText.textContent = 'Memindai…';
    results.innerHTML = '';

    const qLow = q.toLowerCase(), qStrip = stripDiacritics(qLow);
    const allResults = [];
    const MAX = 300, BATCH = 6;

    for (let i = 0; i < 114; i += BATCH) {
      if (S.searchCancelled) break;
      const batch = [];
      for (let j = i; j < Math.min(i + BATCH, 114); j++) batch.push(j + 1);

      const fetched = await Promise.all(batch.map(async (n) => {
        try {
          if (S.surahCache[n]) return { n, data: S.surahCache[n] };
          const json = await safeFetch(API_BASE + '/surat/' + n);
          const data = json?.data;
          if (data) S.surahCache[n] = data;
          return { n, data };
        } catch { return { n, data: null }; }
      }));

      for (const { data } of fetched) {
        if (!data) continue;
        (data.ayat || []).forEach(a => {
          if (allResults.length >= MAX) return;
          const trans = (a.teksIndonesia || '').toLowerCase();
          const arabStripped = stripDiacritics(a.teksArab || '');
          const latin = (a.teksLatin || '').toLowerCase();
          let hit = false;
          if (scope === 'indonesia' && trans.includes(qLow)) hit = true;
          else if (scope === 'arab' && arabStripped.includes(qStrip)) hit = true;
          else if (scope === 'latin' && latin.includes(qLow)) hit = true;
          else if (scope === 'all' && (trans.includes(qLow) || arabStripped.includes(qStrip) || latin.includes(qLow))) hit = true;
          if (hit) allResults.push({
            surah: data.nomor, surahName: data.namaLatin, verse: a.nomorAyat,
            arab: a.teksArab, latin: a.teksLatin, trans: a.teksIndonesia
          });
        });
      }

      const pct = ((i + BATCH) / 114) * 100;
      progFill.style.width = Math.min(pct, 100) + '%';
      progText.textContent = `Surah ${Math.min(i + BATCH, 114)}/114 · Ditemukan ${allResults.length} ayat…`;
      await new Promise(r => setTimeout(r, 0));
    }

    btn.disabled = false;
    cancel.style.display = 'none';

    if (S.searchCancelled) { progWrap.style.display = 'none'; return; }

    progText.textContent = `Selesai · ${allResults.length} ayat ditemukan`;
    if (!allResults.length) {
      results.innerHTML = `<div class="quran-no-results"><i class="fas fa-search-minus"></i><h4>Tidak ada ayat cocok</h4><p>Coba kata kunci lain</p></div>`;
      return;
    }
    renderSearchResults(allResults, q);
    showToast(`Ditemukan ${allResults.length} ayat`, 'success');
  }

  function renderSearchResults(list, q) {
    const results = $('#verseSearchResults'); if (!results) return;
    const scope = $('input[name="vscope"]:checked')?.value || 'indonesia';
    const re = new RegExp('(' + escRx(q) + ')', 'gi');
    const hl = (txt) => esc(txt || '').replace(re, '<mark>$1</mark>');

    const frag = document.createDocumentFragment();
    list.forEach((r, i) => {
      const card = document.createElement('div');
      card.className = 'search-result-card';
      card.style.animationDelay = Math.min(i * 0.01, 0.4) + 's';
      card.innerHTML = `
        <div class="src-header">
          <span class="src-surah">QS. ${esc(r.surahName)}</span>
          <span class="src-ref">${r.surah}:${r.verse}</span>
        </div>
        <div class="src-arabic">${esc(r.arab || '')}</div>
        ${(scope === 'latin' || scope === 'all') ? `<div class="src-latin">${hl(r.latin)}</div>` : ''}
        <div class="src-trans">${hl(r.trans)}</div>`;
      card.addEventListener('click', () => {
        switchTab('baca');
        openSurah(r.surah, r.verse);
      });
      frag.appendChild(card);
    });
    results.innerHTML = '';
    results.appendChild(frag);
  }

  /* ═══ SETTINGS DRAWER ═══ */
  function bindSettingsDrawer() {
    const drawer = $('#readerSettingsDrawer'), overlay = $('#drawerOverlay');
    const openBtn = $('#readerSettingsBtn'), closeBtn = $('#drawerCloseBtn');
    if (!drawer || !overlay) return;
    const open = () => {
      drawer.classList.add('open'); overlay.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
    };
    const close = () => {
      drawer.classList.remove('open'); overlay.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
    };
    openBtn?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    overlay.addEventListener('click', close);

    const fs = $('#setFontSize'), fsv = $('#setFontSizeVal');
    fs?.addEventListener('input', () => {
      S.settings.fontSize = Number(fs.value);
      if (fsv) fsv.textContent = fs.value + 'px';
      applySettings(); saveSettings();
    });
    const lh = $('#setLineHeight'), lhv = $('#setLineHeightVal');
    lh?.addEventListener('input', () => {
      S.settings.lineHeight = Number(lh.value);
      if (lhv) lhv.textContent = lh.value;
      applySettings(); saveSettings();
    });
    const ls = $('#setLetterSpacing'), lsv = $('#setLetterSpacingVal');
    ls?.addEventListener('input', () => {
      S.settings.letterSpacing = Number(ls.value);
      if (lsv) lsv.textContent = ls.value;
      applySettings(); saveSettings();
    });
    $$('.rd-preset').forEach(b => b.addEventListener('click', () => {
      S.settings.fontSize = Number(b.dataset.size);
      applySettings(); saveSettings();
    }));
    $('#setFontFamily')?.addEventListener('change', (e) => {
      S.settings.fontFamily = e.target.value;
      applySettings(); saveSettings();
    });
    $('#setQari')?.addEventListener('change', (e) => {
      S.settings.qari = e.target.value;
      saveSettings();
      showToast('Qari: ' + QARI_NAMES[e.target.value], 'info');
    });
    $$('.rd-theme').forEach(b => b.addEventListener('click', () => {
      S.settings.theme = b.dataset.theme;
      lsSet(LS.THEME, b.dataset.theme);
      applySettings(); saveSettings();
    }));
    $('#setShowLatin')?.addEventListener('change', (e) => {
      S.settings.showLatin = e.target.checked;
      saveSettings();
      $$('.verse-latin').forEach(el => el.style.display = e.target.checked ? 'block' : 'none');
    });
    $('#setShowTrans')?.addEventListener('change', (e) => {
      S.settings.showTrans = e.target.checked;
      saveSettings();
      $$('.verse-trans').forEach(el => el.style.display = e.target.checked ? 'block' : 'none');
    });
    $('#setShowTafsir')?.addEventListener('change', (e) => {
      S.settings.showTafsir = e.target.checked;
      saveSettings();
      if (S.currentSurah) renderReader(S.currentSurah, S.currentVerse?.verse);
    });
    $('#setAutoplay')?.addEventListener('change', (e) => {
      S.settings.autoplay = e.target.checked;
      $('#qapAutoplay')?.classList.toggle('active', e.target.checked);
      saveSettings();
    });
    $('#setVibrate')?.addEventListener('change', (e) => {
      S.settings.vibrate = e.target.checked;
      saveSettings();
    });
    $('#setAutoScroll')?.addEventListener('change', (e) => {
      S.autoScroll = e.target.checked;
      saveSettings();
    });
    $('#savePosBtn')?.addEventListener('click', () => {
      if (!S.currentSurah) return;
      const cv = S.currentVerse || { verse: 1 };
      saveLastRead({ surah: S.currentSurah.nomor, surahName: S.currentSurah.namaLatin, verse: cv.verse, time: Date.now() });
      renderContinueReading();
      showToast('Posisi disimpan', 'success');
      close();
    });
    $('#resetSettingsBtn')?.addEventListener('click', () => {
      if (!confirm('Reset semua pengaturan?')) return;
      S.settings = {
        fontSize: 30, fontFamily: 'Amiri', qari: '05',
        showLatin: true, showTrans: true, showTafsir: false,
        autoplay: true, vibrate: true, theme: 'dark',
        speed: 1, volume: 1, repeat: false, lineHeight: 2.2, letterSpacing: 0
      };
      saveSettings(); applySettings();
      showToast('Pengaturan direset', 'success');
    });
  }

  /* ═══ TAFSIR ═══ */
  function populateTafsirSelect() {
    const sel = $('#tafsirSurahSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Pilih Surah --</option>' +
      S.surahs.map(s => `<option value="${s.nomor}">${s.nomor}. ${esc(s.namaLatin)}</option>`).join('');
    sel.addEventListener('change', () => {
      const n = Number(sel.value);
      if (n) loadTafsirTab(n);
      else $('#tafsirList').innerHTML = '';
    });
  }

  async function loadTafsirTab(nomor) {
    const list = $('#tafsirList');
    if (!list) return;
    list.innerHTML = '<div class="quran-no-results"><i class="fas fa-spinner fa-spin"></i><p>Memuat tafsir…</p></div>';
    try {
      const json = await safeFetch(API_BASE + '/tafsir/' + nomor);
      const data = json?.data;
      const tafsir = data?.tafsir || [];
      if (!tafsir.length) throw new Error('Tafsir kosong');
      list.innerHTML = tafsir.map((t, i) => `
        <div class="tafsir-item" style="animation-delay:${Math.min(i * 0.02, 0.4)}s">
          <div class="tafsir-item-head">QS. ${esc(data.namaLatin)} : ${t.ayat}</div>
          <div class="tafsir-item-arabic">${esc(t.teksArab || '')}</div>
          <div class="tafsir-item-text">${esc(t.teks || '').replace(/\n/g, '<br>')}</div>
        </div>`).join('');
    } catch (err) {
      console.warn('[Quran] tafsir error', err);
      list.innerHTML = '<div class="quran-no-results"><i class="fas fa-exclamation-triangle"></i><h4>Gagal memuat tafsir</h4><p>Coba lagi nanti</p></div>';
    }
  }

  // BUGFIX: bind listener sekali saja
  function bindTafsirModal() {
    const modal = $('#tafsirModal');
    if (!modal) return;
    $('#tafsirModalClose')?.addEventListener('click', closeTafsir);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeTafsir(); });
  }

  async function openTafsir(surahNomor, verseNum, ayat) {
    const modal = $('#tafsirModal');
    const title = $('#tafsirTitle');
    const body = $('#tafsirBody');
    if (!modal || !body) return;
    if (title) title.textContent = `Tafsir QS. ${S.currentSurah?.namaLatin || ''} : ${verseNum}`;
    body.innerHTML = '<p style="text-align:center;color:#888">Memuat tafsir…</p>';
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');

    try {
      let cache = S.tafsirCache[surahNomor];
      if (!cache) {
        const json = await safeFetch(API_BASE + '/tafsir/' + surahNomor);
        cache = json?.data?.tafsir || [];
        S.tafsirCache[surahNomor] = cache;
      }
      const t = cache.find(x => x.ayat === verseNum);
      if (!t) throw new Error('Tafsir tidak ditemukan');
      body.innerHTML = `
        <div style="font-family:'Amiri',serif;font-size:1.25rem;color:#D4B98C;direction:rtl;text-align:right;line-height:2;margin-bottom:14px;">${esc(t.teksArab || '')}</div>
        <div style="padding:12px;background:rgba(0,0,0,0.2);border-radius:10px;margin-bottom:14px;">${esc(ayat?.teksIndonesia || '')}</div>
        <div style="color:var(--text-secondary);font-size:0.9rem;line-height:1.85;">${esc(t.teks || '').replace(/\n/g, '<br>')}</div>`;
    } catch (err) {
      body.innerHTML = '<p style="color:#ff6584">Gagal memuat tafsir. Coba lagi.</p>';
    }
  }
  function closeTafsir() {
    const m = $('#tafsirModal');
    if (m) m.style.display = 'none';
    document.body.classList.remove('modal-open');
  }
  async function loadTafsirInline(surahNomor) {
    try {
      if (!S.tafsirCache[surahNomor]) {
        const json = await safeFetch(API_BASE + '/tafsir/' + surahNomor);
        S.tafsirCache[surahNomor] = json?.data?.tafsir || [];
      }
      $$('.verse-tafsir').forEach(el => {
        const v = Number(el.dataset.tafsirFor);
        const t = S.tafsirCache[surahNomor].find(x => x.ayat === v);
        el.innerHTML = t ? `<strong style="color:#4facfe">Tafsir:</strong><br>${esc(t.teks || '').replace(/\n/g, '<br>')}` : 'Tafsir tidak tersedia';
      });
    } catch (_) {}
  }

  /* ═══ DOA HARIAN ═══ */
  const DOA_DATA = [
    { cat:'tidur', icon:'fa-bed', title:'Sebelum Tidur', arabic:'بِسْمِكَ اللّٰهُمَّ اَمُوْتُ وَاَحْيَا', latin:"Bismikallāhumma amūtu wa aḥyā", arti:"Dengan nama-Mu ya Allah aku mati dan aku hidup.", ref:"HR. Bukhari" },
    { cat:'tidur', icon:'fa-sun', title:'Bangun Tidur', arabic:'اَلْحَمْدُ لِلّٰهِ الَّذِيْ اَحْيَانَا بَعْدَ مَا اَمَاتَنَا وَاِلَيْهِ النُّشُوْرُ', latin:"Alḥamdulillāhil-lażī aḥyānā ba'da mā amātanā wa ilaihin-nusyūr", arti:"Segala puji bagi Allah yang menghidupkan kami setelah mematikan kami, dan kepada-Nya kami dibangkitkan.", ref:"HR. Bukhari" },
    { cat:'makan', icon:'fa-utensils', title:'Sebelum Makan', arabic:'اَللّٰهُمَّ بَارِكْ لَنَا فِيْمَا رَزَقْتَنَا وَقِنَا عَذَابَ النَّارِ', latin:"Allāhumma bārik lanā fīmā razaqtanā wa qinā 'ażāban-nār", arti:"Ya Allah berkahilah kami pada rezeki yang Engkau berikan dan jagalah kami dari siksa api neraka.", ref:"HR. Ibnu Majah" },
    { cat:'makan', icon:'fa-hands', title:'Sesudah Makan', arabic:'اَلْحَمْدُ لِلّٰهِ الَّذِيْ اَطْعَمَنَا وَسَقَانَا وَجَعَلَنَا مُسْلِمِيْنَ', latin:"Alḥamdulillāhil-lażī aṭ'amanā wa saqānā wa ja'alanā muslimīn", arti:"Segala puji bagi Allah yang memberi kami makan dan minum serta menjadikan kami sebagai muslim.", ref:"HR. Tirmidzi" },
    { cat:'perjalanan', icon:'fa-door-open', title:'Keluar Rumah', arabic:'بِسْمِ اللّٰهِ تَوَكَّلْتُ عَلَى اللّٰهِ لَا حَوْلَ وَلَا قُوَّةَ اِلَّا بِاللّٰهِ', latin:"Bismillāhi tawakkaltu 'alallāhi lā ḥaula wa lā quwwata illā billāh", arti:"Dengan nama Allah, aku bertawakal kepada Allah. Tiada daya dan kekuatan kecuali dengan pertolongan Allah.", ref:"HR. Tirmidzi" },
    { cat:'perjalanan', icon:'fa-home', title:'Masuk Rumah', arabic:'بِسْمِ اللّٰهِ وَلَجْنَا وَبِسْمِ اللّٰهِ خَرَجْنَا وَعَلَى رَبِّنَا تَوَكَّلْنَا', latin:"Bismillāhi walajnā wa bismillāhi kharajnā wa 'alā rabbinā tawakkalnā", arti:"Dengan nama Allah kami masuk, dengan nama Allah kami keluar, dan kepada Tuhan kami, kami bertawakal.", ref:"HR. Abu Dawud" },
    { cat:'perjalanan', icon:'fa-plane', title:'Naik Kendaraan', arabic:'سُبْحَانَ الَّذِيْ سَخَّرَ لَنَا هٰذَا وَمَا كُنَّا لَهُ مُقْرِنِيْنَ', latin:"Subḥānal-lażī sakhkhara lanā hāżā wa mā kunnā lahū muqrinīn", arti:"Maha Suci Allah yang telah menundukkan ini untuk kami, dan kami tidak akan mampu menguasainya.", ref:"QS. Az-Zukhruf: 13" },
    { cat:'kesehatan', icon:'fa-heartbeat', title:'Menjenguk Orang Sakit', arabic:'اَسْاَلُ اللّٰهَ الْعَظِيْمَ رَبَّ الْعَرْشِ الْعَظِيْمِ اَنْ يَشْفِيَكَ', latin:"As'alullāhal-'aẓīma rabbal-'arsyil-'aẓīmi an yasyfiyak", arti:"Aku memohon kepada Allah yang Maha Agung, Tuhan Arsy yang Agung, agar menyembuhkanmu.", ref:"HR. Tirmidzi" },
    { cat:'kesehatan', icon:'fa-sad-tear', title:'Ketika Sedih', arabic:'لَا اِلٰهَ اِلَّا اللّٰهُ الْعَظِيْمُ الْحَلِيْمُ', latin:"Lā ilāha illallāhul-'aẓīmul-ḥalīm", arti:"Tiada Tuhan selain Allah yang Maha Agung dan Maha Penyantun.", ref:"HR. Bukhari" },
    { cat:'perlindungan', icon:'fa-cloud-rain', title:'Turun Hujan', arabic:'اَللّٰهُمَّ صَيِّبًا نَافِعًا', latin:"Allāhumma ṣayyiban nāfi'ā", arti:"Ya Allah, turunkanlah hujan yang bermanfaat.", ref:"HR. Bukhari" },
    { cat:'ibadah', icon:'fa-book-quran', title:'Sebelum Baca Qur\'an', arabic:'اَعُوْذُ بِاللّٰهِ مِنَ الشَّيْطَانِ الرَّجِيْمِ', latin:"A'ūżu billāhi minasy-syaiṭānir-rajīm", arti:"Aku berlindung kepada Allah dari setan yang terkutuk.", ref:"QS. An-Nahl: 98" },
    { cat:'ibadah', icon:'fa-graduation-cap', title:'Sebelum Belajar', arabic:'رَبِّ زِدْنِيْ عِلْمًا وَارْزُقْنِيْ فَهْمًا', latin:"Rabbi zidnī 'ilman warzuqnī fahmā", arti:"Tuhanku, tambahkanlah ilmu kepadaku dan berikanlah aku pemahaman.", ref:"QS. Thaha: 114" },
    { cat:'ibadah', icon:'fa-hands-praying', title:'Setelah Sholat', arabic:'اَسْتَغْفِرُ اللّٰهَ الْعَظِيْمَ', latin:"Astaghfirullāhal-'aẓīm", arti:"Aku memohon ampun kepada Allah yang Maha Agung.", ref:"HR. Muslim" },
    { cat:'ibadah', icon:'fa-moon', title:'Malam Lailatul Qadar', arabic:'اَللّٰهُمَّ اِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّيْ', latin:"Allāhumma innaka 'afuwwun tuḥibbul-'afwa fa'fu 'annī", arti:"Ya Allah, Engkau Maha Pengampun dan mencintai ampunan, maka ampunilah aku.", ref:"HR. Tirmidzi" },
    { cat:'ibadah', icon:'fa-star', title:'Kebaikan Dunia Akhirat', arabic:'رَبَّنَا اٰتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْاٰخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ', latin:"Rabbanā ātinā fid-dun-yā ḥasanataw wa fil-ākhirati ḥasanataw wa qinā 'ażāban-nār", arti:"Tuhan kami, berikanlah kepada kami kebaikan di dunia dan kebaikan di akhirat, dan lindungilah kami dari azab neraka.", ref:"QS. Al-Baqarah: 201" },
    { cat:'perlindungan', icon:'fa-user-shield', title:'Doa Perlindungan', arabic:'بِسْمِ اللّٰهِ الَّذِيْ لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْاَرْضِ وَلَا فِي السَّمَاءِ', latin:"Bismillāhil-lażī lā yaḍurru ma'asmihī syai'un fil-arḍi wa lā fis-samā'", arti:"Dengan nama Allah yang tidak ada sesuatu pun membahayakan bersama nama-Nya, baik di bumi maupun di langit.", ref:"HR. Abu Dawud" },
    { cat:'ibadah', icon:'fa-wind', title:'Ketika Bersin', arabic:'اَلْحَمْدُ لِلّٰهِ', latin:"Alḥamdulillāh", arti:"Segala puji bagi Allah.", ref:"HR. Bukhari" },
    { cat:'keluarga', icon:'fa-ring', title:'Doa untuk Pengantin', arabic:'بَارَكَ اللّٰهُ لَكَ وَبَارَكَ عَلَيْكَ وَجَمَعَ بَيْنَكُمَا فِيْ خَيْرٍ', latin:"Bārakallāhu laka wa bāraka 'alaika wa jama'a bainakumā fī khair", arti:"Semoga Allah memberkahimu, dan memberkahi atasmu, dan mengumpulkan kalian berdua dalam kebaikan.", ref:"HR. Abu Dawud" },
    { cat:'keluarga', icon:'fa-child', title:'Doa untuk Anak', arabic:'رَبِّ هَبْ لِيْ مِنَ الصَّالِحِيْنَ', latin:"Rabbi hab lī minaṣ-ṣāliḥīn", arti:"Tuhanku, anugerahkanlah kepadaku (seorang anak) yang termasuk orang-orang saleh.", ref:"QS. As-Saffat: 100" },
    { cat:'rezeki', icon:'fa-hand-holding-heart', title:'Doa Rezeki', arabic:'اَللّٰهُمَّ اكْفِنِيْ بِحَلَالِكَ عَنْ حَرَامِكَ وَاَغْنِنِيْ بِفَضْلِكَ عَمَّنْ سِوَاكَ', latin:"Allāhummakfinī biḥalālika 'an ḥarāmika wa agninī bifaḍlika 'amman siwāk", arti:"Ya Allah cukupkanlah aku dengan yang halal dan jauhkan yang haram, serta kayakanlah aku dengan karunia-Mu dari bergantung pada selain-Mu.", ref:"HR. Tirmidzi" },
    { cat:'ibadah', icon:'fa-book-open', title:'Sebelum Wudhu', arabic:'بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ', latin:"Bismillāhir-raḥmānir-raḥīm", arti:"Dengan nama Allah yang Maha Pengasih, Maha Penyayang.", ref:"HR. Muslim" },
    { cat:'perjalanan', icon:'fa-door-closed', title:'Keluar Toilet', arabic:'غُفْرَانَكَ', latin:"Gufrānak", arti:"Aku memohon ampunan-Mu (ya Allah).", ref:"HR. Abu Dawud" },
    { cat:'perjalanan', icon:'fa-toilet', title:'Masuk Toilet', arabic:'اَللّٰهُمَّ اِنِّيْ اَعُوْذُ بِكَ مِنَ الْخُبُثِ وَالْخَبَائِثِ', latin:"Allāhumma innī a'ūżu bika minal-khubuṡi wal-khabā'iṡ", arti:"Ya Allah, aku berlindung kepada-Mu dari setan jantan dan betina.", ref:"HR. Bukhari" },
    { cat:'ibadah', icon:'fa-mosque', title:'Masuk Masjid', arabic:'اَللّٰهُمَّ افْتَحْ لِيْ اَبْوَابَ رَحْمَتِكَ', latin:"Allāhummaftaḥ lī abwāba raḥmatik", arti:"Ya Allah, bukakanlah untukku pintu-pintu rahmat-Mu.", ref:"HR. Muslim" }
  ];

  const DOA_CATS = [
    { id: 'all', label: 'Semua' },
    { id: 'ibadah', label: 'Ibadah' },
    { id: 'makan', label: 'Makan' },
    { id: 'tidur', label: 'Tidur' },
    { id: 'perjalanan', label: 'Perjalanan' },
    { id: 'kesehatan', label: 'Kesehatan' },
    { id: 'keluarga', label: 'Keluarga' },
    { id: 'rezeki', label: 'Rezeki' },
    { id: 'perlindungan', label: 'Perlindungan' }
  ];

  function renderDoaCats() {
    const row = $('#doaCatRow'); if (!row) return;
    row.innerHTML = DOA_CATS.map(c =>
      `<button class="doa-cat ${c.id === S.doaCategory ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>`
    ).join('');
    row.querySelectorAll('.doa-cat').forEach(b => b.addEventListener('click', () => {
      S.doaCategory = b.dataset.cat;
      renderDoaCats();
      renderDoa();
    }));
  }

  function renderDoa() {
    const grid = $('#doaGrid'); if (!grid) return;
    renderDoaCats();
    let list = DOA_DATA;
    if (S.doaCategory !== 'all') list = list.filter(d => d.cat === S.doaCategory);
    const q = ($('#doaSearchInput')?.value || '').trim().toLowerCase();
    if (q) list = list.filter(d =>
      d.title.toLowerCase().includes(q) || d.arti.toLowerCase().includes(q) || d.latin.toLowerCase().includes(q)
    );
    if (!list.length) {
      grid.innerHTML = '<div class="quran-no-results" style="grid-column:1/-1;"><i class="fas fa-search"></i><h4>Tidak ditemukan</h4></div>';
      return;
    }
    grid.innerHTML = list.map((d) => {
      const isFav = S.doaFav.includes(d.title);
      return `
        <div class="doa-card">
          <div class="doa-card-head">
            <div class="doa-card-icon"><i class="fas ${d.icon}"></i></div>
            <h4 class="doa-card-title">${esc(d.title)}</h4>
            <button class="doa-fav-btn ${isFav ? 'active' : ''}" data-fav="${esc(d.title)}" aria-label="Favorit"><i class="fas fa-heart"></i></button>
          </div>
          <div class="doa-card-arabic">${esc(d.arabic)}</div>
          <div class="doa-card-latin">${esc(d.latin)}</div>
          <div class="doa-card-trans">${esc(d.arti)}</div>
          <div class="doa-card-ref">📖 ${esc(d.ref)}</div>
        </div>`;
    }).join('');
    grid.querySelectorAll('[data-fav]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = btn.dataset.fav;
        const i = S.doaFav.indexOf(t);
        if (i >= 0) S.doaFav.splice(i, 1); else S.doaFav.push(t);
        saveDoaFav();
        btn.classList.toggle('active');
      });
    });
  }
  function bindDoaSearch() {
    const inp = $('#doaSearchInput'); if (!inp) return;
    inp.addEventListener('input', debounce(renderDoa, 180));
  }

  /* ═══ ASMAUL HUSNA ═══ */
  const ASMAUL = [
    { ar:'الرَّحْمَنُ', n:'Ar-Rahman', a:'Yang Maha Pengasih' },
    { ar:'الرَّحِيْمُ', n:'Ar-Rahim', a:'Yang Maha Penyayang' },
    { ar:'الْمَلِكُ', n:'Al-Malik', a:'Yang Maha Merajai' },
    { ar:'الْقُدُّوْسُ', n:'Al-Quddus', a:'Yang Maha Suci' },
    { ar:'السَّلَامُ', n:'As-Salam', a:'Yang Maha Memberi Kesejahteraan' },
    { ar:'الْمُؤْمِنُ', n:'Al-Mu\'min', a:'Yang Maha Memberi Keamanan' },
    { ar:'الْمُهَيْمِنُ', n:'Al-Muhaimin', a:'Yang Maha Mengatur' },
    { ar:'الْعَزِيْزُ', n:'Al-\'Aziz', a:'Yang Maha Perkasa' },
    { ar:'الْجَبَّارُ', n:'Al-Jabbar', a:'Yang Memiliki Mutlak Kegagahan' },
    { ar:'الْمُتَكَبِّرُ', n:'Al-Mutakabbir', a:'Yang Maha Megah' },
    { ar:'الْخَالِقُ', n:'Al-Khaliq', a:'Yang Maha Pencipta' },
    { ar:'الْبَارِئُ', n:'Al-Bari\'', a:'Yang Maha Melepaskan' },
    { ar:'الْمُصَوِّرُ', n:'Al-Mushawwir', a:'Yang Maha Membentuk Rupa' },
    { ar:'الْغَفَّارُ', n:'Al-Ghaffar', a:'Yang Maha Pengampun' },
    { ar:'الْقَهَّارُ', n:'Al-Qahhar', a:'Yang Maha Memaksa' },
    { ar:'الْوَهَّابُ', n:'Al-Wahhab', a:'Yang Maha Pemberi Karunia' },
    { ar:'الرَّزَّاقُ', n:'Ar-Razzaq', a:'Yang Maha Pemberi Rezeki' },
    { ar:'الْفَتَّاحُ', n:'Al-Fattah', a:'Yang Maha Pembuka Rahmat' },
    { ar:'الْعَلِيْمُ', n:'Al-\'Alim', a:'Yang Maha Mengetahui' },
    { ar:'الْقَابِضُ', n:'Al-Qabidh', a:'Yang Maha Menyempitkan' },
    { ar:'الْبَاسِطُ', n:'Al-Basith', a:'Yang Maha Melapangkan' },
    { ar:'الْخَافِضُ', n:'Al-Khafidh', a:'Yang Maha Merendahkan' },
    { ar:'الرَّافِعُ', n:'Ar-Rafi\'', a:'Yang Maha Meninggikan' },
    { ar:'الْمُعِزُّ', n:'Al-Mu\'izz', a:'Yang Maha Memuliakan' },
    { ar:'الْمُذِلُّ', n:'Al-Mudzill', a:'Yang Maha Menghinakan' },
    { ar:'السَّمِيْعُ', n:'As-Sami\'', a:'Yang Maha Mendengar' },
    { ar:'الْبَصِيْرُ', n:'Al-Bashir', a:'Yang Maha Melihat' },
    { ar:'الْحَكَمُ', n:'Al-Hakam', a:'Yang Maha Menetapkan' },
    { ar:'الْعَدْلُ', n:'Al-\'Adl', a:'Yang Maha Adil' },
    { ar:'اللَّطِيْفُ', n:'Al-Lathif', a:'Yang Maha Lembut' },
    { ar:'الْخَبِيْرُ', n:'Al-Khabir', a:'Yang Maha Mengenal' },
    { ar:'الْحَلِيْمُ', n:'Al-Halim', a:'Yang Maha Penyantun' },
    { ar:'الْعَظِيْمُ', n:'Al-\'Azhim', a:'Yang Maha Agung' },
    { ar:'الْغَفُوْرُ', n:'Al-Ghafur', a:'Yang Maha Pengampun' },
    { ar:'الشَّكُوْرُ', n:'Asy-Syakur', a:'Yang Maha Pembalas Budi' },
    { ar:'الْعَلِيُّ', n:'Al-\'Aliy', a:'Yang Maha Tinggi' },
    { ar:'الْكَبِيْرُ', n:'Al-Kabir', a:'Yang Maha Besar' },
    { ar:'الْحَفِيْظُ', n:'Al-Hafizh', a:'Yang Maha Memelihara' },
    { ar:'الْمُقِيْتُ', n:'Al-Muqit', a:'Yang Maha Pemberi Kecukupan' },
    { ar:'الْحَسِيْبُ', n:'Al-Hasib', a:'Yang Maha Membuat Perhitungan' },
    { ar:'الْجَلِيْلُ', n:'Al-Jalil', a:'Yang Maha Luhur' },
    { ar:'الْكَرِيْمُ', n:'Al-Karim', a:'Yang Maha Pemurah' },
    { ar:'الرَّقِيْبُ', n:'Ar-Raqib', a:'Yang Maha Mengawasi' },
    { ar:'الْمُجِيْبُ', n:'Al-Mujib', a:'Yang Maha Mengabulkan' },
    { ar:'الْوَاسِعُ', n:'Al-Wasi\'', a:'Yang Maha Luas' },
    { ar:'الْحَكِيْمُ', n:'Al-Hakim', a:'Yang Maha Bijaksana' },
    { ar:'الْوَدُوْدُ', n:'Al-Wadud', a:'Yang Maha Mengasihi' },
    { ar:'الْمَجِيْدُ', n:'Al-Majid', a:'Yang Maha Mulia' },
    { ar:'الْبَاعِثُ', n:'Al-Ba\'its', a:'Yang Maha Membangkitkan' },
    { ar:'الشَّهِيْدُ', n:'Asy-Syahid', a:'Yang Maha Menyaksikan' },
    { ar:'الْحَقُّ', n:'Al-Haqq', a:'Yang Maha Benar' },
    { ar:'الْوَكِيْلُ', n:'Al-Wakil', a:'Yang Maha Memelihara' },
    { ar:'الْقَوِيُّ', n:'Al-Qawiy', a:'Yang Maha Kuat' },
    { ar:'الْمَتِيْنُ', n:'Al-Matin', a:'Yang Maha Kokoh' },
    { ar:'الْوَلِيُّ', n:'Al-Waliy', a:'Yang Maha Melindungi' },
    { ar:'الْحَمِيْدُ', n:'Al-Hamid', a:'Yang Maha Terpuji' },
    { ar:'الْمُحْصِيْ', n:'Al-Muhshi', a:'Yang Maha Menghitung' },
    { ar:'الْمُبْدِئُ', n:'Al-Mubdi\'', a:'Yang Maha Memulai' },
    { ar:'الْمُعِيْدُ', n:'Al-Mu\'id', a:'Yang Maha Mengembalikan' },
    { ar:'الْمُحْيِيْ', n:'Al-Muhyi', a:'Yang Maha Menghidupkan' },
    { ar:'الْمُمِيْتُ', n:'Al-Mumit', a:'Yang Maha Mematikan' },
    { ar:'الْحَيُّ', n:'Al-Hayy', a:'Yang Maha Hidup' },
    { ar:'الْقَيُّوْمُ', n:'Al-Qayyum', a:'Yang Maha Mandiri' },
    { ar:'الْوَاجِدُ', n:'Al-Wajid', a:'Yang Maha Penemu' },
    { ar:'الْمَاجِدُ', n:'Al-Majid', a:'Yang Maha Mulia' },
    { ar:'الْوَاحِدُ', n:'Al-Wahid', a:'Yang Maha Tunggal' },
    { ar:'الْاَحَدُ', n:'Al-Ahad', a:'Yang Maha Esa' },
    { ar:'الصَّمَدُ', n:'Ash-Shamad', a:'Yang Maha Dibutuhkan' },
    { ar:'الْقَادِرُ', n:'Al-Qadir', a:'Yang Maha Menentukan' },
    { ar:'الْمُقْتَدِرُ', n:'Al-Muqtadir', a:'Yang Maha Berkuasa' },
    { ar:'الْمُقَدِّمُ', n:'Al-Muqaddim', a:'Yang Maha Mendahulukan' },
    { ar:'الْمُؤَخِّرُ', n:'Al-Mu\'akhkhir', a:'Yang Maha Mengakhirkan' },
    { ar:'الْاَوَّلُ', n:'Al-Awwal', a:'Yang Maha Awal' },
    { ar:'الْاٰخِرُ', n:'Al-Akhir', a:'Yang Maha Akhir' },
    { ar:'الظَّاهِرُ', n:'Azh-Zhahir', a:'Yang Maha Nyata' },
    { ar:'الْبَاطِنُ', n:'Al-Bathin', a:'Yang Maha Ghaib' },
    { ar:'الْوَالِيْ', n:'Al-Wali', a:'Yang Maha Memerintah' },
    { ar:'الْمُتَعَالِيْ', n:'Al-Muta\'ali', a:'Yang Maha Tinggi' },
    { ar:'الْبَرُّ', n:'Al-Barr', a:'Yang Maha Penderma' },
    { ar:'التَّوَّابُ', n:'At-Tawwab', a:'Yang Maha Penerima Taubat' },
    { ar:'الْمُنْتَقِمُ', n:'Al-Muntaqim', a:'Yang Maha Pemberi Balasan' },
    { ar:'الْعَفُوُّ', n:'Al-\'Afuww', a:'Yang Maha Pengampun' },
    { ar:'الرَّءُوْفُ', n:'Ar-Ra\'uf', a:'Yang Maha Pengasih' },
    { ar:'مَالِكُ الْمُلْكِ', n:'Malikul Mulk', a:'Penguasa Kerajaan' },
    { ar:'ذُو الْجَلَالِ وَالْاِكْرَامِ', n:'Dzul Jalali wal Ikram', a:'Yang Maha Pemilik Kebesaran dan Kemuliaan' },
    { ar:'الْمُقْسِطُ', n:'Al-Muqsith', a:'Yang Maha Adil' },
    { ar:'الْجَامِعُ', n:'Al-Jami\'', a:'Yang Maha Mengumpulkan' },
    { ar:'الْغَنِيُّ', n:'Al-Ghaniy', a:'Yang Maha Kaya' },
    { ar:'الْمُغْنِيْ', n:'Al-Mughni', a:'Yang Maha Pemberi Kekayaan' },
    { ar:'الْمَانِعُ', n:'Al-Mani\'', a:'Yang Maha Mencegah' },
    { ar:'الضَّارُّ', n:'Adh-Dharr', a:'Yang Maha Penimpa Kemudaratan' },
    { ar:'النَّافِعُ', n:'An-Nafi\'', a:'Yang Maha Pemberi Manfaat' },
    { ar:'النُّوْرُ', n:'An-Nur', a:'Yang Maha Bercahaya' },
    { ar:'الْهَادِيْ', n:'Al-Hadi', a:'Yang Maha Pemberi Petunjuk' },
    { ar:'الْبَدِيْعُ', n:'Al-Badi\'', a:'Yang Maha Pencipta' },
    { ar:'الْبَاقِيْ', n:'Al-Baqi', a:'Yang Maha Kekal' },
    { ar:'الْوَارِثُ', n:'Al-Warits', a:'Yang Maha Pewaris' },
    { ar:'الرَّشِيْدُ', n:'Ar-Rasyid', a:'Yang Maha Pandai' },
    { ar:'الصَّبُوْرُ', n:'Ash-Shabur', a:'Yang Maha Sabar' }
  ];

  function renderAsmaul() {
    const grid = $('#asmaulGrid'); if (!grid) return;
    grid.innerHTML = ASMAUL.map((a, i) => `
      <div class="asmaul-card" style="animation-delay:${Math.min(i * 0.008, 0.5)}s">
        <div class="asmaul-num">${i + 1}</div>
        <div class="asmaul-arabic">${esc(a.ar)}</div>
        <div class="asmaul-latin">${esc(a.n)}</div>
        <div class="asmaul-arti">${esc(a.a)}</div>
      </div>`).join('');
  }
  function bindAsmaulSearch() {
    const inp = $('#asmaulSearchInput'); if (!inp) return;
    inp.addEventListener('input', debounce(() => {
      const q = inp.value.trim().toLowerCase();
      const filtered = !q ? ASMAUL : ASMAUL.filter(a =>
        a.n.toLowerCase().includes(q) || a.a.toLowerCase().includes(q)
      );
      const grid = $('#asmaulGrid'); if (!grid) return;
      if (!filtered.length) {
        grid.innerHTML = '<div class="quran-no-results" style="grid-column:1/-1;"><i class="fas fa-search"></i><h4>Tidak ditemukan</h4></div>';
        return;
      }
      grid.innerHTML = filtered.map((a) => `
        <div class="asmaul-card">
          <div class="asmaul-num">${ASMAUL.indexOf(a) + 1}</div>
          <div class="asmaul-arabic">${esc(a.ar)}</div>
          <div class="asmaul-latin">${esc(a.n)}</div>
          <div class="asmaul-arti">${esc(a.a)}</div>
        </div>`).join('');
    }, 180));
  }

  /* ═══ TASBIH ═══ */
  function bindTasbih() {
    const btn = $('#tasbihBtn'), reset = $('#tasbihReset');
    const targetSel = $('#tasbihTarget');
    const dhikrs = $$('.tasbih-dhikr');
    updateTasbihUI();

    btn?.addEventListener('click', () => {
      S.tasbih.count++;
      if (S.settings.vibrate && navigator.vibrate) navigator.vibrate(15);
      btn.classList.add('pulse');
      setTimeout(() => btn.classList.remove('pulse'), 400);
      if (S.tasbih.count === S.tasbih.target && navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 100]);
        showToast('Target tercapai! 🎉', 'success');
      }
      saveTasbih();
      updateTasbihUI();
    });
    reset?.addEventListener('click', () => {
      S.tasbih.count = 0;
      saveTasbih(); updateTasbihUI();
    });
    targetSel?.addEventListener('change', () => {
      S.tasbih.target = Number(targetSel.value);
      saveTasbih(); updateTasbihUI();
    });
    dhikrs.forEach(d => d.addEventListener('click', () => {
      dhikrs.forEach(x => x.classList.remove('active'));
      d.classList.add('active');
      S.tasbih.dhikr = d.dataset.dhikr;
      saveTasbih();
    }));
    if (targetSel) targetSel.value = S.tasbih.target;
    dhikrs.forEach(x => x.classList.toggle('active', x.dataset.dhikr === S.tasbih.dhikr));
  }
  function updateTasbihUI() {
    setText('#tasbihCount', S.tasbih.count);
    const pct = Math.min((S.tasbih.count / S.tasbih.target) * 100, 100);
    const fill = $('#tasbihFill'); if (fill) fill.style.width = pct + '%';
    const remaining = Math.max(S.tasbih.target - S.tasbih.count, 0);
    setText('#tasbihHint', `Target: ${S.tasbih.target} · Sisa: ${remaining}`);
  }

  /* ═══ STATISTIK ═══ */
  function renderStats() {
    const grid = $('#statGrid'); if (!grid) return;
    const today = new Date().toISOString().slice(0, 10);
    const todayVerses = S.stats.lastDate === today ? S.stats.todayVerses : 0;
    grid.innerHTML = `
      <div class="stat-card">
        <i class="fas fa-fire stat-icon"></i>
        <div class="stat-value">${S.stats.streak}</div>
        <div class="stat-label">Hari Beruntun</div>
      </div>
      <div class="stat-card">
        <i class="fas fa-book-open stat-icon"></i>
        <div class="stat-value">${S.stats.totalVerses}</div>
        <div class="stat-label">Total Ayat Dibaca</div>
      </div>
      <div class="stat-card">
        <i class="fas fa-calendar-day stat-icon"></i>
        <div class="stat-value">${todayVerses}</div>
        <div class="stat-label">Ayat Hari Ini</div>
      </div>
      <div class="stat-card">
        <i class="fas fa-bookmark stat-icon"></i>
        <div class="stat-value">${S.bookmarks.length}</div>
        <div class="stat-label">Bookmark</div>
      </div>
      <div class="stat-card">
        <i class="fas fa-circle-notch stat-icon"></i>
        <div class="stat-value">${S.tasbih.count}</div>
        <div class="stat-label">Total Dzikir Sesi Ini</div>
      </div>
      <div class="stat-card">
        <i class="fas fa-heart stat-icon"></i>
        <div class="stat-value">${S.doaFav.length}</div>
        <div class="stat-label">Doa Favorit</div>
      </div>`;
  }

  /* ═══ DAILY VERSE ═══ */
  async function renderDailyVerse() {
    const card = $('#dailyVerseCard'); if (!card) return;
    const today = new Date();
    const dateKey = today.toISOString().slice(0, 10);
    const stored = lsGet(LS.DAILY, null);
    if (stored && stored.date === dateKey) {
      renderDailyVerseCard(stored);
      return;
    }
    const hash = dateKey.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const surahN = (hash % 114) + 1;
    try {
      let data = S.surahCache[surahN];
      if (!data) {
        const json = await safeFetch(API_BASE + '/surat/' + surahN);
        data = json?.data;
        if (data) S.surahCache[surahN] = data;
      }
      if (!data) return;
      const verseIdx = (hash * 7) % data.jumlahAyat;
      const a = data.ayat[verseIdx];
      const payload = {
        date: dateKey, surah: surahN, verse: a.nomorAyat,
        surahName: data.namaLatin,
        arab: a.teksArab, latin: a.teksLatin, trans: a.teksIndonesia
      };
      lsSet(LS.DAILY, payload);
      renderDailyVerseCard(payload);
    } catch (err) { console.warn('[Quran] daily verse error', err); }
  }
  function renderDailyVerseCard(d) {
    const card = $('#dailyVerseCard'); if (!card) return;
    card.style.display = 'flex';
    setText('#dvDate', new Date(d.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }));
    setText('#dvArabic', d.arab);
    setText('#dvLatin', d.latin);
    setText('#dvTrans', d.trans);
    setText('#dvRef', `QS. ${d.surahName} : ${d.verse}`);
  }
  function bindDailyVerse() {
    $('#dvOpenBtn')?.addEventListener('click', () => {
      const stored = lsGet(LS.DAILY, null);
      if (stored) { switchTab('baca'); openSurah(stored.surah, stored.verse); }
    });
    $('#dvCardBtn')?.addEventListener('click', () => {
      const d = lsGet(LS.DAILY, null);
      if (d) generateCard(d.surah, d.surahName, { teksArab: d.arab, teksIndonesia: d.trans, nomorAyat: d.verse, teksLatin: d.latin });
    });
  }

  /* ═══ KARTU AYAT (Canvas) ═══ */
  function bindCardModal() {
    const modal = $('#cardModal');
    if (!modal) return;
    $('#cardModalClose')?.addEventListener('click', () => {
      modal.style.display = 'none';
      document.body.classList.remove('modal-open');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.style.display = 'none'; document.body.classList.remove('modal-open'); }
    });
    $('#cardDownloadBtn')?.addEventListener('click', () => {
      const canvas = $('#cardCanvas');
      if (!canvas) return;
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `ayat-${Date.now()}.png`;
      a.click();
      showToast('Kartu diunduh', 'success');
    });
    $('#cardShareBtn')?.addEventListener('click', async () => {
      const canvas = $('#cardCanvas');
      if (!canvas) return;
      try {
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const file = new File([blob], 'ayat.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Ayat Al-Qur\'an' });
        } else {
          showToast('Share tidak didukung, download manual', 'info');
        }
      } catch (_) { showToast('Gagal membagikan', 'error'); }
    });
  }

  function generateCard(surahNum, surahName, ayat) {
    const modal = $('#cardModal');
    const canvas = $('#cardCanvas');
    if (!modal || !canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 1080, H = 1080;
    // Background gradient
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#0a0a1a');
    g.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Gold border
    ctx.strokeStyle = '#C9A96E';
    ctx.lineWidth = 6;
    ctx.strokeRect(30, 30, W - 60, H - 60);
    // Ornament circle
    ctx.beginPath();
    ctx.arc(W / 2, 200, 60, 0, Math.PI * 2);
    ctx.fillStyle = '#C9A96E';
    ctx.fill();
    ctx.font = 'bold 60px serif';
    ctx.fillStyle = '#1a1a2e';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☾', W / 2, 200);

    // Arabic text (wrap)
    ctx.font = '48px "Amiri", serif';
    ctx.fillStyle = '#D4B98C';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    const arabic = ayat.teksArab || '';
    const words = arabic.split(/\s+/);
    let line = '', y = 320;
    const maxWidth = W - 200;
    ctx.direction = 'rtl';
    for (const w of words) {
      const test = line + ' ' + w;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line.trim(), W - 100, y);
        line = w;
        y += 80;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line.trim(), W - 100, y);
    y += 110;

    // Translation
    ctx.direction = 'ltr';
    ctx.font = '32px "Inter", sans-serif';
    ctx.fillStyle = '#b0b0b0';
    ctx.textAlign = 'center';
    const trans = `"${ayat.teksIndonesia || ''}"`;
    const wordsT = trans.split(/\s+/);
    line = '';
    const maxW2 = W - 200;
    for (const w of wordsT) {
      const test = line + ' ' + w;
      if (ctx.measureText(test).width > maxW2 && line) {
        ctx.fillText(line.trim(), W / 2, y);
        line = w;
        y += 45;
      } else { line = test; }
    }
    if (line) ctx.fillText(line.trim(), W / 2, y);
    y += 80;

    // Reference
    ctx.font = 'bold 32px "Inter", sans-serif';
    ctx.fillStyle = '#C9A96E';
    ctx.fillText(`QS. ${surahName} : ${ayat.nomorAyat}`, W / 2, y);
    y += 70;

    // Watermark
    ctx.font = '24px "Inter", sans-serif';
    ctx.fillStyle = 'rgba(201,169,110,0.5)';
    ctx.fillText('— IRGXYMODS Al-Qur\'an Digital —', W / 2, H - 80);

    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
  }

  /* ═══ STATIC CONTENT ═══ */
  const TAJWID = [
    { icon:'fa-volume-up', sub:'Nun mati / Tanwin', title:'Idzhar Halqi', desc:'Nun mati/tanwin bertemu huruf halqi (ء ه ع ح غ خ) → dibaca JELAS tanpa dengung.', example:'مَنْ اٰمَنَ', hint:'Baca jelas: "man aamana"' },
    { icon:'fa-wave-square', sub:'Nun mati / Tanwin', title:'Idgham Bighunnah', desc:'Nun mati/tanwin bertemu ي ن م و → melebur + dengung 2 harakat.', example:'مَنْ يَّعْمَلْ', hint:'Melebur + dengung' },
    { icon:'fa-minus', sub:'Nun mati / Tanwin', title:'Idgham Bilaghunnah', desc:'Nun mati/tanwin bertemu ل ر → melebur tanpa dengung.', example:'مِنْ رَّبِّهِمْ', hint:'Melebur tanpa dengung' },
    { icon:'fa-exchange-alt', sub:'Nun mati / Tanwin', title:'Iqlab', desc:'Nun mati/tanwin bertemu ب → berubah jadi mim + dengung.', example:'مِنْ بَعْدِ', hint:'Berubah jadi mim' },
    { icon:'fa-eye-slash', sub:'Nun mati / Tanwin', title:'Ikhfa Haqiqi', desc:'Nun mati/tanwin bertemu 15 huruf ikhfa → dibaca samar + dengung.', example:'مِنْ قَبْلِ', hint:'Samar + dengung' },
    { icon:'fa-circle-notch', sub:'Qalqalah', title:'Qalqalah Sughra', desc:'Huruf ق ط ب ج د bersukun di tengah kata → memantul ringan.', example:'يَجْعَلُوْنَ', hint:'Memantul ringan' },
    { icon:'fa-circle', sub:'Qalqalah', title:'Qalqalah Kubra', desc:'Huruf qalqalah di akhir kata (waqaf) → memantul kuat.', example:'قُلْ اَعُوْذُ', hint:'Memantul kuat' },
    { icon:'fa-arrows-alt-h', sub:'Mad', title:"Mad Thabi'i", desc:'Alif setelah fathah, ya setelah kasrah, wau setelah dhammah → 2 harakat.', example:'قَالَ - قِيْلَ - يَقُوْلُ', hint:'2 harakat' },
    { icon:'fa-arrows-alt-h', sub:'Mad', title:'Mad Wajib Muttashil', desc:"Mad thabi'i bertemu hamzah 1 kata → wajib 4-5 harakat.", example:'جَاءَ', hint:'4-5 harakat' },
    { icon:'fa-arrows-alt-h', sub:'Mad', title:'Mad Jaiz Munfashil', desc:"Mad thabi'i bertemu hamzah beda kata → 2-5 harakat.", example:'بِمَآ اُنْزِلَ', hint:'2-5 harakat' },
    { icon:'fa-arrows-alt-h', sub:'Mad', title:'Mad Lazim', desc:"Mad thabi'i bertemu sukun/tasydid → wajib 6 harakat.", example:'الضَّآلِّيْنَ', hint:'6 harakat' },
    { icon:'fa-arrows-alt-h', sub:'Mad', title:"Mad 'Aridh Lissukun", desc:"Mad thabi'i di akhir ayat, diwaqafkan → 2/4/6 harakat.", example:'الرَّحِيْمِ', hint:'2-6 harakat' },
    { icon:'fa-arrows-alt-h', sub:'Mad', title:'Mad Shilah Qashirah', desc:'Ha dhamir (ه) tidak bertemu hamzah → 2 harakat.', example:'بِهِ - لَهُ', hint:'2 harakat' },
    { icon:'fa-wave-square', sub:'Ghunnah', title:'Ghunnah Musyaddadah', desc:'Nun/mim bertasydid → wajib dengung 2 harakat.', example:'اِنَّ - ثُمَّ', hint:'Dengung kuat' },
    { icon:'fa-eye-slash', sub:'Mim sukun', title:'Ikhfa Syafawi', desc:'Mim sukun bertemu ب → samar di bibir + dengung.', example:'تَرْمِيْهِمْ بِحِجَارَةٍ', hint:'Samar di bibir' },
    { icon:'fa-compress-arrows-alt', sub:'Mim sukun', title:'Idgham Mimi', desc:'Mim sukun bertemu mim → melebur + dengung.', example:'لَهُمْ مَّا', hint:'Melebur ke mim' }
  ];

  const WAQAF = [
    { icon:'fa-stop-circle', sub:'Waqaf Lazim', title:'مـ', desc:'Wajib berhenti. Jika tidak, makna bisa rusak.', example:'وَاَمَّا مَنْ خَابَ وَمَـ', hint:'Wajib berhenti' },
    { icon:'fa-ban', sub:"Waqaf Mamnu'", title:'لا', desc:'Dilarang berhenti.', example:'... لَا تَقْرَبُوا الصَّلٰوةَ لا', hint:'Dilarang berhenti' },
    { icon:'fa-circle', sub:'Waqaf Jaiz', title:'ج', desc:'Boleh berhenti atau lanjut.', example:'... ج', hint:'Boleh keduanya' },
    { icon:'fa-arrow-left', sub:'Al-Waqfu Aula', title:'قلى', desc:'Lebih baik berhenti.', example:'... قلى', hint:'Utamakan berhenti' },
    { icon:'fa-arrow-right', sub:'Al-Washlu Aula', title:'صلى', desc:'Lebih baik melanjutkan.', example:'... صلى', hint:'Utamakan lanjut' },
    { icon:'fa-ellipsis-h', sub:'Muanaqah', title:'∴ ∴', desc:'Berhenti di salah satu tanda saja.', example:'... ∴ ... ∴ ...', hint:'Pilih salah satu' },
    { icon:'fa-pause', sub:'Saktah', title:'س', desc:'Berhenti sejenak tanpa nafas.', example:'... س ...', hint:'Tanpa nafas' },
    { icon:'fa-question-circle', sub:'Qila Alaihil Waqf', title:'ق', desc:'Sebagian ulama menyarankan berhenti.', example:'... ق', hint:'Sebaiknya berhenti' }
  ];

  const HIJAIYAH = [
    { a:'ا', n:'Alif', l:'A' }, { a:'ب', n:'Ba', l:'B' }, { a:'ت', n:'Ta', l:'T' },
    { a:'ث', n:'Tsa', l:'Ts' }, { a:'ج', n:'Jim', l:'J' }, { a:'ح', n:'Ha', l:'H' },
    { a:'خ', n:'Kha', l:'Kh' }, { a:'د', n:'Dal', l:'D' }, { a:'ذ', n:'Dzal', l:'Dz' },
    { a:'ر', n:'Ra', l:'R' }, { a:'ز', n:'Zai', l:'Z' }, { a:'س', n:'Sin', l:'S' },
    { a:'ش', n:'Syin', l:'Sy' }, { a:'ص', n:'Shad', l:'Sh' }, { a:'ض', n:'Dhad', l:'Dh' },
    { a:'ط', n:'Tha', l:'Th' }, { a:'ظ', n:'Zha', l:'Zh' }, { a:'ع', n:"'Ain", l:"'" },
    { a:'غ', n:'Ghain', l:'Gh' }, { a:'ف', n:'Fa', l:'F' }, { a:'ق', n:'Qaf', l:'Q' },
    { a:'ك', n:'Kaf', l:'K' }, { a:'ل', n:'Lam', l:'L' }, { a:'م', n:'Mim', l:'M' },
    { a:'ن', n:'Nun', l:'N' }, { a:'و', n:'Wau', l:'W' }, { a:'ه', n:'Ha', l:'H' },
    { a:'ء', n:'Hamzah', l:"'" }, { a:'ي', n:'Ya', l:'Y' }
  ];

  const HARAKAT = [
    { icon:'fa-minus', sub:'Dasar', title:'Fathah', desc:'Baris di atas, bunyi "a".', example:'بَ = Ba', hint:'a' },
    { icon:'fa-minus', sub:'Dasar', title:'Kasrah', desc:'Baris di bawah, bunyi "i".', example:'بِ = Bi', hint:'i' },
    { icon:'fa-minus', sub:'Dasar', title:'Dhammah', desc:'Baris seperti wau kecil, bunyi "u".', example:'بُ = Bu', hint:'u' },
    { icon:'fa-circle', sub:'Dasar', title:'Sukun', desc:'Bulatan kecil, huruf mati.', example:'اَبْ = Ab', hint:'Mati' },
    { icon:'fa-asterisk', sub:'Tanwin', title:'Fathatain', desc:'Fathah ganda, bunyi "an".', example:'كِتَابًا', hint:'an' },
    { icon:'fa-asterisk', sub:'Tanwin', title:'Kasratain', desc:'Kasrah ganda, bunyi "in".', example:'كِتَابٍ', hint:'in' },
    { icon:'fa-asterisk', sub:'Tanwin', title:'Dhammatain', desc:'Dhammah ganda, bunyi "un".', example:'كِتَابٌ', hint:'un' },
    { icon:'fa-compress', sub:'Tasydid', title:'Tasydid', desc:'Huruf dobel/ditekan.', example:'مُحَمَّدٌ', hint:'Dobel' },
    { icon:'fa-arrows-alt-h', sub:'Mad', title:"Mad Thabi'i", desc:'Panjang 2 harakat.', example:'قَالَ', hint:'2 harakat' },
    { icon:'fa-arrows-alt-h', sub:'Mad', title:'Mad Wajib', desc:'4-5 harakat.', example:'جَآءَ', hint:'4-5 harakat' },
    { icon:'fa-arrows-alt-h', sub:'Mad', title:'Mad Jaiz', desc:'2-5 harakat.', example:'بِمَآ اُنْزِلَ', hint:'2-5 harakat' },
    { icon:'fa-arrows-alt-h', sub:'Mad', title:'Mad Lazim', desc:'6 harakat.', example:'الضَّآلِّيْنَ', hint:'6 harakat' }
  ];

  const PANDUAN = [
    { icon:'fa-hand-holding-heart', sub:'Langkah 1', title:'Niat & Suci dari Hadas', desc:'Awali dengan niat ikhlas. Berwudhu sebelum menyentuh mushaf.' },
    { icon:'fa-font', sub:'Langkah 2', title:'Kenali Huruf Hijaiyah', desc:'Kuasai 29 huruf hijaiyah beserta makhraj-nya.' },
    { icon:'fa-dot-circle', sub:'Langkah 3', title:'Kuasai Harakat', desc:'Pahami fathah, kasrah, dhammah, sukun, tanwin, tasydid.' },
    { icon:'fa-star-and-crescent', sub:'Langkah 4', title:'Terapkan Tajwid', desc:'Pelajari 16 kaidah tajwid utama & praktikkan.' },
    { icon:'fa-stop-circle', sub:'Langkah 5', title:'Perhatikan Waqaf', desc:'Berhenti di tempat yang tepat agar makna tetap benar.' },
    { icon:'fa-clock', sub:'Langkah 6', title:'Tartil & Panjang-Pendek', desc:'Baca perlahan & jelas, perhatikan 2/4/5/6 harakat.' },
    { icon:'fa-headphones', sub:'Langkah 7', title:'Dengarkan Murottal', desc:'Simak bacaan 8 qari, tirukan irama & makhraj-nya.' },
    { icon:'fa-calendar-check', sub:'Langkah 8', title:'Rutin & Bertahap', desc:'Mulai 1 halaman/hari. Konsisten lebih baik dari banyak tapi jarang.' },
    { icon:'fa-language', sub:'Langkah 9', title:'Pahami Terjemahan', desc:'Baca terjemahan untuk memahami makna, bacaan jadi khusyuk.' },
    { icon:'fa-brain', sub:'Langkah 10', title:'Hafalkan Perlahan', desc:'Mulai dari surah pendek, gunakan tikrar & muraja\'ah.' }
  ];

  function renderStaticContent() {
    renderGuide('#tajwidGrid', TAJWID);
    renderGuide('#waqafGrid', WAQAF);
    renderGuide('#harakatGrid', HARAKAT);
    renderGuide('#guideSteps', PANDUAN);
    renderHijaiyah();
  }
  function renderGuide(sel, list) {
    const wrap = $(sel); if (!wrap) return;
    const frag = document.createDocumentFragment();
    list.forEach((g, i) => {
      const card = document.createElement('div');
      card.className = 'guide-card';
      card.style.animationDelay = Math.min(i * 0.035, 0.5) + 's';
      card.innerHTML = `
        <div class="gc-icon"><i class="fas ${g.icon}"></i></div>
        <span class="gc-sub">${esc(g.sub)}</span>
        <h3 class="gc-title">${esc(g.title)}</h3>
        <p class="gc-desc">${esc(g.desc)}</p>
        ${g.example ? `<div class="gc-example">${g.example}</div>` : ''}
        ${g.hint ? `<div class="gc-hint">💡 ${esc(g.hint)}</div>` : ''}`;
      frag.appendChild(card);
    });
    wrap.innerHTML = ''; wrap.appendChild(frag);
  }
  function renderHijaiyah() {
    const wrap = $('#hijaiyahGrid'); if (!wrap) return;
    const frag = document.createDocumentFragment();
    HIJAIYAH.forEach((h, i) => {
      const card = document.createElement('div');
      card.className = 'hijaiyah-card';
      card.style.animationDelay = Math.min(i * 0.012, 0.4) + 's';
      card.innerHTML = `
        <div class="hijaiyah-letter">${h.a}</div>
        <div class="hijaiyah-name">${h.n}</div>
        <div class="hijaiyah-latin">${h.l}</div>`;
      frag.appendChild(card);
    });
    wrap.innerHTML = ''; wrap.appendChild(frag);
  }

  /* ═══ KEYBOARD ═══ */
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (e.key === 'Escape') {
        closeTafsir();
        const sm = $('#shortcutModal'); if (sm) sm.style.display = 'none';
        const cm = $('#cardModal'); if (cm) cm.style.display = 'none';
        const slm = $('#sleepModal'); if (slm) slm.style.display = 'none';
        const drawer = $('#readerSettingsDrawer');
        if (drawer?.classList.contains('open')) {
          drawer.classList.remove('open');
          $('#drawerOverlay')?.classList.remove('open');
          document.body.classList.remove('modal-open');
        }
        return;
      }
      if (isInput) return;
      if (e.key === '?') { e.preventDefault(); toggleShortcutModal(); return; }
      if (e.code === 'Space') { e.preventDefault(); if (audio.src) { if (audio.paused) audio.play(); else audio.pause(); } }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); stepVerse(-1); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); stepVerse(1); }
      else if (e.key.toLowerCase() === 'f' && !e.ctrlKey) { toggleFullscreen(); }
      else if (e.key === '+' || e.key === '=') {
        S.settings.fontSize = Math.min(72, S.settings.fontSize + 2);
        applySettings(); saveSettings();
      }
      else if (e.key === '-') {
        S.settings.fontSize = Math.max(16, S.settings.fontSize - 2);
        applySettings(); saveSettings();
      }
      else if (e.ctrlKey && e.key.toLowerCase() === 'f') {
        e.preventDefault(); switchTab('cari');
        setTimeout(() => $('#verseSearchInput')?.focus(), 200);
      }
      else if (e.ctrlKey && e.key.toLowerCase() === 'b') {
        e.preventDefault(); switchTab('bookmark');
      }
      else if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault(); toggleFocusMode();
      }
    });
  }
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  /* ═══ FOCUS MODE ═══ */
  function bindFocusMode() {
    $('#focusModeBtn')?.addEventListener('click', toggleFocusMode);
  }
  function toggleFocusMode() {
    const cur = document.body.getAttribute('data-mode') === 'focus';
    document.body.setAttribute('data-mode', cur ? (S.mushafMode ? 'mushaf' : 'normal') : 'focus');
    showToast(cur ? 'Mode fokus nonaktif' : 'Mode fokus aktif', 'info');
  }

  /* ═══ SHORTCUT HELP MODAL ═══ */
  function bindShortcutModal() {
    const m = $('#shortcutModal');
    if (!m) return;
    $('#shortcutHelpBtn')?.addEventListener('click', toggleShortcutModal);
    $('#shortcutModalClose')?.addEventListener('click', () => {
      m.style.display = 'none';
      document.body.classList.remove('modal-open');
    });
    m.addEventListener('click', (e) => {
      if (e.target === m) { m.style.display = 'none'; document.body.classList.remove('modal-open'); }
    });
  }
  function toggleShortcutModal() {
    const m = $('#shortcutModal');
    if (!m) return;
    const open = m.style.display !== 'flex';
    m.style.display = open ? 'flex' : 'none';
    document.body.classList.toggle('modal-open', open);
  }

  /* ═══ THEME BUTTON ═══ */
  function bindThemeButtons() {
    $('#themeToggleBtn')?.addEventListener('click', () => {
      const order = ['dark', 'light', 'sepia', 'emerald', 'midnight', 'royal'];
      const idx = order.indexOf(S.settings.theme);
      S.settings.theme = order[(idx + 1) % order.length];
      lsSet(LS.THEME, S.settings.theme);
      applySettings(); saveSettings();
      showToast('Tema: ' + S.settings.theme, 'info');
    });
  }

  /* ═══ INIT MODAL BINDINGS (BUGFIX) ═══ */
  document.addEventListener('DOMContentLoaded', () => {
    bindTafsirModal();
  });

  // Deep link support
  window.addEventListener('load', () => {
    const m = location.hash.match(/#s=(\d+)&v=(\d+)/);
    if (m) {
      const sn = Number(m[1]), v = Number(m[2]);
      if (sn >= 1 && sn <= 114) setTimeout(() => openSurah(sn, v), 1200);
    }
  });

})();