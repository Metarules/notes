// Общее: номер релиза страницы, состояние, мелкие помощники (el, esc, хранилище), уведомления.

// prefill — данные траты из ссылки шортката, СМС или вставленного текста: { merchant }
// loaded — справочники (категории, валюты, магазины) уже есть: из кэша на устройстве или с сервера
// touched — пользователь сам менял форму: фоновая загрузка больше не перезаписывает его ввод
// Номер релиза страницы = число коммитов index.html на GitHub, включая тот, где он записан
// (git rev-list --count HEAD -- index.html): +1 при каждом изменении страницы. Виден внизу формы
// рядом с номером сервера — так понятно, что телефон открыл свежую страницу, а не старую из кэша.
var PAGE_VERSION = 94;

var state = { categories: [], currencies: [], merchants: {}, recent: [], prefill: null, editing: null, savedNew: null, sign: -1, categoryId: "", todayKey: "",
  loaded: false, loadError: "", offline: false, touched: false, opText: "", opFailShown: false, opMode: false };

function el(id) { return document.getElementById(id); }
// прокручивается не страница, а область #scroller (см. стили): наверх — её, сколько прокручено — у неё
function scrollToTop() { el("scroller").scrollTop = 0; }
function scrolledBy() { return el("scroller").scrollTop; }
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

// ---------- виброотклик ----------
// В iOS Safari нет API вибрации, но системный переключатель <input type=checkbox switch> «тикает», когда его
// касается палец. Программное нажатие с iOS 26.5 не тикает, поэтому в кнопку с откликом вкладываем невидимый
// такой переключатель на всю её площадь (HZ, стили .hz): палец попадает на него, iOS тикает, а нажатие
// всплывает до кнопки и выполняет её действие как обычно. Тик — один на касание; на отпускание после свайпа
// его не бывает. На Android — штатный navigator.vibrate через haptic(n). Выключается в «Настройках» («Виброотклик»).
var HZ = '<input type="checkbox" switch class="hz" tabindex="-1" aria-hidden="true">';
// Переключатель получают все кнопки с data-act — и нарисованные заново: следим за изменениями страницы.
// Звук нажатия (Snd.tap) — у тех же кнопок, так что вибрация и звук всегда вместе.
function armHaptics() {
  var list = document.querySelectorAll("button[data-act]");
  for (var i = 0; i < list.length; i++) {
    var b = list[i];
    if (b.lastElementChild && b.lastElementChild.classList.contains("hz")) continue;
    var old = b.querySelector(".hz"); // текст кнопки поменяли после переключателя — переносим его в конец, поверх всего
    if (old) { b.appendChild(old); continue; }
    if (getComputedStyle(b).position === "static") b.style.position = "relative";
    b.insertAdjacentHTML("beforeend", HZ);
  }
}
if (window.MutationObserver) new MutationObserver(armHaptics).observe(document.documentElement, { childList: true, subtree: true });
var HAPTIC_GAP_MS = 110; // между вибрациями двойного/тройного на Android
function hapticsOn() { return store("haptics") !== "off"; }
function haptic(n) {
  if (!hapticsOn() || !navigator.vibrate) return;
  n = n || 1;
  try { var p = []; for (var i = 0; i < n; i++) p.push(12, HAPTIC_GAP_MS); navigator.vibrate(p.slice(0, -1)); } catch (e) {}
}

// ---------- котик на ошибках ----------
// Одна мордочка-смайлик (голова с ушками, носик, рот «ω», усы); различаются только глаза и мелочи:
// sleep — нет связи (спит, «z»), cry — сервер не ответил (плачет, синяя слеза), angry — ключ не подошёл (сердитый прищур),
// calm — страницу открыли не через шорткат (ошибки нет — спокойные глаза-точки).
// Цвет линий — currentColor (задаёт место, где мордочка стоит), слеза — цвет кнопок (.cat-tear в стилях).
var CAT_EYES = {
  calm: '<circle cx="24.5" cy="35" r="2.4" fill="currentColor" stroke="none"/><circle cx="39.5" cy="35" r="2.4" fill="currentColor" stroke="none"/>',
  sleep: '<path d="M21 35 q3.5 2.6 7 0"/><path d="M36 35 q3.5 2.6 7 0"/>',
  cry: '<path d="M21 35.6 q3.5 -2.6 7 0"/><path d="M36 35.6 q3.5 -2.6 7 0"/>',
  angry: '<path d="M21 33 L28 35.8 Q27.4 38.4 24.6 38.4 Q21.6 38.2 21 33 Z" fill="currentColor" stroke-width="1.2"/>' +
    '<path d="M43 33 L36 35.8 Q36.6 38.4 39.4 38.4 Q42.4 38.2 43 33 Z" fill="currentColor" stroke-width="1.2"/>'
};
var CAT_EXTRA = {
  calm: '',
  sleep: '<path d="M54.5 2 h6 l-6 7 h6" stroke-width="2.2"/><path d="M63 -5.5 h4 l-4 4.6 h4" stroke-width="1.8"/>',
  cry: '<path class="cat-tear" d="M24.5 37.1 C24 39.1 23.2 41 23.2 42.1 C23.2 43 23.8 43.6 24.5 43.6 C25.2 43.6 25.8 43 25.8 42.1 C25.8 41 25 39.1 24.5 37.1 Z" stroke-width="1.2"/>',
  angry: ''
};
function catFace(kind, size) {
  return '<svg class="cat-face" width="' + size + '" height="' + size + '" viewBox="-4 -6 72 72" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M11 31 L13 10 L25 19 Q32 16.5 39 19 L51 10 L53 31 Q54 55 32 56 Q10 55 11 31 Z"/>' + CAT_EYES[kind] +
    '<path d="M30.4 40.2 h3.2 l-1.6 1.8 Z" fill="currentColor" stroke-width="1.2"/>' +
    '<path d="M32 42 v2.6" stroke-width="2.2"/><path d="M28 46.2 q2 -2.4 4 -1.6 q2 -0.8 4 1.6" stroke-width="2.2"/>' +
    '<g stroke-width="1.8"><path d="M20 42.4 Q14 40.6 8.5 41.4"/><path d="M20 45.4 Q14 45.6 8.8 48.2"/><path d="M44 42.4 Q50 40.6 55.5 41.4"/><path d="M44 45.4 Q50 45.6 55.2 48.2"/></g>' +
    CAT_EXTRA[kind] + '</svg>';
}

// ---------- уведомление ----------
// isError — красное уведомление (ошибка); ms — сколько показывать, если нужно дольше обычного
// сколько держится уведомление: обычное, «Сохранено», подсказка или предупреждение, ошибка
var TOAST_MS = 2500, TOAST_SHORT_MS = 2000, TOAST_LONG_MS = 4000, TOAST_ERROR_MS = 5000;
// kind: true — ошибка (красное), "net" — нет связи (жёлтое, как значок «Нет связи»), иначе — обычное
function toast(text, kind, ms) {
  var t = el("toast"), cls = kind === true ? " err" : kind === "net" ? " net" : "";
  t.textContent = text;
  t.className = "toast show" + cls;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(function () { t.className = "toast" + cls; }, ms || (kind === true ? TOAST_ERROR_MS : TOAST_MS));
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
  var pos = on ? "" : opPosText(); // «Сохранить · 1 из 3», когда разбираем очередь операций (sms.js)
  b.innerHTML = on ? '<span class="mini-spinner"></span>' : esc(t("save")) + (pos ? ' <span class="op-pos">· ' + esc(pos) + '</span>' : "") + HZ;
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
