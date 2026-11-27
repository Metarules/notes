// История: удаление свайпом, подгрузка старых операций, список по дням.

// ---------- удаление: свайп влево открывает кнопку «Удалить» ----------
var REVEAL = 88; // на сколько уезжает карточка
var SWIPE_START_PX = 8; // сдвиг пальца, после которого понятно: это свайп или прокрутка
var SWIPE_ANIM_MS = cssNum("--swipe-ms", 250); // длительность сдвига карточки (задана в CSS)
var swipe = { row: null, startX: 0, startY: 0, base: 0, x: 0, active: false, moved: false, openRow: null, swallow: false };
function setX(row, x, animate) {
  var c = row.querySelector(".tx");
  c.style.transition = animate ? "" : "none";
  c.style.transform = x ? "translateX(" + x + "px)" : "";
  if (x < 0) row.classList.add("swiping");
  else if (animate) setTimeout(function () { if (!c.style.transform) row.classList.remove("swiping"); }, SWIPE_ANIM_MS);
  else row.classList.remove("swiping");
}
function closeOpenRow() { if (swipe.openRow) { setX(swipe.openRow, 0, true); swipe.openRow = null; } }
// касание вне открытой строки только закрывает её
document.addEventListener("pointerdown", function (e) {
  swipe.swallow = false;
  if (swipe.openRow && !swipe.openRow.contains(e.target)) { closeOpenRow(); swipe.swallow = true; }
}, true);
var list = el("historyList");
list.addEventListener("pointerdown", function (e) {
  var row = e.target.closest(".row");
  swipe.moved = false;
  if (!row || e.target.closest(".swipe-del")) return;
  swipe.row = row; swipe.startX = e.clientX; swipe.startY = e.clientY;
  swipe.base = row === swipe.openRow ? -REVEAL : 0; swipe.x = swipe.base; swipe.active = false;
});
list.addEventListener("pointermove", function (e) {
  if (!swipe.row) return;
  var dx = e.clientX - swipe.startX, dy = e.clientY - swipe.startY;
  if (!swipe.active) {
    if (Math.abs(dx) < SWIPE_START_PX && Math.abs(dy) < SWIPE_START_PX) return;
    // вертикально — это прокрутка, а не касание: отпускание пальца не должно открыть операцию на правку
    if (Math.abs(dy) >= Math.abs(dx)) { swipe.row = null; swipe.moved = true; return; }
    swipe.active = true; swipe.moved = true;
    if (swipe.openRow && swipe.openRow !== swipe.row) closeOpenRow();
    try { swipe.row.setPointerCapture(e.pointerId); } catch (x) {}
  }
  var x = Math.min(0, swipe.base + dx);
  if (x < -REVEAL) x = -REVEAL + (x + REVEAL) / 3; // дальше кнопки — с сопротивлением
  swipe.x = x;
  setX(swipe.row, x, false);
});
function endSwipe() {
  var row = swipe.row;
  swipe.row = null;
  if (!row || !swipe.active) return;
  var open = swipe.x < -REVEAL / 2;
  if (open && swipe.openRow !== row) { haptic(1); Snd.swipe(); } // кнопка «Удалить» открылась (вибрация — только Android: в iOS тик бывает лишь от касания переключателя)
  setX(row, open ? -REVEAL : 0, true);
  swipe.openRow = open ? row : null;
}
list.addEventListener("pointerup", endSwipe);
list.addEventListener("pointercancel", endSwipe);
list.addEventListener("click", function (e) {
  if (swipe.moved || swipe.swallow) { swipe.moved = false; swipe.swallow = false; return; }
  var row = e.target.closest(".row");
  if (!row) return;
  var qid = row.getAttribute("data-q");
  if (qid) { // трата из очереди: свайп «Удалить» убирает её с телефона, касание ничего не делает
    if (e.target.closest(".swipe-del")) { haptic(1); Snd.tap(); dropQueued(qid); }
    else if (swipe.openRow) closeOpenRow();
    else toast(t(sendingIds.indexOf(qid) > -1 ? "q.sending" : state.offline ? "q.waitNet" : "q.queued"));
    return;
  }
  var i = Number(row.getAttribute("data-i"));
  if (e.target.closest(".swipe-del")) { haptic(1); Snd.tap(); deleteRow(i); return; }
  if (swipe.openRow) { closeOpenRow(); return; }
  Snd.tap(); // открыть операцию на правку
  startEdit(i);
});
// Карточка исчезает сразу, запрос уходит фоном. Можно удалять несколько подряд, не дожидаясь ответов:
// сервер находит операцию по дате, сумме и валюте, даже если её строка уже сдвинулась.
// Свежая история с сервера рисуется, только когда ответили на все удаления (иначе вернулись бы
// ещё не удалённые карточки). Если какое-то удаление не прошло, карточка возвращается, а после всех
// ответов история перечитывается с сервера.
var pendingDeletes = 0, deleteFailed = false;
// Изменения тоже уходят фоном (form.js). Пока ждём ответов на удаления или изменения, свежую историю с сервера
// не рисуем — иначе вернулись бы карточки в прежнем виде; рисуем последний пришедший ответ, когда ждать нечего.
var pendingEdits = 0, freshRecent = null;
function historyBusy() { return pendingDeletes > 0 || pendingEdits > 0; }
// перерисовать историю, когда ничего не ждём и пользователь с ней не работает (свайп, изменение)
function redrawWhenFree(fn) {
  (function tryIt() {
    if (historyBusy() || !canRedrawHistory()) { setTimeout(tryIt, HIST_REDRAW_RETRY_MS); return; }
    fn();
  })();
}
function byDateDesc(a, b) { return (b.sortKey - a.sortKey) || (b.row - a.row); }

// ---------- подгрузка старых операций при прокрутке истории ----------
// state.recent — всё, что показано: первая страница от сервера и подгруженные старые.
// Сервер в ответах присылает только первую страницу — старые подгруженные сохраняем (withOlder).
// HIST_PAGE и SEND_BATCH сервер присылает в init (limits); здесь — значения до первого ответа
var HIST_PAGE = 50;
var HIST_PRELOAD_SCREENS = 2.5; // до конца списка меньше стольких экранов — грузим следующую страницу
var HIST_REDRAW_RETRY_MS = 400; // пока открыт свайп или идёт удаление — пробуем перерисовать через столько
var HIST_ONLINE_DELAY_MS = 500; // связь вернулась — подгрузку истории пробуем чуть позже
var hist = { loading: false, done: false, failed: false, next: 0 }; // next — с какой строки таблицы грузить дальше
function opKey(x) { return x.id || [x.date, x.amount, x.currencyId, x.categoryId].join("|"); }
function minRow(list) { return list.reduce(function (m, x) { return Math.min(m, Number(x.row) || Infinity); }, Infinity); }
// сервер вставил строку row (операция встала на место по дате): у строк ниже номера выросли на один
function shiftRows(row) {
  row = Number(row);
  if (!(row > 1)) return;
  state.recent = (state.recent || []).map(function (x) { return x.row >= row ? Object.assign({}, x, { row: x.row + 1 }) : x; });
  if (hist.next && row <= hist.next) hist.next++;
}
function withOlder(top) {
  top = top || [];
  if (!top.length) return top;
  var min = minRow(top), seen = {};
  top.forEach(function (x) { seen[opKey(x)] = 1; });
  var old = (state.recent || []).filter(function (x) { return x.row < min && !seen[opKey(x)]; });
  return old.length ? top.concat(old).sort(byDateDesc) : top;
}
function historyVisible() { return !el("view-history").classList.contains("hidden") && stats.pane === "ops"; }
function loadOlder() {
  if (hist.loading || hist.done || hist.failed || !state.loaded || !historyVisible()) return;
  if (state.offline || navigator.onLine === false) { renderMore(); return; }
  var before = Math.min(minRow(state.recent || []), hist.next || Infinity);
  if (!isFinite(before) || before <= 2) { hist.done = true; renderMore(); return; }
  hist.loading = true;
  renderMore();
  call("apiGetOlder", [before], function (res) {
    hist.loading = false;
    res = res || {};
    hist.next = Number(res.next) || before;
    hist.done = !res.more;
    var items = res.items || [];
    (function apply() {
      // пока открыт свайп или идёт удаление — подождём, чтобы не сбить строки под пальцем
      if (!canRedrawHistory() || historyBusy()) { setTimeout(apply, HIST_REDRAW_RETRY_MS); return; }
      var have = {};
      state.recent.forEach(function (x) { have[opKey(x)] = 1; });
      var add = items.filter(function (x) { return !have[opKey(x)]; });
      if (add.length) renderHistory(state.recent.concat(add).sort(byDateDesc));
      else { renderMore(); checkMore(); }
    })();
  }, function (msg, kind) {
    hist.loading = false;
    if (kind === "network") { renderMore(); return; } // без связи — подгрузим, когда появится
    hist.failed = true;
    renderMore();
  });
}
function retryOlder() { hist.failed = false; loadOlder(); }
// низ списка: индикатор, ошибка с «Повторить» или «Это все операции»
function renderMore() {
  var m = el("histMore");
  if (!state.loaded || !(state.recent || []).length) { m.innerHTML = ""; return; }
  if (hist.loading) m.innerHTML = '<span class="spinner sm"></span>';
  else if (hist.failed) m.innerHTML = '<span class="muted">' + esc(t("hist.olderFailed")) + '</span><button class="link inline" data-act="retryOlder">' + esc(t("retry")) + '</button>';
  else if (hist.done) m.innerHTML = '<span class="muted">' + esc(t("hist.allLoaded")) + '</span>';
  else if (state.offline || navigator.onLine === false) m.innerHTML = '<span class="muted">' + esc(t("hist.olderWaitNet")) + '</span>';
  else m.innerHTML = "";
}
// до конца списка осталось меньше HIST_PRELOAD_SCREENS экранов — грузим следующую страницу
function checkMore() {
  if (!historyVisible()) return;
  if (el("histMore").getBoundingClientRect().top < window.innerHeight * HIST_PRELOAD_SCREENS) loadOlder();
}
el("scroller").addEventListener("scroll", checkMore, { passive: true }); // прокручивается область, не страница
window.addEventListener("online", function () { setTimeout(checkMore, HIST_ONLINE_DELAY_MS); });
function canRedrawHistory() { return !state.editing && !swipe.openRow && !swipe.row; }
function deleteRow(i) {
  var r = state.recent[i];
  if (!r) return;
  if (navigator.onLine === false) { closeOpenRow(); toast(t("form.noNetDelete"), false, TOAST_LONG_MS); return; }
  pendingDeletes++;
  // строки ниже удаляемой в таблице сдвинутся вверх на одну
  var rest = state.recent.filter(function (x, k) { return k !== i; }).map(function (x) {
    return x.row > r.row ? Object.assign({}, x, { row: x.row - 1 }) : x;
  });
  if (hist.next > r.row) hist.next--;
  swipe.openRow = null;
  swipe.row = null;
  renderHistory(rest);
  function allDone(full) {
    if (full && full.recent) freshRecent = full.recent;
    if (historyBusy()) return;
    if (deleteFailed) {
      deleteFailed = false;
      call("apiGetRecent", [], function (list) { if (!historyBusy() && canRedrawHistory()) renderHistory(withOlder(list)); }, function () {});
    } else if (freshRecent && canRedrawHistory()) renderHistory(withOlder(freshRecent));
  }
  call("apiDeleteTransaction", [r.row, { date: r.date, amount: r.amount, currencyId: r.currencyId, categoryId: r.categoryId, id: r.id || "" }], function (res, full) {
    pendingDeletes--;
    toast(t("hist.deleted", { amount: fmtNum(r.amount) + " " + r.currencyId }));
    allDone(full);
  }, function (msg, kind) {
    pendingDeletes--;
    if (kind === "network") toast(t("form.noNetDelete"), false, TOAST_LONG_MS);
    else if (kind === "timeout") toast(t("hist.deleteUnknown"), false, TOAST_LONG_MS); // могла и удалиться — перечитаем
    else toast(msg, true);
    if (kind !== "network") deleteFailed = true; // после всех ответов перечитаем историю; без связи — всё равно не выйдет
    var back = state.recent.concat([r]).sort(byDateDesc);
    if (canRedrawHistory()) renderHistory(back); else state.recent = back;
    allDone(null);
  });
}

// ---------- история ----------
// заголовок дня: слева «Сегодня» / «Вчера» / день недели, справа дата («16 ноября»; другой год — с годом)
function dayHead(key) {
  if (!key) return '<div class="day"><span>' + esc(t("hist.noDate")) + '</span></div>';
  var p = key.split("-").map(Number);
  var d = new Date(p[0], p[1] - 1, p[2]);
  var tk = (state.todayKey || "").split("-").map(Number);
  var today = tk.length === 3 ? new Date(tk[0], tk[1] - 1, tk[2]) : null;
  var diff = today ? Math.round((today - d) / 86400000) : NaN;
  var left = diff === 0 ? t("hist.today") : diff === 1 ? t("hist.yesterday") : fmtWeekday(d);
  var right = fmtDayMonthLong(d, !!today && p[0] !== tk[0]);
  return '<div class="day"><span>' + esc(left) + '</span><span class="dd">' + esc(right) + '</span></div>';
}
// траты из очереди на телефоне — отдельным блоком над историей
function queuedHtml() {
  var l = outbox();
  if (!l.length) return "";
  return '<div class="day"><span>' + esc(t("hist.waiting")) + '</span></div><div class="daygroup">' + l.map(function (x) {
    var f = x.form, n = Number(f.amount);
    var at = f.at ? new Date(f.at) : null;
    var time = at && isFinite(at.getTime()) ? at.toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
    // статус: не записалась / отправляется сейчас / ждёт своей очереди (связь есть) / ждёт связи
    var status = x.error ? '<span class="q err">' + esc(t("st.failed", { msg: serverError(x) })) + '</span>'
      : sendingIds.indexOf(f.id) > -1 ? '<span class="q sending"><span class="q-spin"></span>' + esc(t("st.sending")) + '</span>'
      : !state.offline ? '<span class="q waiting">' + esc(t("st.queued")) + '</span>'
      : '<span class="q">' + esc(t("st.waitNet")) + '</span>';
    return '<div class="row queued" data-q="' + esc(f.id) + '">' +
      '<button class="swipe-del">' + esc(t("delete")) + HZ + '</button>' +
      '<div class="card tx"><div class="tx-main">' +
        '<div><span class="amount' + (n > 0 ? " pos" : "") + '">' + esc(fmtNum(n)) + " " + esc(f.currencyId) + '</span></div>' +
        '<div class="tx-sub">' + esc(categoryName(f.categoryId) || f.categoryId) + (time ? ' · ' + esc(time) : '') + '</div>' +
        '<div class="tx-sub tx-status">' + status + '</div>' +
      '</div></div></div>';
  }).join("") + '</div>';
}
function renderHistory(items) {
  swipe.openRow = null;
  if (items === null) { el("historyList").innerHTML = queuedHtml() + pendingBlock("pending tall"); el("histMore").innerHTML = ""; return; } // ещё грузится
  state.recent = items || [];
  cacheInit({ recent: state.recent.slice(0, HIST_PAGE) }); // на телефоне храним только первую страницу
  var html = queuedHtml(), lastDay = null;
  var gone = cancels();
  state.recent.forEach(function (r, i) {
    if (r.id && gone.indexOf(r.id) > -1) return; // удалена, сервер ещё не подтвердил
    if (r.dayKey !== lastDay) { html += (lastDay !== null ? '</div>' : '') + dayHead(r.dayKey) + '<div class="daygroup">'; lastDay = r.dayKey; }
    var n = Number(r.amount);
    var name = categoryName(r.categoryId) || r.categoryName || t("hist.noCategory"); // перевод — по id категории
    // pending — изменение ещё не подтверждено сервером: карточка приглушена, не нажимается и подписана «сохраняется…»
    html += '<div class="row' + (r.pending ? " saving" : "") + '" data-i="' + i + '">' +
      '<button class="swipe-del">' + esc(t("delete")) + HZ + '</button>' +
      '<div class="card tx">' +
      '<div class="tx-main">' +
        '<div><span class="amount' + (n > 0 ? " pos" : "") + '">' + esc(fmtNum(n)) + " " + esc(r.currencyId) + '</span>' +
        (r.amountEUR !== "" && r.currencyId !== "EUR" ? ' <span class="muted">' + esc(fmtNum(r.amountEUR)) + ' EUR</span>' : '') + '</div>' +
        '<div class="tx-sub">' + esc(name) + (r.time ? ' · ' + esc(r.time) : '') + '</div>' +
        (r.pending ? '<div class="tx-sub tx-status"><span class="q sending"><span class="q-spin"></span>' + esc(t("st.saving")) + '</span></div>' : '') +
      // Без невидимого переключателя (HZ) — то есть без виброотклика на касание: в iOS 27 переключатель
      // перехватывает движение пальца, и список не прокручивался, если начать вести пальцем по операции
      '</div>' +
      '</div></div>';
  });
  if (lastDay !== null) html += '</div>'; // закрываем карточку последнего дня
  el("historyList").innerHTML = html || '<p class="muted">' + esc(t("hist.empty")) + '</p>';
  renderMore();
  setTimeout(checkMore, 0);
}
