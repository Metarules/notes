// Тема и фон с котиками до отрисовки страницы (подключается в <head>): выбор с этого устройства, иначе — как в системе.
// Отдельным файлом, потому что встроенные скрипты защита страницы (CSP) запрещает.
(function () {
  var t = null;
  try { t = localStorage.getItem("theme"); } catch (e) {}
  if (t !== "dark" && t !== "light") t = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  var p = null; // фон с котиками — тоже до отрисовки, чтобы не мелькал
  try { p = localStorage.getItem("pattern"); } catch (e) {}
  document.documentElement.setAttribute("data-pattern", p === "off" ? "off" : "on");
})();
