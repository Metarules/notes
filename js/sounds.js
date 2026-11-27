// Звуки действий: «Сохранить» — касса (щелчок и «живой» колокольчик); свайп, открывший «Удалить», —
// мягкий короткий взмах; остальные нажатия кнопок (Snd.tap; общий обработчик в actions.js, «Удалить»,
// операция в истории) — мягкая пластиковая кнопка: нажал и отпустил.
// Синтезируются Web Audio прямо здесь, без файлов. Тихие и короткие; режим тишины iPhone (Silent mode)
// их глушит, музыку и подкасты они не прерывают: сеанс звука страницы — «ambient» (navigator.audioSession,
// Safari 16.4+). Звучат только в ответ на касание: иначе iOS не даст.
// Выключаются в «Настройках» («Звуки»); выбор — на этом устройстве ("sounds").
var SOUND_VOLUME = 0.4;        // общая громкость (как на странице проверки по умолчанию)
// множители громкости: касса и взмах выровнены на слух — по модели громкости с суммированием по критическим
// полосам (как у Цвикера): широкий шум взмаха ухо слышит громче чистого тона той же энергии. Тап короткий,
// по такой модели до кассы его не дотянуть без искажений — у него пик на уровне, подобранном на iPhone
var SOUND_LEVELS = { save: 1, swipe: 0.25, tap: 8.9 };
var SOUND_IDLE_MS = 30000;     // после тишины аудио засыпает, чтобы не держать динамик и батарею;
                               // не сразу: свайп разбудить его может не всегда, а по касанию он сработает
var Snd = (function () {
  var ctx = null, master = null, noiseBuf = null, idle = 0;

  function setup() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch (e) {}
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = SOUND_VOLUME;
    master.connect(ctx.destination);
    return ctx;
  }
  function noise(c) { // секунда белого шума
    if (noiseBuf) return noiseBuf;
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
  function tone(c, out, t, f, d, peak) {
    var o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(f, t);
    env(g, t, 0.003, peak, d);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + d + 0.05);
  }
  // щелчок: короткая полоса шума с центром f
  function click(c, out, t, d, f, q, peak, a) {
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noise(c);
    bp.type = "bandpass"; bp.Q.value = q; bp.frequency.value = f;
    env(g, t, a || 0.004, peak, d);
    s.connect(bp); bp.connect(g); g.connect(out);
    s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  }
  // колокольчик: у настоящего каждый обертон — пара близких частот (отсюда мерцание), плюс удар молоточка.
  // [отношение к основному тону, громкость, доля длительности]
  var BELL = [[1, 1, 1], [2.32, 0.45, 0.7], [4.25, 0.25, 0.4], [6.63, 0.12, 0.25], [9.38, 0.06, 0.15]];
  function bell(c, out, t, f, peak, d) {
    click(c, out, t, 0.006, 7000, 0.6, peak * 0.9, 0.001);
    BELL.forEach(function (p) {
      var beat = 1.2 + Math.random() * 2.3;
      tone(c, out, t, f * p[0], d * p[2], peak * p[1] * 0.6);
      tone(c, out, t, f * p[0] + beat, d * p[2] * 0.9, peak * p[1] * 0.45);
    });
  }
  var pinkBuf = null;
  function pink(c) { // розовый шум (фильтр Пола Келлета): мягче белого, как настоящий шум воздуха
    if (pinkBuf) return pinkBuf;
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
  // взмах: розовый шум через полосу (добротность q, верх срезан на cut), центр которой идёт по точкам fs;
  // громкость — плавный «горб»: нарастает до доли p длительности и мягко гаснет, без щелчков на краях
  function whoosh(c, out, t, d, fs, peak, p, q, cut) {
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = pink(c);
    bp.type = "bandpass"; bp.Q.value = q;
    lp.type = "lowpass"; lp.frequency.value = cut;
    bp.frequency.setValueAtTime(fs[0], t);
    for (var i = 1; i < fs.length; i++) bp.frequency.exponentialRampToValueAtTime(fs[i], t + d * i / (fs.length - 1));
    var curve = new Float32Array(64);
    for (var k = 0; k < curve.length; k++) {
      var x = k / (curve.length - 1);
      var h = x < p ? Math.pow(Math.sin(Math.PI / 2 * x / p), 2) : Math.pow(Math.cos(Math.PI / 2 * (x - p) / (1 - p)), 1.6);
      curve[k] = Math.max(h * peak, 0.00001);
    }
    g.gain.setValueAtTime(0.00001, t);
    g.gain.setValueCurveAtTime(curve, t, d);
    s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out);
    s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  function swoosh(c, out, t) { // мягкий короткий взмах: «пролетел мимо» — высота вверх и вниз, без верхнего шипения
    whoosh(c, out, t, 0.22, [550, 1500, 750], 0.85, 0.42, 0.7, 3500);
  }
  // мягкий щелчок: розовый шум в полосе f, верх срезан на lp, атака a
  function softClick(c, out, t, d, f, q, peak, a, lp) {
    var s = c.createBufferSource(), bp = c.createBiquadFilter(), l = c.createBiquadFilter(), g = c.createGain();
    s.buffer = pink(c);
    bp.type = "bandpass"; bp.Q.value = q; bp.frequency.value = f;
    l.type = "lowpass"; l.frequency.value = lp;
    env(g, t, a, peak, d);
    s.connect(bp); bp.connect(l); l.connect(g); g.connect(out);
    s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  function tick(c, out, t) { // мягкая пластиковая кнопка: нажал и отпустил, верх срезан
    softClick(c, out, t, 0.007, 2000, 1.4, 1.2, 0.0012, 3500);
    softClick(c, out, t + 0.022, 0.006, 2400, 1.4, 0.65, 0.0012, 3500);
  }
  function register(c, out, t) { // касса: два щелчка ящика и «дзинь»
    click(c, out, t, 0.03, 1800, 1.2, 0.45);
    click(c, out, t + 0.045, 0.025, 2400, 1.5, 0.27);
    bell(c, out, t + 0.08, 2093, 0.24, 0.9);
  }

  function on() { return store("sounds") !== "off"; }
  function sleepLater() {
    clearTimeout(idle);
    idle = setTimeout(function () { try { ctx.suspend(); } catch (e) {} }, SOUND_IDLE_MS);
  }
  // вызывать из обработчика касания: iOS разрешает звук только так; force — проиграть, даже если выключено
  function play(fn, level, force) {
    if (!force && !on()) return;
    try {
      if (!setup()) return;
      clearTimeout(idle);
      if (ctx.state !== "running") ctx.resume();
      var g = ctx.createGain();
      g.gain.value = level;
      g.connect(master);
      fn(ctx, g, ctx.currentTime + 0.01);
      sleepLater();
    } catch (e) {}
  }
  return {
    on: on,
    save: function (force) { play(register, SOUND_LEVELS.save, force); },
    swipe: function () { play(swoosh, SOUND_LEVELS.swipe); },
    tap: function () { play(tick, SOUND_LEVELS.tap); }
  };
})();
