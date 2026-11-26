// Временная проверка звуков (sounds-test.html)
(function () {
  var vol = document.getElementById("vol"), val = document.getElementById("volVal");
  function show() { val.textContent = vol.value + "%"; }
  vol.addEventListener("input", show); show();
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-s]") : null;
    if (b) Snd.play(b.getAttribute("data-s"), vol.value / 100);
  });
  document.getElementById("log").textContent = "audioSession: " + (navigator.audioSession ? "есть (музыку не прерывает)" : "нет в этом браузере");
})();
