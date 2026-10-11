/* サーバーとの通信 (Supabase / 為替 / 場所検索) */
(function () {
'use strict';
var TB = window.TB;
var cfg = window.TB_CONFIG;
var sb = null;

function must(res) {
  if (res && res.error) throw res.error;
  return res ? res.data : null;
}

var api = TB.api = {};

api.init = function () {
  if (!window.supabase || !window.supabase.createClient) throw new Error('Failed to fetch: supabase-js');
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  return sb;
};

/* ---------- ログイン (匿名。ブラウザごとに自動で作られる) ---------- */
api.ensureUser = function () {
  return sb.auth.getSession().then(function (r) {
    var s = r && r.data && r.data.session;
    if (s && s.user) return s.user;
    return sb.auth.signInAnonymously().then(function (res) { return must(res).user; });
  });
};

/* ---------- 旅 ---------- */
api.listTrips = function () {
  return sb.from('trips')
    .select('id,name,country,start_date,end_date,invite_code,created_by,created_at,members(user_id,name,color)')
    .order('created_at', { ascending: false })
    .then(must);
};
api.createTrip = function (name, country, start, end, nick) {
  return sb.rpc('create_trip', { p_name: name, p_country: country, p_start: start || null, p_end: end || null, p_nickname: nick }).then(must);
};
api.joinTrip = function (code, nick) {
  return sb.rpc('join_trip', { p_code: code, p_nickname: nick }).then(must);
};
api.loadTrip = function (id) {
  return Promise.all([
    sb.from('trips').select('*').eq('id', id).maybeSingle().then(must),
    sb.from('members').select('*').eq('trip_id', id).order('joined_at').then(must),
    sb.from('events').select('*').eq('trip_id', id).order('created_at').then(must),
    sb.from('packing').select('*').eq('trip_id', id).order('created_at').then(must),
    sb.from('posts').select('*').eq('trip_id', id).order('created_at').then(must)
  ]).then(function (r) {
    return { trip: r[0], members: r[1], events: r[2], packing: r[3], posts: r[4] };
  });
};
api.loadTable = function (table, id) {
  var q = sb.from(table).select('*');
  q = table === 'trips' ? q.eq('id', id) : q.eq('trip_id', id);
  if (table === 'members') q = q.order('joined_at');
  else if (table !== 'trips') q = q.order('created_at');
  return q.then(must);
};
api.updateTrip = function (id, patch) { return sb.from('trips').update(patch).eq('id', id).then(must); };
api.deleteTrip = function (id) { return sb.from('trips').delete().eq('id', id).then(must); };
api.renameMe = function (tripId, userId, name) {
  return sb.from('members').update({ name: name }).eq('trip_id', tripId).eq('user_id', userId).then(must);
};
api.leaveTrip = function (tripId, userId) {
  return sb.from('members').delete().eq('trip_id', tripId).eq('user_id', userId).then(must);
};

/* ---------- 予定・持ち物・投稿 ---------- */
api.insert = function (table, row) { return sb.from(table).insert(row).select().single().then(must); };
api.insertMany = function (table, rows) { return sb.from(table).insert(rows).select().then(must); };
api.update = function (table, id, patch) { return sb.from(table).update(patch).eq('id', id).then(must); };
api.remove = function (table, id) { return sb.from(table).delete().eq('id', id).then(must); };
/* 予定を消す前に、その予定に付いていた投稿へ場所の名前を残す */
api.keepPostPlace = function (eventId, name) {
  return sb.from('posts').update({ place_name: name }).eq('event_id', eventId).then(must);
};

/* ---------- 写真 ---------- */
var urlCache = {};
api.uploadPhoto = function (tripId, blob) {
  var path = tripId + '/' + TB.uuid() + '.jpg';
  return sb.storage.from(cfg.photoBucket).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
    .then(function (r) { must(r); return path; });
};
api.removePhotos = function (paths) {
  paths = (paths || []).filter(Boolean);
  if (!paths.length) return Promise.resolve();
  paths.forEach(function (p) { delete urlCache[p]; });
  return sb.storage.from(cfg.photoBucket).remove(paths).then(function () {}, function () {});
};
api.photoUrls = function (paths) {
  var now = Date.now(), need = [];
  paths.forEach(function (p) { if (p && (!urlCache[p] || urlCache[p].exp < now) && need.indexOf(p) < 0) need.push(p); });
  var done = need.length ? sb.storage.from(cfg.photoBucket).createSignedUrls(need, 3600).then(function (r) {
    (must(r) || []).forEach(function (x) { if (x && x.signedUrl && !x.error) urlCache[x.path] = { url: x.signedUrl, exp: now + 3000 * 1000 }; });
  }) : Promise.resolve();
  return done.then(function () {
    var out = {};
    paths.forEach(function (p) { if (urlCache[p]) out[p] = urlCache[p].url; });
    return out;
  });
};

/* ---------- リアルタイム同期 ---------- */
api.subscribe = function (tripId, onChange) {
  var ch = sb.channel('trip-' + tripId);
  ['events', 'packing', 'posts', 'members'].forEach(function (t) {
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: 'trip_id=eq.' + tripId }, function () { onChange(t); });
  });
  ch = ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trips', filter: 'id=eq.' + tripId }, function () { onChange('trips'); });
  ch.subscribe();
  return function () { try { sb.removeChannel(ch); } catch (e) {} };
};

/* ---------- 為替 (取れなければ内蔵の参考値を使う) ---------- */
api.fetchRates = function () {
  var K = 'tabicho:rates', now = Date.now(), cached = null;
  try { cached = JSON.parse(localStorage.getItem(K) || 'null'); } catch (e) {}
  if (cached && cached.rates && now - cached.t < 12 * 3600 * 1000) return Promise.resolve(cached);
  var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var timer = ctl ? setTimeout(function () { ctl.abort(); }, 6000) : null;
  return fetch('https://open.er-api.com/v6/latest/JPY', ctl ? { signal: ctl.signal } : {})
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (timer) clearTimeout(timer);
      if (!j || j.result !== 'success' || !j.rates) throw new Error('rates');
      var out = { t: now, date: String(j.time_last_update_utc || '').slice(5, 16), rates: j.rates };
      try { localStorage.setItem(K, JSON.stringify(out)); } catch (e) {}
      return out;
    })
    .catch(function () { if (timer) clearTimeout(timer); return cached || null; });
};

/* ---------- 場所の検索 (OpenStreetMap Nominatim: 1秒に1回まで、入力中の自動検索は禁止) ---------- */
var lastGeo = 0;
api.geocode = function (q, cc) {
  var wait = Math.max(0, lastGeo + 1100 - Date.now());
  return new Promise(function (res) { setTimeout(res, wait); }).then(function () {
    lastGeo = Date.now();
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=ja' +
      (cc ? '&countrycodes=' + encodeURIComponent(String(cc).toLowerCase()) : '') + '&q=' + encodeURIComponent(q);
    return fetch(url, { referrerPolicy: 'strict-origin-when-cross-origin' }).then(function (r) {
      if (!r.ok) throw new Error('geocode ' + r.status);
      return r.json();
    });
  }).then(function (list) {
    return (list || []).map(function (x) {
      var parts = String(x.display_name || '').split(', ');
      return { name: (x.name || parts[0] || q), full: x.display_name || '', lat: +x.lat, lng: +x.lon };
    }).filter(function (x) { return isFinite(x.lat) && isFinite(x.lng); });
  });
};

/* ---------- 写真を縮小する ---------- */
api.shrink = function (file, max, q) {
  max = max || 1100; q = q || 0.78;
  return new Promise(function (res, rej) {
    var u = URL.createObjectURL(file), im = new Image();
    im.onload = function () {
      var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var cv = document.createElement('canvas');
      cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(u);
      cv.toBlob(function (b) { b ? res(b) : rej(new Error('toBlob')); }, 'image/jpeg', q);
    };
    im.onerror = function () { URL.revokeObjectURL(u); rej(new Error('image')); };
    im.src = u;
  });
};
})();
