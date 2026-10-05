/* ============================================================================
   AUDIO. Everything is synthesised in the browser; there are no sound files.
     sfx    bat, ball, cars, glass. Each has several variants so no two sound alike.
     crowd  quiet most of the time: a faint murmur, then real reactions to what happens
     music  the lobby organ tune and short organ stings between pitches
   Two volume sliders: SOUND (sfx + crowd) and MUSIC. On pause everything drops to a
   whisper. Dragging a slider plays only that side so it can be set by ear.
   ============================================================================ */

const AUDIO = {
  PAUSE_DUCK: 0.22, // how loud everything is on the pause menu, relative to play
  BED: 0.3, // the always-on murmur: 1 would be as loud as the old constant crowd
  DEFAULT_SOUND: 0.8,
  DEFAULT_MUSIC: 0.6,
};

let AC = null,
  master = null,
  duck = null, // pause ducking
  limiter = null,
  sfxBus = null,
  musicBus = null,
  white = null, // 1 s of white noise
  pink = null, // 5 s of pink noise
  organWave = null,
  solo = null; // 'sound' | 'music' while a slider is being dragged
const storedVol = (key, fallback) => {
  const v = parseFloat(store.get(key, ''));
  return Number.isFinite(v) ? clamp(v, 0, 1) : fallback;
};
const vol = { sound: storedVol('vs', AUDIO.DEFAULT_SOUND), music: storedVol('vm', AUDIO.DEFAULT_MUSIC) };
let hapOn = store.get('hap', '1') !== '0';

function audioInit() {
  if (AC) {
    if (AC.state === 'suspended') AC.resume();
    return;
  }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = 0.7;
    duck = AC.createGain();
    // a limiter so a roaring crowd plus a bat crack never distorts
    limiter = AC.createDynamicsCompressor();
    limiter.threshold.value = -5;
    limiter.knee.value = 3;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    master.connect(duck);
    duck.connect(limiter);
    limiter.connect(AC.destination);
    sfxBus = AC.createGain();
    musicBus = AC.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);

    white = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const w = white.getChannelData(0);
    for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
    pink = AC.createBuffer(1, AC.sampleRate * 5, AC.sampleRate);
    const p = pink.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < p.length; i++) {
      const x = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + x * 0.099046;
      b1 = 0.963 * b1 + x * 0.2965164;
      b2 = 0.57 * b2 + x * 1.0526913;
      p[i] = (b0 + b1 + b2 + x * 0.1848) * 0.22;
    }
    // organ tone: a few drawbars
    const harmonics = [0, 1, 0.55, 0.3, 0.18, 0, 0.08, 0, 0.05];
    organWave = AC.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics));
    crowd.build();
    music.build();
    applyVolumes(true);
    if (state === 'menu') music.startTune();
  } catch (e) {
    AC = null;
  }
}

/* Sets every bus from the sliders, the pause state and any slider being dragged. */
function applyVolumes(now) {
  if (!AC) return;
  const t = AC.currentTime,
    tc = now ? 0.001 : 0.08;
  sfxBus.gain.setTargetAtTime(solo === 'music' ? 0 : vol.sound, t, tc);
  musicBus.gain.setTargetAtTime(solo === 'sound' ? 0 : vol.music * 0.8, t, tc);
  // on the pause menu everything is quiet but still there; while a slider is dragged it comes back up
  duck.gain.setTargetAtTime(paused && !solo ? AUDIO.PAUSE_DUCK : 1, t, 0.12);
}
function setVolume(which, value) {
  vol[which] = clamp(value, 0, 1);
  store.set(which === 'sound' ? 'vs' : 'vm', vol[which].toFixed(2));
  applyVolumes();
}
/* Called while a slider is held: only that side plays, with something to listen to. */
let soloTimer = 0;
function audioSolo(which) {
  if (solo === which) return;
  solo = which;
  clearInterval(soloTimer);
  if (!AC) return;
  applyVolumes();
  if (which === 'sound') {
    const sample = () => {
      sfx.crack(1 + ((Math.random() * 3) | 0));
      crowd.cheer(0.6, 1.2);
    };
    sample();
    soloTimer = setInterval(sample, 1100);
  }
  if (which === 'music') music.startTune();
  if (!which && state !== 'menu') music.stopTune();
}

/* ---------- building blocks ---------- */
const vary = (x, pct) => x * (1 + rnd(-pct, pct));
const pick = (list) => list[(Math.random() * list.length) | 0];

/* A burst of filtered noise. o: {f0, f1, q, type, delay, dest, buf, attack} */
function noise(dur, gain, o) {
  if (!AC) return;
  o = o || {};
  const t = AC.currentTime + (o.delay || 0),
    src = AC.createBufferSource(),
    filter = AC.createBiquadFilter(),
    g = AC.createGain();
  src.buffer = o.buf || white;
  src.loop = true;
  filter.type = o.type || 'bandpass';
  filter.Q.value = o.q || 1;
  filter.frequency.setValueAtTime(o.f0 || 1000, t);
  if (o.f1) filter.frequency.exponentialRampToValueAtTime(Math.max(40, o.f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + (o.attack || 0.003));
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(o.dest || sfxBus);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.03);
}
/* A pitched blip that can glide. o: {type, delay, dest, attack} */
function tone(f0, f1, dur, gain, o) {
  if (!AC) return;
  o = o || {};
  const t = AC.currentTime + (o.delay || 0),
    osc = AC.createOscillator(),
    g = AC.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + (o.attack || 0.008));
  g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  osc.connect(g);
  g.connect(o.dest || sfxBus);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

/* ---------- sound effects ---------- */
/* Three bats: [body resonance Hz, ring Hz, knock Hz]. One is picked per swing and detuned a little. */
const BATS = [
  [1150, 2400, 520],
  [880, 1900, 430],
  [1420, 3000, 640],
];
const sfx = {
  /* Bat on ball. level 0 = foul tick, 1 = base hit, 2 = home run, 3 = grand slam. */
  crack(level) {
    const power = [0.35, 0.6, 0.85, 1][level],
      bat = pick(BATS),
      tune = vary(1, 0.1);
    noise(0.012, power, { type: 'highpass', f0: 1800 * tune });
    noise(vary(0.05, 0.25), power * 0.8, { f0: bat[0] * tune, q: 3 });
    noise(0.04, power * 0.5, { f0: bat[1] * tune, q: 4 });
    tone((level ? bat[2] : bat[2] * 1.5) * tune, 180, 0.05, power * 0.4, { type: 'triangle' });
    if (level >= 2) tone(vary(130, 0.1), 48, 0.28, 0.6);
    // the crack coming back off the far stands
    if (level >= 2) noise(0.09, power * 0.22, { f0: 900 * tune, q: 1.2, delay: vary(0.19, 0.15) });
    if (level === 3) noise(0.12, 0.16, { f0: 700, q: 1, delay: vary(0.37, 0.1) });
  },
  whiff() {
    noise(vary(0.16, 0.2), 0.3, { f0: vary(500, 0.2), f1: vary(1900, 0.2), q: 2 });
  },
  pop() {
    const tune = vary(1, 0.15);
    noise(0.09, 0.7, { f0: 300 * tune, f1: 120, q: 0.8 });
    tone(180 * tune, 70, 0.1, 0.4);
  },
  release() {
    noise(0.1, 0.1, { f0: vary(900, 0.15), f1: 400, q: 1.5 });
  },
  whoosh(seconds) {
    noise(seconds, 0.16, { buf: pink, f0: vary(500, 0.15), f1: vary(1700, 0.15), q: 0.7, attack: seconds * 0.3 });
  },
  firework() {
    noise(vary(0.22, 0.3), 0.4, { type: 'lowpass', f0: vary(900, 0.25), f1: 200 });
    const sparks = 5 + ((Math.random() * 8) | 0);
    for (let i = 0; i < sparks; i++) noise(0.02, 0.1, { type: 'highpass', f0: vary(4000, 0.2), delay: 0.08 + Math.random() * 0.45 });
  },
  thud(vol) {
    const tune = vary(1, 0.15),
      k = vol == null ? 1 : vol;
    tone(90 * tune, 40, 0.4, 0.7 * k);
    noise(0.3, 0.5 * k, { f0: 200 * tune, f1: 60, q: 0.6 });
  },
  /* a ball skipping off the grass */
  skip() {
    noise(0.12, 0.09, { f0: vary(900, 0.2), f1: 300, q: 0.8 });
  },
  /* a ball off a steel light bank */
  clang() {
    const tune = vary(1, 0.1);
    tone(1900 * tune, 1700 * tune, 0.5, 0.35, { type: 'triangle' });
    tone(2630 * tune, 2500 * tune, 0.35, 0.2, { type: 'sine' });
    noise(0.05, 0.6, { f0: 3000, f1: 1200, q: 1 });
  },
  /* electrics complaining */
  buzz() {
    for (let i = 0; i < 6; i++) tone(vary(120, 0.3), 90, 0.08, 0.18, { type: 'sawtooth', delay: 0.1 + i * rnd(0.05, 0.14) });
  },
  carHit() {
    const tune = vary(1, 0.2);
    noise(0.07, 0.8, { f0: 2200 * tune, f1: 500, q: 0.8 });
    tone(196 * tune, 150 * tune, 0.35, 0.3, { type: 'square' });
    tone(277 * tune, 210 * tune, 0.3, 0.2, { type: 'square' });
    tone(95, 45, 0.3, 0.6);
  },
  /* Three makes of car alarm. */
  carAlarm() {
    const tune = vary(1, 0.15),
      kind = (Math.random() * 3) | 0;
    if (kind === 0) {
      // chirps, then the horn
      for (let i = 0; i < 4; i++) {
        tone(700 * tune, 1500 * tune, 0.11, 0.09, { type: 'square', delay: 0.15 + i * 0.24 });
        tone(1500 * tune, 700 * tune, 0.11, 0.09, { type: 'square', delay: 0.27 + i * 0.24 });
      }
      for (let i = 0; i < 3; i++) {
        tone(415 * tune, 415 * tune, 0.2, 0.1, { type: 'sawtooth', delay: 1.2 + i * 0.36 });
        tone(523 * tune, 523 * tune, 0.2, 0.1, { type: 'sawtooth', delay: 1.2 + i * 0.36 });
      }
    } else if (kind === 1) {
      // slow siren
      for (let i = 0; i < 4; i++) {
        tone(600 * tune, 1300 * tune, 0.28, 0.08, { type: 'square', delay: 0.15 + i * 0.56 });
        tone(1300 * tune, 600 * tune, 0.28, 0.08, { type: 'square', delay: 0.43 + i * 0.56 });
      }
    } else {
      // honking
      for (let i = 0; i < 6; i++) {
        tone(440 * tune, 440 * tune, 0.16, 0.1, { type: 'sawtooth', delay: 0.15 + i * 0.3 });
        tone(554 * tune, 554 * tune, 0.16, 0.1, { type: 'sawtooth', delay: 0.15 + i * 0.3 });
      }
    }
  },
  /* A big pane or a small one. */
  glass() {
    const big = Math.random() < 0.5,
      tinkles = big ? 20 : 10;
    noise(big ? 0.1 : 0.06, 0.9, { type: 'highpass', f0: vary(2500, 0.2) });
    noise(big ? 0.6 : 0.35, 0.35, { f0: vary(5200, 0.15), q: 0.7 });
    for (let i = 0; i < tinkles; i++) {
      const f = rnd(2400, 7200);
      tone(f, f * 0.98, rnd(0.04, 0.16), rnd(0.04, 0.12), { delay: 0.03 + Math.random() * (big ? 0.9 : 0.5), attack: 0.002 });
    }
  },
  /* A dog in somebody's yard: big or small, two to five barks. */
  dogBark() {
    const pitch = rnd(300, 560),
      barks = 2 + ((Math.random() * 4) | 0);
    let at = 0.35;
    for (let i = 0; i < barks; i++) {
      tone(pitch, pitch * 0.55, 0.1, 0.22, { type: 'sawtooth', delay: at, attack: 0.01 });
      noise(0.09, 0.25, { f0: pitch * 2, q: 2, delay: at });
      at += rnd(0.2, 0.5);
    }
  },
  heart(k) {
    k = k || 1;
    tone(70, 45, 0.14, 0.5 * k);
    tone(62, 40, 0.14, 0.35 * k, { delay: 0.2 });
  },
  out() {
    tone(vary(330, 0.08), 110, 0.5, 0.2, { type: 'sawtooth' });
  },
};

/* ---------- crowd ---------- */
const crowd = (() => {
  const layers = {}; // name -> { gain, filter, drift }
  let bus = null,
    excite = 0, // 0..1, set by reactions, fades on its own
    fade = 1, // seconds for excite to fade from 1 to 0
    lastStep = 0,
    nextMix = 0,
    nextVoice = 0;

  /* A looping source through a filter into its own gain. */
  function layer(name, buffer, filterType, freq, q, rate, offset) {
    const src = AC.createBufferSource(),
      filter = AC.createBiquadFilter(),
      gain = AC.createGain();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = rate || 1;
    filter.type = filterType;
    filter.frequency.value = freq;
    filter.Q.value = q;
    gain.gain.value = 0;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus);
    src.start(0, offset || 0);
    layers[name] = { gain, filter, drift: 0 };
  }

  /* Applause: thousands of single claps scattered over four seconds. */
  function applauseBuffer() {
    const sr = AC.sampleRate,
      buf = AC.createBuffer(1, sr * 4, sr),
      d = buf.getChannelData(0);
    for (let n = 0; n < 2600; n++) {
      const at = (Math.random() * (d.length - 500)) | 0,
        len = 120 + ((Math.random() * 260) | 0),
        amp = 0.15 + Math.random() * 0.35;
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = Math.random() * 2 - 1;
        lp += (x - lp) * 0.55; // takes the fizz off
        d[at + i] += lp * amp * Math.exp((-6 * i) / len);
      }
    }
    return buf;
  }

  /* Voices: a couple of dozen people talking over each other, rendered once in the background. */
  function renderVoices(done) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Offline) return;
    const secs = 7,
      off = new Offline(1, AC.sampleRate * secs, AC.sampleRate);
    for (let v = 0; v < 26; v++) {
      const osc = off.createOscillator(),
        g = off.createGain(),
        pitch0 = rnd(95, 250);
      osc.type = 'sawtooth';
      g.gain.setValueAtTime(0, 0);
      let t = rnd(0, 0.5);
      while (t < secs - 0.4) {
        // one syllable
        const len = rnd(0.09, 0.32);
        osc.frequency.setValueAtTime(pitch0 * rnd(0.85, 1.25), t);
        osc.frequency.linearRampToValueAtTime(pitch0 * rnd(0.8, 1.2), t + len);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(rnd(0.25, 1), t + 0.03);
        g.gain.linearRampToValueAtTime(0, t + len);
        t += len + (Math.random() < 0.25 ? rnd(0.2, 0.9) : rnd(0.01, 0.08));
      }
      for (const [lo, hi, q] of [[450, 850, 4], [1100, 2300, 6]]) {
        const formant = off.createBiquadFilter();
        formant.type = 'bandpass';
        formant.frequency.value = rnd(lo, hi);
        formant.Q.value = q;
        g.connect(formant);
        formant.connect(off.destination);
      }
      osc.connect(g);
      osc.start(0);
    }
    const finish = (buffer) => {
      const d = buffer.getChannelData(0);
      let peak = 0.001;
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
      for (let i = 0; i < d.length; i++) d[i] *= 0.6 / peak;
      done(buffer);
    };
    off.oncomplete = (e) => finish(e.renderedBuffer);
    const p = off.startRendering();
    if (p && p.then) {
      off.oncomplete = null;
      p.then(finish).catch(() => {});
    }
  }

  /* One person in the crowd: a whistle, a shout or a lone clap. */
  function loneVoice(level) {
    const pan = AC.createStereoPanner ? AC.createStereoPanner() : null,
      dest = pan || bus;
    if (pan) {
      pan.pan.value = rnd(-0.8, 0.8);
      pan.connect(bus);
    }
    const which = Math.random(),
      loud = 0.015 + level * 0.045;
    if (which < 0.35) {
      // whistle: up, or up and back down
      const f = rnd(1700, 2600);
      tone(f, f * rnd(1.15, 1.5), rnd(0.18, 0.4), loud, { dest, attack: 0.03 });
      if (Math.random() < 0.5) tone(f * 1.4, f, 0.25, loud * 0.8, { dest, delay: 0.3, attack: 0.03 });
    } else if (which < 0.7) {
      // shout: "hey!" / "let's go!"
      const f = rnd(190, 340),
        syllables = 1 + ((Math.random() * 3) | 0);
      for (let i = 0; i < syllables; i++) {
        tone(f * rnd(0.95, 1.3), f * rnd(0.8, 1.05), rnd(0.12, 0.26), loud * 1.6, { type: 'sawtooth', dest, delay: i * 0.2, attack: 0.02 });
      }
    } else {
      const claps = 2 + ((Math.random() * 5) | 0);
      for (let i = 0; i < claps; i++) noise(0.03, loud * 4, { f0: rnd(1100, 1900), q: 1.2, dest, delay: i * rnd(0.14, 0.2) });
    }
  }

  /* A crowd-sized vowel: pitch moves from f0 to f1 (as a ratio), `rise` seconds to swell. */
  function vowel(f0ratio, f1ratio, seconds, gain, rise) {
    const people = 5 + ((Math.random() * 4) | 0);
    for (let i = 0; i < people; i++) {
      const f = rnd(150, 290);
      tone(f * f0ratio, f * f1ratio, seconds * rnd(0.8, 1.1), gain, {
        type: 'sawtooth',
        dest: layers.vowel.filter,
        delay: Math.random() * 0.12,
        attack: rise,
      });
    }
  }

  /* Clapping rhythms, as beat times in seconds. */
  const CLAPS = [
    [0, 0.3, 0.6, 0.75, 0.9, 1.5, 1.8, 2.1, 2.25, 2.4],
    [0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75],
    [0, 0.5, 0.75, 1.0, 1.5, 2.0, 2.25, 2.5],
  ];

  return {
    build() {
      bus = AC.createGain();
      bus.gain.value = 0.9;
      bus.connect(sfxBus);
      layer('murmur', pink, 'lowpass', 340, 0.5, 1, 0);
      layer('roar', pink, 'bandpass', 850, 0.5, 0.9, 2);
      layer('applause', applauseBuffer(), 'highpass', 500, 0.5, 1, 0);
      renderVoices((buffer) => {
        layer('voicesA', buffer, 'lowpass', 2400, 0.5, 1, 0);
        layer('voicesB', buffer, 'lowpass', 2000, 0.5, 0.87, 3.1);
      });
      // crowd vowels ("ohh", "ooh") go through one soft filter
      const f = AC.createBiquadFilter(),
        g = AC.createGain();
      f.type = 'lowpass';
      f.frequency.value = 750;
      f.Q.value = 0.7;
      g.gain.value = 1;
      f.connect(g);
      g.connect(bus);
      layers.vowel = { gain: g, filter: f, drift: 0 };
    },

    /* Called every frame, paused or not. The bed stays faint; reactions ride on top and fade. */
    step(now) {
      const dt = Math.min(0.1, now - lastStep);
      lastStep = now;
      excite = Math.max(0, excite - dt / (paused ? 0.4 : fade)); // a paused game lets the cheer die fast
      if (now < nextMix) return;
      nextMix = now + 0.22;
      const e = excite,
        bed = AUDIO.BED * (state === 'menu' || state === 'over' ? 0.6 : 1);
      const mix = {
        murmur: bed * 0.2 + 0.2 * e,
        voicesA: bed * 0.05 + 0.3 * e,
        voicesB: bed * 0.04 + 0.28 * e,
        applause: 1.2 * e * e,
        roar: 0.9 * Math.pow(e, 1.6), // silent unless something just happened
      };
      for (const name in mix) {
        const L = layers[name];
        if (!L) continue; // voices may still be rendering
        L.drift = clamp(L.drift + rnd(-0.12, 0.12), -0.35, 0.35);
        L.gain.gain.setTargetAtTime(mix[name] * (1 + L.drift), now, 0.25);
      }
      layers.roar.filter.frequency.setTargetAtTime(700 + 500 * e + rnd(-80, 80), now, 0.4);
      // now and then somebody in the stands makes themselves heard
      if (now >= nextVoice && !paused) {
        nextVoice = now + (e > 0.2 ? rnd(0.6, 2) : rnd(5, 13));
        loneVoice(e);
      }
    },
    cheer(amount, seconds) {
      if (!AC) return;
      excite = Math.max(excite, amount);
      fade = seconds || 2;
      nextMix = 0;
      vowel(1, vary(1.12, 0.04), 0.9 + amount * 0.6, 0.02 + 0.03 * amount, 0.12);
      const whistles = Math.round(amount * 4);
      for (let i = 0; i < whistles; i++) setTimeout(() => AC && !paused && loneVoice(amount), rnd(100, 1400));
    },
    groan() {
      if (!AC) return;
      excite *= 0.4;
      vowel(1, vary(0.78, 0.05), vary(1, 0.2), 0.045, 0.1);
    },
    ooh() {
      if (!AC) return;
      vowel(0.95, vary(1.1, 0.04), vary(0.5, 0.2), 0.035, 0.08);
    },
    hush() {
      excite *= 0.5;
    },
    claps() {
      if (!AC) return;
      pick(CLAPS).forEach((t) => {
        for (let i = 0; i < 5; i++) noise(0.04, 0.16, { f0: rnd(1200, 1800), q: 1, dest: bus, delay: t + Math.random() * 0.03 });
      });
    },
    get level() {
      return excite;
    },
  };
})();

/* ---------- music ---------- */
const music = (() => {
  // note numbers: 60 = middle C. Each entry: [note, start beat, length in beats]
  const BPM = 126,
    BARS = 8;
  // lobby tune: an original eight-bar organ shuffle in C
  const RHYTHM = [0, 0.5, 1, 1.5, 2.5, 3],
    LENGTHS = [0.5, 0.5, 0.5, 1, 0.5, 1];
  const MELODY = [
    [67, 64, 67, 72, 67, 64],
    [62, 64, 67, 69, 67, 67],
    [69, 65, 69, 72, 69, 65],
    [67, 64, 60, 64, 67, 67],
    [71, 67, 71, 74, 71, 67],
    [69, 72, 69, 65, 69, 69],
    [67, 72, 76, 74, 71, 67],
    [72, 67, 64, 60, 60, 0],
  ];
  const CHORDS = [
    [48, [64, 67, 72]],
    [48, [64, 67, 72]],
    [41, [65, 69, 72]],
    [48, [64, 67, 72]],
    [43, [62, 67, 71]],
    [41, [65, 69, 72]],
    [48, [64, 67, 72]],
    [43, [62, 65, 71]],
  ];
  /* Stings: each name has one or more versions; one is picked at random. Steps are 95 ms. */
  const STINGS = {
    play: [
      [[72, 0, 1], [76, 1, 1], [79, 2, 1], [84, 3, 3]],
      [[67, 0, 1], [72, 1, 1], [76, 2, 1], [79, 3, 3]],
    ],
    newPitch: [[[69, 0, 1], [69, 1.4, 1], [72, 2.8, 2.5]]],
    newPitcher: [
      [[67, 0, 1], [65, 1, 1], [64, 2, 1], [62, 3, 1], [60, 4, 2.5]],
      [[72, 0, 1], [71, 1, 1], [69, 2, 1], [67, 3, 2.5]],
    ],
    homer: [
      [[67, 0, 1], [72, 1, 1], [76, 2, 1], [79, 3, 1], [72, 4, 4], [76, 4, 4], [79, 4, 4], [84, 4, 4]],
      [[72, 0, 1], [72, 1, 1], [76, 2, 1], [79, 3, 3], [76, 3, 3]],
      [[79, 0, 1], [76, 1, 1], [79, 2, 1], [84, 3, 4], [76, 3, 4], [72, 3, 4]],
    ],
    grand: [
      [[72, 0, 0.8], [72, 1, 0.8], [72, 2, 0.8], [76, 3, 1.6], [79, 5, 1.6], [84, 7, 6], [76, 7, 6], [79, 7, 6], [88, 9, 4]],
      [[67, 0, 1], [72, 1, 1], [76, 2, 1], [79, 3, 1], [84, 4, 1], [88, 5, 6], [84, 5, 6], [79, 5, 6]],
    ],
    ko: [[[60, 0, 1], [64, 1, 1], [67, 2, 1], [72, 3, 1], [76, 4, 1], [79, 5, 1], [84, 6, 4], [76, 6, 4], [79, 6, 4]]],
    ninth: [[[57, 0, 1.6], [57, 2, 1.6], [60, 4, 1.6], [57, 6, 1.6], [64, 8, 4]]],
    record: [[[72, 0, 1], [76, 1, 1], [79, 2, 1], [84, 3, 2], [79, 5, 1], [84, 6, 2], [88, 8, 7], [84, 8, 7], [79, 8, 7], [76, 8, 7]]],
    streak: [[[67, 0, 0.8], [67, 1, 0.8], [72, 2, 0.8], [76, 3, 0.8], [79, 4, 1.6], [84, 6, 5], [79, 6, 5], [76, 6, 5]]],
    mimic: [[[45, 0, 3], [52, 0, 3], [44, 3, 3], [51, 3, 3], [43, 6, 3], [50, 6, 3], [42, 9, 8], [49, 9, 8], [57, 9, 8]]],
    riff: [
      [[67, 0, 1], [69, 1, 1], [71, 2, 1], [72, 3, 2]],
      [[72, 0, 1], [71, 1, 1], [72, 2, 1], [76, 3, 2]],
      [[60, 0, 1], [64, 1, 1], [67, 2, 1], [64, 3, 1], [67, 4, 2]],
      [[76, 0, 1], [74, 1, 1], [72, 2, 1], [74, 3, 1], [76, 4, 2]],
      [[64, 0, 0.8], [64, 1, 0.8], [67, 2, 0.8], [72, 3, 2.5]],
    ],
  };
  const STING_STEP = 0.095; // seconds per sting step
  let tuneBus = null,
    stingBus = null,
    playing = false,
    nextBar = 0, // AudioContext time of the next bar to schedule
    bar = 0;

  const hz = (note) => 440 * Math.pow(2, (note - 69) / 12);
  function organ(note, at, seconds, gain, dest) {
    if (!note) return;
    const osc = AC.createOscillator(),
      g = AC.createGain();
    osc.setPeriodicWave(organWave);
    osc.frequency.value = hz(note);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.012);
    g.gain.setValueAtTime(gain, at + Math.max(0.02, seconds - 0.03));
    g.gain.linearRampToValueAtTime(0.0001, at + seconds + 0.04);
    osc.connect(g);
    g.connect(dest);
    osc.start(at);
    osc.stop(at + seconds + 0.08);
  }
  function scheduleBar(index, at) {
    const beat = 60 / BPM,
      [bass, chord] = CHORDS[index];
    MELODY[index].forEach((note, i) => organ(note, at + RHYTHM[i] * beat, LENGTHS[i] * beat * 0.92, 0.16, tuneBus));
    organ(bass, at, beat * 0.9, 0.2, tuneBus);
    organ(bass + 7, at + 2 * beat, beat * 0.9, 0.16, tuneBus);
    for (const off of [1, 3]) chord.forEach((n) => organ(n - 12, at + off * beat, beat * 0.3, 0.06, tuneBus));
  }

  return {
    build() {
      // a slow tremolo gives the organ its wobble
      const tremolo = AC.createGain(),
        lfo = AC.createOscillator(),
        depth = AC.createGain();
      lfo.frequency.value = 5.6;
      depth.gain.value = 0.12;
      lfo.connect(depth);
      depth.connect(tremolo.gain);
      lfo.start();
      tremolo.connect(musicBus);
      tuneBus = AC.createGain();
      tuneBus.gain.value = 0;
      tuneBus.connect(tremolo);
      stingBus = AC.createGain();
      stingBus.gain.value = 1;
      stingBus.connect(tremolo);
    },
    startTune() {
      if (!AC || playing) return;
      playing = true;
      bar = 0;
      nextBar = AC.currentTime + 0.15;
      tuneBus.gain.cancelScheduledValues(AC.currentTime);
      tuneBus.gain.setTargetAtTime(0.75, AC.currentTime, 0.2);
    },
    stopTune() {
      if (!AC || !playing) return;
      playing = false;
      tuneBus.gain.cancelScheduledValues(AC.currentTime);
      tuneBus.gain.setTargetAtTime(0, AC.currentTime, 0.12);
    },
    /* Called every frame: keeps half a second of the tune scheduled ahead. */
    step(now) {
      if (!playing) return;
      if (nextBar < now) nextBar = now + 0.05; // tab was in the background
      while (nextBar < now + 0.5) {
        scheduleBar(bar % BARS, nextBar);
        nextBar += (60 / BPM) * 4;
        bar++;
      }
    },
    /* `up` shifts the whole sting by that many semitones. */
    sting(name, up) {
      if (!AC) return;
      const notes = pick(STINGS[name] || STINGS.riff),
        at = AC.currentTime + 0.03;
      notes.forEach(([note, start, len]) => organ(note + (up || 0), at + start * STING_STEP, len * STING_STEP, 0.13, stingBus));
    },
    riff() {
      this.sting('riff');
    },
    get playing() {
      return playing;
    },
  };
})();

/* Runs every frame, paused or not, so nothing ever freezes at full volume. */
function audioUpdate() {
  if (!AC) return;
  crowd.step(AC.currentTime);
  music.step(AC.currentTime);
}

function vib(pattern) {
  try {
    if (hapOn && navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) {}
}
