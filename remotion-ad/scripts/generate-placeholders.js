const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const screenshots = [
  { name: 'discover.png', title: 'DISCOVER', subtitle: 'Find your next favorite set', icon: '🎧' },
  { name: 'feed.png', title: 'FEED', subtitle: 'Follow artists you love', icon: '📡' },
  { name: 'identify.png', title: 'IDENTIFY', subtitle: 'Name that track', icon: '🎵' },
  { name: 'crate.png', title: 'CRATE', subtitle: 'Your music collection', icon: '📦' },
  { name: 'profile.png', title: 'PROFILE', subtitle: 'Your music identity', icon: '👤' },
];

const width = 1170;
const height = 2532;

const outputDir = path.join(__dirname, '../public/screenshots');

// Ensure directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

screenshots.forEach(({ name, title, subtitle, icon }) => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(0.5, '#16213e');
  gradient.addColorStop(1, '#0f0f23');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Accent glow
  const glowGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, 600);
  glowGradient.addColorStop(0, 'rgba(196, 30, 58, 0.3)');
  glowGradient.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, width, height);

  // Icon
  ctx.font = '200px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(icon, width / 2, height / 2 - 100);

  // Title
  ctx.font = 'bold 120px -apple-system, SF Pro Display, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, width / 2, height / 2 + 100);

  // Subtitle
  ctx.font = '48px -apple-system, SF Pro Display, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.fillText(subtitle, width / 2, height / 2 + 180);

  // Placeholder notice
  ctx.font = '32px -apple-system, SF Pro Display, sans-serif';
  ctx.fillStyle = 'rgba(196, 30, 58, 0.8)';
  ctx.fillText('Replace with real screenshot', width / 2, height - 200);

  // Save
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(outputDir, name), buffer);
  console.log(`Created: ${name}`);
});

console.log('\nPlaceholder screenshots created!');
console.log('Replace them with real app screenshots from your device.');
