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
  var BELL = [[1, 1, 1], [2.32, 0.45, 0.7], [4.25, 0.25, 0.4], [6.63, 0.12, 0.25], [9.38, 0.06, 0.15]];
  function bell(c, out, t, f, peak, d, strike) {
    if (strike) click(c, out, t, 0.006, 7000, 0.6, peak * strike, 0.001);
    BELL.forEach(function (p) {
      var beat = rnd(1.2, 3.5);
      tone(c, out, t, f * p[0], d * p[2], peak * p[1] * 0.6);
      tone(c, out, t, f * p[0] + beat, d * p[2] * 0.9, peak * p[1] * 0.45);
    });
  }
  // стук: короткий импульс шума через резонаторы — так звучит сам предмет. modes: [частота, добротность, громкость]
  function knock(c, out, t, modes, peak, imp) {
    var s = c.createBufferSource(), g = c.createGain();
    s.buffer = noise(c); env(g, t, 0.0005, 1, imp || 0.003);
    s.connect(g);
    modes.forEach(function (m) {
      var bp = c.createBiquadFilter(), mg = c.createGain();
      bp.type = "bandpass"; bp.frequency.value = m[0] * rnd(0.99, 1.01); bp.Q.value = m[1];
      mg.gain.value = peak * m[2] * Math.sqrt(m[1]); // узкая полоса тише — подравниваем
      g.connect(bp); bp.connect(mg); mg.connect(out);
    });
    s.start(t, Math.random() * 0.5); s.stop(t + 0.05);
  }
  // мягкий щелчок: розовый шум, полоса f, срез верха lp, атака a
  function softClick(c, out, t, d, f, q, peak, a, lp) {
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), l = c.createBiquadFilter(), g = c.createGain();
    s.buffer = pink(c); bp.type = "bandpass"; bp.Q.value = q; bp.frequency.value = f;
    l.type = "lowpass"; l.frequency.value = lp;
    env(g, t, a, peak, d);
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
    tap1: function (c, o, t) { // 1. щелчок кассы как есть (для сравнения)
      click(c, o, t, 0.03, 1800, 1.2, 0.45);
    },
    soft2: function (c, o, t) { // 2. ниже, со срезанным верхом
      softClick(c, o, t, 0.03, 1300, 1, 1.1, 0.002, 3000);
    },
    soft3: function (c, o, t) { // 3. ещё мягче и глуше
      softClick(c, o, t, 0.032, 950, 0.9, 1.05, 0.003, 2000);
    },
    soft4: function (c, o, t) { // 4. короче и легче
      softClick(c, o, t, 0.016, 1500, 1, 1.3, 0.0015, 3200);
    },
    soft5: function (c, o, t) { // 5. мягкий двойной, как в кассе
      softClick(c, o, t, 0.022, 1200, 1, 1.3, 0.002, 2800);
      softClick(c, o, t + 0.035, 0.018, 1550, 1, 0.75, 0.002, 3000);
    },
    soft6: function (c, o, t) { // 6. совсем бархатный: низкий, с плавным началом
      softClick(c, o, t, 0.035, 750, 0.8, 1.5, 0.005, 1500);
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
