// Плашка «Нет связи» и очередь трат на телефоне: отправка пачками, отмена удалением.

// ---------- связь с сервером: плашка «Нет связи» ----------
function setOnline(on) {
  var changed = state.offline === !!on;
  state.offline = !on;
  updateNetBar();
  if (changed && !state.loaded) { renderCategories(); renderHistory(null); }
  if (changed && on) setTimeout(flushOutbox, 0); // связь вернулась — отправляем отложенное
}
function plural(n, one, few, many) {
  var m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
}
function updateNetBar() {
  var n = outbox().filter(function (x) { return !x.error; }).length;
  el("netText").textContent = n
    ? n + " " + plural(n, "операция ждёт", "операции ждут", "операций ждут") + " отправки"
    : "Операции сохранятся на телефоне";
  var wasHidden = el("netBar").classList.contains("hidden");
  el("netBar").classList.toggle("hidden", !state.offline);
  if (wasHidden === state.offline) scheduleFit(); // плашка появилась или исчезла — меняется место под кнопки
}

// ---------- очередь трат на телефоне ----------
// Без связи новая трата не теряется: она лежит в localStorage ("outbox") и уходит на сервер,
// как только связь появится (при следующем открытии страницы — тоже). У каждой свой id и время
// нажатия «Сохранить»: сервер не запишет её дважды и поставит время покупки, а не отправки.
// Изменение и удаление уже записанных трат без связи не работают — только новые траты.
function outbox(list) {
  if (list === undefined) { try { var l = JSON.parse(store("outbox") || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  store("outbox", list.length ? JSON.stringify(list) : null);
}
// off — операция ждала связи: когда уйдёт, скажем об этом («Отправлено с телефона: N»);
// обычное мгновенное сохранение уходит молча — «Сохранено» уже было показано
function enqueue(form, off) {
  var l = outbox();
  if (!l.some(function (x) { return x.form.id === form.id; })) l.push({ form: form, error: "", off: !!off });
  outbox(l);
  updateNetBar();
  refreshHistory();
}
// Удаление операции из очереди. Если она уже уходила на сервер (sent), сервер мог её записать —
// тогда просим удалить её и там (по id); сервер запомнит id и не запишет её, даже если запрос
// на запись придёт позже. Пока сервер не ответил, в истории её не показываем.
function dropQueued(id) {
  var x = outbox().filter(function (y) { return y.form.id === id; })[0];
  if (x && x.sent && !x.error) { cancels(cancels().concat([id])); flushCancels(); }
  outbox(outbox().filter(function (x) { return x.form.id !== id; }));
  // строка была открыта свайпом — сбрасываем его, иначе перерисовка истории пропускается
  swipe.openRow = null;
  swipe.row = null;
  updateNetBar();
  refreshHistory();
}
// id операций, которые надо удалить на сервере (удалены из очереди, когда уже отправлялись)
function cancels(list) {
  if (list === undefined) { try { var l = JSON.parse(store("cancels") || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  store("cancels", list.length ? JSON.stringify(list) : null);
}
var cancelling = false;
function flushCancels() {
  var l = cancels();
  if (cancelling || !l.length || navigator.onLine === false) return;
  cancelling = true;
  var id = l[0];
  call("apiDeleteById", [id], function (res, full) {
    cancelling = false;
    cancels(cancels().filter(function (x) { return x !== id; }));
    if (full && full.recent) state.recent = withOlder(full.recent);
    refreshHistory();
    flushCancels();
  }, function (msg, kind) {
    cancelling = false;
    if (kind !== "network") { // сервер отказал — повтор не поможет; операция останется в истории, удалить можно обычным свайпом
      cancels(cancels().filter(function (x) { return x !== id; }));
      refreshHistory();
      toast("Не удалось удалить на сервере: " + msg, true);
    }
  }, { keepalive: true });
}
// перерисовать историю, если пользователь сейчас с ней не работает
function refreshHistory() {
  if (!state.editing && pendingDeletes === 0 && !swipe.openRow && !swipe.row) renderHistory(state.loaded ? state.recent : null);
}
// Очередь уходит одним запросом (addMany, до SEND_BATCH операций): сервер пишет их подряд и отвечает по каждой.
// sendingIds — операции, которые прямо сейчас уходят на сервер (для статуса «отправляется…»)
var SEND_BATCH = 25, flushing = false, flushedCount = 0, sendingIds = [];
// now — отправить сразу, даже если считаем, что связи нет (после «Сохранить» связь могла вернуться)
function flushOutbox(now) {
  if (flushing || (state.offline && !now) || navigator.onLine === false) return;
  var items = outbox().filter(function (x) { return !x.error; }).slice(0, SEND_BATCH);
  if (!items.length) {
    if (flushedCount) { toast("Отправлено с телефона: " + flushedCount + " " + plural(flushedCount, "операция", "операции", "операций")); flushedCount = 0; }
    return;
  }
  flushing = true;
  sendingIds = items.map(function (x) { return x.form.id; });
  // отмечаем, что они уходили на сервер: удалить их потом — значит удалить и там
  outbox(outbox().map(function (x) { return sendingIds.indexOf(x.form.id) > -1 ? Object.assign({}, x, { sent: true }) : x; }));
  refreshHistory();
  call("apiAddMany", [items.map(function (x) { return x.form; })], function (res, full) {
    flushing = false;
    sendingIds = [];
    var byId = {}, errors = [];
    ((res && res.results) || []).forEach(function (r) { byId[r.id] = r; });
    outbox(outbox().map(function (x) {
      var r = byId[x.form.id];
      if (!r) return x;                         // не была в этой пачке — останется в очереди
      if (r.ok) { if (x.off && !r.cancelled) flushedCount++; return null; } // записана (или отменена удалением) — убираем из очереди
      errors.push(r.error);                       // сервер отказал (например, категорию удалили) — повтор не поможет
      return { form: x.form, error: r.error };
    }).filter(Boolean));
    if (errors.length) toast((errors.length === 1 ? "Операция не записалась: " : "Не записались операции: " + errors.length + " — ") + errors[0], true);
    // сервер ставит операцию на место по дате: строки ниже сдвигаются — поправляем номера у подгруженных старых
    ((res && res.results) || []).forEach(function (r) { if (r.ok && r.inserted) shiftRows(r.row); });
    if (full && full.recent) state.recent = withOlder(full.recent);
    updateNetBar();
    refreshHistory();
    flushOutbox(); // следующая пачка, если очередь была длиннее SEND_BATCH
    flushCancels();
  }, function (msg, kind) {
    flushing = false;
    var ids = sendingIds;
    sendingIds = [];
    // не ушли — теперь они «ждали связи»: когда отправятся, скажем об этом
    outbox(outbox().map(function (x) { return ids.indexOf(x.form.id) > -1 ? Object.assign({}, x, { off: true }) : x; }));
    updateNetBar();
    refreshHistory();
    if (kind !== "network") toast("Не отправилось: " + msg + ". Операции остались на телефоне", true);
  }, { keepalive: true });
}
// телефон снова в сети — сразу пробуем загрузить; пропала сеть — сразу показываем плашку
window.addEventListener("online", function () { load(); });
window.addEventListener("offline", function () { setOnline(false); });
