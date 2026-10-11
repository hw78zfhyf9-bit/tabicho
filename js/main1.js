/* 全体の状態・描画・起動 */
(function () {
'use strict';
var TB = window.TB, V = TB.views, api = TB.api;
function $(id) { return document.getElementById(id); }

var LS = TB.ls = {
  get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};

TB.st = { user: null, screen: 'boot', trips: [], trip: null, members: [], events: [], packing: [], posts: [] };
var rateOv = {};
try { rateOv = JSON.parse(LS.get('tabicho:rateov') || '{}') || {}; } catch (e) { rateOv = {}; }
TB.ui = {
  tab: 'schedule', day: 0, form: '', busy: false, err: '', errRaw: '', confirm: '',
  pkFilter: 'all', memFilter: 'all', rates: null, rateOv: rateOv,
  draftRef: null, draftPhotos: [], prefill: null,
  selEv: '', draft: null, placeFor: '', pickMode: false, results: null, q: '',
  nick: LS.get('tabicho:nick') || '', joinCode: '', newCountry: 'KR'
};

var dirty = false;

/* ---------- 通知 ---------- */
TB.toast = function (msg) {
  var t = $('toast'); if (!t) return;
  t.textContent = msg; t.hidden = false;
  clearTimeout(TB.toast.t); TB.toast.t = setTimeout(function () { t.hidden = true; }, 3200);
};

/* ---------- 写真の読み込み(署名つきURLに置き換える) ---------- */
function hydratePhotos() {
  var imgs = Array.prototype.slice.call(document.querySelectorAll('img[data-ph]'));
  if (!imgs.length) return;
  var paths = imgs.map(function (i) { return i.getAttribute('data-ph'); });
  api.photoUrls(paths).then(function (m) {
    imgs.forEach(function (img) {
      var u = m[img.getAttribute('data-ph')];
      if (u && img.getAttribute('src') !== u) img.src = u;
    });
  }, function () {});
}

function bindConv() {
  var l = $('cv-l'), j = $('cv-j'); if (!l || !j) return;
  var c = TB.country(TB.st.trip.country), r = V.perUnit() / c.unit;
  l.addEventListener('input', function () { j.value = l.value === '' ? '' : String(Math.round(l.value * r)); });
  j.addEventListener('input', function () { l.value = j.value === '' ? '' : String(Math.round(j.value / r * 100) / 100); });
}

/* ---------- 描画 ---------- */
function render() {
  var s = TB.st, u = TB.ui, nav = $('tabsNav');
  dirty = false;
  if (s.screen === 'trip' && s.trip) {
    $('hd').innerHTML = V.tripHeader();
    var view = { schedule: V.schedule, map: V.map, packing: V.packing, memories: V.memories, settings: V.settings }[u.tab] || V.schedule;
    $('main').innerHTML = view();
    nav.hidden = false;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) {
      b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === u.tab));
    });
  } else {
    nav.hidden = true;
    $('hd').innerHTML = V.homeHeader();
    $('main').innerHTML = s.screen === 'home' ? V.home() : s.screen === 'setup' ? V.setupHelp() : '<div class="spin">読み込み中…</div>';
  }
  hydratePhotos();
  if (s.screen === 'trip' && u.tab === 'map') TB.map.mount();
  if (s.screen === 'trip' && u.tab === 'settings') bindConv();
}
TB.render = render;

/* 入力の途中で相手の変更が届いたときは、入力を消さないように描画を待つ */
TB.softRender = function () {
  var a = document.activeElement, m = $('main');
  var typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && m && m.contains(a);
  if (typing || TB.ui.form) { dirty = true; return; }
  render();
};
TB.isDirty = function () { return dirty; };

/* ---------- 旅の読み込み ---------- */
var unsub = null, pending = {};

function stopSub() { if (unsub) { try { unsub(); } catch (e) {} unsub = null; } }

function todayIndex() {
  var t = TB.st.trip;
  if (!t || !t.start_date) return 0;
  var a = TB.parseDate(t.start_date), now = new Date();
  var d = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - a) / 864e5);
  return d >= 0 && d < V.dayCount() ? d : 0;
}

TB.refreshTrips = function () {
  return api.listTrips().then(function (rows) { TB.st.trips = rows || []; return TB.st.trips; });
};

TB.goHome = function (msg) {
  stopSub();
  var s = TB.st, u = TB.ui;
  s.screen = 'home'; s.trip = null; s.members = []; s.events = []; s.packing = []; s.posts = [];
  u.form = ''; u.err = msg || ''; u.confirm = ''; resetMapUi();
  LS.del('tabicho:last');
  render();
  return TB.refreshTrips().then(render, function () {});
};

function resetMapUi() {
  var u = TB.ui;
  u.selEv = ''; u.draft = null; u.placeFor = ''; u.pickMode = false; u.results = null; u.q = '';
  TB.map.reset();
}

TB.openTrip = function (id) {
  var s = TB.st, u = TB.ui;
  s.screen = 'loading'; u.err = ''; render();
  return api.loadTrip(id).then(function (d) {
    if (!d.trip) throw new Error('not found');
    stopSub();
    s.trip = d.trip; s.members = d.members; s.events = d.events; s.packing = d.packing; s.posts = d.posts;
    s.screen = 'trip';
    u.tab = 'schedule'; u.form = ''; u.confirm = ''; u.pkFilter = 'all'; u.memFilter = 'all'; u.prefill = null;
    u.draftRef = null; u.draftPhotos = []; resetMapUi();
    u.day = todayIndex();
    LS.set('tabicho:last', id);
    unsub = api.subscribe(id, onRemote);
    render(); window.scrollTo(0, 0);
  }).catch(function (e) {
    s.screen = 'home'; u.err = TB.errText(e); render();
  });
};

/* ---------- 相手の変更を受け取る ---------- */
var flush = TB.debounce(function () {
  var tables = Object.keys(pending); pending = {};
  Promise.all(tables.map(reloadTable)).then(function () { TB.softRender(); }, function () {});
}, 250);
function onRemote(table) { pending[table] = 1; flush(); }

function reloadTable(t) {
  var s = TB.st; if (!s.trip) return Promise.resolve();
  var id = s.trip.id;
  return api.loadTable(t, id).then(function (rows) {
    if (!s.trip || s.trip.id !== id) return;
    if (t === 'trips') { if (rows[0]) s.trip = rows[0]; return; }
    if (t === 'members') {
      var me = V.me();
      if (!rows.some(function (m) { return m.user_id === me; })) { TB.goHome('この旅から外れました。'); return; }
    }
    s[t] = rows;
  });
}
TB.reloadTable = reloadTable;

/* ---------- 起動 ---------- */
function readHash() {
  var m = /[#&]j=([A-Za-z0-9]+)/.exec(location.hash || '');
  return m ? m[1].toLowerCase() : '';
}

TB.boot = function () {
  var s = TB.st, u = TB.ui;
  s.screen = 'boot'; u.err = ''; u.errRaw = ''; render();
  u.joinCode = readHash();
  try { api.init(); } catch (e) { s.screen = 'setup'; u.errRaw = String(e.message || e); render(); return; }
  api.ensureUser().then(function (user) {
    s.user = user;
    return TB.refreshTrips();
  }).then(function (trips) {
    var last = LS.get('tabicho:last');
    var hit = !u.joinCode && last && trips.some(function (t) { return t.id === last; });
    if (hit) return TB.openTrip(last);
    s.screen = 'home'; render();
  }).catch(function (e) {
    s.screen = 'setup'; u.errRaw = String((e && (e.message || e.error_description)) || e); render();
  });
  api.fetchRates().then(function (r) { if (r) { u.rates = r; TB.softRender(); } });
};

window.addEventListener('hashchange', function () {
  var code = readHash();
  if (code && TB.st.user) { TB.ui.joinCode = code; if (TB.st.screen === 'trip') TB.goHome(); else render(); }
});
})();
