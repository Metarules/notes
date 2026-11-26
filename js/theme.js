// Тема (тумблер на форме), диагностика размеров экрана.

// ---------- тема ----------
function currentTheme() { return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"; }
// тумблер: в ползунке — значок текущей темы (слева солнце, справа луна)
function updateThemeBtn() {
  var dark = currentTheme() === "dark";
  el("themeSwitch").setAttribute("aria-checked", dark ? "true" : "false");
  el("themeKnob").innerHTML = (dark ? document.querySelector("#themeSwitch .moon") : document.querySelector("#themeSwitch .sun")).outerHTML.replace(/class="[^"]*"/, "");
}
// Тема: тумблер на форме — светлая/тёмная, выбор запоминается на этом устройстве.
// Пока тумблер не трогали, тема как в системе («auto» — отсутствие выбора) и меняется вместе с ней.
var darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function themeMode() { var t = store("theme"); return t === "dark" || t === "light" ? t : "auto"; }
function applyTheme() {
  var m = themeMode();
  var t = m === "auto" ? (darkQuery && darkQuery.matches ? "dark" : "light") : m;
  document.documentElement.setAttribute("data-theme", t);
  updateThemeBtn();
}
function setTheme(m) { store("theme", m === "auto" ? null : m); applyTheme(); }
// выбора нет, а система сменила тему (например, вечером) — меняемся вместе с ней
if (darkQuery) {
  var onSystemTheme = function () { if (themeMode() === "auto") applyTheme(); };
  if (darkQuery.addEventListener) darkQuery.addEventListener("change", onSystemTheme);
  else if (darkQuery.addListener) darkQuery.addListener(onSystemTheme);
}

// Диагностика размеров окна (для подгонки кнопок под экран) — пункт на экране «Настройки».
// Меряет форму ввода, поэтому сначала возвращаемся на неё и показываем данные поверх.
function openDiag() {
  showTab("add");
  requestAnimationFrame(function () { requestAnimationFrame(showDiag); });
}
function showDiag() {
  function probe(css) {
    var d = document.createElement("div");
    d.style.cssText = "position:fixed;top:0;left:0;width:1px;visibility:hidden;pointer-events:none;" + css;
    document.body.appendChild(d);
    var v = Math.round(d.getBoundingClientRect().height); d.remove(); return v;
  }
  var anchor = el("navRow").offsetParent ? el("navRow") : el("saveBtn");
  var lines = [
    t("diag.versions", { p: PAGE_VERSION, s: state.serverVersion || "—" }),
    t("diag.sizes"),
    "ih " + window.innerHeight + " · iw " + window.innerWidth + " · screen " + screen.width + "×" + screen.height + " · dpr " + window.devicePixelRatio,
    "svh " + probe("height:100svh") + " · lvh " + probe("height:100lvh") + " · dvh " + probe("height:100dvh") +
      " · safe↓ " + probe("height:0;padding-bottom:env(safe-area-inset-bottom)") + " · safe↑ " + probe("height:0;padding-top:env(safe-area-inset-top)"),
    t("diag.bottom", { b: Math.round(anchor.getBoundingClientRect().bottom), r: fitReserve(),
      h: document.documentElement.style.getPropertyValue("--chip-h") + (el("catGrid").classList.contains("compact") ? " " + t("diag.compact") : "") }),
    "", t("diag.log")
  ].concat(fitLog, ["", t("diag.close")]);
  var d = document.createElement("div");
  d.className = "diag"; d.textContent = lines.join("\n");
  d.onclick = function () { d.remove(); };
  document.body.appendChild(d);
}
// Язык: «Как в системе» или один из пяти. При смене — перерисовываем всё, что видно, без перезагрузки страницы.
function renderLangSelect() {
  var sel = el("langSelect"), choice = langChoice();
  sel.innerHTML = '<option value="auto">' + esc(t("set.langAuto")) + '</option>' + LANGS.map(function (l) {
    return '<option value="' + l[0] + '">' + esc(l[1]) + '</option>';
  }).join("");
  sel.value = choice;
}
function setLang() {
  var v = el("langSelect").value;
  store("lang", v === "auto" ? null : v);
  LANG = langChoice() === "auto" ? systemLang() : langChoice();
  relocalize();
}
function relocalize() {
  applyStaticI18n();
  renderLangSelect();
  renderVersion();
  setSaving(saving);
  if (state.loaded) { renderCategories(); renderCurrencies(el("currency").value); } else renderCategories();
  updateNetBar();
  refreshHistory();
  renderMore();
  updateKindLabel();
  if (stats.pane === "stats" && !el("view-history").classList.contains("hidden")) loadStats();
  if (state.editing) renderEditWhen();
}

function toggleTheme() { setTheme(currentTheme() === "dark" ? "light" : "dark"); }
