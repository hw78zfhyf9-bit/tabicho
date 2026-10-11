/* 画面の描画 その1: 共通部品、最初の画面、日程、持ち物 */
(function () {
'use strict';
var TB = window.TB, esc = TB.esc, IC = TB.IC;
var V = TB.views = {};

/* 状態は main.js が持つ。ここでは読むだけ */
function st() { return TB.st; }
function ui() { return TB.ui; }

/* ---------- 人 ---------- */
V.member = function (uid) {
  var ms = st().members;
  for (var i = 0; i < ms.length; i++) if (ms[i].user_id === uid) return ms[i];
  return null;
};
V.memberName = function (uid) {
  if (!uid) return '共有';
  var m = V.member(uid);
  return m ? m.name : '抜けた人';
};
V.badge = function (uid, small) {
  var m = uid ? V.member(uid) : null, cls, ch;
  if (!uid) { cls = 'all'; ch = '共'; }
  else if (!m) { cls = 'all'; ch = '?'; }
  else { cls = 'c' + (m.color % 6); ch = Array.from(m.name)[0] || '?'; }
  var nm = V.memberName(uid);
  return '<span class="bd ' + cls + (small ? ' sm' : '') + '" title="' + esc(nm) + '">' + esc(ch) + '</span>';
};
V.me = function () { return st().user ? st().user.id : null; };
V.whoRadios = function (name, sel, withShared) {
  var h = st().members.map(function (m) {
    return '<label class="pill who"><input type="radio" name="' + name + '" value="' + esc(m.user_id) + '"' + (m.user_id === sel ? ' checked' : '') + '>' + V.badge(m.user_id, true) + esc(m.name) + '</label>';
  }).join('');
  if (withShared) h += '<label class="pill who"><input type="radio" name="' + name + '" value=""' + (!sel ? ' checked' : '') + '><span class="bd sm all">共</span>共有</label>';
  return '<div class="seg">' + h + '</div>';
};

/* ---------- 為替 ---------- */
V.perUnit = function () {
  var c = TB.country(st().trip.country);
  var ov = ui().rateOv[c.cur];
  if (ov > 0) return ov * c.unit;
  var live = ui().rates && ui().rates.rates && ui().rates.rates[c.cur];
  if (live > 0) return c.unit / live;
  return c.unit / c.perJpy;
};
V.rateLabel = function () {
  var c = TB.country(st().trip.country), p = V.perUnit();
  return TB.num(c.unit) + c.sym + ' = ' + TB.num(p, p < 10 ? 2 : 1) + '円';
};
V.rateSource = function () {
  var c = TB.country(st().trip.country);
  if (ui().rateOv[c.cur] > 0) return '手入力のレート';
  if (ui().rates && ui().rates.rates && ui().rates.rates[c.cur] > 0) return '自動取得 ' + (ui().rates.date || '');
  return '参考値 ' + TB.RATE_DATE.replace(/-/g, '/');
};

/* ---------- 日付 ---------- */
V.dayCount = function () {
  var t = st().trip, a = TB.parseDate(t.start_date), b = TB.parseDate(t.end_date);
  if (!t.start_date || !t.end_date || isNaN(a) || isNaN(b) || b < a) return 1;
  return Math.min(31, Math.round((b - a) / 864e5) + 1);
};
V.dayInfo = function (i) {
  if (i < 0) return { d1: '未定', d2: '', full: 'まだ決めてない' };
  var t = st().trip, a = TB.parseDate(t.start_date);
  if (!t.start_date || isNaN(a)) return { d1: 'DAY', d2: String(i + 1), full: 'Day ' + (i + 1) };
  var d = new Date(a.getFullYear(), a.getMonth(), a.getDate() + i);
  return { d1: TB.WD[d.getDay()], d2: (d.getMonth() + 1) + '/' + d.getDate(), full: (d.getMonth() + 1) + '/' + d.getDate() + '(' + TB.WD[d.getDay()] + ')' };
};

/* ---------- ヘッダー ---------- */
V.tripHeader = function () {
  var t = st().trip, c = TB.country(t.country);
  var people = st().members.map(function (m) { return V.badge(m.user_id, false); }).join('');
  var dr = (t.start_date && t.end_date) ? '<span class="chip mono">' + esc(t.start_date.slice(5).replace('-', '/')) + ' – ' + esc(t.end_date.slice(5).replace('-', '/')) + '</span>' : '';
  return '<button class="back" data-act="home">' + IC.back + 'ほかの旅</button>' +
    '<div class="hd-top"><div class="trip-name">' + esc(t.name) + '</div><div class="acts" style="gap:2px;flex:none" aria-label="メンバー">' + people + '</div></div>' +
    '<div class="hd-sub"><span class="chip pk">' + esc(c.n) + '</span><span class="chip y mono">' + esc(V.rateLabel()) + '</span>' + dr + '</div>';
};
V.homeHeader = function () {
  return '<div class="hero"><h1>旅帖</h1><p>ふたりで、みんなで。旅の予定と思い出を、ひとつに。</p></div>';
};

/* ---------- 最初の画面 ---------- */
V.home = function () {
  var s = st(), u = ui();
  var err = u.err ? '<div class="err" role="alert">' + esc(u.err) + '</div>' : '';
  var cards = s.trips.map(function (t) {
    var c = TB.country(t.country), n = (t.members || []).length;
    var when = t.start_date ? t.start_date.replace(/-/g, '/') : '日程はこれから';
    return '<button type="button" class="trip-card" data-act="openTrip" data-id="' + esc(t.id) + '"><span class="flag">' + esc(t.country) + '</span>' +
      '<span><div class="t">' + esc(t.name) + '</div><div class="s">' + esc(c.n) + ' ・ ' + esc(when) + ' ・ ' + n + '人</div></span><span class="chip">開く</span></button>';
  }).join('');
  var nick = u.nick || '';
  var cOpts = TB.COUNTRIES.map(function (x, i) {
    var dup = TB.COUNTRIES.slice(0, i).some(function (y) { return y.c === x.c; });
    return dup ? '' : '<option value="' + x.c + '"' + (x.c === (u.newCountry || 'KR') ? ' selected' : '') + '>' + esc(x.n) + '</option>';
  }).join('');
  var joinCard = '<form class="form card" data-form="join"><div class="sec-hd"><h2>招待コードで参加</h2></div>' +
    '<div class="field"><label for="j-code">招待コード(またはリンクの末尾)</label><input class="in mono" id="j-code" name="code" value="' + esc(u.joinCode || '') + '" required autocomplete="off" autocapitalize="off" placeholder="例: 3f9a1c0b7d2e"></div>' +
    '<div class="field"><label for="j-nick">この旅でのあなたの名前</label><input class="in" id="j-nick" name="nick" value="' + esc(nick) + '" maxlength="12" required autocomplete="nickname"></div>' +
    '<div class="acts"><button class="btn" type="submit">参加する</button></div></form>';
  var newForm = u.form === 'newTrip' ?
    '<form class="form card" data-form="newTrip"><div class="sec-hd"><h2>新しい旅</h2></div>' +
    '<div class="field"><label for="n-name">旅の名前</label><input class="in" id="n-name" name="name" required maxlength="60" placeholder="例: ソウル 3泊4日" autocomplete="off"></div>' +
    '<div class="field"><label for="n-cty">行き先の国</label><select class="in" id="n-cty" name="country">' + cOpts + '</select></div>' +
    '<div class="grid2"><div class="field"><label for="n-st">出発</label><input class="in" id="n-st" type="date" name="start"></div><div class="field"><label for="n-en">帰着</label><input class="in" id="n-en" type="date" name="end"></div></div>' +
    '<div class="field"><label for="n-nick">この旅でのあなたの名前</label><input class="in" id="n-nick" name="nick" value="' + esc(nick) + '" maxlength="12" required autocomplete="nickname"></div>' +
    '<div class="acts"><button class="btn" type="submit">作る</button><button class="btn plain" type="button" data-act="cancelForm">やめる</button></div></form>' : '';
  var list = cards ? '<div class="plist">' + cards + '</div>' :
    '<div class="empty">' + IC.empty + 'まだ旅がありません。<br>新しく作るか、招待コードで参加しましょう。</div>';
  return '<div class="pane">' + err +
    '<div class="sec-hd"><h2>あなたの旅</h2><button class="btn sm" data-act="form" data-f="newTrip">＋ 新しい旅</button></div>' +
    newForm + list + joinCard +
    '<div class="muted">ログインは不要です。このブラウザで自動的にあなた用のIDが作られます。ブラウザのデータを消すと旅に入れなくなるので、気をつけてください。</div></div>';
};

/* 匿名ログインがオフのとき、直し方を案内する */
V.setupHelp = function () {
  var msg = ui().errRaw || '';
  var anon = /anonymous/i.test(msg);
  var body = anon ?
    '<h2>Supabaseの設定を1つ変えてください</h2>' +
    '<ol class="steps"><li>Supabaseの画面で、左メニューの「Authentication」を開く</li><li>「Sign In / Providers」を開く</li><li>「Allow anonymous sign-ins」をオンにして保存</li><li>このページを開き直す</li></ol>' :
    '<h2>うまく接続できませんでした</h2><div class="muted">通信を確かめて、もう一度試してください。直らないときは、Supabaseのプロジェクトが一時停止していないか確かめてください。</div>';
  return '<div class="pane"><div class="err" role="alert">ログインの準備ができていません。</div>' +
    '<section class="card form">' + body +
    '<div class="muted">' + esc(msg.slice(0, 160)) + '</div><div class="acts"><button class="btn" data-act="retry">もう一度試す</button></div></section></div>';
};

/* ---------- 日程 ---------- */
V.eventCard = function (e, n) {
  var c = TB.country(st().trip.country);
  var tile = e.ref_path ? '<img data-ph="' + esc(e.ref_path) + '" alt="' + esc(e.title) + 'の参考写真">' : TB.catSvg(e.cat);
  var hasPos = e.lat != null && e.lng != null;
  var pin = hasPos ?
    '<button class="icon-btn" data-act="showOnMap" data-id="' + e.id + '" aria-label="地図で見る">' + IC.pin + '</button>' :
    '<button class="icon-btn" data-act="placeOnMap" data-id="' + e.id + '" aria-label="地図に置く" title="地図に置く" style="color:var(--pk)">' + IC.pin + '</button>';
  var move = '';
  if (e.day < 0) {
    var o = '<option value="">日にちを決める</option>';
    for (var i = 0; i < n; i++) o += '<option value="' + i + '">' + esc(V.dayInfo(i).full) + '</option>';
    move = '<select class="in" style="padding:1px 8px;font-size:12px;border-radius:10px;justify-self:start;width:auto" data-chg="move" data-id="' + e.id + '" aria-label="日にちを決める">' + o + '</select>';
  }
  var visit = '<button type="button" class="chip ' + (e.visited ? 'mn' : '') + '" style="justify-self:start;cursor:pointer;padding:0 10px" data-act="visit" data-id="' + e.id + '" aria-pressed="' + !!e.visited + '">' + (e.visited ? '✓ 行った' : '行きたい') + '</button>';
  return '<article class="ev' + (e._pending ? ' sync' : '') + '"><div class="tile" style="background:' + TB.catColor(e.cat) + '">' + tile + V.badge(e.by, true) + '</div>' +
    '<div class="ev-body">' + (e.time ? '<span class="ev-time">' + esc(e.time) + '</span>' : '') +
    '<div class="ev-title">' + esc(e.title) + '</div>' + (e.note ? '<div class="ev-note">' + esc(e.note) + '</div>' : '') + visit + move + '</div>' +
    '<div class="ev-acts">' + pin +
    '<button class="icon-btn" data-act="pick" data-id="' + e.id + '" aria-label="参考の写真を付ける">' + IC.cam + '</button>' +
    '<button class="icon-btn del" data-act="delEv" data-id="' + e.id + '" aria-label="この予定を削除">' + IC.x + '</button></div></article>';
};
V.schedule = function () {
  var s = st(), u = ui(), n = V.dayCount();
  if (u.day >= n) u.day = n - 1;
  if (u.day < -1) u.day = 0;
  var chips = '<button type="button" class="day tbd" data-act="day" data-i="-1" aria-pressed="' + (u.day === -1) + '"><div class="d1">未定</div><div class="d2">' + IC.star + '</div></button>';
  for (var i = 0; i < n; i++) {
    var di = V.dayInfo(i);
    chips += '<button type="button" class="day" data-act="day" data-i="' + i + '" aria-pressed="' + (i === u.day) + '"><div class="d1">' + esc(di.d1) + '</div><div class="d2">' + esc(di.d2) + '</div></button>';
  }
  var items = s.events.filter(function (e) { return u.day < 0 ? e.day < 0 : (e.day >= 0 && Math.min(e.day, n - 1) === u.day); })
    .sort(function (a, b) { return (a.time || '99:99') < (b.time || '99:99') ? -1 : (a.time || '99:99') > (b.time || '99:99') ? 1 : 0; });
  var empty = '<div class="empty">' + IC.empty + (u.day < 0 ? '行きたい場所をここにためよう' : 'この日はまだ空っぽ') + '</div>';
  if (!s.events.length && TB.country(s.trip.country).c === 'KR') {
    empty += '<div class="acts" style="justify-content:center"><button class="btn sm plain" data-act="sample">ソウルのサンプルを入れてみる</button></div>';
  }
  var list = items.length ? '<div class="tl">' + items.map(function (e) { return V.eventCard(e, n); }).join('') + '</div>' : empty;
  var cats = TB.CAT_LIST.map(function (k, idx) {
    return '<label class="pill cat"><input type="radio" name="cat" value="' + k + '"' + (idx === 0 ? ' checked' : '') + '><span class="cat-tile" style="background:' + TB.CAT[k].c + '">' + TB.catSvg(k) + '</span>' + k + '</label>';
  }).join('');
  var form = u.form === 'ev' ?
    '<form class="form card" data-form="ev"><div class="seg" role="radiogroup" aria-label="種類">' + cats + '</div>' +
    '<div class="field"><label for="f-title">なにする?</label><input class="in" id="f-title" name="title" required maxlength="80" placeholder="例: 景福宮" autocomplete="off"></div>' +
    '<div class="grid2">' + (u.day < 0 ? '' : '<div class="field"><label for="f-time">時間</label><input class="in" id="f-time" name="time" type="time"></div>') +
    '<div class="field"><label for="f-note">ひとこと</label><input class="in" id="f-note" name="note" maxlength="200" placeholder="予約など" autocomplete="off"></div></div>' +
    '<label class="drop"><input type="file" accept="image/*" data-chg="refdraft">' + (u.draftRef ? '写真を選び直す' : '参考の写真を付ける') + '</label>' +
    '<div class="thumb" id="refDraft">' + (u.draftRef ? '<img src="' + esc(u.draftRef.url) + '" alt="選んだ写真">' : '') + '</div>' +
    '<div class="acts"><button class="btn" type="submit"' + (u.busy ? ' disabled' : '') + '>追加</button><button class="btn plain" type="button" data-act="cancelForm">やめる</button></div></form>' : '';
  return '<div class="pane"><div class="days" role="group" aria-label="日付">' + chips + '</div>' +
    '<div class="sec-hd"><h2>' + esc(V.dayInfo(u.day).full) + '</h2><button class="btn sm" data-act="form" data-f="ev">＋ 追加</button></div>' + form + list + '</div>';
};

/* ---------- 持ち物 ---------- */
V.packing = function () {
  var s = st(), u = ui(), c = TB.country(s.trip.country), v = parseInt(c.v, 10);
  var all = s.packing, done = all.filter(function (p) { return p.done; }).length;
  var vis = all.filter(function (p) { return u.pkFilter === 'all' || (u.pkFilter === 'shared' ? !p.owner : p.owner === u.pkFilter); });
  var pills = '<button type="button" class="pill" data-act="pkf" data-id="all" aria-pressed="' + (u.pkFilter === 'all') + '">ぜんぶ</button>' +
    '<button type="button" class="pill who" data-act="pkf" data-id="shared" aria-pressed="' + (u.pkFilter === 'shared') + '"><span class="bd sm all">共</span>共有</button>' +
    s.members.map(function (m) { return '<button type="button" class="pill who" data-act="pkf" data-id="' + esc(m.user_id) + '" aria-pressed="' + (u.pkFilter === m.user_id) + '">' + V.badge(m.user_id, true) + esc(m.name) + '</button>'; }).join('');
  var rows = vis.length ? '<div class="pk-list">' + vis.map(function (p) {
    return '<div class="pk' + (p.done ? ' done' : '') + '"><input type="checkbox" id="k' + p.id + '" data-chg="pk" data-id="' + p.id + '"' + (p.done ? ' checked' : '') + '>' +
      '<label class="nm" for="k' + p.id + '">' + esc(p.name) + '</label>' + V.badge(p.owner, true) +
      '<button class="icon-btn del" data-act="delPk" data-id="' + p.id + '" aria-label="削除">' + IC.x + '</button></div>';
  }).join('') + '</div>' : '<div class="empty">' + IC.empty + '持ち物を入れよう</div>';
  var has = all.some(function (p) { return p.name.indexOf('プラグ') >= 0; });
  var plug = '<section class="card"><div class="plug"><span class="chip y mono">' + esc(c.v) + '</span><span class="chip mono">' + esc(c.plug) + '</span>' +
    (v > 127 ? '<span class="chip or">変換プラグが必要</span>' : '<span class="chip mn">日本とほぼ同じ</span>') +
    (v > 127 && !has ? '<button class="btn sm" data-act="addPlug">持ち物に入れる</button>' : '') + '</div></section>';
  var form = '<form class="form card" data-form="pk"><div class="field"><label for="k-name">持ち物を追加</label><input class="in" id="k-name" name="name" required maxlength="60" placeholder="例: 折りたたみ傘" autocomplete="off"></div>' +
    '<div class="field"><span class="lbl">だれが持つ?</span>' + V.whoRadios('owner', '', true) + '</div>' +
    '<div class="acts"><button class="btn" type="submit">追加</button></div></form>';
  return '<div class="pane">' + plug +
    '<section class="card"><div class="sec-hd"><h2>持ち物</h2><span class="chip mn mono">' + done + ' / ' + all.length + '</span></div>' +
    '<div class="prog" aria-hidden="true"><i style="width:' + (all.length ? Math.round(done / all.length * 100) : 0) + '%"></i></div>' +
    '<div class="seg" style="margin-bottom:8px">' + pills + '</div>' + rows + '</section>' + form + '</div>';
};
})();
