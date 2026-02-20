import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  Img,
  staticFile,
} from "remotion";
import { IPhoneFrame } from "./components/IPhoneFrame";

const colors = {
  background: "#F5F0E8",
  surface: "#FFFFFF",
  border: "#E8E2D9",
  borderLight: "#F0EBE3",
  text: "#2D2A26",
  textSecondary: "rgba(45, 42, 38, 0.6)",
  textMuted: "#9C968E",
  primary: "#C41E3A",
  primaryDark: "#9E1830",
  youtube: "#FF0000",
  soundcloud: "#FF5500",
  cardDark: "#1A1816",
  cardDarkSoft: "#2D2A26",
};

interface Props {
  landscape?: boolean;
}

// ─── Campaign 6: Pinned TikTok — Full App Demo (~64s) ─────────────────────
export const TikTokCampaign6: React.FC<Props> = ({ landscape = false }) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.background, overflow: "hidden" }}
    >
      {/* Scene 1: Hook — what trakd is (0-220) — ~7s */}
      <Sequence from={0} durationInFrames={230}>
        <HookScene />
      </Sequence>

      {/* Scene 2: Floating links → button fills → tracklist (210-620) — ~14s */}
      <Sequence from={210} durationInFrames={420}>
        <CoreDemoScene />
      </Sequence>

      {/* Scene 3: Live record — rings, pocket, lasers (610-1100) — ~16s */}
      <Sequence from={610} durationInFrames={500}>
        <LiveRecordScene />
      </Sequence>

      {/* Scene 4: Unreleased differentiation (1090-1400) — ~10s */}
      <Sequence from={1090} durationInFrames={310}>
        <UnreleasedScene />
      </Sequence>

      {/* Scene 5: Search & find a track (1390-1660) — ~9s */}
      <Sequence from={1390} durationInFrames={270}>
        <SearchScene />
      </Sequence>

      {/* Scene 6: CTA (1650-1930) — ~9s */}
      <Sequence from={1650} durationInFrames={280}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Scene 1: Hook — establish what trakd is ───────────────────────────────
const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOp = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 20, stiffness: 30 } });
  const line1 = spring({ frame: Math.max(0, frame - 50), fps, config: { damping: 20, stiffness: 30 } });
  const line2 = spring({ frame: Math.max(0, frame - 95), fps, config: { damping: 20, stiffness: 30 } });
  const line3 = spring({ frame: Math.max(0, frame - 135), fps, config: { damping: 20, stiffness: 30 } });
  const exitOp = interpolate(frame, [185, 225], [1, 0], { extrapolateLeft: "clamp" });

  // Pulsating logo scale
  const pulse = 1 + Math.sin(frame * 0.08) * 0.04;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background, opacity: exitOp }}>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,30,58,0.1) 0%, transparent 55%)" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "0 55px" }}>
        <div style={{ fontSize: 130, fontWeight: 900, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -6, opacity: logoOp, transform: `scale(${logoOp * pulse})`, textShadow: "0 0 80px rgba(196,30,58,0.25)", marginBottom: 10 }}>
          trakd
        </div>
        <div style={{ fontSize: 48, fontWeight: 800, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", letterSpacing: -1.5, lineHeight: 1.25, opacity: line1, transform: `translateY(${(1 - line1) * 25}px)` }}>
          the tracklist to
        </div>
        <div style={{ fontSize: 52, fontWeight: 800, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", letterSpacing: -2, lineHeight: 1.15, opacity: line2, transform: `translateY(${(1 - line2) * 25}px)`, textShadow: "0 0 50px rgba(196,30,58,0.2)" }}>
          basically every DJ set.
        </div>
        <div style={{ fontSize: 26, fontWeight: 600, color: colors.textSecondary, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", opacity: line3, transform: `translateY(${(1 - line3) * 20}px)`, marginTop: 4 }}>
          here's how it works.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: Floating links → button fills → tracklist ────────────────────
const CoreDemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneScale = spring({ frame, fps, config: { damping: 22, stiffness: 30 } });

  // Phase 1: Floating link cards converge (0-80)
  // Phase 2: Links jump into phone, buttons fill (80-160)
  // Phase 3: Processing (160-200)
  // Phase 4: Tracklist builds (200-420)

  // YouTube link floats from top-left — same set name
  const ytOrbitAngle = frame * 0.04;
  const ytCatchFrame = 75;
  const ytCaught = frame >= ytCatchFrame;
  const ytFloat = ytCaught ? 0 : 1;
  const ytX = ytCaught ? 0 : Math.cos(ytOrbitAngle) * 120 - 200;
  const ytY = ytCaught ? 0 : Math.sin(ytOrbitAngle * 0.7) * 80 - 300;
  const ytScale = ytCaught ? interpolate(frame, [ytCatchFrame, ytCatchFrame + 10], [1, 0], { extrapolateRight: "clamp" }) : 1;

  // SoundCloud link floats from top-right — same set name
  const scOrbitAngle = frame * 0.035 + Math.PI;
  const scCatchFrame = 85;
  const scCaught = frame >= scCatchFrame;
  const scFloat = scCaught ? 0 : 1;
  const scX = scCaught ? 0 : Math.cos(scOrbitAngle) * 110 + 200;
  const scY = scCaught ? 0 : Math.sin(scOrbitAngle * 0.6) * 70 - 280;
  const scScale = scCaught ? interpolate(frame, [scCatchFrame, scCatchFrame + 10], [1, 0], { extrapolateRight: "clamp" }) : 1;

  // Button fills inside phone
  const ytFill = interpolate(frame, [88, 120], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const scFill = interpolate(frame, [98, 130], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  // Processing
  const processingOp = interpolate(frame, [145, 158, 195, 210], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const processingDots = frame >= 145 ? ".".repeat(Math.max(1, Math.min(3, Math.floor(((frame - 145) % 24) / 8) + 1))) : "";

  // Tracklist
  const tracklistOp = interpolate(frame, [210, 228], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Label text — ABOVE the phone
  const labelOp = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 18, stiffness: 40 } });
  // Label changes after tracklist appears
  const label2Op = spring({ frame: Math.max(0, frame - 225), fps, config: { damping: 18, stiffness: 35 } });

  const tracks = [
    { artist: "ADR & OUTTEN", title: "Good Luck", time: "0:00", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { artist: "Leon", title: "The Snake", time: "4:20", gradient: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)" },
    { artist: "M-High", title: "ID", time: "8:00", gradient: "linear-gradient(135deg, #2d3436 0%, #636e72 100%)", badge: "UNRELEASED" },
    { artist: "Prunk", title: "Holding On", time: "11:15", gradient: "linear-gradient(135deg, #55efc4 0%, #00b894 100%)" },
    { artist: "Floorplan", title: "Never Grow Old", time: "14:30", gradient: "linear-gradient(135deg, #fd79a8 0%, #e84393 100%)" },
    { artist: "Daft Punk", title: "HBFS (Alessi Edit)", time: "18:26", gradient: "linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)" },
    { artist: "Folamour", title: "Devoted To U", time: "20:45", gradient: "linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)" },
    { artist: "Special Ed", title: "Club Scene (Stussy Edit)", time: "22:30", gradient: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)" },
    { artist: "Across Boundaries", title: "Pumpin'", time: "26:00", gradient: "linear-gradient(135deg, #e17055 0%, #d63031 100%)" },
    { artist: "Soulphiction", title: "Freebase", time: "28:30", gradient: "linear-gradient(135deg, #b8e994 0%, #78e08f 100%)" },
    { artist: "Chris Stussy", title: "Darkness", time: "31:10", gradient: "linear-gradient(135deg, #C41E3A 0%, #9E1830 100%)", badge: "UNRELEASED", goldBadge: true, image: staticFile("chris-stussy.jpg") },
    { artist: "Lola", title: "Body Move", time: "34:50", gradient: "linear-gradient(135deg, #fab1a0 0%, #e17055 100%)" },
  ];

  // Smooth scroll — slow and gentle, starts after all tracks visible
  const scrollOffset = interpolate(frame, [310, 400], [0, 180], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  const exitOp = interpolate(frame, [390, 418], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background, opacity: exitOp }}>
      {/* Floating YouTube card — same set name */}
      {ytFloat > 0 && (
        <div style={{ position: "absolute", transform: `translate(${ytX}px, ${ytY}px) scale(${ytScale})`, zIndex: 15 }}>
          <div style={{ backgroundColor: colors.cardDarkSoft, borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, border: `2px solid ${colors.youtube}40`, boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: colors.youtube, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 0, height: 0, borderLeft: "8px solid white", borderTop: "5px solid transparent", borderBottom: "5px solid transparent", marginLeft: 2 }} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Chris Stussy — Alexandra Palace</div>
          </div>
        </div>
      )}

      {/* Floating SoundCloud card — same set name */}
      {scFloat > 0 && (
        <div style={{ position: "absolute", transform: `translate(${scX}px, ${scY}px) scale(${scScale})`, zIndex: 15 }}>
          <div style={{ backgroundColor: colors.cardDarkSoft, borderRadius: 14, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, border: `2px solid ${colors.soundcloud}40`, boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: colors.soundcloud, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 10 }}>
                {[4, 6, 10, 8, 5, 4].map((h, j) => <div key={j} style={{ width: 1.5, height: h, borderRadius: 1, backgroundColor: "white" }} />)}
              </div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Chris Stussy — Alexandra Palace</div>
          </div>
        </div>
      )}

      {/* Label text — ABOVE the phone, close to it */}
      <div style={{ position: "absolute", top: 240, opacity: tracklistOp < 0.5 ? labelOp : 0, zIndex: 20, padding: "0 40px" }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", letterSpacing: -2, lineHeight: 1.25 }}>
          paste a DJ set from
          <br />
          <span style={{ color: colors.youtube }}>YouTube</span> or <span style={{ color: colors.soundcloud }}>SoundCloud</span>
        </div>
      </div>

      {/* Second label above phone after tracklist */}
      <div style={{ position: "absolute", top: 250, opacity: label2Op, zIndex: 20, padding: "0 40px" }}>
        <div style={{ fontSize: 64, fontWeight: 800, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", letterSpacing: -2.5 }}>
          instant <span style={{ color: colors.primary }}>full tracklist.</span>
        </div>
      </div>

      {/* Phone */}
      <div style={{ transform: `scale(${phoneScale})`, marginTop: 80 }}>
        <IPhoneFrame width={440} height={880}>
          <div style={{ width: "100%", height: "100%", backgroundColor: colors.background, padding: 20, paddingTop: 55, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexShrink: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -0.5 }}>trakd</div>
              {tracklistOp > 0.5 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, opacity: tracklistOp }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#22C55E" }} />
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#22C55E", fontFamily: "SF Mono, monospace" }}>34 tracks</div>
                </div>
              )}
            </div>

            {/* Import UI with fill buttons */}
            <div style={{ opacity: 1 - tracklistOp, flexShrink: 0, display: tracklistOp > 0.9 ? "none" : "flex", flexDirection: "column" as const }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginBottom: 16 }}>Import a Set</div>

              {/* YouTube button with fill */}
              <div style={{ position: "relative", height: 52, borderRadius: 14, overflow: "hidden", marginBottom: 10, border: `2px solid ${ytFill > 0 ? colors.youtube + "60" : colors.border}` }}>
                <div style={{ position: "absolute", inset: 0, backgroundColor: colors.cardDarkSoft }} />
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${ytFill}%`, backgroundColor: colors.youtube, opacity: 0.9 }} />
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: "100%" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 5, backgroundColor: ytFill > 50 ? "rgba(255,255,255,0.3)" : colors.youtube, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 0, height: 0, borderLeft: "7px solid white", borderTop: "4px solid transparent", borderBottom: "4px solid transparent", marginLeft: 1 }} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>YouTube</div>
                </div>
              </div>

              {/* SoundCloud button with fill */}
              <div style={{ position: "relative", height: 52, borderRadius: 14, overflow: "hidden", marginBottom: 14, border: `2px solid ${scFill > 0 ? colors.soundcloud + "60" : colors.border}` }}>
                <div style={{ position: "absolute", inset: 0, backgroundColor: colors.cardDarkSoft }} />
                <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${scFill}%`, backgroundColor: colors.soundcloud, opacity: 0.9 }} />
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, height: "100%" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: scFill > 50 ? "rgba(255,255,255,0.3)" : colors.soundcloud, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 0.8, height: 9 }}>
                      {[3, 5, 8, 6, 4, 3].map((h, j) => <div key={j} style={{ width: 1.2, height: h, borderRadius: 0.5, backgroundColor: "white" }} />)}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>SoundCloud</div>
                </div>
              </div>

              {/* Processing — modern progress slider */}
              {processingOp > 0 && (() => {
                const loadProgress = interpolate(frame, [145, 205], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
                return (
                  <div style={{ opacity: processingOp, marginTop: 20, padding: "0 4px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Identifying tracks</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: colors.primary, fontFamily: "SF Mono, monospace" }}>{Math.round(loadProgress)}%</div>
                    </div>
                    <div style={{ width: "100%", height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }}>
                      <div style={{ width: `${loadProgress}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${colors.primary}, ${colors.primaryDark})`, boxShadow: `0 0 8px ${colors.primary}40` }} />
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Tracklist */}
            {tracklistOp > 0 && (
              <div style={{ opacity: tracklistOp, flex: 1, overflow: "hidden" }}>
                {/* Set card — fixed at top, doesn't scroll */}
                <div style={{ backgroundColor: colors.cardDarkSoft, borderRadius: 14, padding: 14, marginBottom: 10, border: `1.5px solid ${colors.primary}50`, flexShrink: 0, position: "relative", zIndex: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: colors.youtube, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 0, height: 0, borderLeft: "8px solid white", borderTop: "5px solid transparent", borderBottom: "5px solid transparent", marginLeft: 2 }} />
                      </div>
                      <div style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.soundcloud, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 0.6, height: 8 }}>
                          {[3, 5, 8, 6, 4].map((h, j) => <div key={j} style={{ width: 1, height: h, borderRadius: 0.5, backgroundColor: "white" }} />)}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Chris Stussy</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "SF Pro Display, -apple-system, sans-serif", marginTop: 2 }}>Alexandra Palace • 34 tracks</div>
                    </div>
                  </div>
                </div>

                {/* Scrolling track list — clipped separately */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ transform: `translateY(${-scrollOffset}px)` }}>
                    {tracks.map((track, i) => {
                      const trackDelay = 225 + i * 7;
                      const trackProgress = spring({ frame: Math.max(0, frame - trackDelay), fps, config: { damping: 22, stiffness: 55 } });
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 4px", borderBottom: `1px solid ${colors.borderLight}`, opacity: trackProgress, transform: `translateY(${(1 - trackProgress) * 12}px)` }}>
                          {/* Thumbnail */}
                          <div style={{ width: 38, height: 38, borderRadius: 8, background: track.gradient, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.08)", position: "relative", overflow: "hidden" }}>
                            {(track as any).image ? (
                              <Img src={(track as any).image} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              <div style={{ width: 14, height: 14, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,0,0,0.15) 0%, transparent 70%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 4, height: 4, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.5)" }} />
                              </div>
                            )}
                          </div>
                          <div style={{ fontSize: 9, color: colors.textMuted, fontFamily: "SF Mono, monospace", width: 38, fontWeight: 500, flexShrink: 0 }}>{track.time}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.title}</div>
                              {(track as any).badge && (
                                <div style={{ fontSize: 6, fontWeight: 800, color: (track as any).goldBadge ? "#1A1816" : "#FFF", background: (track as any).goldBadge ? "linear-gradient(135deg, #FFD700, #FFA500)" : colors.primary, padding: "2px 4px", borderRadius: 3, letterSpacing: 0.5, flexShrink: 0 }}>{(track as any).badge}</div>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: colors.textSecondary, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginTop: 1 }}>{track.artist}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </IPhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 3: Live Record — spinning rings, pocket, lasers ─────────────────
const LiveRecordScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase 1: Phone with record button + spinning rings (0-120)
  // Phase 2: Phone slips into pocket (120-175)
  // Phase 3: Dark with lasers + listening text (165-310)
  // Phase 4: Phone slides back up with setlist (300-500)

  const phoneScale = spring({ frame, fps, config: { damping: 22, stiffness: 30 } });

  // Label — appears early, stays longer
  const labelOp = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 18, stiffness: 40 } });
  const labelFade = interpolate(frame, [100, 130], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Record button press at frame 65 (a bit later, more buildup)
  const recordPressed = frame >= 65;
  const recordPulse = recordPressed ? Math.sin((frame - 65) * 0.12) * 0.5 + 0.5 : 0;

  // Spinning rings speed up after press
  const ringSpeed = recordPressed ? 0.08 + (frame - 65) * 0.002 : 0.03;
  const ringAngle = frame * ringSpeed * 60;

  // Phone pocket animation (120-175)
  const pocketProgress = interpolate(frame, [120, 175], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const phoneShrink = interpolate(pocketProgress, [0, 0.5, 1], [1, 0.6, 0.08]);
  const phoneSlideDown = interpolate(pocketProgress, [0, 1], [0, 900]);
  const phoneTilt = interpolate(pocketProgress, [0, 0.5, 1], [0, -5, 0]);

  // Dark laser phase — extended for more impact
  const isLaserPhase = frame >= 165 && frame < 315;
  const laserBgOp = interpolate(frame, [165, 185, 290, 315], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const laserTextOp = interpolate(frame, [190, 215, 275, 300], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Phone return — slower
  const isPhaseReturn = frame >= 305;
  const phoneReturn = spring({ frame: Math.max(0, frame - 310), fps, config: { damping: 16, stiffness: 28 } });
  const phoneReturnSlide = interpolate(phoneReturn, [0, 1], [600, 0]);

  const liveTracks = [
    { artist: "Peggy Gou", title: "Starry Night", time: "0:00", gradient: "linear-gradient(135deg, #fd79a8 0%, #e84393 100%)" },
    { artist: "DJ Koze", title: "Pick Up", time: "5:30", gradient: "linear-gradient(135deg, #55efc4 0%, #00b894 100%)" },
    { artist: "ID", title: "ID", time: "9:15", badge: "UNRELEASED", gradient: "linear-gradient(135deg, #2d3436 0%, #636e72 100%)" },
    { artist: "Chez Damier", title: "Can You Feel It", time: "13:00", gradient: "linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)" },
    { artist: "Peggy Gou", title: "I Go", time: "18:20", gradient: "linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)" },
    { artist: "Bicep", title: "Glue", time: "22:45", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { artist: "ID", title: "Untitled Edit", time: "27:00", badge: "ID", gradient: "linear-gradient(135deg, #C41E3A 0%, #9E1830 100%)" },
    { artist: "Todd Terje", title: "Inspector Norse", time: "31:30", gradient: "linear-gradient(135deg, #b8e994 0%, #78e08f 100%)" },
    { artist: "Ross From Friends", title: "Talk To Me", time: "35:00", gradient: "linear-gradient(135deg, #fab1a0 0%, #e17055 100%)" },
    { artist: "Peggy Gou", title: "Nabi", time: "38:20", gradient: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)" },
  ];

  // Gentle scroll for live tracks
  const liveScrollOffset = interpolate(frame, [420, 480], [0, 120], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  const exitOp = interpolate(frame, [468, 498], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background, opacity: exitOp }}>
      {/* Dark laser background overlay */}
      {laserBgOp > 0 && (
        <AbsoluteFill style={{ backgroundColor: `rgba(10,8,6,${laserBgOp * 0.95})`, zIndex: 25 }}>
          {/* Animated laser beams */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const laserAngle = (i * 30) + frame * 0.8;
            const laserX = 540 + Math.sin((frame * 0.02 + i * 1.2)) * 400;
            return (
              <div key={i} style={{
                position: "absolute",
                top: 0,
                left: laserX,
                width: 3,
                height: "100%",
                background: `linear-gradient(180deg, transparent 0%, ${colors.primary}${Math.floor(20 + Math.sin(frame * 0.05 + i) * 15).toString(16).padStart(2, '0')} 30%, ${colors.primary}${Math.floor(40 + Math.sin(frame * 0.08 + i * 0.5) * 25).toString(16).padStart(2, '0')} 50%, ${colors.primary}${Math.floor(20 + Math.sin(frame * 0.05 + i) * 15).toString(16).padStart(2, '0')} 70%, transparent 100%)`,
                transform: `rotate(${laserAngle - 90}deg)`,
                transformOrigin: "top center",
                opacity: 0.4 + Math.sin(frame * 0.1 + i * 0.8) * 0.3,
              }} />
            );
          })}
          {/* Wider glow beams */}
          {[0, 1, 2].map((i) => {
            const beamX = 540 + Math.sin(frame * 0.015 + i * 2) * 350;
            return (
              <div key={`glow-${i}`} style={{
                position: "absolute",
                top: 0,
                left: beamX - 20,
                width: 40,
                height: "100%",
                background: `linear-gradient(180deg, transparent 0%, rgba(196,30,58,${0.06 + Math.sin(frame * 0.06 + i) * 0.04}) 40%, rgba(196,30,58,${0.06 + Math.sin(frame * 0.06 + i) * 0.04}) 60%, transparent 100%)`,
                filter: "blur(15px)",
              }} />
            );
          })}

          {/* Listening text */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", opacity: laserTextOp, zIndex: 30 }}>
            <div style={{ fontSize: 50, fontWeight: 800, color: "white", fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", letterSpacing: -2, lineHeight: 1.25, textShadow: "0 0 40px rgba(196,30,58,0.5)" }}>
              phone in your pocket.
            </div>
            <div style={{ fontSize: 30, fontWeight: 500, color: "rgba(255,255,255,0.6)", fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", marginTop: 18, textShadow: "0 0 20px rgba(196,30,58,0.3)" }}>
              trakd is listening.
            </div>
          </div>
        </AbsoluteFill>
      )}

      {/* Phase 1 label — above phone */}
      {!isPhaseReturn && frame < 160 && (
        <div style={{ position: "absolute", top: 260, opacity: labelOp * labelFade, zIndex: 20, padding: "0 40px" }}>
          <div style={{ fontSize: 58, fontWeight: 800, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", letterSpacing: -2 }}>
            at a show? <span style={{ color: colors.primary }}>hit record.</span>
          </div>
        </div>
      )}

      {/* Phase 4 label — above phone */}
      {isPhaseReturn && (
        <div style={{ position: "absolute", top: 260, opacity: phoneReturn, zIndex: 20, padding: "0 40px" }}>
          <div style={{ fontSize: 58, fontWeight: 800, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", letterSpacing: -2 }}>
            pull it out. <span style={{ color: colors.primary }}>full setlist.</span>
          </div>
        </div>
      )}

      {/* Phone */}
      <div style={{
        transform: isPhaseReturn
          ? `scale(${phoneReturn}) translateY(${phoneReturnSlide}px)`
          : `scale(${phoneScale * phoneShrink}) translateY(${phoneSlideDown}px) rotate(${phoneTilt}deg)`,
        marginTop: 80,
        opacity: isPhaseReturn ? phoneReturn : (pocketProgress > 0.95 ? 0 : 1),
      }}>
        <div style={{ position: "relative" }}>
          <IPhoneFrame width={440} height={880}>
            <div style={{ width: "100%", height: "100%", backgroundColor: colors.background, padding: 20, paddingTop: 55, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -0.5, marginBottom: 16 }}>trakd</div>

              {/* Record UI with spinning rings */}
              {!isPhaseReturn && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Live Recording</div>

                  {/* Record button with spinning rings */}
                  <div style={{ position: "relative", width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {/* Outer spinning ring */}
                    <div style={{
                      position: "absolute",
                      width: 140,
                      height: 140,
                      borderRadius: "50%",
                      border: `3px solid transparent`,
                      borderTopColor: recordPressed ? colors.primary : "rgba(196,30,58,0.2)",
                      borderRightColor: recordPressed ? "rgba(196,30,58,0.4)" : "transparent",
                      transform: `rotate(${ringAngle}deg)`,
                      opacity: recordPressed ? 1 : 0.5,
                    }} />
                    {/* Middle spinning ring (opposite) */}
                    <div style={{
                      position: "absolute",
                      width: 122,
                      height: 122,
                      borderRadius: "50%",
                      border: `2px solid transparent`,
                      borderBottomColor: recordPressed ? colors.primary : "rgba(196,30,58,0.15)",
                      borderLeftColor: recordPressed ? "rgba(196,30,58,0.3)" : "transparent",
                      transform: `rotate(${-ringAngle * 1.3}deg)`,
                      opacity: recordPressed ? 0.8 : 0.3,
                    }} />
                    {/* Inner ring */}
                    <div style={{
                      position: "absolute",
                      width: 106,
                      height: 106,
                      borderRadius: "50%",
                      border: `2px solid transparent`,
                      borderTopColor: recordPressed ? "rgba(196,30,58,0.6)" : "rgba(196,30,58,0.1)",
                      transform: `rotate(${ringAngle * 1.8}deg)`,
                      opacity: recordPressed ? 0.6 : 0.2,
                    }} />
                    {/* Button */}
                    <div style={{
                      width: 90,
                      height: 90,
                      borderRadius: "50%",
                      border: `4px solid ${colors.primary}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: recordPressed ? `0 0 ${25 + recordPulse * 35}px rgba(196,30,58,${0.3 + recordPulse * 0.4})` : "0 4px 16px rgba(0,0,0,0.08)",
                    }}>
                      <div style={{
                        width: recordPressed ? 30 : 62,
                        height: recordPressed ? 30 : 62,
                        borderRadius: recordPressed ? 8 : 31,
                        backgroundColor: colors.primary,
                      }} />
                    </div>
                  </div>

                  {recordPressed && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: colors.primary, opacity: recordPulse }} />
                      <div style={{ fontSize: 15, fontWeight: 600, color: colors.primary, fontFamily: "SF Mono, monospace" }}>recording...</div>
                    </div>
                  )}

                  <div style={{ fontSize: 13, color: colors.textMuted, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", padding: "0 25px", lineHeight: 1.5 }}>
                    slip your phone in your pocket — we'll build your setlist
                  </div>
                </div>
              )}

              {/* Setlist results */}
              {isPhaseReturn && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: colors.primary }} />
                      <div style={{ fontSize: 12, fontWeight: 700, color: colors.primary, fontFamily: "SF Mono, monospace" }}>LIVE</div>
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#22C55E", fontFamily: "SF Mono, monospace" }}>10 tracks found</div>
                  </div>

                  {/* Set card — stays fixed */}
                  <div style={{ backgroundColor: colors.cardDarkSoft, borderRadius: 12, padding: 12, marginBottom: 12, border: `1.5px solid ${colors.primary}40`, flexShrink: 0, position: "relative", zIndex: 5 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Peggy Gou</div>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontFamily: "SF Pro Display, -apple-system, sans-serif", marginTop: 2 }}>Warehouse Project • Live Recording</div>
                  </div>

                  {/* Scrolling tracks */}
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ transform: `translateY(${-liveScrollOffset}px)` }}>
                      {liveTracks.map((track, i) => {
                        const trackAppear = spring({ frame: Math.max(0, frame - 325 - i * 8), fps, config: { damping: 20, stiffness: 50 } });
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4.5px 0", borderBottom: `1px solid ${colors.borderLight}`, opacity: trackAppear, transform: `translateY(${(1 - trackAppear) * 12}px)` }}>
                            {/* Thumbnail */}
                            <div style={{ width: 36, height: 36, borderRadius: 8, background: track.gradient, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
                              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,0,0,0.15) 0%, transparent 70%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <div style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.5)" }} />
                              </div>
                            </div>
                            <div style={{ fontSize: 9, color: colors.textMuted, fontFamily: "SF Mono, monospace", width: 36, flexShrink: 0 }}>{track.time}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>{track.title}</div>
                                {(track as any).badge && <div style={{ fontSize: 6, fontWeight: 800, color: "#FFF", backgroundColor: colors.primary, padding: "2px 4px", borderRadius: 3 }}>{(track as any).badge}</div>}
                              </div>
                              <div style={{ fontSize: 10, color: colors.textSecondary, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>{track.artist}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </IPhoneFrame>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 4: Unreleased Differentiation ───────────────────────────────────
const UnreleasedScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOp = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 20, stiffness: 30 } });
  const otherAppOp = spring({ frame: Math.max(0, frame - 55), fps, config: { damping: 18, stiffness: 35 } });
  const trakdOp = spring({ frame: Math.max(0, frame - 120), fps, config: { damping: 18, stiffness: 35 } });
  const taglineOp = spring({ frame: Math.max(0, frame - 185), fps, config: { damping: 18, stiffness: 35 } });

  const exitOp = interpolate(frame, [275, 308], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background, opacity: exitOp }}>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,30,58,0.1) 0%, transparent 55%)" }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30, padding: "0 50px", width: "100%" }}>
        {/* Title */}
        <div style={{ opacity: titleOp, transform: `translateY(${(1 - titleOp) * 25}px)`, textAlign: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -1.5, lineHeight: 1.2 }}>
            that track nobody
            <br />
            can identify?
          </div>
        </div>

        {/* Other apps fail */}
        <div style={{ opacity: otherAppOp, transform: `translateX(${(1 - otherAppOp) * 50}px)`, width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: colors.textMuted, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginBottom: 10, textAlign: "center" }}>
            other music recognition apps
          </div>
          <div style={{ backgroundColor: "rgba(45,42,38,0.06)", borderRadius: 18, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, border: `2px solid ${colors.border}` }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, background: "linear-gradient(135deg, #dfe6e9, #b2bec3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 26, color: "#636e72" }}>?</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 600, color: colors.textMuted, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>No result found</div>
              <div style={{ fontSize: 15, color: colors.textMuted, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginTop: 4, opacity: 0.6 }}>Not in our database</div>
            </div>
            <div style={{ fontSize: 32, color: "#d63031", flexShrink: 0 }}>✕</div>
          </div>
        </div>

        {/* trakd succeeds — Darkness by Chris Stussy */}
        <div style={{ opacity: trakdOp, transform: `translateX(${(1 - trakdOp) * -50}px)`, width: "100%" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginBottom: 10, textAlign: "center" }}>
            trakd
          </div>
          <div style={{ backgroundColor: colors.cardDarkSoft, borderRadius: 18, padding: "20px 24px", display: "flex", alignItems: "center", gap: 16, border: `2px solid ${colors.primary}50`, boxShadow: "0 6px 30px rgba(196,30,58,0.15)" }}>
            <div style={{ width: 56, height: 56, borderRadius: 14, overflow: "hidden", flexShrink: 0 }}>
              <Img src={staticFile("chris-stussy.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Darkness</div>
              <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", fontFamily: "SF Pro Display, -apple-system, sans-serif", marginTop: 4 }}>Chris Stussy</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#1A1816", background: "linear-gradient(135deg, #FFD700, #FFA500)", padding: "4px 10px", borderRadius: 6, marginTop: 8, display: "inline-block", letterSpacing: 0.5 }}>UNRELEASED</div>
            </div>
            <div style={{ fontSize: 32, color: "#22C55E", flexShrink: 0 }}>✓</div>
          </div>
        </div>

        {/* Tagline */}
        <div style={{ opacity: taglineOp, transform: `translateY(${(1 - taglineOp) * 20}px)`, textAlign: "center", marginTop: 4 }}>
          <div style={{ fontSize: 46, fontWeight: 800, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -1.5, lineHeight: 1.2 }}>
            we find them anyway.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5: Search for a Track ───────────────────────────────────────────
const SearchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneScale = spring({ frame, fps, config: { damping: 22, stiffness: 30 } });
  const labelOp = spring({ frame: Math.max(0, frame - 10), fps, config: { damping: 18, stiffness: 40 } });

  const searchQuery = "HBFS";
  const typeProgress = interpolate(frame, [45, 80], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const typedChars = Math.floor(typeProgress * searchQuery.length);

  const resultOp = spring({ frame: Math.max(0, frame - 95), fps, config: { damping: 18, stiffness: 40 } });
  const foundInOp = spring({ frame: Math.max(0, frame - 130), fps, config: { damping: 18, stiffness: 40 } });

  const exitOp = interpolate(frame, [240, 268], [1, 0], { extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background, opacity: exitOp }}>
      <div style={{ position: "absolute", top: 260, opacity: labelOp, zIndex: 20, padding: "0 40px" }}>
        <div style={{ fontSize: 56, fontWeight: 800, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", letterSpacing: -2 }}>
          heard a track you <span style={{ color: colors.primary }}>can't find?</span>
        </div>
      </div>

      <div style={{ transform: `scale(${phoneScale})`, marginTop: 80 }}>
        <IPhoneFrame width={440} height={880}>
          <div style={{ width: "100%", height: "100%", backgroundColor: colors.background, padding: 20, paddingTop: 60, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -0.5, marginBottom: 16 }}>trakd</div>

            <div style={{
              backgroundColor: colors.surface,
              borderRadius: 14,
              padding: "14px 16px",
              border: `2px solid ${typeProgress > 0 ? colors.primary : colors.border}`,
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <div style={{ fontSize: 16, color: colors.textMuted }}>🔍</div>
              <div style={{ fontSize: 15, color: typeProgress > 0 ? colors.text : colors.textMuted, fontFamily: "SF Pro Display, -apple-system, sans-serif", fontWeight: typeProgress > 0 ? 600 : 400 }}>
                {typeProgress > 0 ? searchQuery.slice(0, typedChars) : "Search for a track..."}
                {typeProgress > 0 && typeProgress < 1 && (
                  <span style={{ color: colors.primary, opacity: frame % 16 < 8 ? 1 : 0 }}>|</span>
                )}
              </div>
            </div>

            <div style={{ opacity: resultOp, transform: `translateY(${(1 - resultOp) * 20}px)` }}>
              <div style={{ backgroundColor: colors.cardDarkSoft, borderRadius: 14, padding: 16, border: `1.5px solid ${colors.primary}50` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,0,0,0.15) 0%, transparent 70%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.5)" }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>HBFS (Alessi Edit)</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "SF Pro Display, -apple-system, sans-serif", marginTop: 3 }}>Daft Punk</div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ opacity: foundInOp, transform: `translateY(${(1 - foundInOp) * 15}px)`, marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginBottom: 12 }}>
                found in 3 sets:
              </div>
              {[
                { artist: "Chris Stussy", venue: "Yuma Tent, Coachella", time: "18:26", accent: "#C41E3A" },
                { artist: "Folamour", venue: "Boiler Room", time: "42:10", accent: "#6C5CE7" },
                { artist: "DJ Seinfeld", venue: "Dekmantel", time: "55:30", accent: "#00B894" },
              ].map((set, i) => {
                const setAppear = spring({ frame: Math.max(0, frame - 140 - i * 15), fps, config: { damping: 18, stiffness: 50 } });
                return (
                  <div key={i} style={{ opacity: setAppear, transform: `translateX(${(1 - setAppear) * 25}px)`, marginBottom: 8 }}>
                    <div style={{ backgroundColor: colors.cardDarkSoft, borderRadius: 11, padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, border: "1px solid rgba(255,255,255,0.05)" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: `linear-gradient(135deg, ${set.accent}, ${set.accent}88)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "white" }}>{set.artist.charAt(0)}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>{set.artist}</div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>{set.venue} • at {set.time}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </IPhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 6: CTA ──────────────────────────────────────────────────────────
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoProgress = spring({ frame: Math.max(0, frame - 15), fps, config: { damping: 16, stiffness: 30 } });
  const taglineProgress = spring({ frame: Math.max(0, frame - 55), fps, config: { damping: 18, stiffness: 35 } });
  const featureProgress = spring({ frame: Math.max(0, frame - 100), fps, config: { damping: 18, stiffness: 35 } });
  const ctaProgress = spring({ frame: Math.max(0, frame - 155), fps, config: { damping: 20, stiffness: 35 } });
  const freeProgress = spring({ frame: Math.max(0, frame - 195), fps, config: { damping: 20, stiffness: 35 } });

  const features = [
    "import from YouTube & SoundCloud",
    "record live at the show",
    "search any set or track",
    "identifies unreleased tracks",
  ];

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,30,58,0.12) 0%, transparent 55%)", transform: `scale(${1 + Math.sin(frame * 0.06) * 0.03})` }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, width: "100%", maxWidth: 800, padding: "0 50px", marginTop: -40 }}>
        <div style={{ fontSize: 130, fontWeight: 900, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -6, textShadow: "0 0 80px rgba(196,30,58,0.25)", opacity: logoProgress, transform: `scale(${logoProgress})`, textAlign: "center" }}>
          trakd
        </div>

        <div style={{ fontSize: 34, fontWeight: 700, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -1, opacity: taglineProgress, textAlign: "center", lineHeight: 1.35 }}>
          every set. every track.
          <br />
          <span style={{ color: colors.primary }}>even the ones nobody else can find.</span>
        </div>

        <div style={{ opacity: featureProgress, transform: `translateY(${(1 - featureProgress) * 15}px)`, display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
          {features.map((feat, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: colors.primary, flexShrink: 0 }} />
              <div style={{ fontSize: 20, fontWeight: 600, color: colors.textSecondary, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>{feat}</div>
            </div>
          ))}
        </div>

        <div style={{ opacity: ctaProgress, transform: `translateY(${(1 - ctaProgress) * 15}px)`, marginTop: 12, textAlign: "center" }}>
          <div style={{ backgroundColor: colors.primary, borderRadius: 22, padding: "22px 64px", boxShadow: "0 8px 36px rgba(196,30,58,0.3)", display: "inline-block" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#FFFFFF", fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: 0.5 }}>Join the Waitlist</div>
          </div>
        </div>

        <div style={{ opacity: freeProgress, fontSize: 18, fontWeight: 500, color: colors.textMuted, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center" }}>
          free to download.
        </div>
      </div>
    </AbsoluteFill>
  );
};
