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
// состояние данных — значок справа от периода (в режиме «Даты» — справа от полей):
// "sync" — идёт обновление (крутилка), "stale" — показаны сохранённые, обновить не вышло (значок «обновить», нажатие —
// повторить), "staleOffline" — то же без связи (жёлтое облачко, как «Нет связи» на форме; нажатие — пояснение), "" — ничего.
// Значок своего места не занимает — дата и цифры ниже не сдвигаются, когда он появляется и исчезает.
var ICON_REFRESH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5"/></svg>';
var ICON_OFFLINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M18 18H7a4.5 4.5 0 0 1-.9-8.9 6 6 0 0 1 1.4-2.8"/><path d="M10.6 5.2A6 6 0 0 1 17.9 10a4 4 0 0 1 2.6 6.7"/></svg>';
function setStatsSync(mode) {
  var dates = stats.kind === "c", b = el(dates ? "statsSyncDates" : "statsSync");
  el(dates ? "statsSync" : "statsSyncDates").innerHTML = "";
  if (mode === "sync") b.innerHTML = '<span class="sync-ico" aria-label="' + esc(t("stats.syncing")) + '"><span class="q-spin"></span></span>';
  else if (mode === "stale") b.innerHTML = '<button class="sync-ico" data-act="loadStats" aria-label="' + esc(t("stats.stale") + ". " + t("retry")) + '">' + ICON_REFRESH + '</button>';
  else if (mode === "staleOffline") b.innerHTML = '<button class="sync-ico net-text" data-act="statsOfflineInfo" aria-label="' + esc(t("stats.staleOffline")) + '">' + ICON_OFFLINE + '</button>';
  else b.innerHTML = "";
}
function statsOfflineInfo() { toast(t("stats.staleOffline"), "net", TOAST_LONG_MS); }
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
  stats.range = r; stats.shown = null;
  stats.cmp = compareRange(k, r); stats.cmpFailed = false;
  var cached = statsCached(key), seq = ++stats.seq;
  if (cached) renderStats(cached); else el("statsBody").innerHTML = '<div class="pending tall"><span class="spinner sm"></span></div>';
  loadCompare(seq);
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
// ---------- сравнение с прошлым промежутком ----------
// Прошлый промежуток того же вида: для «С 20-го», месяца и года — предыдущий, для своих дат — столько же дней перед ними.
// Текущий, ещё не закончившийся промежуток сравниваем с тем же числом дней прошлого (20–28 нояб. — с 20–28 окт.):
// иначе неполный период всегда выглядел бы экономнее полного.
function compareRange(kind, r) {
  var p;
  if (kind === "c") { var len = dayDiff(r.from, r.to) + 1; p = { from: addDays(r.from, -len), to: addDays(r.from, -1) }; }
  else p = rangeFor(kind, stats.offset - 1);
  var today = todayD();
  p.partial = r.from <= today && today < r.to;
  if (p.partial) { var cut = addDays(p.from, dayDiff(r.from, today)); if (cut < p.to) p.to = cut; }
  var first = fromKey(statsFirstDay());
  return first && p.to < first ? null : p; // раньше операций не было — сравнивать не с чем
}
// подпись под итогами: «Для сравнения: октябрь 2026» / «Для сравнения: 20 окт. – 28 окт. 2026»
function compareLabel(p) {
  if (!p.partial && stats.kind !== "c") return rangeLabel(stats.kind, p).toLowerCase();
  return fmtDayMonth(p.from, p.from.getFullYear() !== p.to.getFullYear()) + " – " + fmtDayMonth(p.to, true);
}
// цифры прошлого промежутка: сохранённые — сразу; нет — один запрос apiGetStats (прошлое не меняется — храним, как всё)
function loadCompare(seq) {
  var p = stats.cmp;
  if (!p || statsCached(statsKey(p)) || navigator.onLine === false || state.offline) return;
  // полный прошлый период придёт в общем ответе, который уже идёт, — отдельно не просим
  if (!p.partial && stats.kind !== "c" && statsAll.loading) return;
  call("apiGetStats", [dkey(p.from), dkey(p.to)], function (res) {
    statsSave([[statsKey(p), res]]);
    if (seq === stats.seq && stats.shown) renderStats(stats.shown);
  }, function () {
    if (seq !== stats.seq) return;
    stats.cmpFailed = true; // без сравнения — место под него больше не держим
    if (stats.shown) renderStats(stats.shown);
  });
}
// изменение к прошлому: «↑ 18%» / «↓ 7%»; рост трат — красный, рост доходов — зелёный.
// prev === undefined — цифр прошлого ещё нет (строка-заглушка той же высоты, чтобы ничего не прыгало)
function deltaPct(cur, prev) { return prev > 0 ? Math.round((cur - prev) / prev * 100) : null; }
function deltaHtml(cur, prev, goodUp) {
  var d = deltaPct(cur, prev);
  if (d === null || d === 0) return "";
  var up = d > 0, cls = up === goodUp ? "good" : "bad";
  return '<span class="dpct ' + cls + '">' + (up ? "↑" : "↓") + "\u2009" + (Math.abs(d) > 999 ? "&gt;999" : Math.abs(d)) + "%</span>";
}
function cmpLine(cur, prev, goodUp) {
  if (prev === undefined || (!cur && !prev)) return '<div class="cmp">&nbsp;</div>'; // ждём цифр / было и есть по нулям
  return '<div class="cmp">' + deltaHtml(cur, prev, goodUp) + '<span class="was">' + esc(t("stats.was", { sum: fmtEur(prev) })) + '</span></div>';
}

function renderStats(res) {
  stats.shown = res;
  var p = stats.cmp, prev = p ? statsCached(statsKey(p)) : null;
  // ждём цифр прошлого — держим под них место; не будет (нет связи, ошибка) — не держим
  var waiting = !!p && !prev && !stats.cmpFailed && navigator.onLine !== false && !state.offline;
  var show = !!prev || waiting;
  function prevOf(key) { return prev ? (prev[key] || 0) : undefined; }
  var html = '<div class="card stat-sum"><div><div class="cap">' + esc(t("stats.spent")) + '</div><div class="val">' + esc(fmtEur(res.spent)) + '</div>' +
    (show ? cmpLine(res.spent || 0, prevOf("spent"), false) : "") + '</div>' +
    '<div><div class="cap">' + esc(t("stats.income")) + '</div><div class="val">' + esc(fmtEur(res.income)) + '</div>' +
    (show ? cmpLine(res.income || 0, prevOf("income"), true) : "") + '</div>';
  // баланс: зелёный — в плюсе, красный — в минусе
  var bal = Math.round(((res.income || 0) - (res.spent || 0)) * 100) / 100;
  html += '<div class="bal"><span class="cap">' + esc(t("stats.balance")) + '</span><span class="val ' + (bal > 0 ? "plus" : bal < 0 ? "minus" : "") + '">' +
    (bal > 0 ? "+" : bal < 0 ? "−" : "") + esc(fmtEur(Math.abs(bal))) + '</span></div></div>' +
    (show ? '<div class="cmp-note">' + esc(t("stats.cmpWith", { range: compareLabel(p) })) + '</div>' : "");
  if (!res.count) { el("statsBody").innerHTML = html + '<p class="muted center">' + esc(t("stats.noOps")) + '</p>'; return; }
  function block(title, key, cls) {
    var list = (res.categories || []).filter(function (c) { return c[key] > 0; }).sort(function (a, b) { return b[key] - a[key]; });
    if (!list.length) return "";
    var total = res[key === "spent" ? "spent" : "income"], max = list[0][key];
    var before = {}; // категория → сумма в прошлом промежутке
    if (prev) (prev.categories || []).forEach(function (c) { before[String(c.categoryId)] = c[key] || 0; });
    return '<div class="sect">' + esc(title) + '</div><div class="card">' + list.map(function (c) {
      var pct = total > 0 ? c[key] / total * 100 : 0;
      return '<div class="catrow tap" data-act="openCatOps" data-arg="' + esc(key + ":" + c.categoryId) + '"><div class="top"><span class="nm">' + esc(categoryName(c.categoryId) || c.categoryName) + '</span>' +
        (prev ? deltaHtml(c[key], before[String(c.categoryId)] || 0, key === "income") : "") + '<span class="amt">' + esc(fmtEur(c[key])) +
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
// Экраны История, Настройки, Изменение и операции категории — записи в истории браузера (адрес тот же, страница не перезагружается):
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
  // операции категории не пережили обновление страницы — шагаем обратно на Историю, как с Изменения
  if (v === "cat" && !catv.cur) { nav.skip++; history.back(); return; }
  var fromCat = !el("view-cat").classList.contains("hidden");
  if (state.editing) cancelEdit(); // сам покажет Историю
  if (v === "cat") { showTab("cat"); loadCatOps(); return; } // «вперёд» — снова тот же список
  if (v === "history" && fromCat) { showTab("history", true); return; }
  if (v !== "history" || el("view-history").classList.contains("hidden")) showTab(v);
});

// back — вернулись системной «назад» с операций категории: статистику не перезапрашиваем и встаём на прежнее место
function showTab(name, back) {
  if (state.editing && name === "add") return;
  var h = name === "history", st = name === "settings", c = name === "cat";
  closeCurPanel();
  el("view-add").classList.toggle("hidden", h || st || c);
  el("view-history").classList.toggle("hidden", !h);
  el("view-settings").classList.toggle("hidden", !st);
  el("view-cat").classList.toggle("hidden", !c);
  if (!c) catv.seq++; // ушли с операций категории — их загрузку не продолжаем (catops.js)
  scrollToTop();
  scheduleFit();
  if (h && back) { el("scroller").scrollTop = catv.scroll; return; }
  if (h && stats.pane === "stats") loadStats(true); // свежие цифры — могли добавиться операции
  else if (h) setTimeout(checkMore, 0);
}
