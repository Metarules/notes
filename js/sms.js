// Разбор СМС и уведомлений банка: сумма, валюта, магазин.

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
