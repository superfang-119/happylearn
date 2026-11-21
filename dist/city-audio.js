/* Original eight-bar radio loops and a live, speed-controlled engine. */
(() => {
  'use strict';

  const stations = {
    wave: {
      label: '霓虹夜航', bpm: 108, swing: 0,
      roots: [50, 46, 53, 48, 50, 46, 48, 45],
      chords: [[0, 3, 7, 10], [0, 4, 7, 11], [0, 4, 7, 9], [0, 4, 7, 10],
               [0, 3, 7, 10], [0, 4, 7, 11], [0, 4, 7, 10], [0, 4, 7, 10]],
      motif: [0, null, 2, 3, 1, 2, null, 3],
    },
    coast: {
      label: '海岸慢游', bpm: 88, swing: 0.12,
      roots: [53, 53, 50, 55, 48, 50, 55, 48],
      chords: [[0, 4, 7, 11], [0, 4, 7, 9], [0, 3, 7, 10], [0, 3, 7, 10],
               [0, 4, 7, 10], [0, 3, 7, 10], [0, 3, 7, 10], [0, 4, 7, 10]],
      motif: [2, null, 1, null, null, 0, 3, null],
    },
  };

  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  let context = null;
  let bus = null;
  let noise = null;
  let station = 'off';
  let paused = false;
  let timer = null;
  let step = 0;
  let nextBeat = 0;
  let generation = 0;
  let suspendTimer = null;
  let starting = false;
  let gestureSeen = false;
  let motor = null;
  let driving = false;
  let speedKmh = 0;
  const voices = new Set();

  function refreshControls() {
    document.querySelectorAll('select[data-city-radio]').forEach(select => {
      select.value = station;
    });
  }

  function createMotor() {
    const hum = context.createOscillator();
    const buzz = context.createOscillator();
    const filter = context.createBiquadFilter();
    const volume = context.createGain();
    hum.type = 'triangle';
    buzz.type = 'sawtooth';
    filter.type = 'lowpass';
    filter.frequency.value = 210;
    volume.gain.value = 0;
    hum.connect(filter);
    buzz.connect(filter);
    filter.connect(volume);
    volume.connect(context.destination);
    hum.start();
    buzz.start();
    return {hum, buzz, filter, volume, audible: false};
  }

  function updateMotor() {
    if (!motor) return;
    const now = context.currentTime;
    const audible = Boolean(bus && driving && !paused && !document.hidden && station !== 'off');
    if (!audible && !motor.audible) return;
    const speed = Math.min(speedKmh / 65, 1);
    const fundamental = 42 + speed * 76;
    if (audible) {
      motor.hum.frequency.setTargetAtTime(fundamental, now, 0.09);
      motor.buzz.frequency.setTargetAtTime(fundamental * 1.997, now, 0.095);
      motor.filter.frequency.setTargetAtTime(180 + speed * 500, now, 0.12);
    }
    const gain = motor.volume.gain;
    if (gain.cancelAndHoldAtTime) gain.cancelAndHoldAtTime(now);
    else {
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(gain.value, now);
    }
    gain.linearRampToValueAtTime(audible ? 0.018 + speed * 0.035 : 0, now + (audible ? 0.09 : 0.024));
    motor.audible = audible;
  }

  function setDrive(isDriving, kmh) {
    const value = Number(kmh);
    const next = isDriving && Number.isFinite(value) ? Math.round(Math.abs(value)) : 0;
    if (Boolean(isDriving) === driving && next === speedKmh) return;
    driving = Boolean(isDriving);
    speedKmh = next;
    updateMotor();
  }

  function stopSound() {
    ++generation;
    starting = false;
    clearTimeout(suspendTimer);
    suspendTimer = null;
    clearInterval(timer);
    timer = null;
    if (!context) return;
    // Disconnect queued notes as well as audible notes before a rapid station change.
    for (const source of voices) {
      try { source.disconnect(); source.stop(); } catch (_) { /* Already finished. */ }
    }
    voices.clear();
    if (bus) bus.disconnect();
    bus = null;
    updateMotor();
  }

  function makeNoise() {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.24), context.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 1867;
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      samples[i] = (seed / 2147483648) - 1;
    }
    return buffer;
  }

  function voice(source, start, length, volume, attack, filter) {
    if (!bus) return;
    const env = context.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(volume, start + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, start + length);
    if (filter) {
      source.connect(filter);
      filter.connect(env);
    } else {
      source.connect(env);
    }
    env.connect(bus);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      if (filter) filter.disconnect();
      env.disconnect();
    };
    source.start(start);
    source.stop(start + length + 0.01);
  }

  function tone(midi, time, length, volume, type = 'triangle', cutoff = 0) {
    const source = context.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(440 * 2 ** ((midi - 69) / 12), time);
    let filter;
    if (cutoff) {
      filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
    }
    voice(source, time, length, volume, 0.012, filter);
  }

  function percussion(kind, time) {
    if (kind === 'kick') {
      const drum = context.createOscillator();
      drum.frequency.setValueAtTime(114, time);
      drum.frequency.exponentialRampToValueAtTime(44, time + 0.13);
      voice(drum, time, 0.18, 0.23, 0.004);
      return;
    }
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    const hat = kind === 'hat';
    filter.type = hat ? 'highpass' : 'bandpass';
    filter.frequency.value = hat ? 6300 : 1750;
    voice(source, time, hat ? 0.044 : 0.105, hat ? 0.055 : 0.12, 0.003, filter);
  }

  function playStep(index, at, duration) {
    const track = stations[station];
    const bar = Math.floor(index / 8) % 8;
    const eighth = index % 8;
    const root = track.roots[bar];
    const chord = track.chords[bar];
    const time = at + (eighth % 2 ? duration * track.swing : 0);
    const bright = station === 'wave';
    if (eighth === 0 || eighth === 4 || (!bright && eighth === 7 && bar % 2))
      percussion('kick', time);
    if (eighth === 2 || eighth === 6) percussion('snare', time);
    if (eighth % 2) percussion('hat', time);
    if (bright ? eighth % 2 === 0 : [0, 3, 4, 7].includes(eighth)) {
      const walk = eighth === 7 ? -2 : eighth === 4 ? 7 : 0;
      tone(root - 12 + walk, time, duration * 1.45, 0.18, 'triangle');
    }
    if (bright ? eighth === 0 : eighth === 1 || eighth === 5) {
      chord.forEach(interval => tone(root + interval + 12, time,
        bright ? duration * 4.2 : duration * 1.15, bright ? 0.033 : 0.055,
        bright ? 'sawtooth' : 'triangle', bright ? 1050 : 2100));
    }
    const note = track.motif[(eighth + (bar % 2 ? 2 : 0)) % 8];
    if (note !== null)
      tone(root + chord[note] + (bright ? 24 : 12), time + 0.014,
        duration * 1.6, bright ? 0.074 : 0.07, bright ? 'triangle' : 'sine');
  }

  function schedule() {
    if (!bus || !stations[station]) return;
    const now = context.currentTime;
    const duration = 30 / stations[station].bpm;
    if (nextBeat < now) nextBeat = now + 0.02;
    while (nextBeat < now + 0.16) {
      playStep(step, nextBeat, duration);
      step = (step + 1) % 64;
      nextBeat += duration;
    }
  }

  function visibilityChanged() {
    updatePlayback(false);
  }

  function updatePlayback(allowCreation) {
    stopSound();
    if (!context) {
      // No audio graph is created on animation frames or automatic page updates.
      if (!allowCreation || !AudioEngine || station === 'off') return;
      try {
        context = new AudioEngine();
        noise = makeNoise();
        document.addEventListener('visibilitychange', visibilityChanged);
      } catch (_) {
        if (context) context.close().catch(() => {});
        context = null;
        station = 'off';
        refreshControls();
        return;
      }
    }
    if (station === 'off' || paused || document.hidden) {
      if (context.state === 'running') {
        const current = generation;
        suspendTimer = setTimeout(() => {
          if (current === generation && context) context.suspend().catch(() => {});
        }, 48);
      }
      return;
    }
    const current = generation;
    starting = true;
    context.resume().then(() => {
      if (current !== generation) return;
      starting = false;
      if (!context || context.state !== 'running') return;
      bus = context.createGain();
      bus.gain.value = 0.42;
      bus.connect(context.destination);
      if (!motor) motor = createMotor();
      updateMotor();
      if (stations[station]) {
        nextBeat = context.currentTime + 0.045;
        schedule();
        timer = setInterval(schedule, 65);
      }
    }).catch(() => {
      if (current !== generation) return;
      starting = false;
      station = 'off';
      refreshControls();
    });
  }

  function setStation(name) {
    if (name !== 'off' && name !== 'motor' && !Object.hasOwn(stations, name)) return;
    station = AudioEngine ? name : 'off';
    step = 0;
    refreshControls();
    const activation = window.navigator?.userActivation;
    if (!activation || activation.isActive) gestureSeen = true;
    updatePlayback(gestureSeen);
  }

  function unlock() {
    const activation = window.navigator?.userActivation;
    if (activation && !activation.isActive && !gestureSeen) return;
    gestureSeen = true;
    if (station !== 'off' && !paused && !document.hidden && !bus && !starting)
      updatePlayback(true);
  }

  function setPaused(value) {
    if (paused === Boolean(value)) return;
    paused = Boolean(value);
    updatePlayback(false);
  }

  function cue(action) {
    if (!bus || paused || document.hidden || !stations[station]) return;
    const notes = {pickup: [76, 83], complete: [72, 76, 79, 84], wrong: [62, 65]}[action];
    if (!Array.isArray(notes)) return;
    const now = context.currentTime + 0.01;
    notes.forEach((midi, i) => tone(midi, now + i * 0.084, 0.21,
      action === 'wrong' ? 0.11 : 0.17, 'sine'));
  }

  function dispose() {
    station = 'off';
    paused = false;
    step = 0;
    stopSound();
    if (motor) {
      motor.hum.stop();
      motor.buzz.stop();
      [motor.hum, motor.buzz, motor.filter, motor.volume].forEach(node => node.disconnect());
      motor = null;
    }
    driving = false;
    speedKmh = 0;
    gestureSeen = false;
    document.removeEventListener('visibilitychange', visibilityChanged);
    if (context) context.close().catch(() => {});
    context = null;
    noise = null;
    refreshControls();
  }

  window.CityAudio = {setStation, setPaused, setDrive, unlock, cue, dispose};
})();
