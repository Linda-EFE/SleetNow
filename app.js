'use strict';

/* ============================================================
   SleetNow – Einschlaf-App
   Alle Klänge werden live mit der Web Audio API erzeugt,
   es werden keine Audiodateien benötigt.
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('sleetnow:' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem('sleetnow:' + key, JSON.stringify(value)); } catch { /* ignorieren */ }
  },
};

/* ---------------- Begrüßung ---------------- */
(function greet() {
  const h = new Date().getHours();
  const text = h < 5 ? 'Schon spät – Zeit zum Abschalten'
    : h < 11 ? 'Guten Morgen'
    : h < 17 ? 'Zeit für ein Nickerchen?'
    : h < 21 ? 'Guten Abend'
    : 'Gute Nacht';
  $('#greeting').textContent = text;
})();

/* ---------------- Tabs ---------------- */
$$('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.tab').forEach(t => {
      const on = t === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', String(on));
    });
    $$('.panel').forEach(p => { p.hidden = p.id !== 'panel-' + tab.dataset.tab; });
  });
});

/* ============================================================
   Audio
   ============================================================ */
let ctx = null;
let master = null;
const noiseCache = {};

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Erzeugt einen nahtlos loopbaren Rausch-Puffer (weiß, rosa oder braun). */
function noiseBuffer(type) {
  if (noiseCache[type]) return noiseCache[type];
  const sr = ctx.sampleRate;
  const len = sr * 10;          // 10 s Loop
  const fade = sr * 1;          // 1 s Überblendung für nahtlosen Loop
  const buf = ctx.createBuffer(2, len, sr);

  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(len + fade);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      if (type === 'white') {
        raw[i] = w * 0.5;
      } else if (type === 'pink') {
        // Paul-Kellet-Filter
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      } else {
        last = (last + 0.02 * w) / 1.02;
        raw[i] = last * 3.5;
      }
    }
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = raw[i];
    // Ende des Rohsignals in den Anfang überblenden → kein Knacksen beim Loop
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = raw[i] * t + raw[len + i] * (1 - t);
    }
  }
  noiseCache[type] = buf;
  return buf;
}

/* Kleine Helfer zum Bauen von Klangketten */
function source(type) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(type);
  s.loop = true;
  // zufälliger Startpunkt, damit gleichzeitige Klänge nicht identisch klingen
  s.start(0, Math.random() * 10);
  return s;
}
function filter(type, freq, q = 0.7) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  return f;
}
function gain(value) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}
/** Langsamer Oszillator, der einen AudioParam um ±depth moduliert. */
function lfo(param, rate, depth) {
  const o = ctx.createOscillator();
  o.frequency.value = rate;
  const d = gain(depth);
  o.connect(d).connect(param);
  o.start();
  return o;
}

/* Klangdefinitionen. build() verbindet alles mit `out` und gibt die zu stoppenden Quellen zurück. */
/* Satire-Kachel: echte Rede als Audiodatei. Ein <audio>-Element wird über die
   Web Audio API geleitet, damit Lautstärke und Sleep-Timer wie bei den anderen Klängen wirken. */
let speechEl = null;
let speechSrc = null;
let speechOwner = 0;

const SOUNDS = [
  {
    id: 'xi', name: 'Xi-Rede (APEC)', icon: '🎤', image: 'media/trump-doesend.jpg', feature: true,
    sub: '28 Minuten Grundsatzrede – garantiert einschläfernd',
    build(out) {
      if (!speechEl) {
        speechEl = new Audio('media/xi-apec-2015.mp3');
        speechEl.loop = true;
        speechEl.preload = 'none';
        speechSrc = ctx.createMediaElementSource(speechEl);
      }
      const token = ++speechOwner;
      speechSrc.connect(out);
      speechEl.play().catch(() => {});
      return [{
        stop() {
          try { speechSrc.disconnect(out); } catch { /* schon getrennt */ }
          // nur pausieren, wenn nicht inzwischen neu gestartet wurde; Position bleibt erhalten
          if (token === speechOwner) speechEl.pause();
        },
      }];
    },
  },
  {
    id: 'rain', name: 'Regen', icon: '🌧️',
    build(out) {
      const s = source('pink');
      const g = gain(0.9);
      s.connect(filter('highpass', 500)).connect(filter('lowpass', 7000)).connect(g).connect(out);
      const s2 = source('white');
      const g2 = gain(0.12);
      s2.connect(filter('bandpass', 3500, 0.8)).connect(g2).connect(out);
      return [s, s2, lfo(g.gain, 0.13, 0.12)];
    },
  },
  {
    id: 'ocean', name: 'Meer', icon: '🌊',
    build(out) {
      const s = source('brown');
      const g = gain(0.55);
      s.connect(filter('lowpass', 700)).connect(g).connect(out);
      const s2 = source('pink');
      const g2 = gain(0.12);
      s2.connect(filter('bandpass', 1200, 0.6)).connect(g2).connect(out);
      // Wellen: ~12 s Periode
      return [s, s2, lfo(g.gain, 0.08, 0.45), lfo(g2.gain, 0.08, 0.11)];
    },
  },
  {
    id: 'wind', name: 'Wind', icon: '🍃',
    build(out) {
      const s = source('white');
      const bp = filter('bandpass', 450, 1.2);
      const g = gain(0.6);
      s.connect(bp).connect(g).connect(out);
      return [s, lfo(bp.frequency, 0.05, 260), lfo(g.gain, 0.11, 0.3)];
    },
  },
  {
    id: 'fire', name: 'Kamin', icon: '🔥',
    build(out) {
      // tiefes Grollen + zufälliges Knistern
      const s = source('brown');
      const g = gain(0.35);
      s.connect(filter('lowpass', 300)).connect(g).connect(out);
      const crackleGain = gain(0.9);
      crackleGain.connect(out);
      const crackle = { stopped: false, timer: 0 };
      const pop = () => {
        if (crackle.stopped) return;
        const t = ctx.currentTime;
        const b = ctx.createBufferSource();
        b.buffer = noiseBuffer('white');
        const f = filter('bandpass', 1500 + Math.random() * 3000, 2);
        const env = gain(0);
        const peak = 0.15 + Math.random() * 0.5;
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(peak, t + 0.002);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.06);
        b.connect(f).connect(env).connect(crackleGain);
        b.start(t, Math.random() * 9);
        b.stop(t + 0.15);
        crackle.timer = setTimeout(pop, 40 + Math.random() * (Math.random() < 0.2 ? 900 : 250));
      };
      pop();
      return [s, { stop() { crackle.stopped = true; clearTimeout(crackle.timer); } }];
    },
  },
  {
    id: 'pink', name: 'Rosa Rauschen', icon: '🌸',
    build(out) {
      const s = source('pink');
      s.connect(gain(0.8)).connect(out);
      return [s];
    },
  },
  {
    id: 'brown', name: 'Braunes Rauschen', icon: '🟤',
    build(out) {
      const s = source('brown');
      s.connect(gain(0.9)).connect(out);
      return [s];
    },
  },
  {
    id: 'white', name: 'Weißes Rauschen', icon: '⚪',
    build(out) {
      const s = source('white');
      s.connect(filter('lowpass', 9000)).connect(gain(0.35)).connect(out);
      return [s];
    },
  },
  {
    id: 'drone', name: 'Tiefer Ton', icon: '🎐',
    build(out) {
      // sanfter, schwebender Akkord mit leichter Verstimmung
      const g = gain(0.06);
      const lp = filter('lowpass', 900);
      g.connect(lp).connect(out);
      const nodes = [110, 110.4, 164.8, 220.3].map(f => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g);
        o.start();
        return o;
      });
      return [...nodes, lfo(g.gain, 0.06, 0.025)];
    },
  },
];

const active = new Map(); // id → { out, nodes }
const volumes = store.get('volumes', {});

function startSound(sound) {
  audio();
  const vol = volumes[sound.id] ?? 0.6;
  const out = gain(0);
  out.connect(master);
  out.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.5); // sanft einblenden
  const nodes = sound.build(out);
  active.set(sound.id, { out, nodes });
}

function stopSound(id) {
  const entry = active.get(id);
  if (!entry) return;
  active.delete(id);
  const t = ctx.currentTime;
  entry.out.gain.cancelScheduledValues(t);
  entry.out.gain.setValueAtTime(entry.out.gain.value, t);
  entry.out.gain.linearRampToValueAtTime(0, t + 0.8);
  setTimeout(() => {
    entry.nodes.forEach(n => { try { n.stop(); } catch { /* schon gestoppt */ } });
    entry.out.disconnect();
  }, 900);
}

function renderSounds() {
  const grid = $('#soundGrid');
  SOUNDS.forEach(sound => {
    const el = document.createElement('div');
    el.className = 'sound' + (sound.feature ? ' feature' : '');
    if (sound.image) {
      el.style.backgroundImage =
        `linear-gradient(to top, rgba(11,16,38,.95) 15%, rgba(11,16,38,.1) 75%), url("${sound.image}")`;
    }
    el.innerHTML = `
      ${sound.feature ? '<span class="zzz" aria-hidden="true">💤</span>' : ''}
      <button class="sound-toggle" aria-pressed="false">
        <span class="sound-icon" aria-hidden="true">${sound.icon}</span>
        <span>
          <span class="sound-name">${sound.name}</span>
          ${sound.sub ? `<span class="sound-sub">${sound.sub}</span>` : ''}
        </span>
      </button>
      <input type="range" min="0" max="1" step="0.01" aria-label="Lautstärke ${sound.name}">`;
    const btn = $('.sound-toggle', el);
    const range = $('input', el);
    range.value = volumes[sound.id] ?? 0.6;

    btn.addEventListener('click', () => {
      if (active.has(sound.id)) stopSound(sound.id);
      else startSound(sound);
      updateSoundUI();
    });
    range.addEventListener('input', () => {
      const v = parseFloat(range.value);
      volumes[sound.id] = v;
      store.set('volumes', volumes);
      const entry = active.get(sound.id);
      if (entry) entry.out.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
    });
    el.dataset.id = sound.id;
    grid.appendChild(el);
  });
}

function updateSoundUI() {
  $$('.sound').forEach(el => {
    const on = active.has(el.dataset.id);
    el.classList.toggle('on', on);
    $('.sound-toggle', el).setAttribute('aria-pressed', String(on));
  });
  updateMediaSession();
}

function stopAll() {
  [...active.keys()].forEach(stopSound);
  updateSoundUI();
}

renderSounds();
$('#stopAll').addEventListener('click', () => { stopAll(); cancelTimer(); });

/* Mediensteuerung (Sperrbildschirm / Kopfhörer-Tasten) */
function updateMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const names = SOUNDS.filter(s => active.has(s.id)).map(s => s.name);
  navigator.mediaSession.metadata = names.length
    ? new MediaMetadata({ title: names.join(' + '), artist: 'SleetNow' })
    : null;
  try { navigator.mediaSession.setActionHandler('pause', stopAll); } catch { /* nicht unterstützt */ }
}

/* ============================================================
   Sleep-Timer
   ============================================================ */
let timerEnd = 0;
let timerTick = 0;

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function resetMaster() {
  if (!master) return;
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(1, t + 0.5);
}

function cancelTimer() {
  timerEnd = 0;
  clearInterval(timerTick);
  resetMaster();
  $('#timerLeft').textContent = '';
  $('#nightTimer').textContent = '';
  $$('#timerChips .chip').forEach(c => c.classList.toggle('active', c.dataset.min === '0'));
}

function startTimer(minutes) {
  cancelTimer();
  if (!minutes) return;
  audio();
  const total = minutes * 60;
  const fade = Math.min(180, total * 0.3); // bis zu 3 min Ausblenden
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(1, t);
  master.gain.setValueAtTime(1, t + total - fade);
  master.gain.linearRampToValueAtTime(0.0001, t + total);

  timerEnd = Date.now() + total * 1000;
  $$('#timerChips .chip').forEach(c => c.classList.toggle('active', Number(c.dataset.min) === minutes));

  const tick = () => {
    const left = timerEnd - Date.now();
    if (left <= 0) {
      stopAll();
      cancelTimer();
      if (!$('#night').hidden) closeNight();
      return;
    }
    $('#timerLeft').textContent = fmt(left);
    $('#nightTimer').textContent = 'Timer ' + fmt(left);
  };
  tick();
  timerTick = setInterval(tick, 1000);
}

$$('#timerChips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const min = Number(chip.dataset.min);
    store.set('timer', min);
    startTimer(min);
  });
});

/* ============================================================
   Nachtmodus (dunkle Uhr, Bildschirm bleibt an)
   ============================================================ */
let wakeLock = null;
let clockTick = 0;

function updateClock() {
  const d = new Date();
  $('#nightClock').textContent =
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function openNight() {
  $('#night').hidden = false;
  updateClock();
  clockTick = setInterval(updateClock, 10000);
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
}
function closeNight() {
  $('#night').hidden = true;
  clearInterval(clockTick);
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
$('#nightBtn').addEventListener('click', openNight);
$('#night').addEventListener('click', closeNight);
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && !$('#night').hidden && !wakeLock) {
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* egal */ }
  }
});

/* ============================================================
   Atemübungen
   ============================================================ */
const PATTERNS = {
  '478': {
    info: '4 s einatmen, 7 s halten, 8 s ausatmen – beruhigt das Nervensystem.',
    steps: [['Einatmen', 4, 'in'], ['Halten', 7, 'hold'], ['Ausatmen', 8, 'out']],
  },
  box: {
    info: 'Gleichmäßig 4 s ein, halten, aus, halten – gut gegen kreisende Gedanken.',
    steps: [['Einatmen', 4, 'in'], ['Halten', 4, 'hold'], ['Ausatmen', 4, 'out'], ['Halten', 4, 'hold']],
  },
  calm: {
    info: '4 s einatmen, 6 s ausatmen – längeres Ausatmen entspannt.',
    steps: [['Einatmen', 4, 'in'], ['Ausatmen', 6, 'out']],
  },
};

let pattern = store.get('pattern', '478');
if (!PATTERNS[pattern]) pattern = '478';
let breathing = false;
let breathTimer = 0;
let rounds = 0;

const circle = $('#breathCircle');

function setPattern(p) {
  pattern = p;
  store.set('pattern', p);
  $$('#patternChips .chip').forEach(c => c.classList.toggle('active', c.dataset.pattern === p));
  $('#patternInfo').textContent = PATTERNS[p].info;
  if (breathing) { stopBreathing(); startBreathing(); }
}

function setCircle(scale, seconds) {
  circle.style.transitionDuration = seconds + 's';
  circle.style.transform = `scale(${scale})`;
}

function runStep(i) {
  const steps = PATTERNS[pattern].steps;
  if (i >= steps.length) {
    rounds++;
    $('#breathRounds').textContent = `${rounds} ${rounds === 1 ? 'Runde' : 'Runden'}`;
    i = 0;
  }
  const [label, secs, kind] = steps[i];
  $('#breathPhase').textContent = label;
  if (kind === 'in') setCircle(1.9, secs);
  if (kind === 'out') setCircle(1, secs);

  let left = secs;
  $('#breathCount').textContent = left;
  const countdown = () => {
    left--;
    if (!breathing) return;
    if (left <= 0) { runStep(i + 1); return; }
    $('#breathCount').textContent = left;
    breathTimer = setTimeout(countdown, 1000);
  };
  breathTimer = setTimeout(countdown, 1000);
}

function startBreathing() {
  breathing = true;
  rounds = 0;
  $('#breathRounds').textContent = '';
  $('#breathBtn').textContent = 'Stoppen';
  runStep(0);
}
function stopBreathing() {
  breathing = false;
  clearTimeout(breathTimer);
  $('#breathBtn').textContent = 'Starten';
  $('#breathPhase').textContent = 'Bereit';
  $('#breathCount').textContent = '';
  setCircle(1, 1);
}

$$('#patternChips .chip').forEach(c => c.addEventListener('click', () => setPattern(c.dataset.pattern)));
$('#breathBtn').addEventListener('click', () => (breathing ? stopBreathing() : startBreathing()));
setPattern(pattern);

/* ============================================================
   Schlafrechner
   ============================================================ */
const CYCLE_MIN = 90;
const FALL_ASLEEP_MIN = 15;

function hhmm(date) {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function renderResults(container, items) {
  container.innerHTML = items.map(({ time, cycles }) => `
    <div class="result${cycles >= 5 ? ' best' : ''}">
      <div class="result-time">${hhmm(time)}</div>
      <div class="result-sub">${cycles} Zyklen · ${(cycles * CYCLE_MIN / 60).toLocaleString('de-DE')} h</div>
    </div>`).join('');
}

$('#calcNow').addEventListener('click', () => {
  const now = Date.now();
  const items = [6, 5, 4, 3].map(cycles => ({
    cycles,
    time: new Date(now + (FALL_ASLEEP_MIN + cycles * CYCLE_MIN) * 60000),
  }));
  renderResults($('#resultsNow'), items);
});

$('#calcWake').addEventListener('click', () => {
  const [h, m] = ($('#wakeTime').value || '07:00').split(':').map(Number);
  const wake = new Date();
  wake.setHours(h, m, 0, 0);
  if (wake <= new Date()) wake.setDate(wake.getDate() + 1);
  store.set('wake', $('#wakeTime').value);
  const items = [6, 5, 4, 3].map(cycles => ({
    cycles,
    time: new Date(wake.getTime() - (FALL_ASLEEP_MIN + cycles * CYCLE_MIN) * 60000),
  }));
  renderResults($('#resultsWake'), items);
});
$('#wakeTime').value = store.get('wake', '07:00');

/* ============================================================
   Offline-Unterstützung
   ============================================================ */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
