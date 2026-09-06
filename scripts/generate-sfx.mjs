import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const SAMPLE_RATE = 44_100;
const outputDirectory = resolve('public/assets/audio/sfx');

function envelope(time, duration, attack = 0.008, release = 0.08) {
  return Math.min(1, time / attack, (duration - time) / release);
}

function writeWav(name, duration, sampleAt) {
  const sampleCount = Math.floor(SAMPLE_RATE * duration);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const sample = Math.max(-1, Math.min(1, sampleAt(time, duration)));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  const target = resolve(outputDirectory, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buffer);
}

writeWav('ui-click.wav', 0.09, (time, duration) =>
  Math.sin(2 * Math.PI * (680 - time * 1900) * time) * envelope(time, duration, 0.002, 0.055) * 0.32);

writeWav('coin.wav', 0.34, (time, duration) => {
  const tone = Math.sin(2 * Math.PI * 1180 * time) + 0.55 * Math.sin(2 * Math.PI * 1770 * time);
  return tone * envelope(time, duration, 0.003, 0.27) * 0.27;
});

writeWav('reject.wav', 0.22, (time, duration) => {
  const frequency = 260 - time * 430;
  return Math.sin(2 * Math.PI * frequency * time) * envelope(time, duration, 0.004, 0.14) * 0.3;
});
