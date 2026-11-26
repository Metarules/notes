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
  // «живой» колокольчик: у настоящего каждый обертон — пара близких частот (отсюда мерцание),
  // плюс короткий удар молоточка. parts: [отношение к основному тону, громкость, доля длительности]
  var DESK_BELL = [[1, 1, 1], [2.32, 0.45, 0.7], [4.25, 0.25, 0.4], [6.63, 0.12, 0.25], [9.38, 0.06, 0.15]];
  function liveBell(c, out, t, f, peak, d, parts) {
    hiss(c, out, t, 0.006, 7000, 0.6, peak * 0.9, null, 0.001); // удар
    (parts || DESK_BELL).forEach(function (p) {
      var beat = rnd(1.2, 3.5);
      tone(c, out, t, f * p[0], d * p[2], peak * p[1] * 0.6);
      tone(c, out, t, f * p[0] + beat, d * p[2] * 0.9, peak * p[1] * 0.45);
    });
  }
  // стук ящика кассы: глухой удар, шорох полозьев и дребезг мелочи
  function drawer(c, out, t, peak) {
    tone(c, out, t, 120, 0.09, peak, 70);
    hiss(c, out, t, 0.06, 420, 1, peak * 0.9, null, 0.002);
    hiss(c, out, t, 0.02, 2200, 1.4, peak * 0.5, null, 0.001);
    for (var i = 0; i < 4; i++) {
      var tt = t + rnd(0.01, 0.06), f = rnd(3500, 5500);
      tone(c, out, tt, f, rnd(0.02, 0.04), peak * 0.12);
      tone(c, out, tt, f * 1.53, 0.02, peak * 0.07);
    }
  }
  // монетка: высокие негармоничные моды металла; каждый отскок тише и короче
  var COIN = [[1, 1, 0.28], [1.46, 0.7, 0.2], [1.89, 0.5, 0.14], [2.33, 0.35, 0.1], [2.81, 0.2, 0.07]];
  function coinHit(c, out, t, f, peak, k) {
    hiss(c, out, t, 0.004, 8000, 0.7, peak * 0.6, null, 0.0008);
    COIN.forEach(function (p) { tone(c, out, t, f * p[0] * rnd(0.995, 1.005), p[2] * k, peak * p[1] * 0.5); });
  }
  // бумага: россыпь крошечных щелчков разной высоты; плотность задаёт рисунок шороха
  function paper(c, out, t, d, n, peak, fLo, fHi) {
    for (var i = 0; i < n; i++) {
      var x = Math.random(), tt = t + d * Math.sqrt(x) * (1 - 0.3 * Math.random());
      hiss(c, out, tt, rnd(0.002, 0.007), rnd(fLo, fHi), rnd(0.8, 2.5), peak * rnd(0.3, 1), null, 0.0005);
    }
  }

  var SOUNDS = {
    // для «Сохранить»
    register: function (c, o, t) { // 1. касса: щелчок ящика и «дзинь» (понравившийся, эталон)
      hiss(c, o, t, 0.03, 1800, 1.2, 0.5);
      hiss(c, o, t + 0.045, 0.025, 2400, 1.5, 0.3);
      bell(c, o, t + 0.08, 2093, 0.22, 0.8);
    },
    registerLive: function (c, o, t) { // 2. касса с «живым» колокольчиком
      hiss(c, o, t, 0.03, 1800, 1.2, 0.45);
      hiss(c, o, t + 0.045, 0.025, 2400, 1.5, 0.27);
      liveBell(c, o, t + 0.08, 2093, 0.24, 0.9);
    },
    registerDrawer: function (c, o, t) { // 3. касса: стук выдвинутого ящика и звонок
      drawer(c, o, t, 0.4);
      liveBell(c, o, t + 0.07, 1975, 0.22, 0.85);
    },
    kaching: function (c, o, t) { // 4. «ка-чинг»: два удара звонка, второй тише и выше
      hiss(c, o, t, 0.025, 1900, 1.2, 0.4);
      liveBell(c, o, t + 0.05, 2093, 0.2, 0.5);
      liveBell(c, o, t + 0.13, 2349, 0.15, 0.8);
    },
    deskBell: function (c, o, t) { // 5. звонок на стойке: один чистый «дзынь», без щелчка
      liveBell(c, o, t, 2489, 0.2, 1.1);
    },
    coinDrop: function (c, o, t) { // 6. монетка упала и подпрыгнула
      var f = rnd(4100, 4400);
      [[0, 0.3, 1], [0.13, 0.2, 0.7], [0.21, 0.13, 0.5], [0.26, 0.08, 0.35], [0.29, 0.05, 0.25]].forEach(function (h) {
        coinHit(c, o, t + h[0], f, h[1], h[2]);
      });
    },
    bill: function (c, o, t) { // 7. шелест купюры
      paper(c, o, t, 0.18, 90, 0.55, 1500, 7000);
      paper(c, o, t + 0.2, 0.12, 50, 0.4, 1500, 7000);
    },
    // для «Удалить»
    drawerClose: function (c, o, t) { // A. ящик кассы задвинули (без звонка)
      hiss(c, o, t, 0.08, 900, 0.8, 0.12, 400, 0.03);
      drawer(c, o, t + 0.07, 0.32);
    },
    lowBell: function (c, o, t) { // B. низкий тихий «дон» — тот же колокольчик, только ниже и короче
      liveBell(c, o, t, 784, 0.22, 0.45);
    },
    crumpleLive: function (c, o, t) { // C. скомкать чек
      paper(c, o, t, 0.28, 140, 0.65, 1200, 6000);
    },
    wood: function (c, o, t) { // D. деревянный «ток»
      hiss(c, o, t, 0.004, 3000, 0.8, 0.2, null, 0.0008);
      [[1, 1, 0.07], [2.57, 0.4, 0.035], [4.2, 0.2, 0.02]].forEach(function (p) { tone(c, o, t, 620 * p[0], p[2], 0.2 * p[1]); });
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
