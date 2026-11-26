// Нажатия на кнопки. Обработчики onclick="…" в разметке защита страницы (CSP) запрещает, поэтому у кнопки —
// data-act="действие" и при необходимости data-arg="значение", а здесь один общий обработчик на весь документ.
// Так же для полей: data-change="действие" — при изменении значения.
var ACTIONS = {
  load: function () { load(); },
  save: function () { save(); },
  showTab: function (a) { showTab(a); },
  cancelEdit: function () { cancelEdit(); },
  toggleSign: function () { toggleSign(); },
  clearAmount: function () { clearAmount(); },
  toggleCurPanel: function () { toggleCurPanel(); },
  pickCurrency: function (a) { pickCurrency(Number(a)); },
  userPickCategory: function (a) { userPickCategory(Number(a)); },
  toggleTheme: function () { toggleTheme(); },
  togglePattern: function () { togglePattern(); },
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
document.addEventListener("click", function (e) {
  var b = e.target.closest ? e.target.closest("[data-act]") : null;
  if (b && !b.disabled) runAction(b, "data-act");
});
document.addEventListener("change", function (e) {
  if (e.target.getAttribute && e.target.getAttribute("data-change")) runAction(e.target, "data-change");
});
