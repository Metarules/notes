// Форма ввода: знак, категории, выбор валюты, сохранение, изменение операции.

// ---------- знак ----------
function setSign(s) {
  state.sign = s;
  el("signBtn").textContent = s < 0 ? "−" : "+";
  el("amountField").classList.toggle("pos", s > 0);
}
function toggleSign() { setSign(-state.sign); formChanged(true); }

// ---------- индикаторы загрузки ----------
// пока справочников нет: в сетке категорий — индикатор или ошибка с кнопкой «Повторить»
function pendingBlock(cls) {
  // нет связи — о ней уже говорит значок в нижней строке, здесь только тихая пометка
  if (state.offline) return '<div class="' + cls + '"><span class="net-text">' + esc(t("form.loadWhenOnline")) + '</span></div>';
  if (state.loadError) return '<div class="' + cls + '"><span class="cat-ill">' + catFace("cry", 64) + '</span><span class="muted">' + esc(state.loadError) + '</span><button class="link inline" data-act="load">' + esc(t("retry")) + '</button></div>';
  return '<div class="' + cls + '"><span class="spinner sm"></span></div>';
}

// ---------- категории ----------
function splitName(name) {
  var m = String(name || "").match(/^(\S+)\s+(.+)$/);
  if (m && !/[A-Za-zА-Яа-яЁё0-9]/.test(m[1])) return { emo: m[1], label: m[2] };
  return { emo: "", label: String(name || "") };
}
function renderCategories() {
  if (!state.loaded) { el("catGrid").innerHTML = pendingBlock("pending"); updateSaveBtn(); return; }
  el("catGrid").innerHTML = state.categories.map(function (c, i) {
    var n = splitName(categoryLabel(c));
    return '<button class="chip' + (sameId(c.categoryId, state.categoryId) ? " on" : "") + '" data-act="userPickCategory" data-arg="' + i + '">' +
      (n.emo ? '<span class="emo">' + esc(n.emo) + '</span>' : '') +
      '<span class="name">' + esc(n.label) + '</span>' + HZ + '</button>';
  }).join("");
  updateSaveBtn();
  scheduleFit();
}
function pickCategory(id) { state.categoryId = id; renderCategories(); }
function userPickCategory(i) { var c = state.categories[i]; if (!c) return; haptic(1); pickCategory(c.categoryId); formChanged(true); }
// id категорий сравниваем как текст: из разных мест (таблица, магазины) он может прийти числом или строкой
function sameId(a, b) { return String(a == null ? "" : a) === String(b == null ? "" : b) && a !== "" && a != null; }
// Название категории на языке страницы: перевод из столбца en/de/sr/es листа Categories, а нет его — основное.
// Значок (эмодзи) — из основного названия, в переводе его повторять не нужно.
function categoryLabel(c) {
  var tr = c && c.names && c.names[LANG];
  if (!tr) return c ? c.categoryName : "";
  var emo = splitName(c.categoryName).emo;
  return emo && !splitName(tr).emo ? emo + " " + tr : tr;
}
function categoryName(id) {
  var c = state.categories.filter(function (x) { return sameId(x.categoryId, id); })[0];
  return c ? categoryLabel(c) : "";
}
// список валют; пока его нет — «…» и выбор недоступен
function renderCurrencies(selected) {
  var sel = el("currency");
  if (!state.currencies.length) { sel.innerHTML = '<option value="">…</option>'; sel.disabled = true; sel.classList.add("loading"); syncCurBtn(); return; }
  if (state.currencies.indexOf(selected) < 0) selected = state.currencies.indexOf("RSD") > -1 ? "RSD" : state.currencies[0];
  sel.innerHTML = state.currencies.map(function (c) {
    return '<option value="' + esc(c) + '"' + (c === selected ? " selected" : "") + ">" + esc(c) + "</option>";
  }).join("");
  sel.disabled = false;
  sel.classList.remove("loading");
  syncCurBtn();
}

// ---------- выбор валюты: крупная панель вместо системного списка ----------
// флаг валюты: по ISO 4217 первые две буквы кода — код страны (RSD → RS, EUR → EU).
// Коды на X (металлы, СДР) и криптовалюты из CUR_NO_FLAG — без флага, чтобы не показать чужую страну.
var CUR_NO_FLAG = ["BTC", "ETH", "LTC", "SOL", "TON", "USDT", "USDC"];
function curFlag(c) {
  c = String(c || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(c) || c.charAt(0) === "X" || CUR_NO_FLAG.indexOf(c) > -1) return "";
  return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65, 0x1F1E6 + c.charCodeAt(1) - 65);
}
function curFlagHtml(c) {
  var f = curFlag(c);
  return f ? '<span class="flag" aria-hidden="true">' + f + '</span>' : "";
}
// Значение хранится в скрытом <select id="currency"> — остальной код читает его как раньше.
function syncCurBtn() {
  var sel = el("currency"), b = el("curBtn");
  b.innerHTML = sel.disabled || !sel.value ? "…" : curFlagHtml(sel.value) + esc(sel.value) + '<svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  b.disabled = sel.disabled;
}
function setCurrency(c) {
  if (state.currencies.indexOf(c) > -1) el("currency").value = c;
  syncCurBtn();
}
// список валют не ниже CUR_PANEL_MIN_ROWS строк, даже на низком экране; CUR_PANEL_PAD — отступы панели сверху и снизу (padding в CSS)
var CUR_PANEL_MIN_ROWS = 4, CUR_PANEL_PAD = 8;
function toggleCurPanel() {
  if (!el("curPanel").classList.contains("hidden")) { closeCurPanel(); return; }
  var f = el("amountField"), p = el("curPanel"), cur = el("currency").value;
  p.style.top = (f.offsetTop + f.offsetHeight + 6) + "px";
  // не длиннее видимой части экрана над панелью браузера: если валют много — список прокручивается
  var room = window.innerHeight - fitReserve() - (f.getBoundingClientRect().bottom + 6) - 8;
  p.style.maxHeight = Math.max(CUR_PANEL_MIN_ROWS * cssNum("--cur-row-h", 52) + CUR_PANEL_PAD, room) + "px";
  p.innerHTML = state.currencies.map(function (c, i) {
    var on = c === cur;
    return '<button role="menuitemradio" aria-checked="' + on + '" class="' + (on ? "on" : "") + '" data-act="pickCurrency" data-arg="' + i + '">' +
      '<span class="check" aria-hidden="true">' + (on ? "✓" : "") + '</span>' +
      curFlagHtml(c) + '<span class="code">' + esc(c) + '</span></button>';
  }).join("");
  p.classList.remove("hidden");
  el("curBtn").setAttribute("aria-expanded", "true");
}
function closeCurPanel() {
  el("curPanel").classList.add("hidden");
  el("curBtn").setAttribute("aria-expanded", "false");
}
function pickCurrency(i) {
  var c = state.currencies[i];
  closeCurPanel();
  if (!c || c === el("currency").value) return;
  setCurrency(c);
  el("currency").dispatchEvent(new Event("change")); // как выбор в системном списке: «пользователь поменял форму»
}
// касание вне панели и кнопки валюты — закрыть
document.addEventListener("pointerdown", function (e) {
  if (el("curPanel").classList.contains("hidden")) return;
  if (e.target.closest("#curPanel") || e.target.closest("#curBtn")) return;
  closeCurPanel();
}, true);
document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeCurPanel(); });

// ---------- форма ----------
function fillForm(d) {
  formChanged();
  setSign(Number(d.amount) > 0 ? 1 : -1);
  el("amount").value = Math.abs(Number(d.amount)) || "";
  updateClear();
  if (d.currencyId) state.wantCurrency = d.currencyId; // если валют ещё нет — выберем, когда загрузятся
  if (state.currencies.indexOf(d.currencyId) > -1) setCurrency(d.currencyId);
  pickCategory(d.categoryId || "");
}
function resetForm() {
  setSign(-1);
  el("amount").value = "";
  updateClear();
  pickCategory("");
  state.prefill = null;
  state.wantCurrency = "";
  formChanged();
  state.touched = false;
  renderOpUi();
}
// убрать данные траты из адресной строки, чтобы обновление страницы не подставило их снова
// (операцию из очереди убирает nextOp в sms.js)
function clearUrl() {
  try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
}

// крестик в поле суммы: стирает только сумму
function updateClear() { el("clearAmt").classList.toggle("hidden", !el("amount").value); updateSaveBtn(); }
function clearAmount() {
  el("amount").value = "";
  updateClear();
  formChanged(true);
  el("amount").focus();
}
el("amount").addEventListener("input", function () { updateClear(); formChanged(true); });
el("currency").addEventListener("change", function () { state.wantCurrency = ""; formChanged(true); });

// вставка текста банка в поле суммы — разбираем прямо на странице и заполняем форму
el("amount").addEventListener("paste", function (e) {
  if (state.editing) return;
  var text = (e.clipboardData || window.clipboardData).getData("text") || "";
  if (/^\s*[-+]?[\d\s.,]+\s*$/.test(text)) return; // обычное число — вставляем как есть
  e.preventDefault();
  var r = parseBankText(text);
  if (!r) { toast(state.loaded ? t("form.pasteNoAmount") : t("form.dictLoading"), false, TOAST_LONG_MS); return; }
  fillForm({ amount: r.amount, currencyId: r.currencyId, categoryId: merchantCategory(r.merchant) });
  state.prefill = { merchant: r.merchant || "", fromClip: true }; // вставили из буфера — после сохранения очистим его
  renderOpUi();
  state.touched = true;
});

function readForm() {
  var amount = amountValue();
  // не хватает данных — тройной тик (проверка на телефоне, сразу по нажатию «Сохранить»)
  if (!amount) { toast(t("form.enterAmount"), true); el("amount").focus(); return null; }
  if (!state.loaded) { toast(t("form.dictLoading"), true); return null; }
  if (!state.categoryId) { toast(t("form.pickCategory"), true); return null; }
  return { amount: state.sign * Math.abs(amount), currencyId: el("currency").value, categoryId: state.categoryId };
}

// изменить или удалить уже записанную операцию можно только со связью (очередь — только для новых)

// «Сохранено: −13 EUR · 🍽 Кафе»
function savedText(form) {
  return t("form.saved", { amount: fmtNum(form.amount) + " " + form.currencyId, cat: categoryName(form.categoryId) || form.categoryId });
}

function save() {
  var form = readForm();
  if (!form) return;
  haptic(1); // «Сохранить» нажато, данные в порядке
  if (state.editing && navigator.onLine === false) { toast(t("form.noNetEdit"), "net", TOAST_LONG_MS); return; }
  Snd.save(); // касса — только когда запись правда уходит
  setSaving(true);
  if (state.editing) {
    var ed = state.editing;
    if (ed.when && ed.when !== ed.when0) form.when = ed.when; // дату меняли — сервер поставит строку на новое место
    // Как на главной форме: сразу возвращаемся в историю, операция там уже с новыми данными (приглушённо, пока сервер
    // не ответит), запрос уходит фоном и доходит, даже если форму сразу закрыть. Не получилось — операция
    // возвращается к прежнему виду и показываем причину.
    setSaving(false);
    cancelEdit();
    var old = showEditLocally(ed, form);
    pendingEdits++;
    toast(savedText(form), false, TOAST_SHORT_MS);
    call("apiUpdateTransaction", [ed.row, ed.expected, form], function (res, full) {
      pendingEdits--;
      if (full && full.recent) freshRecent = full.recent;
      var moved = !!(res && res.moved);
      redrawWhenFree(function () {
        // строка переехала по дате: номера подгруженных старых операций сдвинулись — показываем историю заново с начала
        if (moved) { state.recent = []; hist.next = 0; hist.done = false; hist.failed = false; }
        if (freshRecent) renderHistory(withOlder(freshRecent)); else showRecent(null);
      });
    }, function (msg, kind) {
      pendingEdits--;
      if (kind === "timeout") { checkEditLater(old); return; }
      undoEditLocally(old);
      if (kind === "network") toast(t("form.noNetEditLost"), true); else toast(t("form.editFailed", { msg: msg }), true);
    }, { keepalive: true });
    return;
  }
  var p = state.prefill || {};
  form.merchant = p.merchant || "";
  // текст банка был взят из буфера обмена — чистим буфер, чтобы следующий запуск не подставил ту же операцию.
  // Делаем сразу, пока идёт нажатие на кнопку: позже браузер запись в буфер не разрешит.
  if (p.fromClip) clearClipboard();
  // Мгновенное сохранение: операция сразу ложится в очередь на телефоне, форма очищается,
  // а отправка идёт в фоне. id — защита от дублей (сервер помнит его в столбце «ID»),
  // время — момент нажатия «Сохранить»: так операция из очереди получит время покупки.
  form.id = newId();
  form.at = new Date().toISOString();
  var offline = navigator.onLine === false;
  enqueue(form, offline);
  store("currency", form.currencyId);
  resetForm();
  clearUrl();
  setSaving(false);
  toast(offline ? t("form.savedOffline") : savedText(form), offline ? "net" : false, offline ? TOAST_LONG_MS : TOAST_SHORT_MS);
  nextOp(); // операция разобрана — в форму сразу следующая из очереди, если есть
  flushOutbox(true); // пробуем сразу, даже если значок «Нет связи» ещё виден — связь могла вернуться
}
function clearClipboard() {
  function fallback() {
    try {
      var t = document.createElement("textarea");
      t.value = " "; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;top:-100px;opacity:0";
      document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    } catch (e) {}
  }
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText("").catch(fallback); return; }
  } catch (e) {}
  fallback();
}
// сервер присылает свежую историю вместе с ответом; если её нет — запрашиваем отдельно
function showRecent(full) {
  if (full && full.recent) renderHistory(withOlder(full.recent));
  else call("apiGetRecent", [], function (list) { renderHistory(withOlder(list)); });
}

// ---------- изменение ----------
function startEdit(i) {
  var r = state.recent[i];
  if (!r) return;
  state.savedNew = { amount: el("amount").value, sign: state.sign, categoryId: state.categoryId, currencyId: el("currency").value, prefill: state.prefill, touched: state.touched };
  // id — по нему сервер найдёт операцию, даже если строки сдвинулись; категория — для строк без id
  // when — дата и время в виде "yyyy-MM-ddTHH:mm" (белградское время, как в таблице); when0 — как было
  var when0 = r.dayKey ? r.dayKey + "T" + (r.time || "00:00") : "";
  state.editing = { row: r.row, expected: { date: r.date, amount: r.amount, currencyId: r.currencyId, categoryId: r.categoryId, id: r.id || "" },
    when0: when0, when: when0, hasTime: !!r.time };
  state.prefill = null;
  fillForm({ amount: r.amount, currencyId: r.currencyId, categoryId: r.categoryId });
  renderEditWhen();
  el("histBar").classList.add("hidden");
  el("navRow").classList.add("hidden"); // при изменении — только «Сохранить»; назад — стрелкой в шапке
  el("editBar").classList.remove("hidden");
  renderOpUi(); // при изменении операции ни магазина, ни «Пропустить», ни номера в очереди
  el("view-history").classList.add("hidden");
  el("view-add").classList.remove("hidden");
  scrollToTop();
  scheduleFit();
}
// Дата и время операции в шапке изменения. Подпись — «25 нояб., 12:00» по правилам языка (год — если не текущий);
// у строк, введённых в таблицу только с датой, время не показываем, пока его не выбрали.
function whenLabel(v, withTime) {
  var p = String(v).split("T"), d = p[0].split("-").map(Number);
  var s = fmtDayMonth(new Date(d[0], d[1] - 1, d[2], 12), d[0] !== new Date().getFullYear());
  return withTime ? s + ", " + p[1] : s;
}
function renderEditWhen() {
  var e = state.editing;
  el("editWhenPill").classList.toggle("hidden", !e || !e.when); // у строки без даты (текст в ячейке) менять нечего
  if (!e || !e.when) return;
  var changed = e.when !== e.when0;
  el("editWhen").textContent = whenLabel(e.when, e.hasTime || changed);
  el("editWhenPill").classList.toggle("changed", changed);
  el("editWhenInput").value = e.when;
}
el("editWhenInput").addEventListener("change", function () {
  var e = state.editing;
  if (!e) return;
  var v = el("editWhenInput").value;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) e.when = v.slice(0, 16); // «Очистить» в системном окне — оставляем прежнее
  renderEditWhen();
  formChanged(true);
});
// на компьютере прозрачное поле само открывает выбор только со значка — открываем сразу; на iPhone окно открывается по нажатию
el("editWhenInput").addEventListener("click", function () {
  try { if (window.matchMedia && matchMedia("(pointer: fine)").matches && this.showPicker) this.showPicker(); } catch (x) {}
});

// операция в истории до ответа сервера: новые сумма, валюта, категория и дата, отметка pending (приглушена)
function sameOp(a, b) { return a.id ? a.id === b.id : a.row === b.row; }
function showEditLocally(ed, form) {
  var key = { id: ed.expected.id, row: ed.row };
  var i = -1;
  state.recent.forEach(function (x, k) { if (i < 0 && sameOp(key, x)) i = k; });
  if (i < 0) return null;
  var old = state.recent[i];
  var r = Object.assign({}, old, { amount: form.amount, currencyId: form.currencyId, categoryId: form.categoryId,
    categoryName: categoryName(form.categoryId) || old.categoryName, pending: true });
  // сумма в евро: та же валюта — пересчитываем по прежнему курсу, другая — покажет сервер
  r.amountEUR = form.currencyId === old.currencyId && typeof old.amountEUR === "number" && Number(old.amount)
    ? Math.round(old.amountEUR / Number(old.amount) * form.amount * 100) / 100 : "";
  if (form.when) {
    var hm = form.when.slice(11, 16);
    r.dayKey = form.when.slice(0, 10);
    r.time = hm === "00:00" ? "" : hm;
    r.sortKey = new Date(form.when).getTime();
  }
  var list = state.recent.slice();
  list[i] = r;
  if (canRedrawHistory()) renderHistory(list.sort(byDateDesc)); else state.recent = list.sort(byDateDesc);
  return old;
}
// Сервер не ответил вовремя: изменение могло и записаться. Не говорим «не сохранилось» — перечитываем историю
// с сервера и показываем, как есть на самом деле; не удалось перечитать — возвращаем прежний вид.
var EDIT_CHECK_DELAY_MS = 2000;
function checkEditLater(old) {
  toast(t("form.editUnknown"), false, TOAST_LONG_MS);
  setTimeout(function () {
    call("apiGetRecent", [], function (list) {
      freshRecent = list;
      redrawWhenFree(function () { renderHistory(withOlder(freshRecent)); });
    }, function () {
      undoEditLocally(old);
      toast(t("form.editCheckFailed"), true);
    });
  }, EDIT_CHECK_DELAY_MS);
}
// сервер не сохранил изменение — возвращаем операцию к прежнему виду
function undoEditLocally(old) {
  if (!old) return;
  var list = state.recent.map(function (x) { return sameOp(old, x) ? old : x; }).sort(byDateDesc);
  if (canRedrawHistory()) renderHistory(list); else state.recent = list;
}

function cancelEdit() {
  state.editing = null;
  el("editBar").classList.add("hidden");
  el("navRow").classList.remove("hidden");
  // возвращаем то, что было на «Вводе» до изменения
  var s = state.savedNew;
  if (s) {
    setSign(s.sign); el("amount").value = s.amount; updateClear(); setCurrency(s.currencyId); pickCategory(s.categoryId);
    state.prefill = s.prefill;
    state.touched = s.touched;
    state.savedNew = null;
  } else resetForm();
  renderOpUi();
  showTab("history");
}
