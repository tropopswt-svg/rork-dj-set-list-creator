const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'chrome-extension', 'icons');

const sizes = [16, 48, 128];

for (const size of sizes) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Create linear gradient (top-left to bottom-right)
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#FF6B35');
  grad.addColorStop(1, '#FF8C42');

  // Draw rounded rectangle
  const rx = size * 0.2; // 20% corner radius matches the SVGs
  ctx.beginPath();
  ctx.moveTo(rx, 0);
  ctx.lineTo(size - rx, 0);
  ctx.quadraticCurveTo(size, 0, size, rx);
  ctx.lineTo(size, size - rx);
  ctx.quadraticCurveTo(size, size, size - rx, size);
  ctx.lineTo(rx, size);
  ctx.quadraticCurveTo(0, size, 0, size - rx);
  ctx.lineTo(0, rx);
  ctx.quadraticCurveTo(0, 0, rx, 0);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw "T'D" text
  const fontSizeMap = { 16: 6, 48: 17, 128: 44 };
  const fontSize = fontSizeMap[size];
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // y at 55% of size to match SVG's y="55%"
  ctx.fillText("T'D", size / 2, size * 0.55);

  // Write PNG
  const outPath = path.join(ICONS_DIR, `icon${size}.png`);
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outPath, buffer);
  console.log(`Generated ${outPath} (${size}x${size}, ${buffer.length} bytes)`);
}

console.log('Done!');
