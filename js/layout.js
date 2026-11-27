// Подгонка высоты кнопок категорий под экран телефона.

// ---------- подгонка под высоту экрана ----------
// Высота кнопок категорий подбирается так, чтобы «Сохранить» и «История» помещались на экране
// над нижними кнопками браузера (fitReserve). Не больше FIT_MAX — на больших экранах.
// Если места мало даже для FIT_NORMAL_MIN, кнопки становятся компактными (эмодзи слева) — до FIT_COMPACT_MIN.
// Запас под нижние кнопки браузера. Где-то они перекрывают страницу (тогда нужно ~80 точек), где-то страница
// заканчивается над ними (iOS 26: окно 637 при полной высоте 758). Полную высоту даёт CSS-единица lvh:
// если видимая часть уже настолько меньше — панели браузера в неё не входят, и хватает небольшого отступа.
var FIT_GAP = 12;
function fitLvh() {
  var d = document.createElement("div");
  d.style.cssText = "position:fixed;top:0;left:0;width:1px;height:100lvh;visibility:hidden;pointer-events:none";
  document.body.appendChild(d);
  var v = d.getBoundingClientRect().height; d.remove();
  return v || window.innerHeight; // старый браузер без lvh — считаем, что панели перекрывают страницу
}
function fitReserve() { return Math.max(FIT_GAP, FIT_RESERVE - Math.max(0, Math.round(fitLvh() - window.innerHeight))); }
var FIT_RESERVE = 80, FIT_NORMAL_MIN = 52, FIT_COMPACT_MIN = 38, FIT_MAX = 76;
var fitQueued = false, fitDone = false, lastSize = { w: 0, h: 0 };
// Первые секунды окно шортката ещё «устаканивается»: высота страницы меняется, пока выезжает лист с формой.
// В это время подгоняем по каждому изменению — к моменту, когда вы начинаете вводить, всё уже на месте.
// Потом подгонка только при реальных переменах (другое число категорий, поворот, плашка «Нет связи»,
// изменение операции) — приход свежих данных с сервера сам по себе ничего не двигает.
var FIT_SETTLE_MS = 2500, fitT0 = Date.now(), fitSig = "", fitForce = false;
function fitSettling() { return Date.now() - fitT0 < FIT_SETTLE_MS; }
// журнал размеров окна для диагностики (долгое нажатие на переключатель темы)
var FIT_LOG_MAX = 30; // строк в журнале
var fitLog = [];
function fitNote(what) {
  fitLog.push(((Date.now() - fitT0) / 1000).toFixed(2) + "s " + what + " · ih " + window.innerHeight +
    (window.visualViewport ? " vv " + Math.round(window.visualViewport.height) : "") + " sh " + screen.height);
  if (fitLog.length > FIT_LOG_MAX) fitLog.shift();
}
function scheduleFit() {
  if (fitQueued) return;
  fitQueued = true;
  requestAnimationFrame(function () { fitQueued = false; fitLayout(); });
}
// Подгонка сразу доводится до конца (несколько замеров до первой отрисовки): кнопки с переносом подписи
// на вторую строку выше остальных, и одного расчёта мало — иначе следующая подгонка (когда через пару
// секунд придут свежие данные) двигала бы интерфейс.
function fitLayout() {
  var grid = el("catGrid"), chips = grid.querySelectorAll(".chip");
  if (!chips.length || el("view-add").classList.contains("hidden")) return;
  var root = document.documentElement;
  // на экране должна помещаться строка «История» под кнопкой (при изменении операции её нет — тогда сама кнопка)
  var anchor = el("navRow").offsetParent ? el("navRow") : el("saveBtn");
  var reserve = fitReserve();
  function slack() { return window.innerHeight - reserve - (anchor.getBoundingClientRect().bottom + scrolledBy()); } // минус — не помещается
  var s = slack();
  var sig = [chips.length, window.innerWidth, el("netBar").classList.contains("hidden"), el("smsBar").classList.contains("hidden"), anchor.id].join("|");
  var force = fitForce; fitForce = false;
  if (fitDone && sig === fitSig && !force) {
    if (!fitSettling()) return;                    // после «устаканивания» — только при реальных переменах
    if (s >= 0 && s < 4) return;                   // пока окно выезжает — подгоняем точно и сразу
  }
  fitDone = true;
  fitSig = sig;
  var cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length || 3;
  var rows = Math.ceil(chips.length / cols);
  // подбираем высоту в заданном виде кнопок; возвращает, сколько места осталось (минус — не поместилось)
  function fit(compact) {
    grid.classList.toggle("compact", compact);
    var lo = compact ? FIT_COMPACT_MIN : FIT_NORMAL_MIN;
    var h = Math.max(lo, Math.min(FIT_MAX, parseFloat(root.style.getPropertyValue("--chip-h")) || lo));
    root.style.setProperty("--chip-h", h + "px");
    var left = slack();
    for (var k = 0; k < 6 && !(left >= 0 && left < rows); k++) {
      var nh = Math.max(lo, Math.min(FIT_MAX, Math.floor(h + left / rows)));
      if (nh === h) break; // упёрлись в предел
      h = nh;
      root.style.setProperty("--chip-h", h + "px");
      left = slack();
    }
    return left;
  }
  // обычные кнопки (эмодзи над подписью), а если не помещаются даже самые низкие — компактные (эмодзи слева)
  var left = fit(false);
  if (left < 0) left = fit(true);
  fitChipNames();
  fitNote(t("diag.fit", { h: root.style.getPropertyValue("--chip-h") + (grid.classList.contains("compact") ? " " + t("diag.compact") : ""), l: Math.round(left), r: reserve }));
}

// Длинное слово в подписи кнопки (Entertainment, Lebensmittel, Развлечения) не делим посреди слова:
// сначала чуть уменьшаем шрифт этой подписи, не мельче CHIP_NAME_MIN_PX. Только если и так не входит —
// слово переносится по слогам (или по буквам, если язык этого не умеет) — см. .chip .name в стилях.
var CHIP_NAME_MIN_PX = 10.5;
function fitChipNames() {
  var ctx = fitChipNames.ctx || (fitChipNames.ctx = document.createElement("canvas").getContext("2d"));
  [].forEach.call(document.querySelectorAll("#catGrid .chip"), function (chip) {
    var n = chip.querySelector(".name"), emo = chip.querySelector(".emo");
    if (!n) return;
    n.style.fontSize = "";
    var cs = getComputedStyle(n), ccs = getComputedStyle(chip), base = parseFloat(cs.fontSize), size = base;
    // ширина под подпись: внутренняя ширина кнопки, а в компактном виде — минус значок слева
    var avail = chip.clientWidth - parseFloat(ccs.paddingLeft) - parseFloat(ccs.paddingRight);
    if (emo && ccs.flexDirection === "row") avail -= emo.offsetWidth + (parseFloat(ccs.columnGap) || 0);
    var words = n.textContent.split(/\s+/).filter(Boolean);
    function widest() {
      ctx.font = cs.fontWeight + " " + size + "px " + cs.fontFamily;
      return Math.max.apply(null, words.map(function (w) { return ctx.measureText(w).width; }));
    }
    while (size - 0.5 >= CHIP_NAME_MIN_PX && widest() > avail) size -= 0.5;
    if (size < base) n.style.fontSize = size + "px";
  });
}

// поворот экрана и смена ширины — пересчёт; изменение высоты при прокрутке (панели браузера) — нет
var FIT_RESIZE_MIN_PX = 120; // высота окна (вверху страницы) изменилась больше чем на столько — тоже пересчёт
window.addEventListener("resize", function () {
  var w = window.innerWidth, hgt = window.innerHeight;
  fitNote("resize");
  if (fitSettling()) { lastSize = { w: w, h: hgt }; scheduleFit(); return; }
  if (w !== lastSize.w || (scrolledBy() === 0 && Math.abs(hgt - lastSize.h) > FIT_RESIZE_MIN_PX)) { lastSize = { w: w, h: hgt }; fitForce = true; scheduleFit(); }
});
// в конце «устаканивания» — последняя сверка (если высота поменялась без события resize)
setTimeout(function () { fitNote(t("diag.end")); fitForce = true; scheduleFit(); }, FIT_SETTLE_MS);
