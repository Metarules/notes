// Короткие звуки действий. Синтезируются Web Audio прямо здесь — без звуковых файлов.
// Тихие и короткие; режим тишины iPhone (Silent mode) их глушит, музыку и подкасты они не прерывают:
// сеанс звука страницы — «ambient» (navigator.audioSession, Safari 16.4+). Звучат только в ответ на касание.
// Snd.play("имя", громкость 0..1); Snd.render — для проверки уровней без динамиков (OfflineAudioContext).
var Snd = (function () {
  var ctx = null, master = null, noiseBuf = null;

  function setup() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    return ctx;
  }
  function noise(c) { // секунда белого шума, общая на все звуки
    if (noiseBuf && noiseBuf.sampleRate === c.sampleRate) return noiseBuf;
    var b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf = b);
  }
  // огибающая: быстрая атака a, затем экспоненциальное затухание за d секунд
  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(c, out, t, f, d, peak, fEnd, type) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f, t);
    if (fEnd) o.frequency.exponentialRampToValueAtTime(fEnd, t + d);
    env(g, t, 0.003, peak, d);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + d + 0.05);
  }
  // шорох: полоса шума с центром f (можно с плавным сдвигом к fEnd)
  function hiss(c, out, t, d, f, q, peak, fEnd, a) {
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise(c);
    bp.type = "bandpass"; bp.Q.value = q;
    bp.frequency.setValueAtTime(f, t);
    if (fEnd) bp.frequency.exponentialRampToValueAtTime(fEnd, t + d);
    env(g, t, a || 0.004, peak, d);
    s.connect(bp); bp.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  // колокольчик: основной тон и негармоничные обертоны, высокие гаснут быстрее
  function bell(c, out, t, f, peak, d) {
    [[1, 1, 1], [2.01, 0.35, 0.6], [2.76, 0.22, 0.45], [5.4, 0.08, 0.25]].forEach(function (p) {
      tone(c, out, t, f * p[0], d * p[2], peak * p[1]);
    });
  }
  function rnd(a, b) { return a + Math.random() * (b - a); }

  var SOUNDS = {
    // для «Сохранить»
    register: function (c, o, t) { // касса: щелчок ящика и «дзинь»
      hiss(c, o, t, 0.03, 1800, 1.2, 0.5);
      hiss(c, o, t + 0.045, 0.025, 2400, 1.5, 0.3);
      bell(c, o, t + 0.08, 2093, 0.22, 0.8);
    },
    registerSoft: function (c, o, t) { // касса помягче: тихий щелчок и негромкий колокольчик пониже
      hiss(c, o, t, 0.02, 2000, 1.5, 0.18);
      bell(c, o, t + 0.035, 1568, 0.16, 0.55);
    },
    coins: function (c, o, t) { // монетки: три коротких металлических «звяка»
      [0, 0.07, 0.15].forEach(function (dt, i) {
        var f = rnd(3000, 3600), p = [0.14, 0.1, 0.08][i];
        tone(c, o, t + dt, f, 0.18, p);
        tone(c, o, t + dt, f * 1.48, 0.12, p * 0.6);
        tone(c, o, t + dt, f * 2.1, 0.08, p * 0.35);
      });
    },
    rustle: function (c, o, t) { // шелест купюр: три мягких «шурх»
      [0, 0.1, 0.2].forEach(function (dt, i) {
        hiss(c, o, t + dt, rnd(0.07, 0.09), rnd(3500, 4500), 0.8, [0.5, 0.42, 0.32][i], rnd(2500, 3000), 0.015);
      });
    },
    count: function (c, o, t) { // пересчёт купюр: быстрые щелчки пачки
      for (var i = 0; i < 5; i++) hiss(c, o, t + i * 0.055, 0.035, rnd(2200, 2800), 1.2, 0.8 - i * 0.08, null, 0.002);
    },
    // для «Удалить»
    swipe: function (c, o, t) { // смахнуть: шорох сверху вниз
      hiss(c, o, t, 0.22, 3000, 1, 0.55, 600, 0.03);
    },
    crumple: function (c, o, t) { // скомкать бумажку: россыпь хрустов
      for (var i = 0; i < 7; i++) hiss(c, o, t + rnd(0, 0.22), rnd(0.012, 0.03), rnd(1800, 5000), 2, rnd(0.45, 0.75), null, 0.001);
    },
    thud: function (c, o, t) { // мягкий «тук» вниз
      tone(c, o, t, 520, 0.12, 0.22, 260);
    }
  };

  function play(name, vol) {
    var fn = SOUNDS[name];
    if (!fn || !setup()) return;
    try {
      if (ctx.state !== "running") ctx.resume();
      master.gain.value = vol == null ? 0.5 : vol;
      fn(ctx, master, ctx.currentTime + 0.01);
    } catch (e) {}
  }
  function render(name) { // → Promise<Float32Array>, звук без динамиков, для проверки уровней
    var c = new OfflineAudioContext(1, 44100 * 1.2, 44100);
    SOUNDS[name](c, c.destination, 0.01);
    return c.startRendering().then(function (b) { return b.getChannelData(0); });
  }
  return { play: play, render: render, names: Object.keys(SOUNDS) };
})();
