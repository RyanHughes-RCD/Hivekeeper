// Little Bee Haven — tiny synthesized sound effects (no audio files).
// iOS Safari only allows audio after a user gesture, so the context is
// created lazily on the first tap.
let ac = null;
let enabled = true;

export function setSoundEnabled(on) { enabled = on; }

export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    ac = new Ctx();
    // play a silent buffer to fully unlock on iOS
    const b = ac.createBuffer(1, 1, 22050);
    const src = ac.createBufferSource();
    src.buffer = b; src.connect(ac.destination); src.start(0);
  } catch (e) { ac = null; }
}

function tone(freq, dur, { type = 'sine', vol = 0.12, slide = 0, delay = 0 } = {}) {
  if (!ac || !enabled) return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(ac.destination);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

export function play(name) {
  if (!ac || !enabled) return;
  switch (name) {
    case 'pop': tone(660, 0.12, { slide: 300, vol: 0.14 }); tone(990, 0.1, { delay: 0.05, vol: 0.08 }); break;
    case 'tick': tone(880, 0.05, { type: 'triangle', vol: 0.06 }); break;
    case 'buzz': tone(190, 0.22, { type: 'sawtooth', vol: 0.035, slide: 40 }); tone(200, 0.2, { type: 'triangle', vol: 0.04, delay: 0.03 }); break;
    case 'place': tone(520, 0.09, { type: 'triangle', vol: 0.1 }); tone(780, 0.12, { type: 'triangle', vol: 0.08, delay: 0.06 }); break;
    case 'chime': [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, { vol: 0.08, delay: i * 0.07 })); break;
    case 'hatch': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.09, delay: i * 0.08 })); break;
    case 'levelup': [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', vol: 0.1, delay: i * 0.09 })); break;
    case 'buy': tone(700, 0.08, { vol: 0.1 }); tone(1050, 0.14, { vol: 0.08, delay: 0.07 }); break;
    case 'nope': tone(220, 0.15, { type: 'triangle', vol: 0.08, slide: -60 }); break;
    default: break;
  }
}
