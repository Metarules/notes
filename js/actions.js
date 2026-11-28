// Нажатия на кнопки. Обработчики onclick="…" в разметке защита страницы (CSP) запрещает, поэтому у кнопки —
// data-act="действие" и при необходимости data-arg="значение", а здесь один общий обработчик на весь документ.
// Так же для полей: data-change="действие" — при изменении значения.
var ACTIONS = {
  load: function () { load(); },
  save: function () { save(); },
  skipOp: function () { skipOp(); },
  toggleOps: function () { toggleOps(); },
  netRetry: function () { netRetry(); },
  showTab: function (a) { showTab(a); },
  navTo: function (a) { navTo(a); },
  navBack: function () { navBack(); },
  cancelEdit: function () { cancelEdit(); },
  deleteEdited: function () { deleteEdited(); },
  toggleSign: function () { toggleSign(); },
  clearAmount: function () { clearAmount(); },
  toggleCurPanel: function () { toggleCurPanel(); },
  pickCurrency: function (a) { pickCurrency(Number(a)); },
  userPickCategory: function (a) { userPickCategory(Number(a)); },
  toggleTheme: function () { toggleTheme(); },
  togglePattern: function () { togglePattern(); },
  toggleHaptics: function () { toggleHaptics(); },
  toggleSounds: function () { toggleSounds(); },
  openDiag: function () { openDiag(); },
  showHistPane: function (a) { showHistPane(a); },
  retryOlder: function () { retryOlder(); },
  setStatsKind: function (a) { setStatsKind(a); },
  shiftStats: function (a) { shiftStats(Number(a)); },
  loadStats: function () { loadStats(true); }, // «Повторить» и смена своих дат — запрос заново
  setLang: function () { setLang(); }
};

function runAction(node, attr) {
  var fn = ACTIONS[node.getAttribute(attr)];
  if (fn) fn(node.getAttribute("data-arg"));
}
// Мягкий щелчок (sounds.js, Snd.tap) — у каждого нажатия кнопки, как и виброотклик (core.js, armHaptics);
// у этих свой звук или своя логика. У выпадающих списков и полей дат нет ни того, ни другого: переключатель
// поверх них не дал бы им открыться, а звук без вибрации кажется странным
var OWN_SOUND = { save: 1, toggleSounds: 1 };
document.addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("[data-act]") : null;
  if (!b || b.disabled) return;
  if (!OWN_SOUND[b.getAttribute("data-act")]) Snd.tap();
  runAction(b, "data-act");
});
document.addEventListener("change", function (e) {
  if (e.target.getAttribute && e.target.getAttribute("data-change")) runAction(e.target, "data-change");
});
