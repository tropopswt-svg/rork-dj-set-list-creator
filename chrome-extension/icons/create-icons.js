// Simple script to create placeholder icons for the Chrome extension
// Run with: node create-icons.js

const fs = require('fs');
const path = require('path');

// SVG icon template - a simple sparkle/star design
const createSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF6B35;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FF8C42;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-weight="bold" font-size="${size * 0.35}">T'D</text>
</svg>
`;

// Convert SVG to PNG using canvas (requires additional setup)
// For now, we'll create SVG files that can be converted manually
const sizes = [16, 48, 128];

sizes.forEach(size => {
  const svg = createSvg(size);
  const filename = `icon${size}.svg`;
  fs.writeFileSync(path.join(__dirname, filename), svg);
  console.log(`Created ${filename}`);
});

console.log(`
Icons created as SVG files. To convert to PNG:

1. Open each SVG in a browser
2. Right-click and save as PNG, OR
3. Use an online converter like https://svgtopng.com/, OR
4. Use ImageMagick: convert icon16.svg icon16.png

Alternatively, you can use any 16x16, 48x48, and 128x128 PNG images.
The icons should be named: icon16.png, icon48.png, icon128.png
`);
