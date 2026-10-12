import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function findFFmpeg() {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch (error) {
    console.log('FFmpeg not found, attempting install via winget...');
    try {
      execSync('winget install --id Gyan.Dev.FFmpeg -e --accept-package-agreements', { stdio: 'inherit' });
      return 'ffmpeg';
    } catch (e) {
      console.error('Failed to install FFmpeg');
      return null;
    }
  }
}

export function findWhisper() {
  try {
    execSync('whisper --version', { stdio: 'ignore' });
    return 'whisper';
  } catch (error) {
    console.log('Whisper not found');
    return null;
  }
}

export async function runFFmpegCommand(args) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args, { stdio: 'pipe' });
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg failed with code ${code}`));
    });
    ffmpeg.on('error', reject);
  });
}

export async function roughCut(inputPath, outputDir) {
  const output = path.join(outputDir, 'rough.mp4');
  await runFFmpegCommand(['-y', '-i', inputPath, '-c:v', 'libx264', '-preset', 'fast', '-c:a', 'aac', output]);
  return output;
}

export async function extractAudio(inputPath, outputDir) {
  const output = path.join(outputDir, 'audio.wav');
  await runFFmpegCommand(['-y', '-i', inputPath, '-vn', '-acodec', 'pcm_s16le', '-ar', '16000', output]);
  return output;
}

export async function addCaptions(videoPath, srtPath, outputDir) {
  const output = path.join(outputDir, 'captioned.mp4');
  await runFFmpegCommand([
    '-y',
    '-i', videoPath,
    '-vf', `subtitles=${srtPath.replace(/\\/g, '/')}:force_style='Fontsize=24,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BackColour=&H80000000'`,
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-c:a', 'aac',
    output
  ]);
  return output;
}

export async function resizeForReels(inputPath, outputDir) {
  const output = path.join(outputDir, 'reels.mp4');
  await runFFmpegCommand([
    '-y',
    '-i', inputPath,
    '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-c:a', 'aac',
    output
  ]);
  return output;
}

export async function extractThumbnail(videoPath, outputDir) {
  const output = path.join(outputDir, 'thumb.jpg');
  await runFFmpegCommand(['-y', '-i', videoPath, '-frames:v', '1', '-q:v', '2', output]);
  return output;
}

export async function generateSRT(transcript, outputPath) {
  const srt = `1
00:00:00,000 --> 00:00:05,000
${transcript.substring(0, 100)}

2
00:00:05,000 --> 00:00:10,000
${transcript.substring(100, 200)}
`;
  fs.writeFileSync(outputPath, srt, 'utf-8');
  return outputPath;
}
