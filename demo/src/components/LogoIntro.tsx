import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, spring, Img, staticFile } from "remotion";

const FADE_IN_END = 25;
const ORBIT_END = 110;
const COLLISION_END = 130;
const BURST_START = 125;
const INTRO_END = 145;

interface LogoConfig {
  name: string;
  startAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  selfRotateSpeed: number;
  size: number;
  color: string;
  flyFromX: number;
  flyFromY: number;
}

const CX = 390 / 2;
const CY = 844 / 2;

// 5 logos evenly spaced at 72° (2π/5) apart
const LOGO_COUNT = 5;
const ANGLE_STEP = (2 * Math.PI) / LOGO_COUNT;

const LOGOS: LogoConfig[] = [
  {
    name: "tiktok",
    startAngle: ANGLE_STEP * 0,
    orbitRadius: 140,
    orbitSpeed: 0.04,
    selfRotateSpeed: 2.5,
    size: 52,
    color: "#000000",
    flyFromX: 450,
    flyFromY: 100,
  },
  {
    name: "soundcloud",
    startAngle: ANGLE_STEP * 1,
    orbitRadius: 140,
    orbitSpeed: 0.04,
    selfRotateSpeed: -2,
    size: 56,
    color: "#FF5500",
    flyFromX: 450,
    flyFromY: 750,
  },
  {
    name: "youtube",
    startAngle: ANGLE_STEP * 2,
    orbitRadius: 140,
    orbitSpeed: 0.04,
    selfRotateSpeed: 1.8,
    size: 62,
    color: "#FF0000",
    flyFromX: -80,
    flyFromY: 900,
  },
  {
    name: "1001tracklists",
    startAngle: ANGLE_STEP * 3,
    orbitRadius: 140,
    orbitSpeed: 0.04,
    selfRotateSpeed: -2.2,
    size: 48,
    color: "#1DB954",
    flyFromX: -80,
    flyFromY: 200,
  },
  {
    name: "spotify",
    startAngle: ANGLE_STEP * 4,
    orbitRadius: 140,
    orbitSpeed: 0.04,
    selfRotateSpeed: 2,
    size: 50,
    color: "#1DB954",
    flyFromX: 200,
    flyFromY: -80,
  },
];

interface FlyingCardConfig {
  artist: string;
  setName: string;
  venue: string;
  duration: string;
  thumbnail?: string;
  startX: number;
  startY: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  rotationSpeed: number;
  delay: number;
  scale: number;
}

const FLYING_CARDS: FlyingCardConfig[] = [
  // Top row — moving left to right
  { artist: "Alisha", setName: "Alisha — Creamfields 2025", venue: "Creamfields, UK", duration: "1h 30m", thumbnail: "alisha-creamfields.jpg", startX: -60, startY: 30, velocityX: 0.1, velocityY: 1.2, rotation: -3, rotationSpeed: 0.05, delay: 0, scale: 0.82 },
  // Upper right — moving right to left
  { artist: "Ranger Trucco B2B Luke Dean", setName: "Ranger Trucco B2B Luke Dean", venue: "Live Set", duration: "2h 00m", thumbnail: "ranger-trucco-luke-dean.jpg", startX: 320, startY: 520, velocityX: -1.6, velocityY: -0.8, rotation: 4, rotationSpeed: -0.08, delay: 3, scale: 0.78 },
  // Left side — drifting downward
  { artist: "Marsolo", setName: "Marsolo — Rinse FM", venue: "Rinse FM, London", duration: "1h 00m", thumbnail: "rinse-fm-marsolo.jpg", startX: -60, startY: 350, velocityX: 0.3, velocityY: 1.5, rotation: 3, rotationSpeed: -0.12, delay: 7, scale: 0.85 },
  // Right side — drifting upward
  { artist: "Robbie Doherty", setName: "Robbie Doherty @ The Warehouse", venue: "The Warehouse", duration: "2h 30m", thumbnail: "robbie-doherty-warehouse.jpg", startX: 250, startY: 350, velocityX: -0.4, velocityY: -1.4, rotation: -3, rotationSpeed: 0.1, delay: 1, scale: 0.75 },
  // Bottom left — moving diagonally up-right
  { artist: "Rossi.", setName: "Rossi. — Homegrown", venue: "Homegrown", duration: "1h 15m", thumbnail: "rossi-homegrown.webp", startX: -160, startY: 700, velocityX: 1.5, velocityY: -0.6, rotation: 6, rotationSpeed: 0.08, delay: 5, scale: 0.8 },
  // Bottom right — moving left
  { artist: "Rossi.", setName: "Rossi. — Mixmag Netherlands", venue: "Mixmag, Netherlands", duration: "1h 30m", thumbnail: "rossi-mixmag.jpg", startX: 450, startY: 780, velocityX: -1.7, velocityY: -0.3, rotation: -4, rotationSpeed: -0.1, delay: 9, scale: 0.76 },
  // Top center — drifting down-right
  { artist: "Chris Stussy", setName: "Chris Stussy @ Hudson River", venue: "Hudson River, NYC", duration: "2h 10m", thumbnail: "chris-stussy.jpg", startX: 100, startY: -120, velocityX: 0.8, velocityY: 1.6, rotation: -2, rotationSpeed: 0.06, delay: 11, scale: 0.84 },
  // Bottom center — drifting up-left
  { artist: "Max Dean", setName: "Max Dean @ Sound LA", venue: "Sound Nightclub, LA", duration: "2h 30m", thumbnail: "max-dean.jpg", startX: 250, startY: 900, velocityX: -0.6, velocityY: -1.5, rotation: 3, rotationSpeed: -0.07, delay: 2, scale: 0.8 },
];

const FlyingCard: React.FC<{ config: FlyingCardConfig; frame: number }> = ({
  config,
  frame,
}) => {
  const localFrame = frame - config.delay;
  if (localFrame < 0) return null;

  const fadeIn = interpolate(localFrame, [0, 10], [0, 0.8], {
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [ORBIT_END, BURST_START], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = fadeIn * fadeOut;
  if (opacity <= 0) return null;

  const x = config.startX + localFrame * config.velocityX;
  const y = config.startY + localFrame * config.velocityY;
  const rot = config.rotation + localFrame * config.rotationSpeed;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 280,
        height: 175,
        transform: `scale(${config.scale}) rotate(${rot}deg)`,
        opacity,
        borderRadius: 16,
        backgroundColor: "rgba(245,235,220,0.15)",
        border: "1px solid rgba(255,245,230,0.3)",
        borderTop: "1px solid rgba(255,250,240,0.5)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,245,230,0.2)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        overflow: "hidden",
      }}
    >
      {/* Thumbnail background */}
      {config.thumbnail && (
        <Img
          src={staticFile(config.thumbnail)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.5,
          }}
        />
      )}
      {/* Glass overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(245,235,220,0.1)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      />
      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: 14,
          display: "flex",
          flexDirection: "column" as const,
          justifyContent: "space-between",
          height: "100%",
        }}
      >
      <div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "rgba(255,245,230,0.95)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            marginBottom: 4,
          }}
        >
          {config.artist}
        </div>
        <div
          style={{
            fontSize: 9,
            color: "rgba(255,240,220,0.55)",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 500,
          }}
        >
          {config.setName}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div
          style={{
            fontSize: 8,
            color: "rgba(255,240,220,0.4)",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          {config.venue}
        </div>
        <div
          style={{
            fontSize: 8,
            color: "#C41E3A",
            fontFamily: "system-ui, -apple-system, sans-serif",
            fontWeight: 700,
          }}
        >
          {config.duration}
        </div>
      </div>
      {/* Fake waveform decoration */}
      <div
        style={{
          display: "flex",
          gap: 2,
          alignItems: "flex-end",
          height: 22,
          opacity: 0.3,
          marginTop: 6,
        }}
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4 + Math.sin(i * 0.8 + config.delay) * 12 + 12,
              backgroundColor: "rgba(245,225,200,0.5)",
              borderRadius: 1,
            }}
          />
        ))}
      </div>
      </div>
    </div>
  );
};

const LOGO_IMAGES: Record<string, string> = {
  tiktok: "tiktok-logo.jpg",
  soundcloud: "soundcloud-logo.avif",
  youtube: "youtube-logo.png",
  "1001tracklists": "1001-logo.png",
  spotify: "spotify-logo.png",
};

const LogoRenderer: React.FC<{ name: string; size: number }> = ({
  name,
  size,
}) => {
  const imageFile = LOGO_IMAGES[name];
  if (imageFile) {
    return (
      <Img
        src={staticFile(imageFile)}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          borderRadius: 8,
        }}
      />
    );
  }

  return null;
};

const OrbitingLogo: React.FC<{
  config: LogoConfig;
  frame: number;
  centerX: number;
  centerY: number;
  fps: number;
}> = ({ config, frame, centerX, centerY, fps }) => {
  const { startAngle, orbitRadius, orbitSpeed, selfRotateSpeed, size, name, flyFromX, flyFromY } =
    config;

  // Fade in (frames 0–15)
  const fadeIn = interpolate(frame, [0, FADE_IN_END], [0, 1], {
    extrapolateRight: "clamp",
  });

  // Scale on entry
  const entryScale = interpolate(frame, [0, FADE_IN_END], [0.3, 1], {
    extrapolateRight: "clamp",
  });

  // Fly-in progress (0 = at flyFrom position, 1 = at orbital position)
  const flyInProgress = interpolate(frame, [0, FADE_IN_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Orbital angle — only starts advancing after fly-in
  const orbitFrame = Math.max(0, frame - FADE_IN_END);
  const angle = startAngle + orbitFrame * orbitSpeed;

  // Target orbital position
  const orbitX = centerX + orbitRadius * Math.cos(angle);
  const orbitY = centerY + orbitRadius * Math.sin(angle);

  // Collision phase: radius shrinks to 0
  const collisionProgress =
    frame >= ORBIT_END
      ? spring({
          frame: frame - ORBIT_END,
          fps,
          config: { damping: 12, stiffness: 80, mass: 0.8 },
        })
      : 0;

  const currentRadius = interpolate(collisionProgress, [0, 1], [orbitRadius, 0]);

  // Scale down during collision
  const collisionScale = interpolate(
    frame,
    [ORBIT_END, COLLISION_END],
    [1, 0.2],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Fade out at collision
  const collisionOpacity = interpolate(
    frame,
    [BURST_START, COLLISION_END],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Speed up rotation during collision
  const rotationBoost =
    frame >= ORBIT_END
      ? interpolate(frame, [ORBIT_END, COLLISION_END], [1, 4], {
          extrapolateRight: "clamp",
        })
      : 1;

  // During collision, override position to converge to center
  let x: number;
  let y: number;
  if (frame >= ORBIT_END) {
    const collisionAngle = startAngle + (ORBIT_END - FADE_IN_END) * orbitSpeed + (frame - ORBIT_END) * orbitSpeed;
    x = centerX + currentRadius * Math.cos(collisionAngle);
    y = centerY + currentRadius * Math.sin(collisionAngle);
  } else if (frame < FADE_IN_END) {
    // Fly in from off-screen to orbital position
    x = interpolate(flyInProgress, [0, 1], [flyFromX, orbitX]);
    y = interpolate(flyInProgress, [0, 1], [flyFromY, orbitY]);
  } else {
    x = orbitX;
    y = orbitY;
  }

  const rotation = frame * selfRotateSpeed * rotationBoost;
  const scale = entryScale * collisionScale;
  const opacity = fadeIn * collisionOpacity;

  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scale}) rotate(${rotation}deg)`,
        opacity,
        filter: `drop-shadow(0 0 12px ${config.color}66)`,
      }}
    >
      <LogoRenderer name={name} size={size} />
    </div>
  );
};

const TrakdCenterLogo: React.FC<{ frame: number }> = ({ frame }) => {
  // Fade in after logos arrive
  const fadeIn = interpolate(frame, [FADE_IN_END - 2, FADE_IN_END + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scale up gently
  const scale = interpolate(frame, [FADE_IN_END - 2, FADE_IN_END + 8], [0.6, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out during collision
  const fadeOut = interpolate(frame, [ORBIT_END, BURST_START], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const opacity = fadeIn * fadeOut;
  if (opacity <= 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: CX,
        top: CY,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <div
        style={{
          fontSize: 32,
          fontWeight: 900,
          color: "rgba(255,245,230,0.95)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: -0.5,
          textShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}
      >
        trakd
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "rgba(255,240,220,0.5)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: 3,
          textTransform: "uppercase",
        }}
      >
        For You
      </div>
    </div>
  );
};

export const LogoIntro: React.FC<{ fps: number }> = ({ fps }) => {
  const frame = useCurrentFrame();

  // Background color transition — starts fading earlier for a gradual crossfade
  const bgOpacity = interpolate(frame, [ORBIT_END, INTRO_END + 10], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Collision burst effect — softer and more subtle
  const burstActive = frame >= BURST_START && frame <= INTRO_END;
  const burstScale = burstActive
    ? interpolate(frame, [BURST_START, INTRO_END], [0, 2.5], {
        extrapolateRight: "clamp",
      })
    : 0;
  const burstOpacity = burstActive
    ? interpolate(frame, [BURST_START, INTRO_END], [0.5, 0], {
        extrapolateRight: "clamp",
      })
    : 0;

  // Phone scale reveal
  const phoneRevealProgress =
    frame >= BURST_START
      ? spring({
          frame: frame - BURST_START,
          fps,
          config: { damping: 10, stiffness: 100, mass: 0.8 },
        })
      : 0;
  const phoneScale = interpolate(phoneRevealProgress, [0, 1], [0.1, 1]);

  // Don't render intro elements after they're done
  if (frame > INTRO_END + 20) return null;

  return (
    <>
      {/* Dark background overlay during intro */}
      <AbsoluteFill
        style={{
          backgroundColor: "#2A2520",
          opacity: bgOpacity,
          zIndex: 50,
        }}
      />

      {/* Flying set cards behind logos */}
      <AbsoluteFill style={{ zIndex: 51, overflow: "hidden" }}>
        {FLYING_CARDS.map((card, i) => (
          <FlyingCard key={i} config={card} frame={frame} />
        ))}
      </AbsoluteFill>

      {/* Trakd logo in center of orbit */}
      <AbsoluteFill style={{ zIndex: 52 }}>
        <TrakdCenterLogo frame={frame} />
      </AbsoluteFill>

      {/* Orbiting logos */}
      <AbsoluteFill style={{ zIndex: 53 }}>
        {LOGOS.map((logo) => (
          <OrbitingLogo
            key={logo.name}
            config={logo}
            frame={frame}
            centerX={CX}
            centerY={CY}
            fps={fps}
          />
        ))}
      </AbsoluteFill>

      {/* Collision burst */}
      {burstActive && (
        <AbsoluteFill style={{ zIndex: 54 }}>
          <div
            style={{
              position: "absolute",
              left: CX - 60,
              top: CY - 60,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%)",
              transform: `scale(${burstScale})`,
              opacity: burstOpacity,
            }}
          />
        </AbsoluteFill>
      )}

      {/* Phone scale-up wrapper */}
      {frame >= BURST_START && frame <= INTRO_END && (
        <AbsoluteFill
          style={{
            zIndex: 55,
            transform: `scale(${phoneScale})`,
            opacity: phoneRevealProgress,
          }}
        />
      )}
    </>
  );
};

export const usePhoneRevealScale = (fps: number) => {
  const frame = useCurrentFrame();

  if (frame >= INTRO_END + 15) return { scale: 0.9, opacity: 1, translateY: 0, ready: true };
  if (frame < ORBIT_END) return { scale: 0.9, opacity: 0, translateY: 300, ready: false };

  const progress = spring({
    frame: frame - ORBIT_END,
    fps,
    config: { damping: 35, stiffness: 10, mass: 2.5 },
  });

  return {
    scale: 0.9,
    opacity: interpolate(progress, [0, 0.1, 0.4, 1], [0, 0, 1, 1]),
    translateY: interpolate(progress, [0, 1], [300, 0]),
    ready: frame >= BURST_START,
  };
};
