// Временная проверка способов виброотклика (haptics-test.html)
(function () {
  var lbl = document.createElement("label");
  lbl.style.display = "none";
  var sw = document.createElement("input");
  sw.type = "checkbox"; sw.setAttribute("switch", "");
  lbl.appendChild(sw);
  document.head.appendChild(lbl);
  var sw4 = document.createElement("input");
  sw4.type = "checkbox"; sw4.setAttribute("switch", ""); sw4.style.display = "none";
  document.body.appendChild(sw4);
  document.getElementById("b3").addEventListener("click", function () { lbl.click(); });
  document.getElementById("b4").addEventListener("click", function () { sw4.click(); });
  document.getElementById("b6").addEventListener("click", function () {
    document.getElementById("log").textContent = "navigator.vibrate: " + (navigator.vibrate ? "есть, " + navigator.vibrate(30) : "нет в этом браузере");
  });
  document.getElementById("log").textContent = "iOS: " + (navigator.userAgent.match(/OS (\d+[_\d]*)/) || ["", "?"])[1].replace(/_/g, ".");
})();
