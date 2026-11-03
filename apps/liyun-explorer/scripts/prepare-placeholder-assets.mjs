import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

// Local transcode only. This command never calls a generation service or changes the original PNGs.
const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proof = path.resolve(app, '../../qa/ui-implementation-20261103/assets');
const ids = ['wencui', 'beihu', 'library', 'teaching', 'wenbo', 'sports', 'tower', 'park'];
const records = [];
for (const id of ids) {
  const receiptPath = path.join(proof, `${id}.json`);
  const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8').replace(/^\uFEFF/, ''));
  const original = fs.readFileSync(receipt.source);
  if (original.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`Not a PNG: ${id}`);
  const nativePixels = [original.readUInt32BE(16), original.readUInt32BE(20)];
  const destination = path.join(app, 'public/assets/landmarks', id, 'hero.webp');
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', receipt.source,
    '-vf', 'scale=768:432:force_original_aspect_ratio=increase,crop=768:432',
    '-c:v', 'libwebp', '-quality', '74', '-frames:v', '1', '-y', destination], { stdio: 'pipe' });
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', destination], { encoding: 'utf8' }));
  const deliveredPixels = [probe.streams[0].width, probe.streams[0].height];
  if (deliveredPixels[0] !== 768 || deliveredPixels[1] !== 432) throw new Error(`Unexpected delivery size: ${id}`);
  const bytes = fs.readFileSync(destination);
  const updated = { ...receipt, nativePixels, deliveredPixels, encoding: 'WebP quality 74; local distribution derivative',
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    visualReview: 'Native output inspected; concept placeholder, not a factual campus photograph.' };
  fs.writeFileSync(receiptPath, JSON.stringify(updated, null, 2) + '\n');
  records.push(updated);
}
const cloud = path.join(app, 'public/assets/regions/ink-cloud.webp');
const cloudBytes = fs.readFileSync(cloud);
const cloudProbe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'json', cloud], { encoding: 'utf8' }));
const cloudSource = 'C:/Users/12929/.codex/generated_images/01a19cdf-88b3-7880-b645-ca87f10dbd3b/exec-47063519-cafa-4716-af7d-b75ef7c2cd81.png';
const cloudOriginal = fs.readFileSync(cloudSource);
records.push({ id: 'ink-cloud', tool: 'built-in ImageGen', usage: 'Opaque rice-paper cloud texture; no GPS or map content',
  source: cloudSource,
  requestedPixels: '2048x2048 in prompt', nativePixels: [cloudOriginal.readUInt32BE(16), cloudOriginal.readUInt32BE(20)],
  deliveredPixels: [cloudProbe.streams[0].width, cloudProbe.streams[0].height],
  encoding: 'WebP quality 84; local distribution derivative', bytes: cloudBytes.length,
  sha256: createHash('sha256').update(cloudBytes).digest('hex'), visualReview: 'Inspected; opaque ivory cloud fill with subtle jade edges.' });
fs.writeFileSync(path.join(proof, 'index.json'), JSON.stringify({ generatedCount: 9, records, totalDeliveredBytes: records.reduce((n, r) => n + r.bytes, 0) }, null, 2) + '\n');
console.log(JSON.stringify({ generatedCount: 9, totalDeliveredBytes: records.reduce((n, r) => n + r.bytes, 0), landmarks: records.slice(0, 8).map(r => ({ id: r.id, nativePixels: r.nativePixels, deliveredPixels: r.deliveredPixels, bytes: r.bytes })) }, null, 2));
