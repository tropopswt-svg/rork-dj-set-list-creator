/**
 * Test yt-dlp directly to see if it works despite semaphore errors
 */

import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const YOUTUBE_URL = 'https://www.youtube.com/watch?v=LXGBKmlRn0U';
const YT_DLP_PATH = process.env.YT_DLP_PATH || './bin/yt-dlp';

async function testYtDlp() {
  console.log('=== Testing yt-dlp Directly ===\n');
  console.log(`yt-dlp path: ${YT_DLP_PATH}`);
  console.log(`YouTube URL: ${YOUTUBE_URL}\n`);

  const args = [
    "-g",
    "-f", "bestaudio/best",
    "--no-check-certificates",
    YOUTUBE_URL,
  ];

  console.log(`Running: ${YT_DLP_PATH} ${args.join(' ')}\n`);

  const startTime = Date.now();
  const result = spawnSync(YT_DLP_PATH, args, {
    encoding: "utf8",
    timeout: 30_000,
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const elapsed = Date.now() - startTime;

  console.log(`Execution time: ${elapsed}ms`);
  console.log(`Exit status: ${result.status}`);
  console.log(`\n=== STDOUT ===`);
  console.log(result.stdout?.toString() || '(empty)');
  console.log(`\n=== STDERR ===`);
  console.log(result.stderr?.toString() || '(empty)');

  const output = result.stdout?.toString() || "";
  const lines = output.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const streamUrl = lines.find(line => line.startsWith('http')) || lines[lines.length - 1] || "";

  console.log(`\n=== RESULT ===`);
  if (streamUrl && streamUrl.startsWith("http")) {
    console.log(`✅ SUCCESS! Extracted stream URL:`);
    console.log(`   ${streamUrl.substring(0, 150)}...`);
    console.log(`\n💡 Even if exit status is non-zero, yt-dlp still extracted the URL!`);
  } else {
    console.log(`❌ FAILED: No valid stream URL found`);
    console.log(`   Exit status: ${result.status}`);
    if (result.status !== 0) {
      console.log(`   This is a real failure, not just a semaphore warning`);
    }
  }
}

testYtDlp().catch(console.error);
