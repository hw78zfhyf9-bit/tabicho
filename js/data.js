/* 共通のデータと小さな道具 */
(function () {
'use strict';
var TB = window.TB = window.TB || {};

/* perJpy = 1円あたりの現地通貨 (2026-10-09 時点の参考値。通信できたときは最新値に置き換える)
   lat/lng/z = 地図の初期位置 */
TB.RATE_DATE = '2026-10-09';
TB.COUNTRIES = [
  { c: 'KR', n: '韓国', cur: 'KRW', sym: '₩', unit: 100, perJpy: 8.489745, v: '220V', plug: 'C / SE', lat: 37.5665, lng: 126.978, z: 12 },
  { c: 'TW', n: '台湾', cur: 'TWD', sym: 'NT$', unit: 1, perJpy: 0.201906, v: '110V', plug: 'A / B', lat: 25.033, lng: 121.5654, z: 12 },
  { c: 'HK', n: '香港', cur: 'HKD', sym: 'HK$', unit: 1, perJpy: 0.049641, v: '220V', plug: 'G', lat: 22.3193, lng: 114.1694, z: 12 },
  { c: 'CN', n: '中国', cur: 'CNY', sym: '元', unit: 1, perJpy: 0.042483, v: '220V', plug: 'A / C / I', lat: 31.2304, lng: 121.4737, z: 11 },
  { c: 'TH', n: 'タイ', cur: 'THB', sym: '฿', unit: 1, perJpy: 0.212926, v: '220V', plug: 'A / B / C / O', lat: 13.7563, lng: 100.5018, z: 11 },
  { c: 'VN', n: 'ベトナム', cur: 'VND', sym: '₫', unit: 10000, perJpy: 163.70711, v: '220V', plug: 'A / C', lat: 21.0285, lng: 105.8542, z: 12 },
  { c: 'SG', n: 'シンガポール', cur: 'SGD', sym: 'S$', unit: 1, perJpy: 0.008105, v: '230V', plug: 'G', lat: 1.3521, lng: 103.8198, z: 12 },
  { c: 'MY', n: 'マレーシア', cur: 'MYR', sym: 'RM', unit: 1, perJpy: 0.025864, v: '240V', plug: 'G', lat: 3.139, lng: 101.6869, z: 12 },
  { c: 'ID', n: 'インドネシア', cur: 'IDR', sym: 'Rp', unit: 10000, perJpy: 113.080121, v: '230V', plug: 'C / F', lat: -8.65, lng: 115.2167, z: 11 },
  { c: 'PH', n: 'フィリピン', cur: 'PHP', sym: '₱', unit: 1, perJpy: 0.398125, v: '220V', plug: 'A / B / C', lat: 14.5995, lng: 120.9842, z: 11 },
  { c: 'US', n: 'アメリカ', cur: 'USD', sym: '$', unit: 1, perJpy: 0.006328, v: '120V', plug: 'A / B', lat: 40.7128, lng: -74.006, z: 11 },
  { c: 'GB', n: 'イギリス', cur: 'GBP', sym: '£', unit: 1, perJpy: 0.004784, v: '230V', plug: 'G', lat: 51.5072, lng: -0.1276, z: 11 },
  { c: 'FR', n: 'フランス', cur: 'EUR', sym: '€', unit: 1, perJpy: 0.00565, v: '230V', plug: 'C / E', lat: 48.8566, lng: 2.3522, z: 12 },
  { c: 'IT', n: 'イタリア', cur: 'EUR', sym: '€', unit: 1, perJpy: 0.00565, v: '230V', plug: 'C / F / L', lat: 41.9028, lng: 12.4964, z: 12 },
  { c: 'ES', n: 'スペイン', cur: 'EUR', sym: '€', unit: 1, perJpy: 0.00565, v: '230V', plug: 'C / F', lat: 40.4168, lng: -3.7038, z: 12 },
  { c: 'DE', n: 'ドイツ', cur: 'EUR', sym: '€', unit: 1, perJpy: 0.00565, v: '230V', plug: 'C / F', lat: 52.52, lng: 13.405, z: 12 },
  { c: 'AU', n: 'オーストラリア', cur: 'AUD', sym: 'A$', unit: 1, perJpy: 0.009098, v: '230V', plug: 'I', lat: -33.8688, lng: 151.2093, z: 11 }
];

/* 種類ごとの色とピクトグラム (48x48) */
TB.CAT = {
  '食事': { c: 'var(--or)', s: '<path d="M7 24h34c0 9-7.500 16-17 16S7 33 7 24z" fill="#fff"/><path d="M29 6l-7 14M36 8l-7 12"/>' },
  'カフェ': { c: 'var(--pu)', s: '<path d="M9 20h25v9a10 10 0 0 1-10 10h-5A10 10 0 0 1 9 29z" fill="#fff"/><path d="M34 23h3a5 5 0 0 1 0 10h-5M16 7c-2 3 2 4 0 7M24 7c-2 3 2 4 0 7"/>' },
  '観光': { c: 'var(--bl)', s: '<circle cx="35" cy="14" r="5" fill="#fff"/><path d="M5 39l13-21 9 13 5-7 11 15z" fill="#fff"/>' },
  '買い物': { c: 'var(--pk)', s: '<path d="M10 17h28l-2 24H12z" fill="#fff"/><path d="M17 17v-3a7 7 0 0 1 14 0v3"/>' },
  '移動': { c: 'var(--mn)', s: '<rect x="10" y="7" width="28" height="29" rx="7" fill="#fff"/><path d="M10 25h28"/><rect x="16" y="12" width="16" height="8" rx="2"/><circle cx="18" cy="31" r="1.500" fill="#1B1740"/><circle cx="30" cy="31" r="1.500" fill="#1B1740"/><path d="M16 42l4-6M32 42l-4-6"/>' },
  '宿泊': { c: 'var(--y)', s: '<path d="M6 38V12M6 30h36v8M42 30v-4a6 6 0 0 0-6-6H21v10"/><rect x="9" y="20" width="9" height="7" rx="3" fill="#fff"/>' },
  'その他': { c: 'var(--gy)', s: '<path d="M24 7l5 11 12 1.500-9 8 2.500 12L24 33l-10.500 6.500L16 27.500l-9-8L19 18z" fill="#fff"/>' }
};
TB.CAT_LIST = ['食事', 'カフェ', '観光', '買い物', '移動', '宿泊', 'その他'];
TB.WD = ['日', '月', '火', '水', '木', '金', '土'];

TB.IC = {
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.200 7-11.200A7 7 0 0 0 5 9.800C5 14.800 12 21 12 21z"/><circle cx="12" cy="9.800" r="2.500"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.500" r="3.500"/><path d="M8.500 7l1.200-2.500h4.600L15.500 7"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.500" stroke-linejoin="round"><path d="M12 3l2.700 5.800 6.300.7-4.700 4.300 1.300 6.200L12 17l-5.600 3 1.300-6.200L3 9.500l6.300-.7z"/></svg>',
  empty: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" style="fill:var(--y);stroke:var(--edge)" stroke-width="3"/><path d="M32 18l4.500 9.500 10.500 1.200-7.800 7 2.200 10.300L32 41l-9.400 5 2.200-10.300-7.800-7 10.500-1.200z" fill="#fff" stroke="#1B1740" stroke-width="2.500" stroke-linejoin="round"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.500" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>'
};

/* ---------- 小さな道具 ---------- */
TB.esc = function (s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
  });
};
TB.num = function (n, d) { return Number(n).toLocaleString('ja-JP', { maximumFractionDigits: d == null ? 0 : d }); };
TB.country = function (code) {
  var c = String(code || '').toUpperCase();
  for (var i = 0; i < TB.COUNTRIES.length; i++) if (TB.COUNTRIES[i].c === c) return TB.COUNTRIES[i];
  return TB.COUNTRIES[0];
};
TB.parseDate = function (s) {
  var p = String(s || '').split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
};
TB.catSvg = function (cat) {
  return '<svg viewBox="0 0 48 48" aria-hidden="true">' + (TB.CAT[cat] || TB.CAT['その他']).s + '</svg>';
};
TB.catColor = function (cat) { return (TB.CAT[cat] || TB.CAT['その他']).c; };
TB.guessCat = function (t) {
  t = String(t || '');
  if (/空港|駅|移動|バス|電車|フライト|出発|到着/.test(t)) return '移動';
  if (/ホテル|宿|チェックイン|チェックアウト/.test(t)) return '宿泊';
  if (/カフェ|コーヒー|cafe|coffee/i.test(t)) return 'カフェ';
  if (/食|ランチ|ラーメン|焼肉|市場|レストラン/.test(t)) return '食事';
  if (/買い物|ショッピング|雑貨|コスメ/.test(t)) return '買い物';
  if (/宮|村|公園|観光|散策|タワー|美術館|寺|博物館/.test(t)) return '観光';
  return 'その他';
};
TB.uuid = function () {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 3 | 8)).toString(16);
  });
};
TB.debounce = function (fn, ms) {
  var t;
  return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); };
};

/* サーバーのエラーを、やさしい日本語にする */
TB.errText = function (e) {
  var m = String((e && (e.message || e.error_description || e.msg)) || e || '');
  var map = [
    [/anonymous_provider_disabled|Anonymous sign-ins are disabled/i, 'Supabaseで「匿名ログイン」がオフになっています。設定でオンにしてください。'],
    [/invalid_code/, '招待コードが違います。もう一度確かめてください。'],
    [/trip_full/, 'この旅は6人までです。'],
    [/too_many_trips/, '作れる旅の数の上限に達しました。'],
    [/not_signed_in/, 'ログインが切れました。ページを開き直してください。'],
    [/row-level security|violates row-level|permission denied/i, 'この操作はできません(権限がありません)。'],
    [/Failed to fetch|NetworkError|network/i, '通信できませんでした。電波を確かめてもう一度試してください。'],
    [/exceeded the maximum allowed size|too large|413/i, '写真のサイズが大きすぎます。'],
    [/mime type/i, 'この形式の写真は使えません。']
  ];
  for (var i = 0; i < map.length; i++) if (map[i][0].test(m)) return map[i][1];
  return 'うまくいきませんでした。' + (m ? '(' + m.slice(0, 80) + ')' : '');
};
})();
