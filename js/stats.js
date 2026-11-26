// Переключение экранов (ввод, история, настройки) и статистика.

// ---------- экраны: ввод (основной) и история (переход — под «Сохранить», назад — стрелкой в шапке) ----------

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
  return x.toLocaleString(locale(), { minimumFractionDigits: 0, maximumFractionDigits: Math.abs(x) >= 100 ? 0 : 2 }) + " €";
}
function showHistPane(p) {
  stats.pane = p;
  el("segOps").classList.toggle("on", p === "ops");
  el("segStats").classList.toggle("on", p === "stats");
  el("paneOps").classList.toggle("hidden", p !== "ops");
  el("paneStats").classList.toggle("hidden", p !== "stats");
  window.scrollTo(0, 0);
  if (p === "stats") loadStats(); else setTimeout(checkMore, 0);
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
function loadStats() {
  var k = stats.kind, r;
  updateKindLabel();
  [].forEach.call(el("kindSeg").children, function (b) { b.classList.toggle("on", b.getAttribute("data-k") === k); });
  el("pNav").classList.toggle("hidden", k === "c");
  el("pDates").classList.toggle("hidden", k !== "c");
  if (k === "c") {
    r = { from: fromKey(el("dFrom").value), to: fromKey(el("dTo").value) };
    if (!r.from || !r.to || r.from > r.to) { el("statsBody").innerHTML = '<p class="muted center">' + esc(t("stats.datesInvalid")) + '</p>'; return; }
  } else {
    r = rangeFor(k, stats.offset);
    el("pLabel").textContent = rangeLabel(k, r);
    el("pNext").disabled = stats.offset >= 0;
  }
  var key = dkey(r.from) + "|" + dkey(r.to);
  var cached = stats.cache[key], seq = ++stats.seq;
  if (cached) renderStats(cached); else el("statsBody").innerHTML = '<div class="pending tall"><span class="spinner sm"></span></div>';
  if (navigator.onLine === false || state.offline) {
    if (!cached) el("statsBody").innerHTML = '<div class="pending tall"><span class="muted">' + esc(t("stats.waitNet")) + '</span></div>';
    return;
  }
  // всегда берём свежие цифры: показываем сохранённые сразу, обновляем, когда придёт ответ
  call("apiGetStats", [dkey(r.from), dkey(r.to)], function (res) {
    stats.cache[key] = res;
    if (seq === stats.seq) renderStats(res);
  }, function (msg, kind) {
    if (seq !== stats.seq || cached) return;
    el("statsBody").innerHTML = '<div class="pending tall"><span class="muted">' + esc(kind === "network" ? t("stats.waitNet") : t("stats.loadFailed", { msg: msg })) +
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
function showTab(name) {
  if (state.editing && name === "add") return;
  var h = name === "history", st = name === "settings";
  closeCurPanel();
  el("view-add").classList.toggle("hidden", h || st);
  el("view-history").classList.toggle("hidden", !h);
  el("histBar").classList.toggle("hidden", !h);
  el("view-settings").classList.toggle("hidden", !st);
  el("setBar").classList.toggle("hidden", !st);
  window.scrollTo(0, 0);
  scheduleFit();
  if (h && stats.pane === "stats") loadStats(); // свежие цифры — могли добавиться операции
  else if (h) setTimeout(checkMore, 0);
}
