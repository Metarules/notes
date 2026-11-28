// Переключение экранов (ввод, история, настройки) и статистика.

// ---------- экраны: ввод (основной) и история (переход — под «Сохранить», назад — системной «назад») ----------

// ---------- статистика ----------
// Вид промежутка: p — отчётный («С 20-го»), m — календарный месяц, y — год, c — свои даты.
// offset — сколько промежутков назад (0 — текущий); сравнить с прошлым — стрелкой ‹.
var stats = { pane: "ops", kind: "p", offset: 0, cache: {}, seq: 0 };
var PERIOD_START_DAY = 20; // до ответа сервера; сервер присылает своё значение (periodStartDay в init)
function periodStartDay() { return state.periodStartDay || PERIOD_START_DAY; }
function pad2(n) { return (n < 10 ? "0" : "") + n; }
function mkd(y, m, d) { return new Date(y, m, d, 12); } // полдень — без сюрпризов с переводом часов
function dkey(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function fromKey(k) { var p = String(k || "").split("-").map(Number); return p.length === 3 && p[0] ? mkd(p[0], p[1] - 1, p[2]) : null; }
function todayD() { var n = new Date(); return mkd(n.getFullYear(), n.getMonth(), n.getDate()); }
function addDays(d, n) { return mkd(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function dayDiff(a, b) { return Math.round((b - a) / 86400000); }
function rangeFor(kind, offset) {
  var t = todayD(), y = t.getFullYear(), m = t.getMonth();
  if (kind === "p") {
    var S = periodStartDay(), f = mkd(y, (t.getDate() >= S ? m : m - 1) + offset, S);
    return { from: f, to: mkd(f.getFullYear(), f.getMonth() + 1, S - 1) };
  }
  if (kind === "m") return { from: mkd(y, m + offset, 1), to: mkd(y, m + offset + 1, 0) };
  return { from: mkd(y + offset, 0, 1), to: mkd(y + offset, 11, 31) };
}
function rangeLabel(kind, r) {
  if (kind === "m") return fmtMonthYear(r.from);
  if (kind === "y") return String(r.from.getFullYear());
  var sameYear = r.from.getFullYear() === r.to.getFullYear();
  return fmtDayMonth(r.from, !sameYear) + " – " + fmtDayMonth(r.to, true);
}
function fmtEur(x) {
  x = Number(x) || 0;
  // чем больше сумма, тем меньше знаков после запятой: от 100 — целые, от 10 — десятые, меньше 10 — сотые
  var ax = Math.abs(x), digits = ax >= 100 ? 0 : ax >= 10 ? 1 : 2;
  return x.toLocaleString(locale(), { minimumFractionDigits: 0, maximumFractionDigits: digits }) + " €";
}
function showHistPane(p) {
  stats.pane = p;
  el("segOps").classList.toggle("on", p === "ops");
  el("segStats").classList.toggle("on", p === "stats");
  el("paneOps").classList.toggle("hidden", p !== "ops");
  el("paneStats").classList.toggle("hidden", p !== "stats");
  scrollToTop();
  if (p === "stats") loadStats(true); else setTimeout(checkMore, 0);
}
function setStatsKind(k) {
  if (k === "c" && !el("dFrom").value) { // свои даты — начинаем с того, что было на экране
    var r = stats.kind === "c" ? null : rangeFor(stats.kind, stats.offset);
    if (r) { el("dFrom").value = dkey(r.from); el("dTo").value = dkey(r.to); }
  }
  stats.kind = k; stats.offset = 0;
  loadStats();
}
function shiftStats(n) { stats.offset = Math.min(0, stats.offset + n); loadStats(); }
// кнопка отчётного промежутка: «С 20-го» / «From 20th» / «Ab 20.»
function updateKindLabel() {
  var n = periodStartDay();
  el("kindSeg").querySelector('[data-k="p"]').textContent = t("kind.p", { n: n, nth: ordinalEn(n) });
}
// ---------- сохранённые цифры статистики ----------
// Ответы сервера хранятся и на телефоне ("stats"): статистика открывается сразу с сохранёнными цифрами,
// а свежие приходят фоном и тихо их заменяют (строка «Обновляется…» под периодом).
// Отчётные периоды, месяцы и годы приходят все сразу одним запросом (statsAll): на сервере дорого само обращение
// к таблице, а не число строк, поэтому один общий запрос вместо запроса на каждый период — и переключение
// периодов (‹ ›, «С 20-го / Месяц / Год») после него мгновенное. «Свои даты» и периоды старше тех, что в общем
// ответе, — отдельным запросом (apiGetStats).
var STATS_KEEP = 150; // сколько промежутков помним на телефоне (общий ответ — около 50)
function statsStore() { try { var o = JSON.parse(store("stats") || "{}"); return o && typeof o === "object" ? o : {}; } catch (e) { return {}; } }
function statsCached(key) {
  if (!stats.cache[key]) { var o = statsStore()[key]; if (o && o.r) stats.cache[key] = o.r; }
  return stats.cache[key] || null;
}
// list — [[ключ, ответ], …]; на телефон пишем одним разом
function statsSave(list) {
  var o = statsStore(), now = Date.now();
  list.forEach(function (x) { stats.cache[x[0]] = x[1]; o[x[0]] = { r: x[1], at: now }; });
  var keys = Object.keys(o).sort(function (a, b) { return (o[b].at || 0) - (o[a].at || 0); });
  keys.slice(STATS_KEEP).forEach(function (k) { delete o[k]; });
  try { store("stats", JSON.stringify(o)); } catch (e) {}
}
// строка под периодом: "sync" — идёт обновление, "stale" / "staleOffline" — показаны сохранённые, обновить не вышло; "" — пусто.
// Место под строку есть всегда — цифры ниже не прыгают, когда она появляется и исчезает.
function setStatsSync(mode) {
  var b = el("statsSync");
  b.className = "stats-sync" + (mode === "sync" ? " on" : "");
  if (mode === "sync") b.innerHTML = '<span class="q-spin"></span>' + esc(t("stats.syncing"));
  else if (mode === "stale") b.innerHTML = esc(t("stats.stale")) + ' <button class="link inline" data-act="loadStats">' + esc(t("retry")) + '</button>';
  else if (mode === "staleOffline") { b.textContent = t("stats.staleOffline"); b.className += " net-text"; }
  else b.textContent = "";
}
function statsKey(r) { return dkey(r.from) + "|" + dkey(r.to); }
function statsVisible() { return !el("view-history").classList.contains("hidden") && stats.pane === "stats"; }

// общий ответ: loading — идёт запрос; at — когда пришёл последний; err — вид ошибки последнего запроса ("" — не было)
// keys — промежутки из последнего общего ответа (для «Своих дат», совпавших с одним из них, отдельный запрос не нужен)
var statsAll = { loading: false, at: 0, err: "", keys: {} };
// первый день с операциями ("yyyy-MM-dd", приходит в общем ответе): раньше него стрелка ‹ не ведёт
function statsFirstDay() { return store("statsFirst") || ""; }
function refreshStatsAll() {
  if (statsAll.loading) return;
  statsAll.loading = true;
  statsAll.err = "";
  call("apiGetStatsAll", [], function (res) {
    statsAll.loading = false;
    statsAll.at = Date.now();
    var names = (res && res.names) || {};
    statsAll.keys = {};
    statsSave(((res && res.periods) || []).map(function (p) {
      (p.categories || []).forEach(function (c) { if (!c.categoryName) c.categoryName = names[c.categoryId] || c.categoryId; });
      statsAll.keys[p.from + "|" + p.to] = 1;
      return [p.from + "|" + p.to, p];
    }));
    if (res && res.firstDay) store("statsFirst", res.firstDay);
    if (statsVisible()) loadStats();
  }, function (msg, kind) {
    statsAll.loading = false;
    statsAll.err = kind || "server";
    if (statsVisible()) loadStats();
  });
}

// После загрузки формы (load в app.js): общий ответ статистики загружаем фоном, чтобы экран статистики
// открылся уже с готовыми цифрами. Чуть позже — чтобы не мешать отправке только что сохранённой траты.
var STATS_PRELOAD_DELAY_MS = 2000;
function preloadStatsAll() {
  setTimeout(function () {
    if (!statsAll.at && !statsAll.loading && !state.offline && navigator.onLine !== false) refreshStatsAll();
  }, STATS_PRELOAD_DELAY_MS);
}
// fresh — статистику только что открыли (или нажали «Повторить»): обновляем общий ответ с сервера.
// Без fresh (‹ ›, смена вида, смена языка) — показываем то, что уже есть, без нового запроса.
function loadStats(fresh) {
  var k = stats.kind, r;
  updateKindLabel();
  [].forEach.call(el("kindSeg").children, function (b) { b.classList.toggle("on", b.getAttribute("data-k") === k); });
  el("pNav").classList.toggle("hidden", k === "c");
  el("pDates").classList.toggle("hidden", k !== "c");
  if (k === "c") {
    r = { from: fromKey(el("dFrom").value), to: fromKey(el("dTo").value) };
    if (!r.from || !r.to || r.from > r.to) { setStatsSync(""); el("statsBody").innerHTML = '<p class="muted center">' + esc(t("stats.datesInvalid")) + '</p>'; return; }
  } else {
    r = rangeFor(k, stats.offset);
    el("pLabel").textContent = rangeLabel(k, r);
    el("pNext").disabled = stats.offset >= 0;
    var first = statsFirstDay();
    el("pPrev").disabled = !!first && dkey(r.from) <= first; // раньше операций нет — дальше назад листать незачем
  }
  var key = statsKey(r);
  var cached = statsCached(key), seq = ++stats.seq;
  if (cached) renderStats(cached); else el("statsBody").innerHTML = '<div class="pending tall"><span class="spinner sm"></span></div>';
  if (navigator.onLine === false || state.offline) {
    setStatsSync(cached ? "staleOffline" : "");
    if (!cached) el("statsBody").innerHTML = '<div class="pending tall"><span class="net-text">' + esc(t("stats.waitNet")) + '</span></div>';
    return;
  }
  if (k === "c") {
    // свои даты совпали с промежутком из только что пришедшего общего ответа — цифры уже свежие
    if (cached && statsAll.at && !statsAll.loading && statsAll.keys[key]) { setStatsSync(""); return; }
    loadOneStats(key, r, cached, seq);
    return;
  }
  if (fresh || (!statsAll.at && !statsAll.err)) refreshStatsAll();
  // общий ответ ещё идёт — когда придёт, loadStats покажет свежие цифры
  if (statsAll.loading) { setStatsSync(cached ? "sync" : ""); return; }
  if (cached) { setStatsSync(statsAll.err ? (statsAll.err === "network" ? "staleOffline" : "stale") : ""); return; }
  loadOneStats(key, r, null, seq); // периода нет в общем ответе (старше) или общий не пришёл — запрашиваем отдельно
}
// один промежуток отдельным запросом: «Свои даты», старые периоды; сохранённое (если есть) видно сразу
function loadOneStats(key, r, cached, seq) {
  setStatsSync(cached ? "sync" : "");
  call("apiGetStats", [dkey(r.from), dkey(r.to)], function (res) {
    statsSave([[key, res]]);
    if (seq !== stats.seq) return;
    renderStats(res);
    setStatsSync("");
  }, function (msg, kind) {
    if (seq !== stats.seq) return;
    if (cached) { setStatsSync(kind === "network" ? "staleOffline" : "stale"); return; }
    setStatsSync("");
    el("statsBody").innerHTML = '<div class="pending tall"><span class="' + (kind === "network" ? "net-text" : "muted") + '">' + esc(kind === "network" ? t("stats.waitNet") : t("stats.loadFailed", { msg: msg })) +
      '</span><button class="link inline" data-act="loadStats">' + esc(t("retry")) + '</button></div>';
  });
}
function renderStats(res) {
  var html = '<div class="card stat-sum"><div><div class="cap">' + esc(t("stats.spent")) + '</div><div class="val">' + esc(fmtEur(res.spent)) + '</div></div>' +
    '<div><div class="cap">' + esc(t("stats.income")) + '</div><div class="val">' + esc(fmtEur(res.income)) + '</div></div>';
  // баланс: зелёный — в плюсе, красный — в минусе
  var bal = Math.round(((res.income || 0) - (res.spent || 0)) * 100) / 100;
  html += '<div class="bal"><span class="cap">' + esc(t("stats.balance")) + '</span><span class="val ' + (bal > 0 ? "plus" : bal < 0 ? "minus" : "") + '">' +
    (bal > 0 ? "+" : bal < 0 ? "−" : "") + esc(fmtEur(Math.abs(bal))) + '</span></div></div>';
  if (!res.count) { el("statsBody").innerHTML = html + '<p class="muted center">' + esc(t("stats.noOps")) + '</p>'; return; }
  function block(title, key, cls) {
    var list = (res.categories || []).filter(function (c) { return c[key] > 0; }).sort(function (a, b) { return b[key] - a[key]; });
    if (!list.length) return "";
    var total = res[key === "spent" ? "spent" : "income"], max = list[0][key];
    return '<div class="sect">' + esc(title) + '</div><div class="card">' + list.map(function (c) {
      var pct = total > 0 ? c[key] / total * 100 : 0;
      return '<div class="catrow"><div class="top"><span class="nm">' + esc(categoryName(c.categoryId) || c.categoryName) + '</span><span class="amt">' + esc(fmtEur(c[key])) +
        '<span class="pct">' + (pct > 0 && pct < 1 ? "&lt;1" : Math.round(pct)) + '%</span></span></div>' +
        '<div class="bar ' + cls + '"><i data-w="' + Math.max(1, Math.round(c[key] / max * 100)) + '"></i></div></div>';
    }).join("") + '</div>';
  }
  el("statsBody").innerHTML = html + block(t("stats.spentByCat"), "spent", "") + block(t("stats.income"), "income", "inc");
  // ширина полосок — из кода: style="…" в HTML запрещён защитой страницы (CSP), а свойство элемента — нет
  [].forEach.call(el("statsBody").querySelectorAll(".bar i[data-w]"), function (b) { b.style.width = b.getAttribute("data-w") + "%"; });
}

// экраны: add — ввод (основной), history — история, settings — настройки
// ---------- системная «назад» ----------
// Экраны История, Настройки и Изменение — записи в истории браузера (адрес тот же, страница не перезагружается):
// кнопка «назад» встроенного Safari и свайп от левого края возвращают на предыдущий экран (своих стрелок в шапках нет).
// Вкладки внутри экрана (Операции/Статистика, вид периода) в историю не пишем — иначе «назад» пришлось бы жать много раз.
// skip — сколько ближайших «назад» сделала сама страница (ушли с Изменения после сохранения) и показывать ничего не нужно;
// own — адреса, которые страница выставила сама: шаг по истории на них — не новая ссылка шортката (см. app.js)
var nav = { skip: 0, own: {} };
function navOwn() { nav.own[location.href] = true; }
function navState() { return (history.state && history.state.v) || "add"; }
function navPush(v) { try { history.pushState({ v: v }, "", location.href); } catch (e) {} navOwn(); }
// вперёд на экран: ссылка «История», шестерёнка
function navTo(name) {
  showTab(name);
  if (navState() !== name) navPush(name);
}
// ушли с Изменения сами (сохранили, удалили): убираем его запись, чтобы «назад» с Истории вёл на форму
function navDropEdit() {
  if (navState() !== "edit") return;
  nav.skip++;
  history.back();
}
window.addEventListener("popstate", function () {
  if (nav.skip > 0) { nav.skip--; return; }
  var v = navState();
  if (v === "edit") {
    if (state.editing) return;
    // «вперёд» на Изменение, которое уже закрыто (сохранено): шагаем обратно на Историю —
    // заменить запись нельзя, иначе подряд окажутся две «Истории» и «назад» сработает не с первого раза
    nav.skip++;
    history.back();
    return;
  }
  if (state.editing) cancelEdit(); // сам покажет Историю
  if (v !== "history" || el("view-history").classList.contains("hidden")) showTab(v);
});

function showTab(name) {
  if (state.editing && name === "add") return;
  var h = name === "history", st = name === "settings";
  closeCurPanel();
  el("view-add").classList.toggle("hidden", h || st);
  el("view-history").classList.toggle("hidden", !h);
  el("view-settings").classList.toggle("hidden", !st);
  scrollToTop();
  scheduleFit();
  if (h && stats.pane === "stats") loadStats(true); // свежие цифры — могли добавиться операции
  else if (h) setTimeout(checkMore, 0);
}
