// Очередь операций от шортката и разбор СМС и уведомлений банка: сумма, валюта, магазин.

// ---------- очередь операций от шортката ----------
// Каждая операция — текст сообщения банка. Пока телефон заблокирован, шорткат копит их у себя и потом передаёт
// все сразу: #op=…&op=… (старые первыми; прежнее имя параметра sms= тоже принимаем).
// Страница держит их на телефоне ("opQueue"), пока каждую не сохранят или не пропустят; разбирают их по нажатию
// на значок очереди (см. toggleOps ниже). Закрыли страницу на середине — операции дождутся в очереди.
// opDone — сколько операций этой пачки уже разобрано: для подписи «Сохранить · 2 из 3».
var OP_QUEUE_MAX = 50, OP_TEXT_MAX = 1000;
function opQueue(list) {
  if (list === undefined) {
    // очередь, оставшаяся от страниц 81–82, хранилась под прежними именами — переносим
    if (store("smsQueue") && !store("opQueue")) { store("opQueue", store("smsQueue")); store("opDone", store("smsDone")); }
    store("smsQueue", null); store("smsDone", null);
    try { var l = JSON.parse(store("opQueue") || "[]"); return Array.isArray(l) ? l.filter(function (s) { return typeof s === "string" && s; }) : []; }
    catch (e) { return []; }
  }
  store("opQueue", list.length ? JSON.stringify(list.slice(0, OP_QUEUE_MAX)) : null);
  if (!list.length) store("opDone", null); // пачка разобрана — следующая начнёт счёт заново
}
function opDone() { var n = Number(store("opDone")); return n > 0 ? n : 0; }
// одинаковый текст дважды не добавляем: у банка в каждом сообщении свой остаток, так что это повтор того же сообщения
function addOps(texts) {
  var q = opQueue();
  texts.forEach(function (s) {
    s = String(s || "").trim().slice(0, OP_TEXT_MAX);
    if (s && q.indexOf(s) < 0) q.push(s);
  });
  opQueue(q);
}
// Текст из буфера обмена (src=clip) берём в очередь, только если он похож на сообщение банка: слова из сообщений банка
// или сумма с кодом валюты («RSD 500», «12.00 EUR»). Иначе чужой текст из буфера (пароль, адрес…) надолго
// остался бы в очереди на телефоне. Раньше такой текст всё равно не заполнял форму — для неё ничего не меняется.
function clipLooksLikeBank(s) {
  s = String(s || "");
  return looksLikeBankText(s) || /\d\s?[A-Z]{3}\b|\b[A-Z]{3}\s?\d/.test(s);
}
// Разбор очереди — второстепенный: форма всегда открывается пустой, чтобы новую трату можно было ввести сразу,
// а очередь видна значком в нижней строке (opBadge). Нажали значок — разбор (state.opMode): форма заполняется
// операциями из очереди по одной. Нажали ещё раз — снова пустая форма, а операции остаются в очереди.
function toggleOps() {
  if (state.editing) return;
  if (state.opMode) stopOps();
  else if (opQueue().length) startOps();
}
function startOps() {
  state.opMode = true;
  resetForm(); // то, что успели набрать вручную, заменяется первой операцией из очереди
  clearUrl();
  state.opText = opQueue()[0] || "";
  state.opFailShown = false;
  renderOpUi();
  applyPrefill();
}
function stopOps() {
  state.opMode = false;
  state.opText = "";
  resetForm();
}
// после сохранения: если разбираем очередь — текущая операция разобрана, берём следующую.
// Трата, введённая вручную, очередь не трогает
function nextOp() {
  if (!state.opMode) { renderOpUi(); return; }
  var q = opQueue();
  if (q.length) { q.shift(); store("opDone", q.length ? String(opDone() + 1) : null); opQueue(q); }
  if (!q.length) state.opMode = false; // очередь разобрана — дальше обычная пустая форма
  state.opText = state.opMode ? q[0] : "";
  state.opFailShown = false;
  renderOpUi();
  if (state.opText) applyPrefill();
}
function skipOp() {
  if (state.editing || !state.opMode) return;
  resetForm();
  clearUrl();
  nextOp();
  toast(t("op.skipped"), false, TOAST_SHORT_MS);
}
// Что видно об очереди и об источнике операции — без отдельной строки над формой, чтобы форма не сдвигалась:
// магазин — мелко под суммой; во время разбора — «Пропустить» рядом с «Сохранить · 1 из 3»; число в очереди — на значке.
function opPosText() {
  if (state.editing || !state.opMode) return "";
  var left = opQueue().length, done = opDone(), total = done + left;
  return left > 0 && total > 1 ? t("op.pos", { i: done + 1, n: total }) : "";
}
function renderOpUi() {
  var m = !state.editing && state.prefill && state.prefill.merchant || "";
  el("opSource").textContent = m;
  el("amountField").classList.toggle("has-src", !!m);
  el("skipBtn").classList.toggle("hidden", !state.opMode || !!state.editing);
  var n = opQueue().length, badge = el("opBadge");
  el("opCount").textContent = n ? String(n) : "";
  badge.classList.toggle("hidden", !n && !state.opMode);
  badge.classList.toggle("on", state.opMode);
  badge.setAttribute("aria-pressed", state.opMode ? "true" : "false");
  badge.setAttribute("aria-label", state.opMode ? t("op.badgeStop") : t("op.badge", { n: n }));
  if (!saving) setSaving(false); // перерисовать подпись «Сохранить»
}

// ---------- разбор СМС / уведомления банка ----------
// Разбор только здесь, на странице: сервер получает готовые сумму, валюту и магазин.

// число из строки: "1 234,50", "1.234,50", "1,234.50", "-350" и т.п.
function parseNumber(raw) {
  var s = String(raw).replace(/[\s  ']/g, "");
  var lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot > -1 && lastComma > -1) {
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    var commas = (s.match(/,/g) || []).length;
    if (commas > 1 || s.length - lastComma - 1 === 3) s = s.replace(/,/g, "");
    else s = s.replace(",", ".");
  } else if (lastDot > -1) {
    var dots = (s.match(/\./g) || []).length;
    if (dots > 1 || s.length - lastDot - 1 === 3) s = s.replace(/\./g, "");
  }
  return Number(s);
}

// Те же правила, что normalizeMerchant_ на сервере: по этим ключам сервер присылает категории магазинов.
var MERCHANT_MAX = 100; // длина названия; сервер присылает своё значение в init (limits)
function normalizeMerchant(name) {
  return String(name || "").replace(/\s+/g, " ").trim().replace(/^[=+\-@'\s]+/, "").slice(0, MERCHANT_MAX).toUpperCase();
}

// категория, которую магазин получил в прошлый раз (только подсказка)
function merchantCategory(merchant) {
  var key = normalizeMerchant(merchant);
  return key && Object.prototype.hasOwnProperty.call(state.merchants, key) ? String(state.merchants[key]) : "";
}

function extractMerchant(t, amountText) {
  var patterns = [
    /(?:trgovac|prodajno mesto|mesto|kod|merchant|магазин|место)\s*[:\-]?\s*([^\n,;]{2,60})/i,
    /\b(?:at|u|в)\s+([A-ZА-ЯЁ0-9][^\n,;]{1,60})/
  ];
  for (var i = 0; i < patterns.length; i++) {
    var m = t.match(patterns[i]);
    if (m && m[1] && m[1].indexOf(amountText) === -1) return normalizeMerchant(m[1]);
  }
  return "";
}

// похоже ли на сообщение банка — по словам из его СМС (Placeno kart.br. … / Raspolozivo: …)
function looksLikeBankText(text) {
  return /\bpla[cć]eno\b|kart\.?\s*br|raspolo/i.test(String(text || ""));
}

// { amount, currencyId, merchant } или null. Формат банка разбирается сразу,
// общий формат («500 RSD …») — только когда известен список валют.
function parseBankText(text) {
  var t = String(text || "").replace(/ /g, " ");

  // пример (выдуманный): Placeno kart.br. 123456_0000 / MP001 PRODAVNICA BG / Beograd RS / RSD 1,234.56 / Raspolozivo: RSD 10,000.00
  var parts = t.split("/").map(function (s) { return s.trim(); }).filter(Boolean);
  if (/^plac[ae]no\b/i.test(parts[0] || "") && parts.length >= 4) {
    for (var i = 2; i < parts.length; i++) {
      if (/^raspolo/i.test(parts[i])) break;
      var am = parts[i].match(/^([A-Za-z]{3})\s*([\d.,\s]+)$/) || parts[i].match(/^([\d.,\s]+)\s*([A-Za-z]{3})$/);
      if (!am) continue;
      var codeFirst = /^[A-Za-z]/.test(am[1]);
      var value = parseNumber(codeFirst ? am[2] : am[1]);
      if (isFinite(value) && value !== 0)
        return { amount: -Math.abs(value), currencyId: (codeFirst ? am[1] : am[2]).toUpperCase(), merchant: normalizeMerchant(parts[1]) };
    }
  }
  var codes = state.currencies.map(function (c) { return String(c).replace(/[^A-Za-z]/g, ""); }).filter(Boolean);
  if (!codes.length) return null;
  var codeRe = codes.join("|");
  var num = "(\\d{1,3}(?:[ .,']\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)";

  // остаток на счёте («Raspoloživo: RSD …») — никогда не сумма траты: дальше его не смотрим
  t = t.replace(/raspolo[žz]ivo[\s\S]*$/i, "");
  var amountStr = "", currencyId = "", matched = "";
  // перед суммой — начало строки или не цифра (вместо lookbehind, которого нет в старом Safari)
  var m = t.match(new RegExp("(?:^|[^\\d.,])" + num + "\\s*(" + codeRe + ")\\b", "i"));
  if (m) { amountStr = m[1]; currencyId = m[2]; matched = m[0]; }
  else {
    m = t.match(new RegExp("\\b(" + codeRe + ")\\s*" + num, "i"));
    if (m) { currencyId = m[1]; amountStr = m[2]; matched = m[0]; }
  }
  if (!m) return null;

  var amount = Math.abs(parseNumber(amountStr));
  if (!isFinite(amount) || amount === 0) return null;
  // поступления — со знаком плюс, всё остальное — расход
  if (!/(uplat|priliv|odobren|povra[ćt]|refund|\bcredited\b|зачисл|пополн|возврат|поступ)/i.test(t)) amount = -amount;
  return { amount: amount, currencyId: currencyId.toUpperCase(), merchant: extractMerchant(t, matched.trim()) };
}
