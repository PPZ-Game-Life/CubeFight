import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const rootDir = fileURLToPath(new URL('..', import.meta.url));
const outputDir = join(rootDir, 'public', 'audio', 'generated');

mkdirSync(outputDir, { recursive: true });

const noteIndex = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

function freq(note) {
  const match = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
  if (!match) {
    throw new Error(`Invalid note: ${note}`);
  }
  const [, pitch, octaveText] = match;
  const octave = Number(octaveText);
  const midi = noteIndex[pitch] + (octave + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makeBuffer(durationSeconds, sampleRate) {
  return new Float32Array(Math.ceil(durationSeconds * sampleRate));
}

function envelope(position, duration, attack = 0.004, decay = 0.08, sustain = 0.65, release = 0.05) {
  if (position < 0 || position >= duration) {
    return 0;
  }
  if (position < attack) {
    return position / attack;
  }
  const decayEnd = attack + decay;
  if (position < decayEnd) {
    const progress = (position - attack) / decay;
    return 1 - (1 - sustain) * progress;
  }
  const releaseStart = Math.max(decayEnd, duration - release);
  if (position < releaseStart) {
    return sustain;
  }
  const releaseProgress = (position - releaseStart) / Math.max(release, 0.0001);
  return sustain * (1 - releaseProgress);
}

function oscillator(type, phase, duty = 0.5) {
  const normalized = phase - Math.floor(phase);
  if (type === 'pulse') {
    return normalized < duty ? 1 : -1;
  }
  if (type === 'square') {
    return normalized < 0.5 ? 1 : -1;
  }
  if (type === 'triangle') {
    return 1 - 4 * Math.abs(normalized - 0.5);
  }
  if (type === 'saw') {
    return 2 * normalized - 1;
  }
  return 0;
}

function addTone(buffer, sampleRate, options) {
  const {
    start,
    duration,
    fromFrequency,
    toFrequency = fromFrequency,
    gain = 0.5,
    type = 'square',
    duty = 0.5,
    attack = 0.003,
    decay = 0.05,
    sustain = 0.7,
    release = 0.04,
    vibratoDepth = 0,
    vibratoRate = 5,
  } = options;

  const startIndex = Math.floor(start * sampleRate);
  const totalSamples = Math.floor(duration * sampleRate);
  let phase = 0;

  for (let index = 0; index < totalSamples; index += 1) {
    const bufferIndex = startIndex + index;
    if (bufferIndex < 0 || bufferIndex >= buffer.length) {
      continue;
    }
    const time = index / sampleRate;
    const progress = duration <= 0 ? 0 : time / duration;
    const glideFrequency = fromFrequency + (toFrequency - fromFrequency) * progress;
    const vibrato = vibratoDepth === 0 ? 0 : Math.sin(2 * Math.PI * vibratoRate * time) * vibratoDepth;
    const currentFrequency = Math.max(20, glideFrequency + vibrato);
    phase += currentFrequency / sampleRate;
    const amp = envelope(time, duration, attack, decay, sustain, release);
    buffer[bufferIndex] += oscillator(type, phase, duty) * gain * amp;
  }
}

function addNoise(buffer, sampleRate, options) {
  const {
    start,
    duration,
    gain = 0.35,
    attack = 0.001,
    decay = 0.03,
    sustain = 0.2,
    release = 0.02,
    color = 'white',
    highPass = 0,
  } = options;

  const startIndex = Math.floor(start * sampleRate);
  const totalSamples = Math.floor(duration * sampleRate);
  let previous = 0;

  for (let index = 0; index < totalSamples; index += 1) {
    const bufferIndex = startIndex + index;
    if (bufferIndex < 0 || bufferIndex >= buffer.length) {
      continue;
    }
    const time = index / sampleRate;
    const amp = envelope(time, duration, attack, decay, sustain, release);
    const randomValue = Math.random() * 2 - 1;
    let sample = randomValue;
    if (color === 'pink') {
      sample = previous * 0.82 + randomValue * 0.18;
      previous = sample;
    }
    if (highPass > 0) {
      sample -= previous * highPass;
      previous = randomValue;
    }
    buffer[bufferIndex] += sample * gain * amp;
  }
}

function lowPass(buffer, sampleRate, cutoffHz) {
  const output = new Float32Array(buffer.length);
  const alpha = cutoffHz <= 0 ? 1 : (2 * Math.PI * cutoffHz) / (2 * Math.PI * cutoffHz + sampleRate);
  let previous = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    previous += alpha * (buffer[index] - previous);
    output[index] = previous;
  }
  return output;
}

function normalize(buffer, peak = 0.92) {
  let maxAbs = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    maxAbs = Math.max(maxAbs, Math.abs(buffer[index]));
  }
  if (maxAbs === 0) {
    return buffer;
  }
  const scale = peak / maxAbs;
  for (let index = 0; index < buffer.length; index += 1) {
    buffer[index] *= scale;
  }
  return buffer;
}

function writeWav8BitMono(filePath, sampleRate, buffer) {
  const normalized = normalize(buffer);
  const dataSize = normalized.length;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < normalized.length; index += 1) {
    const sample = clamp(Math.round((normalized[index] * 0.5 + 0.5) * 255), 0, 255);
    wav.writeUInt8(sample, 44 + index);
  }

  writeFileSync(filePath, wav);
}

function writeJson(filePath, data) {
  writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function buildMainMenuBgm() {
  const sampleRate = 16000;
  const bpm = 124;
  const beatsPerBar = 4;
  const barCount = 16;
  const beat = 60 / bpm;
  const sixteenth = beat / 4;
  const duration = barCount * beatsPerBar * beat;
  const buffer = makeBuffer(duration, sampleRate);
  const roots = ['E2', 'E2', 'C2', 'D2'];
  const leadPhrase = ['E4', 'G4', 'B4', 'A4', 'G4', 'E4', 'D4', 'B3'];

  for (let bar = 0; bar < barCount; bar += 1) {
    const rootFreq = freq(roots[bar % roots.length]);
    const barStart = bar * beatsPerBar * beat;

    for (let step = 0; step < 16; step += 1) {
      const start = barStart + step * sixteenth;
      const durationStep = sixteenth * 0.92;
      const pattern = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0][step];
      if (pattern === 1) {
        const bassFrequency = step % 8 >= 6 ? rootFreq * 1.5 : rootFreq;
        addTone(buffer, sampleRate, {
          start,
          duration: durationStep,
          fromFrequency: bassFrequency,
          gain: 0.23,
          type: 'triangle',
          attack: 0.002,
          decay: 0.03,
          sustain: 0.5,
          release: 0.04,
        });
      }
    }

    for (let index = 0; index < leadPhrase.length; index += 1) {
      const start = barStart + index * (beat * 0.5);
      const note = leadPhrase[(index + bar) % leadPhrase.length];
      const gain = index % 4 === 0 ? 0.13 : 0.1;
      addTone(buffer, sampleRate, {
        start,
        duration: beat * 0.32,
        fromFrequency: freq(note),
        gain,
        type: 'square',
        attack: 0.001,
        decay: 0.028,
        sustain: 0.28,
        release: 0.025,
        vibratoDepth: 0.5,
        vibratoRate: 5,
      });
    }

    for (let pulse = 0; pulse < 4; pulse += 1) {
      const arpeggioStart = barStart + pulse * beat;
      const pulseDuration = beat * 0.52;
      for (let sub = 0; sub < 2; sub += 1) {
        const semitone = [0, 7, 12, 7][(pulse + sub) % 4];
        addTone(buffer, sampleRate, {
          start: arpeggioStart + sub * (pulseDuration / 2),
          duration: pulseDuration / 2,
          fromFrequency: rootFreq * 2 ** (semitone / 12),
          gain: 0.06,
          type: 'pulse',
          duty: 0.25,
          attack: 0.001,
          decay: 0.02,
          sustain: 0.2,
          release: 0.02,
          vibratoDepth: 0.2,
          vibratoRate: 5,
        });
      }
    }
  }

  return { sampleRate, buffer: lowPass(buffer, sampleRate, 5200) };
}

function buildInGameBaseBgm() {
  const sampleRate = 16000;
  const bpm = 132;
  const beatsPerBar = 4;
  const barCount = 16;
  const beat = 60 / bpm;
  const sixteenth = beat / 4;
  const duration = barCount * beatsPerBar * beat;
  const buffer = makeBuffer(duration, sampleRate);
  const roots = ['E2', 'E2', 'C2', 'D2'];
  const kickPattern = [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0];
  const snarePattern = [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0];

  for (let bar = 0; bar < barCount; bar += 1) {
    const rootFreq = freq(roots[bar % roots.length]);
    const barStart = bar * beatsPerBar * beat;
    for (let step = 0; step < 16; step += 1) {
      const start = barStart + step * sixteenth;
      const bassFrequency = step % 4 === 3 ? rootFreq * 1.5 : rootFreq;
      addTone(buffer, sampleRate, {
        start,
        duration: sixteenth * 0.9,
        fromFrequency: bassFrequency,
        gain: 0.27,
        type: 'triangle',
        attack: 0.001,
        decay: 0.025,
        sustain: 0.48,
        release: 0.025,
      });

      if (kickPattern[step] === 1) {
        addNoise(buffer, sampleRate, {
          start,
          duration: 0.06,
          gain: 0.24,
          attack: 0.001,
          decay: 0.02,
          sustain: 0.15,
          release: 0.02,
          color: 'pink',
        });
        addTone(buffer, sampleRate, {
          start,
          duration: 0.07,
          fromFrequency: 130,
          toFrequency: 58,
          gain: 0.17,
          type: 'triangle',
          attack: 0.001,
          decay: 0.02,
          sustain: 0.2,
          release: 0.02,
        });
      }

      if (snarePattern[step] === 1) {
        addNoise(buffer, sampleRate, {
          start,
          duration: 0.08,
          gain: 0.28,
          attack: 0.001,
          decay: 0.025,
          sustain: 0.1,
          release: 0.03,
          highPass: 0.4,
        });
      }
    }
  }

  return { sampleRate, buffer: lowPass(buffer, sampleRate, 5000) };
}

function buildInGameMelodyLayer() {
  const sampleRate = 16000;
  const bpm = 132;
  const beatsPerBar = 4;
  const barCount = 16;
  const beat = 60 / bpm;
  const duration = barCount * beatsPerBar * beat;
  const buffer = makeBuffer(duration, sampleRate);
  const phrase = ['E4', 'G4', 'B4', 'A4', 'G4', 'E4', 'D4', 'B3'];

  for (let bar = 0; bar < barCount; bar += 1) {
    const barStart = bar * beatsPerBar * beat;
    for (let index = 0; index < phrase.length; index += 1) {
      const start = barStart + index * (beat * 0.5);
      const note = phrase[(index + bar) % phrase.length];
      addTone(buffer, sampleRate, {
        start,
        duration: beat * 0.34,
        fromFrequency: freq(note),
        gain: 0.17,
        type: 'square',
        attack: 0.001,
        decay: 0.03,
        sustain: 0.35,
        release: 0.03,
        vibratoDepth: 1.2,
        vibratoRate: 6,
      });
    }
  }

  return { sampleRate, buffer: lowPass(buffer, sampleRate, 6200) };
}

function buildSfxSprite() {
  const sampleRate = 11025;
  const cues = [];
  const fragments = [];
  let cursor = 0;

  function pushCue(name, duration, renderer) {
    const padding = 0.02;
    const buffer = makeBuffer(duration, sampleRate);
    renderer(buffer, sampleRate, duration);
    fragments.push({ name, buffer, duration });
    cues.push({ name, start: Number(cursor.toFixed(3)), end: Number((cursor + duration).toFixed(3)) });
    cursor += duration + padding;
  }

  pushCue('hover_l1', 0.04, (buffer, sr, duration) => {
    addTone(buffer, sr, { start: 0, duration, fromFrequency: freq('C6'), gain: 0.28, type: 'triangle', decay: 0.012, sustain: 0.15, release: 0.01 });
  });
  pushCue('hover_l2', 0.04, (buffer, sr, duration) => {
    addTone(buffer, sr, { start: 0, duration, fromFrequency: freq('E6'), gain: 0.28, type: 'triangle', decay: 0.012, sustain: 0.15, release: 0.01 });
  });
  pushCue('hover_l3', 0.04, (buffer, sr, duration) => {
    addTone(buffer, sr, { start: 0, duration, fromFrequency: freq('G6'), gain: 0.28, type: 'triangle', decay: 0.012, sustain: 0.15, release: 0.01 });
  });
  pushCue('click_confirm', 0.12, (buffer, sr, duration) => {
    addTone(buffer, sr, { start: 0, duration, fromFrequency: freq('B6'), toFrequency: freq('E5'), gain: 0.34, type: 'square', decay: 0.04, sustain: 0.28, release: 0.03 });
  });
  pushCue('select_blue', 0.09, (buffer, sr, duration) => {
    addTone(buffer, sr, { start: 0, duration, fromFrequency: freq('E5'), toFrequency: freq('B5'), gain: 0.2, type: 'triangle', attack: 0.004, decay: 0.022, sustain: 0.2, release: 0.028 });
    addTone(buffer, sr, { start: 0.01, duration: duration * 0.45, fromFrequency: freq('B5'), gain: 0.045, type: 'triangle', attack: 0.002, decay: 0.014, sustain: 0.12, release: 0.018 });
  });

  for (let level = 2; level <= 9; level += 1) {
    const duration = Math.max(0.1, 0.2 - (level - 2) * 0.012);
    pushCue(`merge_lv${level}`, duration, (buffer, sr) => {
      const notes = ['C5', 'E5', 'G5', 'C6'];
      const stepDuration = duration / notes.length;
      for (let index = 0; index < notes.length; index += 1) {
        const semitoneShift = (level - 2) * 0.5;
        addTone(buffer, sr, {
          start: index * stepDuration,
          duration: stepDuration,
          fromFrequency: freq(notes[index]) * 2 ** (semitoneShift / 12),
          gain: 0.2,
          type: 'triangle',
          attack: 0.003,
          decay: 0.02,
          sustain: 0.22,
          release: 0.026,
        });

        addTone(buffer, sr, {
          start: index * stepDuration + 0.004,
          duration: stepDuration * 0.72,
          fromFrequency: freq(notes[index]) * 2 ** (semitoneShift / 12) * 2,
          gain: 0.032,
          type: 'triangle',
          attack: 0.002,
          decay: 0.014,
          sustain: 0.12,
          release: 0.018,
        });
      }
    });
  }

  pushCue('devour_red', 0.14, (buffer, sr) => {
    addNoise(buffer, sr, { start: 0, duration: 0.09, gain: 0.36, decay: 0.03, sustain: 0.12, release: 0.03, highPass: 0.3 });
    addTone(buffer, sr, { start: 0, duration: 0.13, fromFrequency: 180, toFrequency: 70, gain: 0.2, type: 'triangle', decay: 0.03, sustain: 0.15, release: 0.03 });
  });
  pushCue('devour_yellow', 0.08, (buffer, sr, duration) => {
    addTone(buffer, sr, { start: 0, duration: duration * 0.7, fromFrequency: freq('E6'), gain: 0.28, type: 'square', decay: 0.02, sustain: 0.2, release: 0.015 });
    addTone(buffer, sr, { start: 0.015, duration: duration * 0.5, fromFrequency: freq('B6'), gain: 0.18, type: 'square', decay: 0.018, sustain: 0.15, release: 0.012 });
  });
  pushCue('combo_base', 0.11, (buffer, sr, duration) => {
    addTone(buffer, sr, { start: 0, duration, fromFrequency: freq('G5'), toFrequency: freq('B5'), gain: 0.25, type: 'square', decay: 0.03, sustain: 0.25, release: 0.025 });
  });
  pushCue('combo_x5_bonus', 0.18, (buffer, sr) => {
    addTone(buffer, sr, { start: 0, duration: 0.16, fromFrequency: freq('E6'), gain: 0.16, type: 'square', decay: 0.03, sustain: 0.18, release: 0.05, vibratoDepth: 2, vibratoRate: 9 });
    addTone(buffer, sr, { start: 0.02, duration: 0.14, fromFrequency: freq('B6'), gain: 0.14, type: 'square', decay: 0.03, sustain: 0.16, release: 0.05, vibratoDepth: 2.5, vibratoRate: 11 });
  });

  const totalDuration = cursor;
  const sprite = makeBuffer(totalDuration, sampleRate);

  let writeCursor = 0;
  for (const fragment of fragments) {
    const startIndex = Math.floor(writeCursor * sampleRate);
    for (let index = 0; index < fragment.buffer.length; index += 1) {
      sprite[startIndex + index] += fragment.buffer[index];
    }
    writeCursor += fragment.duration + 0.02;
  }

  return {
    sampleRate,
    buffer: lowPass(sprite, sampleRate, 4800),
    cues,
  };
}

function generate() {
  const mainMenu = buildMainMenuBgm();
  writeWav8BitMono(join(outputDir, 'main_menu_bgm.wav'), mainMenu.sampleRate, mainMenu.buffer);

  const inGameBase = buildInGameBaseBgm();
  writeWav8BitMono(join(outputDir, 'ingame_bgm_base.wav'), inGameBase.sampleRate, inGameBase.buffer);

  const inGameMelody = buildInGameMelodyLayer();
  writeWav8BitMono(join(outputDir, 'ingame_bgm_melody.wav'), inGameMelody.sampleRate, inGameMelody.buffer);

  const sfxSprite = buildSfxSprite();
  writeWav8BitMono(join(outputDir, 'sfx_sprite.wav'), sfxSprite.sampleRate, sfxSprite.buffer);
  writeJson(join(outputDir, 'sfx_sprite.json'), {
    sampleRate: sfxSprite.sampleRate,
    sprite: Object.fromEntries(sfxSprite.cues.map(({ name, start, end }) => [name, { start, end }])),
  });
}

generate();
