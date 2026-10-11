/* 画面の描画 その2: 地図、思い出、設定 */
(function () {
'use strict';
var TB = window.TB, esc = TB.esc, IC = TB.IC, V = TB.views;
function st() { return TB.st; }
function ui() { return TB.ui; }

/* ---------- 地図のピン ---------- */
V.pinSvg = function (cat, visited, color) {
  var fill = color || TB.catColor(cat);
  var check = visited ? '<g transform="translate(20 -4)"><circle cx="8" cy="8" r="8" style="fill:var(--mn)" stroke="#1B1740" stroke-width="2"/><path d="M4.500 8.200l2.500 2.500 4.500-5" fill="none" stroke="#1B1740" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round"/></g>' : '';
  return '<svg viewBox="0 0 34 40" aria-hidden="true"><path d="M17 38C17 38 3 25 3 14.500a14 14 0 0 1 28 0C31 25 17 38 17 38z" style="fill:' + fill + '" stroke="#1B1740" stroke-width="2.500"' + (visited ? '' : ' stroke-dasharray="4 3"') + '/><circle cx="17" cy="14.500" r="5.500" fill="#fff" stroke="#1B1740" stroke-width="2"/>' + check + '</svg>';
};
V.mapsLink = function (e) {
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(e.lat + ',' + e.lng);
};
V.placed = function () { return st().events.filter(function (e) { return e.lat != null && e.lng != null; }); };

V.map = function () {
  var s = st(), u = ui(), n = V.dayCount();
  var pins = V.placed();
  var done = pins.filter(function (p) { return p.visited; }).length;
  var target = u.placeFor ? s.events.filter(function (e) { return e.id === u.placeFor; })[0] : null;
  var hasL = !!window.L;

  var banner = target ? '<div class="banner"><span>『' + esc(target.title) + '』の場所を決めよう</span><button class="btn sm" data-act="cancelPlace">やめる</button></div>' : '';
  var searchForm = (u.form === 'search' || target) ?
    '<form class="form card" data-form="search"><div class="field"><label for="q">場所を検索(名前や住所)</label><div class="copyrow"><input class="in" id="q" name="q" value="' + esc(u.q || (target ? target.title : '')) + '" maxlength="80" autocomplete="off" placeholder="例: 広蔵市場"><button class="btn" type="submit"' + (u.busy ? ' disabled' : '') + '>検索</button></div></div>' +
    '<div class="muted">入力しただけでは検索しません。「検索」を押してください。見つからないときは、地図をタップしても置けます。</div>' +
    (u.results ? (u.results.length ? '<div class="results">' + u.results.map(function (r, i) {
      return '<button type="button" class="res" data-act="pickRes" data-i="' + i + '"><b>' + esc(r.name) + '</b>' + esc(r.full) + '</button>';
    }).join('') + '</div>' : '<div class="empty" style="padding:8px">見つかりませんでした。別の言葉か、地図のタップで置いてください。</div>') : '') +
    '</form>' : '';
  var toolbar = '<div class="acts"><span class="chip mn mono">行った ' + done + ' / ' + pins.length + '</span>' +
    (u.pickMode ? '<span class="chip pk">地図をタップ</span><button class="btn sm plain" data-act="pickMode">やめる</button>' : '<button class="btn sm pk" data-act="pickMode">地図をタップして置く</button>') + '</div>';
  var box = hasL ? '<div class="mapwrap' + (u.pickMode ? ' pick' : '') + '"><div id="mapHost"></div></div>' :
    '<div class="card"><div class="muted">地図を読み込めませんでした。通信を確かめてページを開き直してください。場所のリストは下に出ます。</div></div>';

  var panel = '';
  if (u.draft) {
    if (target) {
      panel = '<section class="card form"><div class="mem-hd"><span class="cat-tile" style="background:' + TB.catColor(target.cat) + '">' + TB.catSvg(target.cat) + '</span><h3>『' + esc(target.title) + '』をここに置く</h3></div>' +
        '<div class="muted">' + esc(u.draft.name || '地図で選んだ場所') + '</div>' +
        '<div class="acts"><button class="btn" data-act="confirmPlace"' + (u.busy ? ' disabled' : '') + '>ここに置く</button><button class="btn plain" data-act="cancelPlace">やめる</button></div></section>';
    } else {
      var cat0 = TB.guessCat(u.draft.name);
      var cats = TB.CAT_LIST.map(function (k) {
        return '<label class="pill cat tileonly" title="' + k + '"><input type="radio" name="cat" value="' + k + '" aria-label="' + k + '"' + (k === cat0 ? ' checked' : '') + '><span class="cat-tile" style="background:' + TB.CAT[k].c + '">' + TB.catSvg(k) + '</span></label>';
      }).join('');
      var dayOpts = '<option value="-1">まだ決めてない</option>';
      for (var i = 0; i < n; i++) dayOpts += '<option value="' + i + '">' + esc(V.dayInfo(i).full) + '</option>';
      panel = '<form class="form card" data-form="pin"><div class="sec-hd"><h2>ここにピンを立てる</h2></div>' +
        '<div class="field"><label for="pn-t">名前</label><input class="in" id="pn-t" name="title" value="' + esc(u.draft.name || '') + '" required maxlength="80" autocomplete="off"></div>' +
        '<div class="seg" role="radiogroup" aria-label="種類">' + cats + '</div>' +
        '<div class="grid2"><div class="field"><label for="pn-d">日にち</label><select class="in" id="pn-d" name="day">' + dayOpts + '</select></div>' +
        '<div class="field"><span class="lbl">状態</span><div class="seg"><label class="pill"><input type="radio" name="status" value="want" checked>行きたい</label><label class="pill"><input type="radio" name="status" value="done">行った</label></div></div></div>' +
        '<div class="acts"><button class="btn" type="submit"' + (u.busy ? ' disabled' : '') + '>立てる</button><button class="btn plain" type="button" data-act="cancelDraft">やめる</button></div></form>';
    }
  } else if (u.selEv) {
    var se = pins.filter(function (p) { return p.id === u.selEv; })[0];
    if (se) {
      panel = '<section class="card"><div class="mem-hd"><span class="cat-tile" style="background:' + TB.catColor(se.cat) + '">' + TB.catSvg(se.cat) + '</span><h3>' + esc(se.title) + '</h3>' + V.badge(se.by, true) + '</div>' +
        '<div class="acts" style="margin-top:10px">' +
        '<button class="btn sm' + (se.visited ? ' plain' : '') + '" data-act="visit" data-id="' + se.id + '">' + (se.visited ? '行ったを取り消す' : '行った!') + '</button>' +
        '<button class="btn sm plain" data-act="writeMem" data-id="' + se.id + '">思い出を書く</button>' +
        '<a class="btn sm plain" href="' + esc(V.mapsLink(se)) + '" target="_blank" rel="noopener">地図アプリで見る</a>' +
        '<button class="btn sm plain" data-act="placeOnMap" data-id="' + se.id + '">場所を変える</button>' +
        '<button class="icon-btn del" data-act="unpin" data-id="' + se.id + '" aria-label="ピンを外す" title="ピンを外す">' + IC.x + '</button></div></section>';
    }
  }
  var list = pins.length ? '<div class="plist">' + pins.map(function (p) {
    return '<button type="button" class="prow" data-act="selEv" data-id="' + p.id + '" aria-pressed="' + (p.id === u.selEv) + '"><span class="cat-tile" style="background:' + TB.catColor(p.cat) + '">' + TB.catSvg(p.cat) + '</span><span class="ev-title">' + esc(p.title) + '</span>' +
      (p.visited ? '<span class="chip mn">行った</span>' : '<span class="chip">行きたい</span>') + '</button>';
  }).join('') + '</div>' : '<div class="empty">' + IC.empty + '場所を検索して、ピンを立てよう</div>';
  var unplaced = s.events.filter(function (e) { return e.lat == null; });
  var more = unplaced.length ? '<div class="muted">場所が未設定の予定が ' + unplaced.length + ' 件あります。日程の画面で、ピンのボタンから置けます。</div>' : '';
  return '<div class="pane"><div class="sec-hd"><h2>地図</h2><button class="btn sm" data-act="form" data-f="search">＋ 場所</button></div>' +
    banner + searchForm + toolbar + box + panel + list + more + '</div>';
};

/* ---------- 思い出 ---------- */
V.postDate = function (iso) {
  var d = new Date(iso);
  if (!iso || isNaN(d)) return '';
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};
V.memories = function () {
  var s = st(), u = ui(), me = V.me();
  var posts = s.posts.filter(function (p) { return u.memFilter === 'all' || p.by === u.memFilter; });
  var photoCount = s.posts.reduce(function (a, p) { return a + (p.photos || []).length; }, 0);
  var evById = {}; s.events.forEach(function (e) { evById[e.id] = e; });
  var groups = {}, order = [];
  posts.forEach(function (p) {
    var ev = p.event_id ? evById[p.event_id] : null;
    var k = ev ? 'e:' + ev.id : 'n:' + (p.place_name || 'その他の場所');
    if (!groups[k]) { groups[k] = { title: ev ? ev.title : (p.place_name || 'その他の場所'), cat: ev ? ev.cat : 'その他', list: [] }; order.push(k); }
    groups[k].list.push(p);
  });
  var feed = order.map(function (k) {
    var g = groups[k];
    var counts = s.members.map(function (m) {
      var cnt = g.list.filter(function (p) { return p.by === m.user_id; }).length;
      return cnt ? '<span class="bd sm c' + (m.color % 6) + '" title="' + esc(m.name) + '">' + cnt + '</span>' : '';
    }).join('');
    var body = g.list.map(function (p, idx) {
      var ph = p.photos || [];
      var imgs = ph.length ? '<div class="ph' + (ph.length === 1 ? ' one' : '') + '">' + ph.map(function (path) { return '<img data-ph="' + esc(path) + '" alt="' + esc(g.title) + 'の写真">'; }).join('') + '</div>' : '';
      return '<div class="post' + (idx === 0 ? ' first' : '') + '"><div class="post-hd">' + V.badge(p.by, true) + '<b>' + esc(V.memberName(p.by)) + '</b><span class="sp"></span><span class="muted mono">' + esc(V.postDate(p.created_at)) + '</span>' +
        (p.by === me ? '<button class="icon-btn del" data-act="delPost" data-id="' + p.id + '" aria-label="この投稿を削除">' + IC.x + '</button>' : '') + '</div>' +
        (p.body ? '<p>' + esc(p.body) + '</p>' : '') + imgs + '</div>';
    }).join('');
    return '<section class="card mem-place"><div class="mem-hd"><span class="cat-tile" style="background:' + TB.catColor(g.cat) + '">' + TB.catSvg(g.cat) + '</span><h3>' + esc(g.title) + '</h3><span class="counts">' + counts + '</span></div>' + body + '</section>';
  }).join('') || '<div class="empty">' + IC.empty + '写真とひとことを残そう</div>';
  var pills = '<button type="button" class="pill" data-act="mf" data-id="all" aria-pressed="' + (u.memFilter === 'all') + '">みんな</button>' +
    s.members.map(function (m) { return '<button type="button" class="pill who" data-act="mf" data-id="' + esc(m.user_id) + '" aria-pressed="' + (u.memFilter === m.user_id) + '">' + V.badge(m.user_id, true) + esc(m.name) + '</button>'; }).join('');
  var pf = u.prefill;
  var plOpts = s.events.map(function (e) { return '<option value="' + e.id + '"' + (pf && pf.eventId === e.id ? ' selected' : '') + '>' + esc(e.title) + '</option>'; }).join('') +
    '<option value=""' + (pf && !pf.eventId ? ' selected' : '') + '>その他の場所</option>';
  var drafts = u.draftPhotos.map(function (d) { return '<img src="' + esc(d.url) + '" alt="添付する写真">'; }).join('');
  var form = u.form === 'po' ?
    '<form class="form card" data-form="po"><div class="field"><label for="m-pl">どこでの思い出?</label><select class="in" id="m-pl" name="eventId">' + plOpts + '</select></div>' +
    '<div class="field"><label for="m-pn">「その他」のときの場所名</label><input class="in" id="m-pn" name="placeName" maxlength="80" autocomplete="off"></div>' +
    '<div class="field"><label for="m-tx">ひとこと</label><textarea class="in" id="m-tx" name="text" maxlength="2000"></textarea></div>' +
    '<label class="drop"><input type="file" accept="image/*" multiple data-chg="photos">写真を選ぶ(複数OK、最大12枚)</label>' +
    '<div class="ph" id="drafts">' + drafts + '</div>' +
    '<div class="acts"><button class="btn" type="submit"' + (u.busy ? ' disabled' : '') + '>' + (u.busy ? '送っています…' : '投稿') + '</button><button class="btn plain" type="button" data-act="cancelForm">やめる</button></div></form>' : '';
  return '<div class="pane"><div class="sec-hd"><h2>思い出</h2><button class="btn sm" data-act="form" data-f="po">＋ 投稿</button></div>' +
    '<div class="stats"><span class="chip pk mono">' + s.posts.length + ' 投稿</span><span class="chip y mono">' + photoCount + ' 枚</span></div>' +
    form + '<div class="seg">' + pills + '</div>' + feed + '</div>';
};

/* ---------- 設定 ---------- */
V.inviteLink = function () {
  return location.origin + location.pathname + '#j=' + st().trip.invite_code;
};
V.settings = function () {
  var s = st(), u = ui(), t = s.trip, c = TB.country(t.country), me = V.me();
  var cOpts = TB.COUNTRIES.map(function (x, i) {
    var dup = TB.COUNTRIES.slice(0, i).some(function (y) { return y.c === x.c; });
    return dup ? '' : '<option value="' + x.c + '"' + (x.c === c.c ? ' selected' : '') + '>' + esc(x.n) + ' (' + x.cur + ')</option>';
  }).join('');
  var mems = s.members.map(function (m) {
    return m.user_id === me ?
      '<div class="mem-row">' + V.badge(m.user_id, false) + '<input class="in" data-chg="mname" value="' + esc(m.name) + '" aria-label="あなたの名前" maxlength="12"></div>' :
      '<div class="mem-row">' + V.badge(m.user_id, false) + '<div><b>' + esc(m.name) + '</b></div></div>';
  }).join('');
  var canShare = !!(navigator.share);
  var confirmBox = function (act, ask, label) {
    return u.confirm === act ?
      '<div class="acts"><button class="btn sm pk" data-act="' + act + '">' + label + '</button><button class="btn sm plain" data-act="confirmNo">やめる</button></div>' :
      '<div class="acts"><button class="btn sm plain" data-act="' + act + 'Ask">' + ask + '</button></div>';
  };
  var danger = confirmBox('leave', 'この旅から抜ける', '本当に抜ける') +
    (t.created_by === me ? confirmBox('delTrip', 'この旅を削除する(全員分が消えます)', '本当に削除する') : '');
  return '<div class="pane">' +
    '<section class="card form"><div class="sec-hd"><h2>招待</h2><span class="chip mono">' + s.members.length + ' / 6人</span></div>' +
    '<div class="muted">このリンクか、コードを相手に送ると、同じ旅に入れます。</div>' +
    '<div class="copyrow"><div class="code" id="inviteLink">' + esc(V.inviteLink()) + '</div><button class="btn sm" data-act="copyInvite">コピー</button></div>' +
    '<div class="copyrow"><div class="code">' + esc(t.invite_code) + '</div><button class="btn sm plain" data-act="copyCode">コピー</button></div>' +
    (canShare ? '<div class="acts"><button class="btn sm plain" data-act="shareInvite">アプリで送る</button></div>' : '') + '</section>' +
    '<section class="card form"><div class="sec-hd"><h2>旅</h2></div>' +
    '<div class="field"><label for="s-name">名前</label><input class="in" id="s-name" data-chg="tname" value="' + esc(t.name) + '" maxlength="60"></div>' +
    '<div class="field"><label for="s-cty">国</label><select class="in" id="s-cty" data-chg="country">' + cOpts + '</select></div>' +
    '<div class="grid2"><div class="field"><label for="s-st">出発</label><input class="in" id="s-st" type="date" data-chg="start" value="' + esc(t.start_date || '') + '"></div>' +
    '<div class="field"><label for="s-en">帰着</label><input class="in" id="s-en" type="date" data-chg="end" value="' + esc(t.end_date || '') + '"></div></div></section>' +
    '<section class="card form"><div class="sec-hd"><h2>レート</h2><span class="chip mono">' + esc(V.rateSource()) + '</span></div>' +
    '<div class="field"><label for="r-in">' + TB.num(c.unit) + esc(c.sym) + ' = 何円?</label><div class="acts"><input class="in mono" id="r-in" type="number" step="any" min="0" style="max-width:150px" data-chg="rate" value="' + (Math.round(V.perUnit() * 100) / 100) + '"><button class="btn sm plain" data-act="rateReset">自動に戻す</button></div></div>' +
    '<div class="conv"><div class="field"><label for="cv-l">' + esc(c.sym) + '</label><input class="in mono" id="cv-l" type="number" inputmode="decimal" min="0" placeholder="0"></div><div class="eq">=</div>' +
    '<div class="field"><label for="cv-j">円</label><input class="in mono" id="cv-j" type="number" inputmode="decimal" min="0" placeholder="0"></div></div>' +
    '<div class="attr">為替は <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">Rates By Exchange Rate API</a> から取得しています。実際の両替では店や手数料で変わります。</div></section>' +
    '<section class="card form"><div class="sec-hd"><h2>メンバー</h2></div>' + mems + '</section>' +
    '<section class="card form"><div class="sec-hd"><h2>そのほか</h2></div>' +
    '<div class="muted">このブラウザのデータ(Cookieやサイトデータ)を消すと、この旅に入れなくなります。大事な旅のときは気をつけてください。</div>' + danger + '</section></div>';
};
})();
