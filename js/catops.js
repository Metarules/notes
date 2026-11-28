// Операции категории за промежуток статистики: касание строки категории в «Статистике».
// Отдельного запроса «операции категории» у сервера нет — только страницы операций от новых к старым
// (recent с before — номером строки таблицы). Поэтому:
// - промежуток рядом с уже загруженной историей — догружаем историю подряд (она же пригодится в «Операциях»);
// - далёкий промежуток — ищем его место в таблице по номеру строки: строки идут по дате, первая дата и последняя
//   известны, так что номер строки нужной даты можно прикинуть и уточнить за несколько запросов, а потом
//   прочитать только страницы этого промежутка.
// Как в «Операциях»: касание — изменить операцию (и вернуться в этот список), свайп влево — «Удалить».
// items — показанные операции категории (новые сверху), st — состояние загрузки (renderCatOps), msg — текст ошибки;
// scroll — где была статистика, listScroll — где был этот список, когда открыли изменение;
// over — правки, сделанные здесь (ключ операции → новый вид, null — удалена): поверх догружаемых страниц,
// чтобы следующая страница не вернула операцию в прежнем виде
var catv = { cur: null, seq: 0, scroll: 0, listScroll: 0, items: [], st: "", msg: "", over: {} };
var CAT_NEAR_DAYS = 45; // промежуток кончается не дальше стольких дней от загруженной истории — грузим историю подряд
var CAT_SEEK_TRIES = 8; // сколько раз уточняем место далёкого промежутка, дальше — читаем подряд от лучшего найденного

// arg — "spent:id" или "income:id" (из строки категории, stats.js)
function openCatOps(arg) {
  var i = arg.indexOf(":"), kind = arg.slice(0, i), id = arg.slice(i + 1), r = stats.range;
  if (!r) return;
  var sum = 0;
  ((stats.shown && stats.shown.categories) || []).forEach(function (c) { if (String(c.categoryId) === id) sum = c[kind] || 0; });
  catv.cur = { id: id, kind: kind, from: dkey(r.from), to: dkey(r.to), sum: sum,
    label: stats.kind === "c" ? fmtDayMonth(r.from, r.from.getFullYear() !== r.to.getFullYear()) + " – " + fmtDayMonth(r.to, true) : rangeLabel(stats.kind, r) };
  catv.scroll = el("scroller").scrollTop; // вернёмся на то же место статистики
  el("catHead").innerHTML = '<div class="ttl">' + esc(categoryName(id) || id) + '</div>' +
    '<div class="sub">' + esc(catv.cur.label) + ' · ' + esc(fmtEur(sum)) + '</div>';
  el("catList").innerHTML = "";
  catv.items = []; catv.st = ""; catv.over = {};
  navTo("cat");
  loadCatOps();
}

// операция подходит: та категория, тот знак (траты / доходы) и дата внутри промежутка
function catMatch(x) {
  var c = catv.cur, n = Number(x.amount);
  return String(x.categoryId) === c.id && (c.kind === "income" ? n > 0 : n < 0) && x.dayKey >= c.from && x.dayKey <= c.to;
}
function oldestKey(list) { return list.length ? list[list.length - 1].dayKey || "" : ""; }
function maxRow(list) { return list.reduce(function (m, x) { return Math.max(m, Number(x.row) || 0); }, 0); }

// st — "loading" (ещё грузим), "done", "net" (нет связи), "err" (ошибка сервера, msg).
// items — что загружено (любые операции): оставляем только эту категорию и промежуток
function renderCatOps(items, st, msg) {
  var seen = {}, over = catv.over;
  catv.items = items.filter(function (x) { var k = opKey(x); if (seen[k]) return false; seen[k] = 1; return true; })
    .map(function (x) { var k = opKey(x); return k in over ? over[k] : x; })
    .filter(function (x) { return x && catMatch(x); }).sort(byDateDesc);
  catv.st = st; catv.msg = msg || "";
  drawCat();
}
// строки — как в «Операциях» (тот же свайп и та же кнопка «Удалить»), только без названия категории: оно в шапке
function drawCat() {
  var list = catv.items.filter(catMatch), st = catv.st; // после изменения операция могла уйти в другую категорию или дату
  var html = "", lastDay = null;
  list.forEach(function (r) {
    if (r.dayKey !== lastDay) { html += (lastDay !== null ? '</div>' : '') + dayHead(r.dayKey) + '<div class="daygroup">'; lastDay = r.dayKey; }
    var n = Number(r.amount);
    html += '<div class="row' + (r.pending ? " saving" : "") + '" data-k="' + esc(opKey(r)) + '">' +
      '<button class="swipe-del">' + esc(t("delete")) + HZ + '</button>' +
      '<div class="card tx"><div class="tx-main">' +
      '<div><span class="amount' + (n > 0 ? " pos" : "") + '">' + esc(fmtNum(n)) + " " + esc(r.currencyId) + '</span>' +
      (r.amountEUR !== "" && r.currencyId !== "EUR" ? ' <span class="muted">' + esc(fmtNum(r.amountEUR)) + ' EUR</span>' : '') + '</div>' +
      (r.time ? '<div class="tx-sub">' + esc(r.time) + '</div>' : '') +
      (r.pending ? '<div class="tx-sub tx-status"><span class="q sending"><span class="q-spin"></span>' + esc(t("st.saving")) + '</span></div>' : '') +
      '</div></div></div>';
  });
  if (lastDay !== null) html += '</div>';
  if (st === "loading") html += '<div class="pending"><span class="spinner sm"></span></div>';
  else if (st === "net") html += '<p class="center net-text">' + esc(t(list.length ? "cat.netPart" : "stats.waitNet")) + '</p>';
  else if (st === "err") html += '<p class="center muted">' + esc(t("stats.loadFailed", { msg: catv.msg })) +
    ' <button class="link inline" data-act="loadCatOps">' + esc(t("retry")) + '</button></p>';
  else if (!list.length) html += '<p class="center muted">' + esc(t("cat.empty")) + '</p>';
  swipe.openRow = null;
  el("catList").innerHTML = html;
}
bindSwipe(el("catList"), function (row, e) {
  var k = row.getAttribute("data-k"), r = null;
  catv.items.forEach(function (x) { if (!r && opKey(x) === k) r = x; });
  if (!r || r.pending) return;
  if (e.target.closest(".swipe-del")) { haptic(1); Snd.tap(); deleteOp(r); return; }
  if (swipe.openRow) { closeOpenRow(); return; }
  Snd.tap();
  startEditOp(r, "cat");
});

// изменения из истории и формы (history.js, form.js): операцию меняют, убирают или возвращают
function catReplace(old, now) {
  if (!catv.cur) return;
  catv.over[opKey(old)] = now;
  var hit = false;
  catv.items = catv.items.map(function (x) { if (sameOp(old, x)) { hit = true; return now; } return x; }).filter(Boolean).sort(byDateDesc);
  if (hit) drawCat();
}
function catDrop(r) {
  catReplace(r, null);
  catv.items.forEach(function (x) { if (x.row > r.row) x.row--; }); // строки ниже удалённой в таблице сдвинулись вверх
}
function catRestore(r) {
  if (!catv.cur) return;
  delete catv.over[opKey(r)];
  if (!catMatch(r)) return;
  catv.items.forEach(function (x) { if (x.row >= r.row) x.row++; });
  catv.items = catv.items.concat([r]).sort(byDateDesc);
  drawCat();
}
// сервер подтвердил изменение — снимаем «сохраняется…»
function catEditDone(old) {
  var hit = false;
  catv.items.forEach(function (x) { if (sameOp(old, x) && x.pending) { x.pending = false; hit = true; } });
  if (hit) drawCat();
}
// вернулись к списку: после изменения загрузка шла и дальше — показываем что есть;
// restart — «вперёд» на список: уход с него загрузку остановил (showTab), незаконченную начинаем заново
function catResume(restart) {
  if (!catv.cur) return;
  if (restart && (catv.st === "loading" || !catv.st)) loadCatOps(); else drawCat();
}

function loadCatOps() {
  var c = catv.cur, seq = ++catv.seq;
  if (!c) return;
  function alive() { return seq === catv.seq && catv.cur === c; }
  var have = state.recent || [], old = oldestKey(have);
  // загруженная история уже доходит до начала промежутка (или это вся таблица)
  if (hist.done || (old && old < c.from)) { renderCatOps(have, "done"); return; }
  if (navigator.onLine === false || state.offline) { renderCatOps(have, "net"); return; }
  var near = !old || dayDiff(fromKey(c.to), fromKey(old)) <= CAT_NEAR_DAYS;
  renderCatOps(near ? have : [], "loading");
  if (near) catPageHistory(c, alive); else catSeek(c, alive);
}

function catFail(alive, items) {
  return function (msg, kind) {
    if (!alive()) return;
    renderCatOps(items(), kind === "network" ? "net" : "err", msg);
  };
}

// ближний промежуток: страницы истории подряд, как при прокрутке «Операций» (и в ту же историю)
function catPageHistory(c, alive) {
  if (!alive()) return;
  var have = state.recent || [], old = oldestKey(have);
  if (hist.done || (old && old < c.from)) { renderCatOps(have, "done"); return; }
  if (hist.loading) { setTimeout(function () { catPageHistory(c, alive); }, HIST_REDRAW_RETRY_MS); return; } // идёт подгрузка «Операций»
  var before = Math.min(minRow(have), hist.next || Infinity);
  if (!isFinite(before) || before <= 2) { hist.done = true; renderCatOps(have, "done"); return; }
  hist.loading = true;
  call("apiGetOlder", [before], function (res) {
    hist.loading = false;
    res = res || {};
    hist.next = Number(res.next) || before;
    hist.done = !res.more;
    var items = res.items || [];
    redrawWhenFree(function () {
      var known = {};
      state.recent.forEach(function (x) { known[opKey(x)] = 1; });
      var add = items.filter(function (x) { return !known[opKey(x)]; });
      if (add.length) renderHistory(state.recent.concat(add).sort(byDateDesc));
      if (!alive()) return;
      renderCatOps(state.recent, "loading");
      catPageHistory(c, alive);
    });
  }, function (msg, kind) {
    hist.loading = false;
    catFail(alive, function () { return state.recent || []; })(msg, kind);
  });
}

// далёкий промежуток: ищем последнюю строку таблицы с датой не позже c.to, потом читаем вниз до c.from.
// lo — известная строка с датой ≤ to, hi — с датой > to; между ними номер нужной строки прикидываем по датам.
function catSeek(c, alive) {
  var have = state.recent || [], first = statsFirstDay();
  if (!first || first > c.to) { renderCatOps([], "done"); return; } // операций до конца промежутка нет
  var got = [], lo = { row: 1, key: first }, top = have[0];
  var hi = { row: maxRow(have) + 1, key: top ? top.dayKey : dkey(todayD()) }, tries = 0;
  if (top && top.dayKey <= c.to) hi.key = dkey(addDays(fromKey(c.to), 1)); // на всякий случай: история новее to
  function days(k) { return dayDiff(fromKey(first), fromKey(k)); }
  function step() {
    if (!alive()) return;
    if (hi.row - lo.row <= 1 || tries >= CAT_SEEK_TRIES) { readDown(hi.row); return; }
    tries++;
    var span = Math.max(1, days(hi.key) - days(lo.key));
    var est = lo.row + (hi.row - lo.row) * (days(c.to) - days(lo.key) + 1) / span;
    // страница — строки [before − HIST_PAGE, before − 1]; ставим прикидку посередине страницы
    var before = Math.round(Math.min(hi.row, Math.max(lo.row + 2, est + HIST_PAGE / 2)));
    call("apiGetOlder", [before], function (res) {
      var items = (res && res.items) || [];
      if (!items.length) { readDown(hi.row); return; }
      items.forEach(function (x) {
        var r = Number(x.row);
        if (x.dayKey <= c.to) { if (r > lo.row) lo = { row: r, key: x.dayKey }; }
        else if (r < hi.row) hi = { row: r, key: x.dayKey };
      });
      step();
    }, catFail(alive, function () { return got; }));
  }
  // вниз от строки before (не включая её), пока не уйдём раньше from
  function readDown(before) {
    if (!alive()) return;
    if (before <= 2) { renderCatOps(got, "done"); return; }
    call("apiGetOlder", [before], function (res) {
      if (!alive()) return;
      var items = (res && res.items) || [];
      got = got.concat(items);
      var min = minRow(items), old = items.reduce(function (m, x) { return x.dayKey < m ? x.dayKey : m; }, "9999");
      if (!items.length || !(res && res.more) || old < c.from || !isFinite(min)) { renderCatOps(got, "done"); return; }
      renderCatOps(got, "loading");
      readDown(min);
    }, catFail(alive, function () { return got; }));
  }
  step();
}
