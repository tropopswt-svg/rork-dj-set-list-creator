# TRACK'D Commercial - Remotion Project

An Apple-style iPhone commercial for the TRACK'D app built with Remotion.

## Quick Start

```bash
# Navigate to the remotion-ad directory
cd remotion-ad

# Start the Remotion Studio (preview & edit)
npm start

# Render the final video
npm run build

# Render landscape version
npm run build:landscape
```

## Adding Your Screenshots

Place your app screenshots in `public/screenshots/` with these exact names:

| Filename | Description |
|----------|-------------|
| `discover.png` | Discover tab showing sets |
| `feed.png` | Feed tab with activity |
| `identify.png` | Track identification screen |
| `crate.png` | Crate tab (saved/liked) |
| `profile.png` | Profile tab |

### Recommended Screenshot Specs
- **Resolution**: 1170 x 2532 (iPhone 14 Pro)
- **Format**: PNG
- **Mode**: Dark mode preferred

## Project Structure

```
remotion-ad/
├── src/
│   ├── index.ts           # Entry point
│   ├── Root.tsx           # Composition definitions
│   ├── TrackdCommercial.tsx  # Main video
│   └── components/
│       ├── IPhoneFrame.tsx    # Realistic iPhone mockup
│       ├── TextReveal.tsx     # Apple-style text animations
│       └── FeatureHighlight.tsx  # Feature callouts
├── public/
│   └── screenshots/       # Your app screenshots
└── remotion.config.ts     # Remotion config
```

## Video Specs

| Format | Resolution | Duration | FPS |
|--------|-----------|----------|-----|
| Portrait | 1080x1920 | 15 sec | 30 |
| Landscape | 1920x1080 | 15 sec | 30 |

## Customization

### Changing Colors
Edit the accent color in `TrackdCommercial.tsx`:
```tsx
// Primary brand color (TRACK'D red)
const accentColor = "#C41E3A";
```

### Changing Text
Modify the scene labels in `TrackdCommercial.tsx`:
```tsx
<PhoneReveal
  screenshot="discover.png"
  label="DISCOVER"           // Main headline
  sublabel="Your custom text" // Subtitle
/>
```

### Changing Timing
Adjust the `from` and `durationInFrames` in Sequences:
```tsx
<Sequence from={60} durationInFrames={80}>
  {/* 60 frames = 2 seconds at 30fps */}
</Sequence>
```

## Adding Music

1. Place your audio file in `public/audio/`
2. Add to your composition:
```tsx
import { Audio, staticFile } from "remotion";

// In your component:
<Audio src={staticFile("audio/background.mp3")} volume={0.8} />
```

## Rendering Options

```bash
# High quality MP4
npm run build

# GIF (for social media)
npm run build:gif

# Custom resolution
npx remotion render TrackdCommercial out/custom.mp4 --width=720 --height=1280

# ProRes (for editing)
npx remotion render TrackdCommercial out/prores.mov --codec=prores
```

## Tips for Best Results

1. **Screenshots**: Capture with real data, not empty states
2. **Timing**: The quick cuts (every 2-2.5s) mimic Apple's style
3. **Music**: Add a driving beat that matches the cut timing
4. **Colors**: Keep it minimal - black, white, and brand red

## Troubleshooting

**Screenshots not loading?**
- Check filenames match exactly (case-sensitive)
- Ensure images are in `public/screenshots/`
- PNG format recommended

**Slow rendering?**
- Close other applications
- Use `--concurrency=4` flag for faster renders

---

Made with [Remotion](https://remotion.dev)
