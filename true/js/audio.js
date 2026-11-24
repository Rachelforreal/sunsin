// VICE SUN '86 - 100% Procedural Web Audio Engine (Zero Audio Files)
window.VS = window.VS || {};

VS.Audio = class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.unlocked = false;

    // Continuous nodes
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineGain = null;

    this.skidGain = null;
    this.skidFilter = null;

    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;

    this.noiseBuffer = null;

    // Procedural 80s Synthwave Radio
    this.stations = ['FLASH FM \'86', 'WAVE 103', 'RADIO OFF'];
    this.stationIdx = 0;
    this.radioStep = 0;
    this.radioTimer = 0;
    this.radioActive = false;
  }

  unlock() {
    if (this.unlocked) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.master.connect(this.ctx.destination);

      // Build reusable white noise buffer (2 seconds)
      const len = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this._initEngine();
      this._initSkid();
      this._initSiren();
      this.unlocked = true;
    } catch (e) {
      // Safe fallback if browser blocks Web Audio in headless contexts
    }
  }

  _initEngine() {
    const ctx = this.ctx;
    this.engineOsc1 = ctx.createOscillator();
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';
    this.engineOsc1.frequency.value = 55;
    this.engineOsc2.frequency.value = 110;

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 280;
    this.engineFilter.Q.value = 2.8;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0001;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);

    this.engineOsc1.start();
    this.engineOsc2.start();
  }

  _initSkid() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    this.skidFilter = ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 1650;
    this.skidFilter.Q.value = 8.5;

    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0.0001;

    src.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.master);
    src.start();
  }

  _initSiren() {
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'sawtooth';
    this.sirenOsc.frequency.value = 660;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 2.0;

    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0.0001;

    this.sirenOsc.connect(filter);
    filter.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.ctx.currentTime, 0.03);
    }
    return this.muted;
  }

  cycleStation() {
    this.stationIdx = (this.stationIdx + 1) % this.stations.length;
    this.playClick();
    return this.stations[this.stationIdx];
  }

  getStationName() {
    return this.stations[this.stationIdx];
  }

  updateContinuous(dt, { inVehicle, rpmNorm, throttle, baseHz, skidIntensity, sirenProximity, sirenManual }) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;

    // Engine audio
    if (inVehicle) {
      const hz = (baseHz || 58) * (0.75 + rpmNorm * 2.55);
      this.engineOsc1.frequency.setTargetAtTime(hz, t, 0.035);
      this.engineOsc2.frequency.setTargetAtTime(hz * 2.01, t, 0.035);
      this.engineFilter.frequency.setTargetAtTime(220 + rpmNorm * 950 + (throttle > 0.1 ? 260 : 0), t, 0.04);
      const targetVol = 0.11 + rpmNorm * 0.1 + (throttle > 0.1 ? 0.06 : 0);
      this.engineGain.gain.setTargetAtTime(targetVol, t, 0.05);
    } else {
      this.engineGain.gain.setTargetAtTime(0.0001, t, 0.08);
    }

    // Tire skid screech
    const sVal = inVehicle ? VS.clamp(skidIntensity, 0, 1) : 0;
    this.skidGain.gain.setTargetAtTime(sVal > 0.06 ? sVal * 0.22 : 0.0001, t, 0.03);
    this.skidFilter.frequency.setTargetAtTime(1450 + sVal * 520, t, 0.05);

    // Police siren (either nearby chasing cruiser or player driving police car with siren on)
    const sProx = Math.max(sirenProximity || 0, sirenManual ? 0.72 : 0);
    if (sProx > 0.02) {
      this.sirenPhase += dt * (sirenManual ? 2.6 : 1.75);
      const sweep = 0.5 + 0.5 * Math.sin(this.sirenPhase * Math.PI);
      const freq = 620 + sweep * 680;
      this.sirenOsc.frequency.setTargetAtTime(freq, t, 0.02);
      this.sirenGain.gain.setTargetAtTime(sProx * 0.14, t, 0.06);
    } else {
      this.sirenGain.gain.setTargetAtTime(0.0001, t, 0.08);
    }

    // Procedural 80s Synthwave Car Radio (only plays when inside a car and radio != OFF)
    this.radioActive = inVehicle && this.stationIdx < 2;
    if (this.radioActive && !this.muted) {
      const bpm = this.stationIdx === 0 ? 116 : 104;
      const stepDur = 60 / bpm / 4; // 16th note
      this.radioTimer += dt;
      if (this.radioTimer >= stepDur) {
        this.radioTimer -= stepDur;
        this._playRadioStep(this.radioStep, this.stationIdx);
        this.radioStep = (this.radioStep + 1) % 64;
      }
    }
  }

  _playRadioStep(step, station) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Two distinct 80s synthwave progressions
    const bassProg0 = [55, 55, 55, 55, 43.65, 43.65, 49, 49]; // A1 - F1 - G1 (Outrun)
    const bassProg1 = [65.4, 65.4, 58.27, 58.27, 51.91, 51.91, 58.27, 65.4]; // C2 - Bb1 - Ab1 - Bb1 (Wave 103)
    const prog = station === 0 ? bassProg0 : bassProg1;
    const barIdx = Math.floor(step / 8);
    const rootHz = prog[barIdx % prog.length];

    // 16th-note Juno pulse bass
    if (step % 2 === 0 || (station === 0 && step % 4 === 3)) {
      const osc = ctx.createOscillator();
      const flt = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(step % 4 === 2 ? rootHz * 2 : rootHz, t);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(750, t);
      flt.frequency.exponentialRampToValueAtTime(160, t + 0.12);
      g.gain.setValueAtTime(0.085, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(flt); flt.connect(g); g.connect(this.master);
      osc.start(t); osc.stop(t + 0.14);
    }

    // Four-on-the-floor kick
    if (step % 4 === 0) {
      const k = ctx.createOscillator();
      const kg = ctx.createGain();
      k.type = 'sine';
      k.frequency.setValueAtTime(130, t);
      k.frequency.exponentialRampToValueAtTime(36, t + 0.11);
      kg.gain.setValueAtTime(0.14, t);
      kg.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      k.connect(kg); kg.connect(this.master);
      k.start(t); k.stop(t + 0.13);
    }

    // 80s gated snare on beats 2 & 4
    if (step % 8 === 4) {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuffer;
      const flt = ctx.createBiquadFilter();
      flt.type = 'highpass';
      flt.frequency.value = 900;
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.075, t);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      s.connect(flt); flt.connect(sg); sg.connect(this.master);
      s.start(t); s.stop(t + 0.15);
    }

    // Shimmering synth lead arp on sparse steps
    const arpPattern = station === 0 ? [4, 5, 6, 8, 6, 5, 4, 3] : [4, 6, 7, 6, 5, 4, 3, 5];
    if (step % 4 === 0 && (step % 16 !== 12)) {
      const mult = arpPattern[(step / 4) % arpPattern.length];
      const lead = ctx.createOscillator();
      const lg = ctx.createGain();
      lead.type = station === 0 ? 'square' : 'triangle';
      lead.frequency.setValueAtTime(rootHz * mult, t);
      lg.gain.setValueAtTime(0.032, t);
      lg.gain.exponentialRampToValueAtTime(0.0008, t + 0.24);
      lead.connect(lg); lg.connect(this.master);
      lead.start(t); lead.stop(t + 0.26);
    }
  }

  // One-shot SFX
  playGearShift(hasTurbo) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    // Exhaust pop
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.08);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.1);

    if (hasTurbo) {
      // Turbo blowoff chirp
      const n = this.ctx.createBufferSource();
      n.buffer = this.noiseBuffer;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(3400, t);
      flt.frequency.exponentialRampToValueAtTime(1500, t + 0.16);
      flt.Q.value = 6;
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.11, t);
      ng.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      n.connect(flt); flt.connect(ng); ng.connect(this.master);
      n.start(t); n.stop(t + 0.19);
    }
  }

  playCrash(intensity = 0.7) {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const vol = VS.clamp(intensity, 0.15, 1.0);

    // Sub thud
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140 * vol + 50, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.22);
    g.gain.setValueAtTime(0.32 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.connect(g); g.connect(this.master);
    osc.start(t); osc.stop(t + 0.27);

    // Metallic crunch noise
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.setValueAtTime(950 + vol * 900, t);
    flt.Q.value = 1.4;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.35 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.28 * vol + 0.08);
    n.connect(flt); flt.connect(ng); ng.connect(this.master);
    n.start(t); n.stop(t + 0.4);
  }

  playExplosion() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(700, t);
    flt.frequency.exponentialRampToValueAtTime(60, t + 1.0);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.6, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    n.connect(flt); flt.connect(ng); ng.connect(this.master);
    n.start(t); n.stop(t + 1.15);
  }

  playPunch(hit = true) {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (hit) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(190, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.11);
      g.gain.setValueAtTime(0.32, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.13);
    }
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const flt = ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = hit ? 1100 : 650;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(hit ? 0.2 : 0.1, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    n.connect(flt); flt.connect(ng); ng.connect(this.master);
    n.start(t); n.stop(t + 0.09);
  }

  playGunshot(isSMG = false) {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = this.noiseBuffer;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(isSMG ? 2400 : 1800, t);
    flt.frequency.exponentialRampToValueAtTime(220, t + (isSMG ? 0.08 : 0.15));
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(isSMG ? 0.24 : 0.34, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + (isSMG ? 0.09 : 0.16));
    n.connect(flt); flt.connect(ng); ng.connect(this.master);
    n.start(t); n.stop(t + 0.17);

    const o = ctx.createOscillator();
    const og = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(isSMG ? 210 : 165, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.07);
    og.gain.setValueAtTime(0.24, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    o.connect(og); og.connect(this.master);
    o.start(t); o.stop(t + 0.09);
  }

  playCarEnter() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Door thunk + starter crank
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(125, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.1);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.12);

    const rev = ctx.createOscillator();
    const rg = ctx.createGain();
    rev.type = 'sawtooth';
    rev.frequency.setValueAtTime(60, t + 0.1);
    rev.frequency.linearRampToValueAtTime(165, t + 0.32);
    rev.frequency.linearRampToValueAtTime(80, t + 0.48);
    rg.gain.setValueAtTime(0.001, t + 0.09);
    rg.gain.linearRampToValueAtTime(0.14, t + 0.22);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    rev.connect(rg); rg.connect(this.master);
    rev.start(t + 0.09); rev.stop(t + 0.52);
  }

  playHorn() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [392, 493.88].forEach((freq) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 1300;
      g.gain.setValueAtTime(0.11, t);
      g.gain.setValueAtTime(0.11, t + 0.2);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(flt); flt.connect(g); g.connect(this.master);
      o.start(t); o.stop(t + 0.3);
    });
  }

  playCash() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [880, 1174.66, 1567.98].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.14, t + i * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.055 + 0.16);
      o.connect(g); g.connect(this.master);
      o.start(t + i * 0.055); o.stop(t + i * 0.055 + 0.18);
    });
  }

  playMissionComplete() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const flt = ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 2200;
      g.gain.setValueAtTime(0.14, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.09 + 0.36);
      o.connect(flt); flt.connect(g); g.connect(this.master);
      o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.38);
    });
  }

  playWantedUp() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    [440, 622.25].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.12, t + i * 0.11);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.11 + 0.15);
      o.connect(g); g.connect(this.master);
      o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.16);
    });
  }

  playClick() {
    if (!this.unlocked || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 720;
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.06);
  }
};
