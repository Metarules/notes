// Запуск: параметры ссылки, кэш на устройстве, подстановка траты из очереди операций, загрузка данных. Подключается последним.

// ---------- параметры ссылки (после "#") ----------
// op — операция от шортката: текст сообщения банка (разбираем здесь, на странице); их может быть несколько
// (op=…&op=…) — это очередь, см. sms.js; прежнее имя параметра sms тоже принимаем; src=clip — текст взят из буфера обмена;
// tab=history — сразу открыть историю; t — ключ доступа, api — адрес сервера: их запоминаем на устройстве.
// Ключ, адрес и тексты операций сразу убираем из адресной строки.
// Новый адрес сервера принимаем только вместе с ключом: иначе чужая ссылка «#api=…» без ключа
// отправила бы уже сохранённый на телефоне ключ на сервер злоумышленника.
function readParams() {
  var q = {}, opList = [];
  try {
    var sp = new URLSearchParams(location.hash.replace(/^#/, ""));
    sp.forEach(function (v, k) { q[k] = v; });
    opList = sp.getAll("op").concat(sp.getAll("sms"));
  } catch (e) {}
  if (q.t || q.api || opList.length) {
    var newApi = isApiUrl(q.api) && q.api !== store("api") ? q.api : "";
    if (newApi && !q.t) newApi = ""; // адрес без ключа — не меняем
    if (q.t) store("token", q.t);
    if (newApi) { store("api", newApi); store("init", null); store("stats", null); store("statsFirst", null); } // другой сервер — справочники, историю и статистику берём заново с него
    if (opList.length) addOps(q.src === "clip" ? opList.filter(clipLooksLikeBank) : opList);
    var rest = new URLSearchParams();
    Object.keys(q).forEach(function (k) { if (k !== "t" && k !== "api" && k !== "op" && k !== "sms") rest.append(k, q[k]); });
    var hash = rest.toString();
    try { history.replaceState(null, "", location.pathname + location.search + (hash ? "#" + hash : "")); } catch (e) {}
    delete q.t;
    delete q.api;
  }
  // вкладка, открытая страницей до 81-й, держала текст СМС у себя — переносим его в очередь
  var old = session("sms");
  if (old) { addOps([old]); session("sms", null); }
  delete q.op; delete q.sms; // операции теперь только в очереди: после обновления страницы берём их оттуда
  return q;
}

// ---------- кэш на устройстве: категории, валюты, магазины и последняя история ----------
// Страница сразу рисуется из кэша, а свежие данные с сервера приходят фоном.
function readCache() {
  if (!hasAccess()) return null;
  try { var c = JSON.parse(store("init") || "null"); return c && c.categories && c.currencies ? c : null; } catch (e) { return null; }
}
function cacheInit(part) {
  var c = readCache();
  if (!c && !part.categories) return; // нечего дополнять
  try { store("init", JSON.stringify(Object.assign(c || {}, part))); } catch (e) {}
}

// ---------- подстановка траты из очереди операций ----------
// Вызывается сразу при открытии и ещё раз, когда пришли справочники: до этого могут быть
// неизвестны валюты (общий формат СМС) и категории магазинов. Ввод пользователя не перезаписываем.
function applyPrefill() {
  if (state.editing) return;
  var q = params, p = null;
  if (state.opText) {
    var r = parseBankText(state.opText);
    if (r) p = { amount: r.amount, currencyId: r.currencyId, categoryId: merchantCategory(r.merchant), merchant: r.merchant };
    else if (state.loaded && !state.opFailShown && looksLikeBankText(state.opText)) {
      // подсказываем, только если это явно сообщение банка (например, банк поменял формат);
      // любой другой текст из буфера молча оставляет форму пустой
      state.opFailShown = true;
      toast(t("form.smsFail"), false, TOAST_LONG_MS);
    }
  }
  if (!p) return;
  if (state.touched) {
    // пользователь уже что-то менял — только подсказываем категорию, если он её ещё не выбрал
    if (!state.categoryId && p.categoryId) pickCategory(p.categoryId);
    return;
  }
  fillForm(p);
  // src=clip — шорткат взял текст из буфера обмена: после сохранения буфер очистим
  state.prefill = { merchant: p.merchant || "", fromClip: q.src === "clip" };
  renderOpUi();
}

// ---------- загрузка ----------
var params = readParams();
state.opText = ""; // форма открывается пустой: очередь операций разбирают по нажатию на её значок (sms.js)

// справочники пришли (из кэша или с сервера) — обновляем, не сбивая то, что пользователь уже выбрал
function applyData(data) {
  var cur = el("currency").value || state.wantCurrency || store("currency") || "";
  if (state.wantCurrency && !state.touched) cur = state.wantCurrency;
  state.categories = data.categories || [];
  state.currencies = data.currencies || [];
  state.merchants = data.merchants || state.merchants || {};
  state.todayKey = data.todayKey || state.todayKey || "";
  if (data.periodStartDay) state.periodStartDay = data.periodStartDay;
  if (data.serverVersion) { state.serverVersion = data.serverVersion; renderVersion(); }
  applyLimits(data.limits);
  state.loaded = true;
  state.loadError = "";
  renderCurrencies(cur);
  if (!state.categories.some(function (c) { return sameId(c.categoryId, state.categoryId); })) state.categoryId = "";
  renderCategories();
  hist.done = false; hist.next = 0; hist.failed = false;
  if (!state.editing && !historyBusy() && !swipe.openRow && !swipe.row) renderHistory(data.recent || []);
  applyPrefill();
}

// числа, общие с сервером (limits в ответе init): страница истории, пачка отправки, длина названия магазина
function applyLimits(l) {
  if (!l) return;
  if (l.historyPage > 0) HIST_PAGE = l.historyPage;
  if (l.sendBatch > 0) SEND_BATCH = l.sendBatch;
  if (l.merchantMax > 0) MERCHANT_MAX = l.merchantMax;
}

function load() {
  if (!state.loaded) { state.loadError = ""; renderCategories(); renderHistory(null); }
  el("netBadge").disabled = true;
  call("apiGetInitData", [], function (data) {
    el("netBadge").disabled = false;
    cacheInit({ categories: data.categories, currencies: data.currencies, merchants: data.merchants || {}, recent: data.recent, todayKey: data.todayKey, periodStartDay: data.periodStartDay, limits: data.limits, serverVersion: data.serverVersion });
    applyData(data);
    flushOutbox(); // связь есть — отправляем траты, отложенные без связи
    flushCancels(); // и удаляем на сервере то, что удалили, пока оно отправлялось
    preloadStatsAll(); // и статистику — фоном, чтобы она открылась сразу
  }, function (msg) {
    el("netBadge").disabled = false;
    if (state.loaded) return; // данные из кэша уже на экране; если нет связи — об этом говорит значок внизу
    state.loadError = msg;
    renderCategories();
    renderHistory(null);
  });
}

// форма показывается сразу; чего ещё нет — крутится индикатор, пока данные грузятся фоном
function boot() {
  if (!hasAccess()) { noAccess(t("err.openViaShortcut"), "calm"); return; }
  el("loader").classList.add("hidden");
  el("app").classList.remove("hidden");
  setSign(-1);
  renderOpUi();
  renderCurrencies(store("currency") || "");
  if (navigator.onLine === false) setOnline(false); // телефон офлайн — говорим сразу, не дожидаясь запроса
  var cached = readCache();
  if (cached) applyData(cached);
  else { renderCategories(); renderHistory(null); applyPrefill(); } // формат банка разбирается и без справочников
  navOwn(); // адрес после разбора ссылки — свой
  // обновили страницу, стоя на Истории или Настройках — остаёмся там (Изменение после обновления не восстановить)
  var v0 = navState();
  if (v0 === "edit" || v0 === "cat") { nav.skip++; history.back(); v0 = "history"; } // Изменение и операции категории не восстановить — шаг обратно на Историю
  if (v0 !== "add") showTab(v0);
  else if (params.tab === "history") navTo("history");
  load();
}

// шорткат открыл новую ссылку на уже открытой странице — перечитываем её.
// Шаг «назад/вперёд» по экранам тоже может сменить адрес (данные траты убраны из него позже), но на свой же —
// это не новая ссылка (адреса, выставленные страницей, — nav.own в stats.js)
window.addEventListener("hashchange", function () {
  if (nav.own[location.href]) return;
  location.reload();
});

applyTheme();
applyPattern();
applyHaptics();
applySounds();
applyStaticI18n();
renderLangSelect();
setSaving(false);
updateKindLabel();
renderVersion();
lastSize = { w: window.innerWidth, h: window.innerHeight };
boot();
