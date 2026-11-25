// 映像の本体で音を鳴らす（Web Audio）。場面が変わると2秒かけて音が入れ替わり、手を握ると鈴が鳴る。
// ブラウザの決まりで、音は利用者がボタンを押したあとにしか鳴らせない。
import { chimeFreq } from '/shared/sound.mjs';

export function createAudio() {
  let ac = null, master = null, echo = null, voice = null, current = null, chimes = 0, volume = 0.5, presence = 0, playing = false, suspendTimer = null;

  function ensure() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = volume; master.connect(ac.destination);
    // 鈴に響きを付ける簡単なこだま
    const d = ac.createDelay(1); d.delayTime.value = 0.32;
    const fb = ac.createGain(); fb.gain.value = 0.35;
    d.connect(fb); fb.connect(d); d.connect(master);
    echo = d;
  }

  function startVoice(s) {
    const now = ac.currentTime;
    const out = ac.createGain(); out.gain.setValueAtTime(0, now); out.gain.linearRampToValueAtTime(0.22 + presence * 0.08, now + 2);
    const filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 200 + s.bright * 3000; filter.Q.value = 0.7;
    const swell = ac.createGain(); swell.gain.value = 0.75;
    const lfo = ac.createOscillator(); lfo.frequency.value = Math.max(0.01, s.pulse);
    const lfoAmt = ac.createGain(); lfoAmt.gain.value = s.pulse > 0 ? 0.25 : 0;
    lfo.connect(lfoAmt); lfoAmt.connect(swell.gain);
    const oscs = [[s.base, 0], [s.base * 1.5, 4], [s.base * 2, -6]].map(([f, detune], i) => {
      const o = ac.createOscillator(); o.type = s.wave; o.frequency.value = f; o.detune.value = detune;
      const g = ac.createGain(); g.gain.value = [0.5, 0.25, 0.15][i];
      o.connect(g); g.connect(filter); o.start(now); return o;
    });
    filter.connect(swell); swell.connect(out); out.connect(master); lfo.start(now);
    return { out, stop() { const t = ac.currentTime; out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t); out.gain.linearRampToValueAtTime(0, t + 2); [...oscs, lfo].forEach((o) => o.stop(t + 2.1)); } };
  }

  return {
    get on() { return playing; },
    async start(sound) { ensure(); clearTimeout(suspendTimer); await ac.resume(); playing = true; if (sound) this.setScene(sound); },
    async stop() {
      playing = false;
      if (voice) { voice.stop(); voice = null; } current = null;
      clearTimeout(suspendTimer);
      if (ac) suspendTimer = setTimeout(() => { if (!playing) ac.suspend(); }, 2200); // 2秒で静かに消えてから止める
    },
    setScene(sound) {
      if (!ac || !playing) { current = sound; return; }
      if (current && voice && JSON.stringify(current) === JSON.stringify(sound)) return;
      if (voice) voice.stop();
      current = sound; voice = startVoice(sound);
    },
    chime() {
      if (!ac || !playing || !current) return;
      const t = ac.currentTime, f = chimeFreq(current, chimes++);
      const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g); g.connect(master); g.connect(echo); o.start(t); o.stop(t + 1.7);
    },
    setPresence(people) {
      presence = Math.min(4, people || 0);
      if (voice && ac) voice.out.gain.linearRampToValueAtTime(0.22 + presence * 0.08, ac.currentTime + 1.5);
    },
    setVolume(v) { volume = Math.min(1, Math.max(0, v)); if (master) master.gain.linearRampToValueAtTime(volume, ac.currentTime + 0.2); },
  };
}
