const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// TRACK'D App Icon Generator
const SIZE = 1024;
const PRIMARY_COLOR = '#cd6a6f';
const BACKGROUND_COLOR = '#1a1a1a';
const TEXT_COLOR = '#FFFFFF';

const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');

// Background
ctx.fillStyle = BACKGROUND_COLOR;
ctx.fillRect(0, 0, SIZE, SIZE);

// Generate waveform bars behind the ID
const barCount = 20;
const barWidth = 32;
const barGap = 12;
const totalWidth = barCount * (barWidth + barGap) - barGap;
const waveStartX = (SIZE - totalWidth) / 2;
const maxBarHeight = SIZE * 0.6;
const centerY = SIZE * 0.5;

ctx.fillStyle = PRIMARY_COLOR;
ctx.globalAlpha = 0.35;

for (let i = 0; i < barCount; i++) {
  const x = waveStartX + i * (barWidth + barGap);

  // Create varied bar heights using sine waves
  const noise1 = Math.sin(i * 0.7) * 0.3;
  const noise2 = Math.sin(i * 1.5) * 0.25;
  const noise3 = Math.sin(i * 0.4) * 0.2;
  const heightFactor = 0.3 + Math.abs(noise1 + noise2 + noise3);
  const barHeight = Math.min(1, heightFactor) * maxBarHeight;

  const y = centerY - barHeight / 2;

  // Round the bars
  const radius = barWidth / 2;
  ctx.beginPath();
  ctx.roundRect(x, y, barWidth, barHeight, radius);
  ctx.fill();
}

ctx.globalAlpha = 1;

// Draw "ID" background box with glow
const boxWidth = SIZE * 0.54;
const boxHeight = SIZE * 0.40;
const boxX = (SIZE - boxWidth) / 2;
const boxY = (SIZE - boxHeight) / 2;
const boxRadius = 50;

// Glow effect
ctx.shadowColor = PRIMARY_COLOR;
ctx.shadowBlur = 50;
ctx.shadowOffsetX = 0;
ctx.shadowOffsetY = 0;

ctx.fillStyle = PRIMARY_COLOR;
ctx.beginPath();
ctx.roundRect(boxX, boxY, boxWidth, boxHeight, boxRadius);
ctx.fill();

// Reset shadow
ctx.shadowBlur = 0;

// Draw ID text - using a large bold font
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillStyle = TEXT_COLOR;
ctx.font = 'bold 320px Arial, Helvetica, sans-serif';

// Add slight shadow to text
ctx.shadowColor = 'rgba(0,0,0,0.3)';
ctx.shadowBlur = 8;
ctx.shadowOffsetY = 4;

ctx.fillText('ID', SIZE / 2, SIZE / 2 + 10);

// Reset shadow
ctx.shadowBlur = 0;
ctx.shadowOffsetY = 0;

// Save the icon
const outputPath = path.join(__dirname, '..', 'assets', 'images', 'icon.png');
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync(outputPath, buffer);
console.log('Icon saved to:', outputPath);

// Also create adaptive icon (same design)
const adaptivePath = path.join(__dirname, '..', 'assets', 'images', 'adaptive-icon.png');
fs.writeFileSync(adaptivePath, buffer);
console.log('Adaptive icon saved to:', adaptivePath);

// Create splash icon (smaller ID on light background)
const splashCanvas = createCanvas(SIZE, SIZE);
const splashCtx = splashCanvas.getContext('2d');

// Light background for splash
splashCtx.fillStyle = '#F5F0E8';
splashCtx.fillRect(0, 0, SIZE, SIZE);

// Smaller box for splash
const splashBoxWidth = SIZE * 0.35;
const splashBoxHeight = SIZE * 0.26;
const splashBoxX = (SIZE - splashBoxWidth) / 2;
const splashBoxY = (SIZE - splashBoxHeight) / 2;
const splashBoxRadius = 32;

splashCtx.shadowColor = PRIMARY_COLOR;
splashCtx.shadowBlur = 30;
splashCtx.fillStyle = PRIMARY_COLOR;
splashCtx.beginPath();
splashCtx.roundRect(splashBoxX, splashBoxY, splashBoxWidth, splashBoxHeight, splashBoxRadius);
splashCtx.fill();

splashCtx.shadowBlur = 0;
splashCtx.font = 'bold 200px Arial, Helvetica, sans-serif';
splashCtx.fillStyle = TEXT_COLOR;
splashCtx.textAlign = 'center';
splashCtx.textBaseline = 'middle';
splashCtx.fillText('ID', SIZE / 2, SIZE / 2 + 5);

const splashPath = path.join(__dirname, '..', 'assets', 'images', 'splash-icon.png');
const splashBuffer = splashCanvas.toBuffer('image/png');
fs.writeFileSync(splashPath, splashBuffer);
console.log('Splash icon saved to:', splashPath);

console.log('\nDone! Icons generated successfully.');
