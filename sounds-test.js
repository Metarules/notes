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
    eraser4: function (c, o, t) { // ластик: одно мягкое движение (для сравнения)
      whoosh(c, o, t, 0.14, [800, 1200, 850], 0.85, 0.45, 1.1, 2400);
    },
    tap1: function (c, o, t) { // 1. мягкий щелчок
      click(c, o, t, 0.012, 2000, 1.2, 0.5, 0.001);
      tone(c, o, t, 1150, 0.02, 0.1);
    },
    tap2: function (c, o, t) { // 2. деревянный «тук», приглушённый
      click(c, o, t, 0.004, 2200, 0.8, 0.09, 0.0008);
      [[1, 1, 0.05], [2.57, 0.3, 0.025], [4.2, 0.12, 0.015]].forEach(function (p) { tone(c, o, t, 480 * p[0], p[2], 0.14 * p[1]); });
    },
    tap3: function (c, o, t) { // 3. капля «туп»
      tone(c, o, t, 950, 0.045, 0.13, 600);
    },
    tap4: function (c, o, t) { // 4. подушечка пальца по стеклу — низкий глухой
      tone(c, o, t, 230, 0.035, 0.17, 160);
      click(c, o, t, 0.006, 1500, 0.8, 0.06, 0.001);
    },
    tap5: function (c, o, t) { // 5. камешек — светлый и крошечный
      click(c, o, t, 0.006, 3500, 1.5, 0.32, 0.0008);
      tone(c, o, t, 2600, 0.025, 0.09);
      tone(c, o, t, 2600 * 1.52, 0.015, 0.045);
    },
    tap6: function (c, o, t) { // 6. пузырёк — вверх
      tone(c, o, t, 600, 0.035, 0.13, 1100);
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
})();
