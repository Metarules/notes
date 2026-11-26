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
    swipe2: function (c, o, t) { // свайп 2: мягче — ниже и без верхнего шипения
      whoosh(c, o, t, 0.3, [500, 1500, 700], 0.85, 0.45, 0.7, 3500);
    },
    swipe3: function (c, o, t) { // свайп 3: ещё мягче, низкий и чуть длиннее
      whoosh(c, o, t, 0.34, [380, 1050, 480], 0.8, 0.5, 0.6, 2400);
    },
    swipe4: function (c, o, t) { // свайп 4: мягкий и короткий
      whoosh(c, o, t, 0.22, [550, 1500, 750], 0.85, 0.42, 0.7, 3500);
    },
    eraser: function (c, o, t) { // ластик 1: прежний
      whoosh(c, o, t, 0.09, [1300, 1800, 1400], 1.05, 0.4, 1.5, 4000);
      whoosh(c, o, t + 0.11, 0.1, [1300, 1800, 1300], 0.85, 0.4, 1.5, 4000);
    },
    eraser2: function (c, o, t) { // ластик 2: ниже и глуше
      whoosh(c, o, t, 0.1, [850, 1250, 950], 1.0, 0.45, 1.2, 2500);
      whoosh(c, o, t + 0.12, 0.11, [850, 1250, 900], 0.8, 0.45, 1.2, 2500);
    },
    eraser3: function (c, o, t) { // ластик 3: совсем мягкий, движения плавнее
      whoosh(c, o, t, 0.12, [650, 1000, 750], 1.0, 0.5, 1, 1900);
      whoosh(c, o, t + 0.14, 0.13, [650, 1000, 700], 0.8, 0.5, 1, 1900);
    },
    eraser4: function (c, o, t) { // ластик 4: одно мягкое движение
      whoosh(c, o, t, 0.14, [800, 1200, 850], 0.85, 0.45, 1.1, 2400);
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
  var strip = document.getElementById("strip"), x0 = null, stripSound = "swipe";
  document.addEventListener("change", function (e) { if (e.target.name === "sw") stripSound = e.target.value; });
  strip.addEventListener("pointerdown", function (e) { x0 = e.clientX; });
  strip.addEventListener("pointerup", function (e) {
    if (x0 === null) return;
    var dx = e.clientX - x0; x0 = null;
    if (dx > -50) return;
    var before = T.state();
    T.play(stripSound, vol.value / 100);
    setTimeout(function () { log.textContent = "Свайп: аудио было «" + before + "», стало «" + T.state() + "»"; }, 300);
  });
  strip.addEventListener("pointercancel", function () { x0 = null; });
})();
