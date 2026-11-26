// Связь с сервером Apps Script: запрос с ключом, id новой операции, экран «нет доступа», номера релизов.

// ---------- связь с сервером (Apps Script) ----------
// Адрес сервера и ключ приходят в ссылке от шортката (после "#") и хранятся только на этом устройстве.
var API = {
  apiGetInitData: function () { return { fn: "init" }; },
  apiGetRecent: function () { return { fn: "recent" }; },
  apiGetOlder: function (before) { return { fn: "recent", before: before }; },
  apiGetStats: function (from, to) { return { fn: "stats", from: from, to: to }; },
  apiAddTransaction: function (form) { return { fn: "add", form: form }; },
  apiAddMany: function (forms) { return { fn: "addMany", forms: forms }; },
  apiUpdateTransaction: function (row, expected, form) { return { fn: "update", row: row, expected: expected, form: form }; },
  apiDeleteTransaction: function (row, expected) { return { fn: "delete", row: row, expected: expected }; },
  apiDeleteById: function (id) { return { fn: "deleteById", id: id }; }
};

function isApiUrl(u) { return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(String(u || "")); }
function hasAccess() { return isApiUrl(store("api")) && !!store("token"); }

var TIMEOUT_MS = 30000; // дольше ответа не ждём: на плохой связи иначе индикатор крутится бесконечно

// opts.keepalive — запрос доходит до сервера, даже если форму закрыли сразу после «Сохранить»
function call(fn, args, onOk, onErr, opts) {
  function fail(msg, kind) {
    if (onErr) onErr(msg, kind || "server"); else toast(msg, true);
    setSaving(false);
  }
  var api = store("api"), token = store("token");
  if (!isApiUrl(api) || !token) { noAccess(t("err.openViaShortcut")); return; }
  var body = API[fn].apply(null, args || []);
  body.action = "page";
  body.token = token;
  var ctrl = typeof AbortController === "function" ? new AbortController() : null;
  var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
  // text/plain — «простой» запрос без предварительной проверки CORS, Apps Script его принимает
  fetch(api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow", credentials: "omit", referrerPolicy: "no-referrer", keepalive: !!(opts && opts.keepalive), signal: ctrl ? ctrl.signal : undefined })
    .then(function (r) {
      // Google при сбое (квота, ошибка скрипта) отвечает HTML-страницей, а не JSON
      return r.text().then(function (text) {
        try { return JSON.parse(text); } catch (e) { throw { server: t("err.httpPage", { http: r.status !== 200 ? " (HTTP " + r.status + ")" : "" }) }; }
      });
    })
    .then(function (res) {
      clearTimeout(timer);
      setOnline(true); // сервер ответил — связь есть
      if (res && res.ok) {
        // ошибка в обработчике — не «нет связи»: выпускаем её отдельно, мимо catch ниже
        try { onOk(res.result, res); } catch (err) { setTimeout(function () { throw err; }); }
        return;
      }
      if (res && res.auth === false) {
        store("token", null); // ключ не подошёл — забываем его и кэш данных
        store("init", null);
        noAccess(t("err.noAccess"));
        return;
      }
      fail(serverError(res) || t("err.server")); // текст по коду ошибки — на языке страницы
    })
    .catch(function (e) {
      clearTimeout(timer);
      if (e && e.server) { setOnline(true); fail(e.server); return; } // ответила страница ошибки Google — связь есть
      setOnline(false);
      if (e && e.name === "AbortError") fail(t("err.timeout"), "network");
      else fail(t("err.network"), "network");
    });
}

// случайный id новой траты
function newId() {
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
}
// форму поменяли; byUser — изменил сам пользователь (фоновая загрузка его ввод больше не перезаписывает)
function formChanged(byUser) {
  if (byUser) state.touched = true;
}

// номера релизов на экране «Настройки»; номер сервера приходит в init (serverVersion), до ответа — из кэша или «—»
function renderVersion() {
  el("verPage").textContent = PAGE_VERSION;
  el("verServer").textContent = state.serverVersion || "—";
}


function noAccess(text) {
  el("app").classList.add("hidden");
  el("loader").classList.remove("hidden");
  el("spinner").classList.add("hidden");
  el("retryBtn").classList.add("hidden");
  el("loaderText").textContent = text;
}
