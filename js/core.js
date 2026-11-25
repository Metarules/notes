// Общее: номер релиза страницы, состояние, мелкие помощники (el, esc, хранилище), уведомления.

// prefill — данные траты из ссылки шортката, СМС или вставленного текста: { merchant }
// loaded — справочники (категории, валюты, магазины) уже есть: из кэша на устройстве или с сервера
// touched — пользователь сам менял форму: фоновая загрузка больше не перезаписывает его ввод
// Номер релиза страницы = число коммитов index.html на GitHub, включая тот, где он записан
// (git rev-list --count HEAD -- index.html): +1 при каждом изменении страницы. Виден внизу формы
// рядом с номером сервера — так понятно, что телефон открыл свежую страницу, а не старую из кэша.
var PAGE_VERSION = 41;

var state = { categories: [], currencies: [], merchants: {}, recent: [], prefill: null, editing: null, savedNew: null, sign: -1, categoryId: "", todayKey: "",
  loaded: false, loadError: "", offline: false, touched: false, smsText: "", smsFailShown: false };

function el(id) { return document.getElementById(id); }
// число из CSS-переменной ("52px", "250ms" → 52, 250): одно значение и для стилей, и для кода
function cssNum(name, fallback) {
  var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return isFinite(v) ? v : fallback;
}
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value);
  } catch (e) { return null; }
}
// текст СМС на время жизни вкладки: обновление страницы не теряет подставленную трату
function session(key, value) {
  try {
    if (value === undefined) return sessionStorage.getItem(key);
    if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value);
  } catch (e) { return null; }
}

// ---------- уведомление ----------
// isError — красное уведомление (ошибка); ms — сколько показывать, если нужно дольше обычного
// сколько держится уведомление: обычное, «Сохранено», подсказка или предупреждение, ошибка
var TOAST_MS = 2500, TOAST_SHORT_MS = 2000, TOAST_LONG_MS = 4000, TOAST_ERROR_MS = 5000;
function toast(text, isError, ms) {
  var t = el("toast");
  t.textContent = text;
  t.className = "toast show" + (isError ? " err" : "");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(function () { t.className = "toast" + (isError ? " err" : ""); }, ms || (isError ? TOAST_ERROR_MS : TOAST_MS));
}

// любое касание страницы или нажатие клавиши убирает уведомление: пользователь уже приступил к делу.
// Новое уведомление от этого же касания (например, ошибка при сохранении) появится уже после.
function hideToast() {
  clearTimeout(toast.timer);
  el("toast").classList.remove("show");
}
document.addEventListener("pointerdown", hideToast, true);
document.addEventListener("keydown", hideToast, true);

var saving = false;
function setSaving(on) {
  var b = el("saveBtn");
  saving = !!on;
  b.classList.toggle("saving", saving);
  b.innerHTML = on ? '<span class="mini-spinner"></span>' : "Сохранить";
  updateSaveBtn();
}
// «Сохранить» доступна, только когда есть сумма, выбрана категория и загружены справочники
function amountValue() {
  var raw = el("amount").value.trim().replace(/^[-+]/, "");
  var n = raw ? parseNumber(raw) : NaN; // "1 234,50", "1,234.56" и т.п. — так же, как в разборе СМС
  return isFinite(n) && n !== 0 ? Math.abs(n) : 0;
}
function formReady() { return state.loaded && !!state.categoryId && amountValue() > 0; }
function updateSaveBtn() { el("saveBtn").disabled = saving || !formReady(); }
