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
  var pinkBuf = null;
  function pink(c) { // розовый шум (фильтр Пола Келлета): мягче белого, как настоящий шум воздуха
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
  // плавный «горб» громкости: нарастает до доли p длительности и мягко гаснет, без щелчков на краях
  function hump(p, n) {
    var a = new Float32Array(n || 64);
    for (var i = 0; i < a.length; i++) {
      var x = i / (a.length - 1);
      a[i] = x < p ? Math.pow(Math.sin(Math.PI / 2 * x / p), 2) : Math.pow(Math.cos(Math.PI / 2 * (x - p) / (1 - p)), 1.6);
    }
    return a;
  }
  // взмах: розовый шум через полосу, центр которой идёт по точкам fs; o.flutter — дрожание, как у ткани
  function whoosh(c, out, t, d, fs, peak, o) {
    o = o || {};
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain(), v = c.createGain();
    s.buffer = pink(c);
    bp.type = "bandpass"; bp.Q.value = o.q || 0.8;
    lp.type = "lowpass"; lp.frequency.value = o.lp || 7000;
    bp.frequency.setValueAtTime(fs[0], t);
    for (var i = 1; i < fs.length; i++) bp.frequency.exponentialRampToValueAtTime(fs[i], t + d * i / (fs.length - 1));
    var curve = hump(o.p || 0.4);
    for (var k = 0; k < curve.length; k++) curve[k] = Math.max(curve[k] * peak, 0.00001);
    g.gain.setValueAtTime(0.00001, t);
    g.gain.setValueCurveAtTime(curve, t, d);
    v.gain.value = 1;
    if (o.flutter) {
      var lfo = c.createOscillator(), depth = c.createGain();
      lfo.frequency.value = o.flutter; depth.gain.value = 0.35;
      lfo.connect(depth); depth.connect(v.gain); lfo.start(t); lfo.stop(t + d + 0.05);
    }
    s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(v); v.connect(out);
    s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  function grains(c, out, t, d, n, peak) { // редкие бумажные потрескивания поверх взмаха
    for (var i = 0; i < n; i++) click(c, out, t + d * (0.15 + 0.7 * Math.random()), 0.002 + Math.random() * 0.004, 2000 + Math.random() * 5000, 1.5, peak * (0.3 + 0.7 * Math.random()), 0.0005);
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
    soft: function (c, o, t) { // A. мягкий взмах: пролетел мимо (высота вверх и вниз)
      whoosh(c, o, t, 0.3, [700, 2200, 900], 0.9, { p: 0.45 });
    },
    quick: function (c, o, t) { // B. быстрый лёгкий взмах
      whoosh(c, o, t, 0.16, [1400, 3800, 2000], 0.8, { p: 0.4, q: 0.9 });
    },
    down: function (c, o, t) { // C. смахнуть вниз: высота уходит вниз
      whoosh(c, o, t, 0.28, [3000, 1400, 500], 0.9, { p: 0.3, q: 0.7 });
    },
    sheet: function (c, o, t) { // D. листок соскользнул: шорох с бумажной фактурой
      whoosh(c, o, t, 0.3, [2500, 3500, 1800], 0.75, { p: 0.35, q: 0.6 });
      grains(c, o, t, 0.3, 18, 0.18);
    },
    air: function (c, o, t) { // E. низкий воздушный «фух»
      whoosh(c, o, t, 0.34, [450, 1100, 500], 0.9, { p: 0.5, q: 0.6, lp: 3000 });
    },
    cloth: function (c, o, t) { // F. взмах с лёгким дрожанием, как ткань
      whoosh(c, o, t, 0.3, [900, 2400, 1000], 0.9, { p: 0.45, flutter: 28 });
    },
    double: function (c, o, t) { // G. двойной «вжух»
      whoosh(c, o, t, 0.13, [1200, 3000, 1600], 0.85, { p: 0.4 });
      whoosh(c, o, t + 0.11, 0.17, [1000, 2600, 1200], 0.65, { p: 0.4 });
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
