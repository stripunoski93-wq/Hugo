import { v4 as uuidv4 } from 'uuid';
import { updateTaskStatus, addEvent, createTask } from './memory.js';
import { getInboxPath, createJobDir, createCapcutReadyDir, listVideoFiles } from './storage.js';
import { findFFmpeg, findWhisper, roughCut, extractAudio, addCaptions, resizeForReels, extractThumbnail, generateSRT } from './ffmpeg.js';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const MAX_PARALLEL = Number(process.env.MAX_PARALLEL || 3);
const ffmpeg = findFFmpeg();
const whisper = findWhisper();

export async function processMakeReels(broadcast) {
  const videos = listVideoFiles();
  if (!videos.length) {
    return { error: 'Нема видеа во inbox/ папката' };
  }

  const jobId = uuidv4();
  const jobName = `reels-${jobId.substring(0, 8)}`;
  const jobPath = createJobDir(jobName);
  const capcut = createCapcutReadyDir(jobPath);

  const mainTask = await createTask({
    id: jobId,
    title: `Направи reels - ${videos.length} видеа`,
    team: 'Creative',
    agent: 'Editor',
    status: 'Чека одобрување',
    progress: 0,
    payload: { type: 'make-reels', videoCount: videos.length, jobPath, capcut }
  });

  broadcast({ type: 'task_created', task: mainTask });

  const subTaskPromises = [];
  for (let i = 0; i < videos.length; i += MAX_PARALLEL) {
    const batch = videos.slice(i, i + MAX_PARALLEL);
    for (const videoPath of batch) {
      subTaskPromises.push(
        processVideoClip(videoPath, jobId, jobPath, capcut, broadcast, videos.indexOf(videoPath), videos.length)
      );
    }
    await Promise.all(subTaskPromises);
  }

  await updateTaskStatus(jobId, 'Готово', 100);
  broadcast({ type: 'task_updated', taskId: jobId, status: 'Готово', progress: 100 });
  await addEvent(jobId, 'completed', `Обработени ${videos.length} видеа`);

  return { ok: true, jobId, jobPath, capcut };
}

async function processVideoClip(videoPath, mainJobId, jobPath, capcut, broadcast, index, total) {
  const clipName = path.basename(videoPath, path.extname(videoPath));
  const clipDir = path.join(jobPath, clipName);
  fs.mkdirSync(clipDir, { recursive: true });

  const subTaskId = uuidv4();
  const subTask = await createTask({
    id: subTaskId,
    title: `Клип: ${clipName}`,
    team: 'Creative',
    agent: 'Captioner',
    status: 'Тече',
    progress: 5,
    payload: { type: 'clip-processing', mainJobId, videoPath, clipDir }
  });

  broadcast({ type: 'task_created', task: subTask });

  try {
    // Step 1: Rough cut
    await updateTaskStatus(subTaskId, 'Тече', 15);
    const rough = await roughCut(videoPath, clipDir);
    broadcast({ type: 'task_updated', taskId: subTaskId, status: 'Тече', progress: 15 });
    await addEvent(subTaskId, 'rough-cut', rough);

    // Step 2: Generate captions
    await updateTaskStatus(subTaskId, 'Тече', 35);
    const srtPath = path.join(clipDir, `${clipName}.srt`);
    let transcript = 'Здраво, HUGO Studio';
    
    if (whisper) {
      try {
        const audio = await extractAudio(videoPath, clipDir);
        const json = path.join(clipDir, 'transcript.json');
        execSync(`whisper "${audio}" --language mk --output_format json --output_dir "${clipDir}"`, { stdio: 'ignore' });
        if (fs.existsSync(json)) {
          const result = JSON.parse(fs.readFileSync(json, 'utf-8'));
          transcript = result.text || transcript;
        }
      } catch (e) {
        console.log('Whisper failed, using default transcript');
      }
    }
    
    await generateSRT(transcript, srtPath);
    broadcast({ type: 'task_updated', taskId: subTaskId, status: 'Тече', progress: 35 });
    await addEvent(subTaskId, 'captions', srtPath);

    // Step 3: Add captions
    await updateTaskStatus(subTaskId, 'Тече', 55);
    const captioned = await addCaptions(rough, srtPath, clipDir);
    broadcast({ type: 'task_updated', taskId: subTaskId, status: 'Тече', progress: 55 });
    await addEvent(subTaskId, 'captioned', captioned);

    // Step 4: Resize for reels
    await updateTaskStatus(subTaskId, 'Тече', 75);
    const reels = await resizeForReels(captioned, clipDir);
    broadcast({ type: 'task_updated', taskId: subTaskId, status: 'Тече', progress: 75 });
    await addEvent(subTaskId, 'resized', reels);

    // Step 5: Extract thumbnail
    await updateTaskStatus(subTaskId, 'Тече', 85);
    const thumb = await extractThumbnail(reels, clipDir);
    broadcast({ type: 'task_updated', taskId: subTaskId, status: 'Тече', progress: 85 });
    await addEvent(subTaskId, 'thumbnail', thumb);

    // Step 6: Brand check (rule-based)
    await updateTaskStatus(subTaskId, 'Тече', 95);
    const brandCheck = performBrandCheck({ transcript, title: clipName });
    broadcast({ type: 'task_updated', taskId: subTaskId, status: 'Тече', progress: 95 });
    await addEvent(subTaskId, 'brand-check', JSON.stringify(brandCheck));

    // Copy to capcut-ready
    const capcutClipDir = path.join(capcut, clipName);
    fs.mkdirSync(capcutClipDir, { recursive: true });
    fs.copyFileSync(reels, path.join(capcutClipDir, 'final.mp4'));
    fs.copyFileSync(srtPath, path.join(capcutClipDir, `${clipName}.srt`));
    fs.copyFileSync(thumb, path.join(capcutClipDir, 'thumb.jpg'));

    await updateTaskStatus(subTaskId, 'Готово', 100);
    broadcast({ type: 'task_updated', taskId: subTaskId, status: 'Готово', progress: 100 });
    await addEvent(subTaskId, 'completed', capcutClipDir);
  } catch (error) {
    console.error(`Failed to process ${clipName}:`, error.message);
    await updateTaskStatus(subTaskId, 'Отклонено', 0);
    broadcast({ type: 'task_updated', taskId: subTaskId, status: 'Отклонено', progress: 0 });
    await addEvent(subTaskId, 'error', error.message);
  }
}

function performBrandCheck(data) {
  const rules = [
    { rule: 'имаДолгаВовед', check: () => data.transcript.length < 500 },
    { rule: 'јасненесподобна', check: () => data.transcript.includes('HUGO') },
    { rule: 'наслованаТемата', check: () => data.title.length > 0 }
  ];

  const results = {};
  for (const r of rules) {
    results[r.rule] = r.check();
  }
  return { passed: Object.values(results).every(v => v), details: results };
}
