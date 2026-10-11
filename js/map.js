/* 地図 (Leaflet + OpenStreetMap)。地図本体は1つだけ作って、画面を描き直しても使い回す */
(function () {
'use strict';
var TB = window.TB;
var el = null, map = null, layer = null, fittedFor = '';

var M = TB.map = {};

M.available = function () { return !!window.L; };

function ensure() {
  if (!window.L) return null;
  if (map) return map;
  var c = TB.country(TB.st.trip ? TB.st.trip.country : 'KR');
  el = document.createElement('div');
  el.id = 'mapEl';
  map = L.map(el, { zoomControl: true, attributionControl: true, tap: true }).setView([c.lat, c.lng], c.z);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
  }).addTo(map);
  layer = L.layerGroup().addTo(map);
  map.on('click', function (e) { if (TB.onMapClick) TB.onMapClick(e.latlng.lat, e.latlng.lng); });
  return map;
}

function icon(cat, visited, sel, draft) {
  var color = draft ? 'var(--pk)' : TB.catColor(cat);
  return L.divIcon({
    className: 'tbpin' + (sel ? ' sel' : '') + (draft ? ' draft' : ''),
    html: TB.views.pinSvg(cat, visited, color),
    iconSize: [34, 40], iconAnchor: [17, 40]
  });
}

/* 画面に地図を差し込む */
M.mount = function () {
  var host = document.getElementById('mapHost');
  if (!host || !ensure()) return;
  if (el.parentNode !== host) host.appendChild(el);
  map.invalidateSize();
  M.sync();
  var t = TB.st.trip;
  if (t && fittedFor !== t.id) { fittedFor = t.id; M.fit(); }
};

M.sync = function () {
  if (!map) return;
  layer.clearLayers();
  var u = TB.ui;
  TB.views.placed().forEach(function (e) {
    var mk = L.marker([e.lat, e.lng], { icon: icon(e.cat, e.visited, e.id === u.selEv, false), title: e.title, keyboard: true });
    mk.on('click', function () { if (TB.onPinClick) TB.onPinClick(e.id); });
    mk.addTo(layer);
  });
  if (u.draft) L.marker([u.draft.lat, u.draft.lng], { icon: icon('その他', false, false, true), interactive: false }).addTo(layer);
};

M.fit = function () {
  if (!map) return;
  var pins = TB.views.placed();
  if (pins.length) {
    var b = L.latLngBounds(pins.map(function (p) { return [p.lat, p.lng]; }));
    map.fitBounds(b, { padding: [40, 40], maxZoom: 15 });
  } else {
    var c = TB.country(TB.st.trip.country);
    map.setView([c.lat, c.lng], c.z);
  }
};

M.flyTo = function (lat, lng, z) {
  if (!map) return;
  map.setView([lat, lng], Math.max(map.getZoom(), z || 15), { animate: true });
};

/* 旅を切り替えたときに、次に開いたとき全体を映し直す */
M.reset = function () { fittedFor = ''; };
})();
