// Временная проверка звуков (sounds-test.html): кандидаты для нажатия «Удалить» и проверка звука на свайпе.
// Синтез — как в js/sounds.js. Как и в форме, через 3 с тишины аудио засыпает.
var T = (function () {
  var ctx = null, master = null, noiseBuf = null, pinkBuf = null, idle = 0;
  function setup() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
    return ctx;
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function noise(c) {
    if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
    var b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = b);
  }
  function pink(c) {
    if (pinkBuf && pinkBuf.sampleRate === c.sampleRate) return pinkBuf;
    var b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (var i = 0; i < d.length; i++) {
      var w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
    }
    return (pinkBuf = b);
  }
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(c, out, t, f, d, peak, fEnd, type, a) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + d);
    env(g, t, a || 0.003, peak, d);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.06);
  }
  function click(c, out, t, d, f, q, peak, a) {
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise(c); bp.type = "bandpass"; bp.Q.value = q; bp.frequency.value = f;
    env(g, t, a || 0.004, peak, d);
    s.connect(bp); bp.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  function whoosh(c, out, t, d, fs, peak, p, q, lp) {
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), l = c.createBiquadFilter(), g = c.createGain();
    s.buffer = pink(c);
    bp.type = "bandpass"; bp.Q.value = q || 0.8;
    l.type = "lowpass"; l.frequency.value = lp || 7000;
    bp.frequency.setValueAtTime(fs[0], t);
    for (var i = 1; i < fs.length; i++) bp.frequency.exponentialRampToValueAtTime(fs[i], t + d * i / (fs.length - 1));
    var curve = new Float32Array(64);
    for (var k = 0; k < curve.length; k++) {
      var x = k / (curve.length - 1);
      var h = x < p ? Math.pow(Math.sin(Math.PI / 2 * x / p), 2) : Math.pow(Math.cos(Math.PI / 2 * (x - p) / (1 - p)), 1.6);
      curve[k] = Math.max(h * peak, 0.00001);
    }
    g.gain.setValueAtTime(0.00001, t); g.gain.setValueCurveAtTime(curve, t, d);
    s.connect(bp); bp.connect(l); l.connect(g); g.connect(out); s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  // россыпь крошечных щелчков; shape > 1 — плотнее к концу, < 1 — к началу
  function grains(c, out, t, d, n, peak, fLo, fHi, shape) {
    for (var i = 0; i < n; i++) {
      var tt = t + d * Math.pow(Math.random(), 1 / (shape || 1));
      click(c, out, tt, rnd(0.0015, 0.005), rnd(fLo || 1500, fHi || 6500), rnd(1, 2.5), peak * rnd(0.3, 1), 0.0005);
    }
  }
  var S = {
    swipe: function (c, o, t) { // взмах — для свайпа
      whoosh(c, o, t, 0.3, [700, 2200, 900], 0.9, 0.45);
    },
    tear: function (c, o, t) { // A. оторвать чек
      click(c, o, t, 0.16, 3200, 0.9, 0.18, 0.03);
      grains(c, o, t, 0.17, 70, 0.6, 1500, 6500, 1.3);
    },
    stamp: function (c, o, t) { // B. штамп «Аннулировано»
      tone(c, o, t, 150, 0.07, 0.28, 85);
      click(c, o, t, 0.035, 900, 0.7, 0.35, 0.001);
      click(c, o, t + 0.004, 0.015, 3200, 1, 0.18, 0.001);
    },
    beep: function (c, o, t) { // C. кассовый терминал: мягкий «бип-буп» вниз
      tone(c, o, t, 1320, 0.07, 0.15, null, "triangle", 0.006);
      tone(c, o, t + 0.1, 880, 0.11, 0.15, null, "triangle", 0.006);
    },
    pen: function (c, o, t) { // D. зачеркнуть ручкой
      whoosh(c, o, t, 0.2, [2000, 2900, 2300], 1.1, 0.3, 2.2, 6000);
      grains(c, o, t, 0.2, 30, 0.12, 2500, 6000, 1);
    },
    bin: function (c, o, t) { // E. скомкать и в корзину
      grains(c, o, t, 0.13, 45, 0.45, 1500, 6000, 1);
      tone(c, o, t + 0.21, 170, 0.07, 0.28, 100);
      click(c, o, t + 0.21, 0.03, 700, 0.8, 0.3, 0.001);
    },
    pop: function (c, o, t) { // F. мягкий «поп»
      tone(c, o, t, 420, 0.06, 0.22, 1150);
      click(c, o, t, 0.006, 2500, 1, 0.12, 0.001);
    },
    eraser: function (c, o, t) { // G. ластик: два быстрых движения
      whoosh(c, o, t, 0.09, [1300, 1800, 1400], 1.05, 0.4, 1.5, 4000);
      whoosh(c, o, t + 0.11, 0.1, [1300, 1800, 1300], 0.85, 0.4, 1.5, 4000);
    }
  };
  function play(name, vol) {
    if (!S[name] || !setup()) return;
    try {
      clearTimeout(idle);
      if (ctx.state !== "running") ctx.resume();
      master.gain.value = vol;
      S[name](ctx, master, ctx.currentTime + 0.01);
      idle = setTimeout(function () { try { ctx.suspend(); } catch (e) {} }, 3000);
    } catch (e) {}
  }
  function state() { return ctx ? ctx.state : "ещё не создано"; }
  function render(name) {
    var c = new OfflineAudioContext(1, 44100 * 1.2, 44100);
    S[name](c, c.destination, 0.01);
    return c.startRendering().then(function (b) { return b.getChannelData(0); });
  }
  return { play: play, render: render, state: state, names: Object.keys(S) };
})();

(function () {
  var vol = document.getElementById("vol"), val = document.getElementById("volVal"), log = document.getElementById("log");
  if (!vol) return;
  function show() { val.textContent = vol.value + "%"; }
  vol.addEventListener("input", show); show();
  document.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-s]") : null;
    if (b) T.play(b.getAttribute("data-s"), vol.value / 100);
  });
  // полоса свайпа: как строка истории — провели влево и отпустили
  var strip = document.getElementById("strip"), x0 = null;
  strip.addEventListener("pointerdown", function (e) { x0 = e.clientX; });
  strip.addEventListener("pointerup", function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0; x0 = null;
    if (dx > -50) return;
    var before = T.state();
    T.play("swipe", vol.value / 100);
    setTimeout(function () { log.textContent = "Свайп: аудио было «" + before + "», стало «" + T.state() + "»"; }, 300);
  });
  strip.addEventListener("pointercancel", function () { x0 = null; });
})();
