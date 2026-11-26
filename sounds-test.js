// Временная проверка звуков (sounds-test.html): звук «Сохранить» (выбран, касса с живым звонком)
// и кандидаты для «Удалить». Всё синтезируется здесь же, как в js/sounds.js.
var T = (function () {
  var ctx = null, master = null, noiseBuf = null;
  function setup() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
    return ctx;
  }
  function noise(c) {
    if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
    var b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = b);
  }
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function revEnv(g, t, d, peak) { // наоборот: плавно нарастает за d и резко обрывается
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + d);
    g.gain.linearRampToValueAtTime(0, t + d + 0.015);
  }
  function tone(c, out, t, f, d, peak, fEnd, rev) {
    var o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + d);
    if (rev) revEnv(g, t, d, peak); else env(g, t, 0.003, peak, d);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.06);
  }
  function click(c, out, t, d, f, q, peak, a) {
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise(c); bp.type = "bandpass"; bp.Q.value = q; bp.frequency.value = f;
    env(g, t, a || 0.004, peak, d);
    s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  var BELL = [[1, 1, 1], [2.32, 0.45, 0.7], [4.25, 0.25, 0.4], [6.63, 0.12, 0.25], [9.38, 0.06, 0.15]];
  var GLASS = [[1, 1, 1], [2.71, 0.3, 0.5], [5.2, 0.1, 0.3]];
  function bell(c, out, t, f, peak, d, parts, noStrike) {
    if (!noStrike) click(c, out, t, 0.006, 7000, 0.6, peak * 0.9, 0.001);
    (parts || BELL).forEach(function (p) {
      var beat = 1.2 + Math.random() * 2.3;
      tone(c, out, t, f * p[0], d * p[2], peak * p[1] * 0.6);
      tone(c, out, t, f * p[0] + beat, d * p[2] * 0.9, peak * p[1] * 0.45);
    });
  }
  function revBell(c, out, t, f, peak, d) { // все обертоны обрываются в один момент t + d
    BELL.forEach(function (p) {
      var di = d * (0.5 + 0.5 * p[2]);
      tone(c, out, t + d - di, f * p[0], di, peak * p[1] * 0.6, null, true);
      tone(c, out, t + d - di, f * p[0] + 2, di, peak * p[1] * 0.45, null, true);
    });
  }
  var S = {
    save: function (c, o, t) { // выбранный для «Сохранить»
      click(c, o, t, 0.03, 1800, 1.2, 0.45);
      click(c, o, t + 0.045, 0.025, 2400, 1.5, 0.27);
      bell(c, o, t + 0.08, 2093, 0.24, 0.9);
    },
    muted: function (c, o, t) { // A. тот же звонок, сразу прижатый ладонью
      click(c, o, t, 0.01, 5000, 0.8, 0.2, 0.001);
      bell(c, o, t, 2093, 0.2, 0.13);
    },
    downTwo: function (c, o, t) { // B. «дзинь-дон» вниз
      bell(c, o, t, 2093, 0.2, 0.35);
      bell(c, o, t + 0.12, 1568, 0.2, 0.55, null, true);
    },
    reverse: function (c, o, t) { // C. звонок наоборот: нарастает и обрывается
      revBell(c, o, t, 2093, 0.45, 0.32);
    },
    key: function (c, o, t) { // D. клавиша кассы: нажали и отпустили
      tone(c, o, t, 190, 0.035, 0.38, 120);
      click(c, o, t, 0.014, 3000, 2, 0.65, 0.001);
      tone(c, o, t + 0.005, 4600, 0.04, 0.04);
      click(c, o, t + 0.085, 0.01, 3600, 2, 0.3, 0.001);
      tone(c, o, t + 0.085, 150, 0.025, 0.15, 110);
    },
    downThree: function (c, o, t) { // E. три лёгкие ноты вниз
      [[0, 2349, 0.18], [0.075, 1976, 0.16], [0.15, 1568, 0.16]].forEach(function (n, i) {
        bell(c, o, t + n[0], n[1], n[2], i < 2 ? 0.22 : 0.45, null, i > 0);
      });
    },
    glass: function (c, o, t) { // F. тихий стеклянный «тинь»
      bell(c, o, t, 1760, 0.19, 0.35, GLASS, true);
      click(c, o, t, 0.004, 6000, 0.8, 0.15, 0.0008);
    },
    lowMuted: function (c, o, t) { // G. низкий приглушённый «дон»
      bell(c, o, t, 1047, 0.22, 0.18, null, true);
      click(c, o, t, 0.012, 2500, 0.8, 0.2, 0.001);
    }
  };
  function play(name, vol) {
    if (!S[name] || !setup()) return;
    try { if (ctx.state !== "running") ctx.resume(); master.gain.value = vol; S[name](ctx, master, ctx.currentTime + 0.01); } catch (e) {}
  }
  function render(name) {
    var c = new OfflineAudioContext(1, 44100 * 1.4, 44100);
    S[name](c, c.destination, 0.01);
    return c.startRendering().then(function (b) { return b.getChannelData(0); });
  }
  return { play: play, render: render, names: Object.keys(S) };
})();

(function () {
  var vol = document.getElementById("vol"), val = document.getElementById("volVal");
  if (!vol) return;
  function show() { val.textContent = vol.value + "%"; }
  vol.addEventListener("input", show); show();
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-s]") : null;
    if (b) T.play(b.getAttribute("data-s"), vol.value / 100);
  });
  document.getElementById("log").textContent = "audioSession: " + (navigator.audioSession ? "есть (музыку не прерывает)" : "нет в этом браузере");
})();
