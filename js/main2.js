/* 操作(タップ・入力・送信) */
(function () {
'use strict';
var TB = window.TB, V = TB.views, api = TB.api, st = TB.st, ui = TB.ui, LS = TB.ls;
function $(id) { return document.getElementById(id); }
function me() { return V.me(); }
function tripId() { return st.trip.id; }
function evById(id) { for (var i = 0; i < st.events.length; i++) if (st.events[i].id === id) return st.events[i]; return null; }
function fail(e) { ui.busy = false; TB.toast(TB.errText(e)); TB.render(); }
var focusNext = false;

/* ---------- 下書きの後片付け ---------- */
function dropDrafts() {
  ui.draftPhotos.forEach(function (d) { try { URL.revokeObjectURL(d.url); } catch (e) {} });
  ui.draftPhotos = [];
  if (ui.draftRef) { try { URL.revokeObjectURL(ui.draftRef.url); } catch (e) {} ui.draftRef = null; }
}
function closeForm() {
  dropDrafts();
  ui.form = ''; ui.prefill = null; ui.draft = null; ui.placeFor = ''; ui.pickMode = false;
  ui.results = null; ui.confirm = ''; ui.err = '';
}
function submitting(f, fn) {
  if (ui.busy) return;
  ui.busy = true;
  var b = f.querySelector('button[type="submit"]');
  if (b) b.disabled = true;
  Promise.resolve().then(fn).then(function () { ui.busy = false; }, function (e) {
    ui.busy = false; if (b) b.disabled = false; TB.toast(TB.errText(e));
  });
}
function copy(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(function () { TB.toast('コピーしました'); }, function () { TB.toast('枠を長押ししてコピーしてください'); });
  }
  TB.toast('枠を長押ししてコピーしてください');
}

/* ---------- 地図からの操作 ---------- */
TB.onMapClick = function (lat, lng) {
  if (!(ui.pickMode || ui.placeFor)) return;
  ui.draft = { lat: lat, lng: lng, name: '' };
  ui.pickMode = false; ui.results = null;
  TB.render();
  var p = document.querySelector('form[data-form="pin"], [data-act="confirmPlace"]');
  if (p && p.scrollIntoView) p.scrollIntoView({ block: 'center', behavior: 'smooth' });
};
TB.onPinClick = function (id) {
  ui.draft = null; ui.placeFor = ''; ui.pickMode = false;
  ui.selEv = ui.selEv === id ? '' : id;
  TB.render();
};

/* ---------- サンプル(韓国の旅だけ) ---------- */
function addSample() {
  var n = V.dayCount(), who = me();
  var S = [
    [0, '14:30', '仁川空港に着く', '移動', 'T-moneyを買って市内へ', 37.4602, 126.4407],
    [0, '17:00', '明洞のホテル', '宿泊', '', 37.5636, 126.9822],
    [0, '18:30', '広蔵市場で夕食', '食事', 'ピンデトク、ユッケ', 37.5700, 126.9996],
    [1, '10:00', '景福宮', '観光', '', 37.5796, 126.9770],
    [1, '13:00', '北村韓屋村', '観光', '', 37.5826, 126.9830],
    [1, '15:30', '弘大で買い物', '買い物', '', 37.5563, 126.9236],
    [2, '11:00', '聖水洞でカフェ巡り', 'カフェ', '', 37.5446, 127.0557],
    [2, '20:00', '漢江公園でラーメン', '食事', '', 37.5284, 126.9326],
    [3, '12:00', '空港へ移動', '移動', '', 37.4602, 126.4407],
    [-1, '', '東大門のDDP', '観光', 'あれば行きたい', 37.5670, 127.0090]
  ].map(function (r) {
    return { trip_id: tripId(), day: r[0] < 0 ? -1 : Math.min(r[0], n - 1), time: r[1] || null, title: r[2], cat: r[3], note: r[4] || null, by: who, lat: r[5], lng: r[6] };
  });
  api.insertMany('events', S).then(function (rows) {
    rows.forEach(function (r) { st.events.push(r); });
    TB.toast('サンプルを入れました'); TB.render();
  }, fail);
}

/* ---------- タップ ---------- */
var ACT = {
  home: function () { TB.goHome(); return false; },
  openTrip: function (id) { TB.openTrip(id); return false; },
  retry: function () { TB.boot(); return false; },
  form: function (id, el) {
    var f = el.getAttribute('data-f');
    if (ui.form !== f) closeForm();
    ui.form = f; focusNext = true;
  },
  cancelForm: function () { closeForm(); },
  day: function (id, el) { closeForm(); ui.day = +el.getAttribute('data-i'); },
  sample: function () { addSample(); return false; },
  mf: function (id) { ui.memFilter = id; },
  pkf: function (id) { ui.pkFilter = id; },

  visit: function (id) {
    var ev = evById(id); if (!ev) return false;
    ev.visited = !ev.visited; TB.render();
    TB.toast(ev.visited ? '行った! スタンプを押しました' : '行きたいに戻しました');
    api.update('events', id, { visited: ev.visited }).then(null, function (e) { ev.visited = !ev.visited; fail(e); });
    return false;
  },
  pick: function (id) { ui.pickFor = id; $('refPick').click(); return false; },
  delEv: function (id) {
    var ev = evById(id); if (!ev) return false;
    api.keepPostPlace(id, ev.title).then(null, function () {})
      .then(function () { return api.remove('events', id); })
      .then(function () {
        if (ev.ref_path) api.removePhotos([ev.ref_path]);
        st.events = st.events.filter(function (x) { return x.id !== id; });
        st.posts.forEach(function (p) { if (p.event_id === id) { p.event_id = null; p.place_name = ev.title; } });
        if (ui.selEv === id) ui.selEv = '';
        TB.render();
      }, fail);
    return false;
  },
  showOnMap: function (id) {
    var ev = evById(id); if (!ev) return false;
    closeForm(); ui.tab = 'map'; ui.selEv = id;
    TB.render(); window.scrollTo(0, 0);
    TB.map.flyTo(ev.lat, ev.lng, 16);
    return false;
  },
  placeOnMap: function (id) {
    var ev = evById(id); if (!ev) return false;
    closeForm(); ui.tab = 'map'; ui.placeFor = id; ui.q = ev.title; ui.selEv = '';
    TB.render(); window.scrollTo(0, 0);
    return false;
  },
  selEv: function (id) {
    ui.draft = null; ui.placeFor = '';
    ui.selEv = ui.selEv === id ? '' : id;
    var ev = evById(id);
    TB.render();
    if (ui.selEv && ev && ev.lat != null) TB.map.flyTo(ev.lat, ev.lng, 16);
    return false;
  },
  pickMode: function () { ui.pickMode = !ui.pickMode; if (ui.pickMode) { ui.draft = null; ui.selEv = ''; } },
  pickRes: function (id, el) {
    var r = ui.results && ui.results[+el.getAttribute('data-i')]; if (!r) return;
    ui.draft = { lat: r.lat, lng: r.lng, name: r.name }; ui.results = null; ui.form = ui.placeFor ? ui.form : '';
    TB.render(); TB.map.flyTo(r.lat, r.lng, 16);
    return false;
  },
  cancelDraft: function () { ui.draft = null; },
  cancelPlace: function () { ui.placeFor = ''; ui.draft = null; ui.results = null; ui.pickMode = false; },
  confirmPlace: function () {
    var ev = evById(ui.placeFor), d = ui.draft; if (!ev || !d) return;
    var lat = d.lat, lng = d.lng;
    api.update('events', ev.id, { lat: lat, lng: lng }).then(function () {
      ev.lat = lat; ev.lng = lng; ui.selEv = ev.id; ui.placeFor = ''; ui.draft = null;
      TB.toast('ピンを置きました'); TB.render();
    }, fail);
    return false;
  },
  unpin: function (id) {
    var ev = evById(id); if (!ev) return false;
    api.update('events', id, { lat: null, lng: null }).then(function () {
      ev.lat = null; ev.lng = null; ui.selEv = ''; TB.render();
    }, fail);
    return false;
  },
  writeMem: function (id) { closeForm(); ui.prefill = { eventId: id }; ui.tab = 'memories'; ui.form = 'po'; focusNext = true; window.scrollTo(0, 0); },

  delPk: function (id) {
    api.remove('packing', id).then(function () {
      st.packing = st.packing.filter(function (x) { return x.id !== id; }); TB.render();
    }, fail);
    return false;
  },
  addPlug: function () {
    api.insert('packing', { trip_id: tripId(), name: '変換プラグ', owner: null }).then(function (r) {
      st.packing.push(r); TB.toast('持ち物に入れました'); TB.render();
    }, fail);
    return false;
  },
  delPost: function (id) {
    var p = st.posts.filter(function (x) { return x.id === id; })[0]; if (!p) return false;
    api.remove('posts', id).then(function () {
      api.removePhotos(p.photos || []);
      st.posts = st.posts.filter(function (x) { return x.id !== id; }); TB.render();
    }, fail);
    return false;
  },

  copyInvite: function () { copy(V.inviteLink()); return false; },
  copyCode: function () { copy(st.trip.invite_code); return false; },
  shareInvite: function () {
    if (navigator.share) navigator.share({ title: '旅帖: ' + st.trip.name, text: '旅帖で一緒に旅の計画を立てよう', url: V.inviteLink() }).catch(function () {});
    return false;
  },
  rateReset: function () {
    var c = TB.country(st.trip.country);
    delete ui.rateOv[c.cur]; LS.set('tabicho:rateov', JSON.stringify(ui.rateOv));
  },
  leaveAsk: function () { ui.confirm = 'leave'; },
  delTripAsk: function () { ui.confirm = 'delTrip'; },
  confirmNo: function () { ui.confirm = ''; },
  leave: function () {
    var t = st.trip, last = st.members.length <= 1;
    if (last && t.created_by === me()) { ACT.delTrip(); return false; }
    api.leaveTrip(t.id, me()).then(function () { TB.goHome('旅から抜けました。'); }, fail);
    return false;
  },
  delTrip: function () {
    var t = st.trip, paths = [];
    st.events.forEach(function (e) { if (e.ref_path) paths.push(e.ref_path); });
    st.posts.forEach(function (p) { (p.photos || []).forEach(function (x) { paths.push(x); }); });
    api.removePhotos(paths).then(function () { return api.deleteTrip(t.id); })
      .then(function () { TB.goHome('旅を削除しました。'); }, fail);
    return false;
  }
};

document.addEventListener('click', function (e) {
  var tab = e.target.closest('[data-tab]');
  if (tab) {
    closeForm(); ui.tab = tab.getAttribute('data-tab');
    TB.render(); window.scrollTo(0, 0); return;
  }
  if (e.target.closest('#lb')) { $('lb').hidden = true; return; }
  var img = e.target.closest('.ph img, .tile img, .thumb img');
  if (img && img.getAttribute('src')) { $('lb').firstElementChild.src = img.src; $('lb').hidden = false; return; }
  var el = e.target.closest('[data-act]');
  if (!el) return;
  var a = el.getAttribute('data-act'), h = ACT[a];
  if (!h) return;
  var r = h(el.getAttribute('data-id'), el);
  if (r === false) return;
  TB.render();
  if (focusNext) {
    focusNext = false;
    var first = document.querySelector('form[data-form] .in');
    if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') $('lb').hidden = true; });

/* ---------- 送信 ---------- */
document.addEventListener('submit', function (e) {
  var f = e.target.closest('form[data-form]');
  if (!f) return;
  e.preventDefault();
  var d = new FormData(f), k = f.getAttribute('data-form');
  var s = function (n) { return String(d.get(n) || '').trim(); };

  if (k === 'join') {
    var code = s('code').split('#j=').pop().split('/').pop().toLowerCase(), nick = s('nick');
    submitting(f, function () {
      return api.joinTrip(code, nick).then(function (id) {
        LS.set('tabicho:nick', nick); ui.nick = nick; ui.joinCode = '';
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e2) {}
        return TB.refreshTrips().then(function () { return TB.openTrip(id); });
      });
    });
  } else if (k === 'newTrip') {
    var nk = s('nick');
    submitting(f, function () {
      return api.createTrip(s('name'), s('country'), s('start'), s('end') && s('end') >= s('start') ? s('end') : s('start'), nk).then(function (t) {
        LS.set('tabicho:nick', nk); ui.nick = nk;
        return TB.refreshTrips().then(function () { return TB.openTrip(t.id); });
      });
    });
  } else if (k === 'ev') {
    submitting(f, function () {
      var row = { trip_id: tripId(), day: ui.day, time: s('time') || null, title: s('title'), cat: s('cat') || 'その他', note: s('note') || null, by: me() };
      var blob = ui.draftRef && ui.draftRef.blob;
      return (blob ? api.uploadPhoto(tripId(), blob) : Promise.resolve(null)).then(function (path) {
        if (path) row.ref_path = path;
        return api.insert('events', row).then(null, function (err) { if (path) api.removePhotos([path]); throw err; });
      }).then(function (ev) { st.events.push(ev); closeForm(); TB.render(); });
    });
  } else if (k === 'pk') {
    submitting(f, function () {
      return api.insert('packing', { trip_id: tripId(), name: s('name'), owner: s('owner') || null }).then(function (r) {
        st.packing.push(r); TB.render();
        var inp = $('k-name'); if (inp) inp.focus({ preventScroll: true });
      });
    });
  } else if (k === 'search') {
    var q = s('q'); if (!q) return;
    ui.q = q;
    submitting(f, function () {
      return api.geocode(q, TB.country(st.trip.country).c).then(function (list) { ui.results = list; TB.render(); });
    });
  } else if (k === 'pin') {
    var dr = ui.draft; if (!dr) return;
    submitting(f, function () {
      var row = { trip_id: tripId(), day: +s('day'), title: s('title'), cat: s('cat') || 'その他', by: me(), lat: dr.lat, lng: dr.lng, visited: s('status') === 'done' };
      return api.insert('events', row).then(function (ev) {
        st.events.push(ev); ui.selEv = ev.id; ui.draft = null; ui.form = '';
        TB.toast(ev.visited ? '行ったピンを立てました' : 'ピンを立てました'); TB.render();
      });
    });
  } else if (k === 'po') {
    var text = s('text');
    if (!text && !ui.draftPhotos.length) { TB.toast('ひとこと か 写真 を入れてください'); return; }
    var evId = s('eventId'), placeName = s('placeName');
    submitting(f, function () {
      var uploaded = [];
      return ui.draftPhotos.reduce(function (chain, dp) {
        return chain.then(function () { return api.uploadPhoto(tripId(), dp.blob).then(function (p) { uploaded.push(p); }); });
      }, Promise.resolve()).then(function () {
        return api.insert('posts', { trip_id: tripId(), event_id: evId || null, place_name: evId ? null : (placeName || 'その他の場所'), body: text || null, photos: uploaded });
      }).then(function (post) {
        st.posts.push(post); closeForm(); TB.toast('投稿しました'); TB.render();
      }, function (err) { api.removePhotos(uploaded); throw err; });
    });
  }
});

/* ---------- 入力の確定 ---------- */
function newBlobDraft(blob) { return { blob: blob, url: URL.createObjectURL(blob) }; }

document.addEventListener('change', function (e) {
  var el = e.target.closest('[data-chg]');
  if (!el) return;
  var k = el.getAttribute('data-chg'), id = el.getAttribute('data-id'), v = el.value;

  if (k === 'move') {
    var ev = evById(id); if (!ev || v === '') return;
    var before = ev.day; ev.day = +v; TB.render();
    api.update('events', id, { day: +v }).then(null, function (err) { ev.day = before; fail(err); });
  } else if (k === 'pk') {
    var pk = st.packing.filter(function (x) { return x.id === id; })[0]; if (!pk) return;
    pk.done = el.checked; TB.render();
    api.update('packing', id, { done: pk.done }).then(null, function (err) { pk.done = !pk.done; fail(err); });
  } else if (k === 'refdraft') {
    var file = el.files && el.files[0]; el.value = '';
    if (!file) return;
    api.shrink(file).then(function (blob) {
      if (ui.draftRef) { try { URL.revokeObjectURL(ui.draftRef.url); } catch (e2) {} }
      ui.draftRef = newBlobDraft(blob);
      var box = $('refDraft'); if (box) box.innerHTML = '<img src="' + ui.draftRef.url + '" alt="選んだ写真">';
    }, function () { TB.toast('読み込めない写真でした'); });
  } else if (k === 'photos') {
    var files = Array.prototype.slice.call(el.files || [], 0, Math.max(0, 12 - ui.draftPhotos.length)); el.value = '';
    files.reduce(function (chain, fl) {
      return chain.then(function () {
        return api.shrink(fl).then(function (blob) {
          var dp = newBlobDraft(blob); ui.draftPhotos.push(dp);
          var box = $('drafts');
          if (box) { var im = document.createElement('img'); im.src = dp.url; im.alt = '添付する写真'; box.appendChild(im); }
        }, function () { TB.toast('読み込めない写真がありました'); });
      });
    }, Promise.resolve());
  } else if (k === 'mname') {
    var nm = v.trim(); if (!nm) { TB.render(); return; }
    api.renameMe(tripId(), me(), nm.slice(0, 12)).then(function () {
      st.members.forEach(function (m) { if (m.user_id === me()) m.name = nm.slice(0, 12); });
      LS.set('tabicho:nick', nm.slice(0, 12)); TB.render();
    }, fail);
  } else if (k === 'tname') {
    var tn = v.trim(); if (!tn) { TB.render(); return; }
    api.updateTrip(tripId(), { name: tn.slice(0, 60) }).then(function () { st.trip.name = tn.slice(0, 60); TB.render(); }, fail);
  } else if (k === 'country') {
    api.updateTrip(tripId(), { country: v }).then(function () { st.trip.country = v; TB.map.reset(); TB.render(); }, fail);
  } else if (k === 'start' || k === 'end') {
    var patch = {}, t = st.trip;
    var s0 = k === 'start' ? v : (t.start_date || ''), e0 = k === 'end' ? v : (t.end_date || '');
    if (s0 && (!e0 || e0 < s0)) e0 = s0;
    patch.start_date = s0 || null; patch.end_date = e0 || null;
    api.updateTrip(tripId(), patch).then(function () {
      t.start_date = patch.start_date; t.end_date = patch.end_date; ui.day = 0; TB.render();
    }, fail);
  } else if (k === 'rate') {
    var c = TB.country(st.trip.country), r = parseFloat(v);
    if (r > 0) ui.rateOv[c.cur] = r / c.unit; else delete ui.rateOv[c.cur];
    LS.set('tabicho:rateov', JSON.stringify(ui.rateOv)); TB.render();
  }
});

/* ---------- 既存の予定に参考写真を付ける ---------- */
$('refPick').addEventListener('change', function () {
  var f = this.files && this.files[0], id = ui.pickFor;
  this.value = '';
  if (!f || !id) return;
  TB.toast('写真を送っています…');
  api.shrink(f).then(function (blob) { return api.uploadPhoto(tripId(), blob); }).then(function (path) {
    var ev = evById(id);
    if (!ev) { api.removePhotos([path]); return; }
    var old = ev.ref_path;
    return api.update('events', id, { ref_path: path }).then(function () {
      ev.ref_path = path; if (old) api.removePhotos([old]); TB.render();
    }, function (err) { api.removePhotos([path]); throw err; });
  }).then(null, fail);
});

/* 入力の途中で保留していた描画は、フォームを閉じたときに反映される */
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', TB.boot);
else TB.boot();
})();
