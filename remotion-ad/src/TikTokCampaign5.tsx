import React from "react";
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
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

// ─── Campaign 5: Multi-set import → Stussy deep dive (~23s) ────────────────
export const TikTokCampaign5: React.FC<Props> = ({ landscape = false }) => {
  return (
    <AbsoluteFill
      style={{ backgroundColor: colors.background, overflow: "hidden" }}
    >
      {/* Scene 1: All 8 set links orbit, catch, phone zooms (0-210) */}
      <Sequence from={0} durationInFrames={215}>
        <OrbitCatchScene />
      </Sequence>

      {/* Scene 2: Stussy import → logo fill → tracklist build (200-580) */}
      <Sequence from={200} durationInFrames={385}>
        <ImportAndBuildScene />
      </Sequence>

      {/* Scene 3: CTA (575-720) */}
      <Sequence from={575} durationInFrames={145}>
        <CTAScene />
      </Sequence>
    </AbsoluteFill>
  );
};

// ─── Scene 1: Orbit & Catch — all 8 links catch, then phone zooms ──────────
const OrbitCatchScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // All 8 links catch — staggered every ~13 frames
  const orbitLinks = [
    { platform: "youtube" as const, title: "Peggy Gou @ Boiler Room", color: colors.youtube, catchFrame: 30 },
    { platform: "soundcloud" as const, title: "Fred Again.. @ Coachella", color: colors.soundcloud, catchFrame: 43 },
    { platform: "youtube" as const, title: "Solomun @ Pacha Ibiza", color: colors.youtube, catchFrame: 56 },
    { platform: "soundcloud" as const, title: "Honey Dijon @ Printworks", color: colors.soundcloud, catchFrame: 69 },
    { platform: "youtube" as const, title: "Denis Sulta @ Sub Club", color: colors.youtube, catchFrame: 82 },
    { platform: "soundcloud" as const, title: "Keinemusik @ Burning Man", color: colors.soundcloud, catchFrame: 95 },
    { platform: "youtube" as const, title: "Ben Böhmer @ Cercle", color: colors.youtube, catchFrame: 108 },
    { platform: "soundcloud" as const, title: "DJ Seinfeld @ Dekmantel", color: colors.soundcloud, catchFrame: 121 },
  ];

  const setCards = [
    { artist: "Peggy Gou", venue: "Boiler Room", tracks: 28, accent: "#E84393" },
    { artist: "Fred Again..", venue: "Coachella", tracks: 22, accent: "#6C5CE7" },
    { artist: "Solomun", venue: "Pacha Ibiza", tracks: 31, accent: "#00B894" },
    { artist: "Honey Dijon", venue: "Printworks", tracks: 19, accent: "#FDCB6E" },
    { artist: "Denis Sulta", venue: "Sub Club", tracks: 24, accent: "#74B9FF" },
    { artist: "Keinemusik", venue: "Burning Man", tracks: 35, accent: "#FF7675" },
    { artist: "Ben Böhmer", venue: "Cercle", tracks: 18, accent: "#55EFC4" },
    { artist: "DJ Seinfeld", venue: "Dekmantel", tracks: 26, accent: "#A29BFE" },
  ];

  const phoneEntrance = spring({ frame, fps, config: { damping: 18, stiffness: 50 } });
  const orbitRadius = 420;

  const caughtCount = orbitLinks.filter((l) => frame >= l.catchFrame + 12).length;

  // Phone pulse on each catch
  const lastCatch = [...orbitLinks].reverse().find((l) => frame >= l.catchFrame && frame < l.catchFrame + 20);
  const phonePulse = lastCatch
    ? interpolate(frame, [lastCatch.catchFrame, lastCatch.catchFrame + 6, lastCatch.catchFrame + 18], [1, 1.05, 1], { extrapolateRight: "clamp" })
    : 1;

  const phoneGlow = interpolate(caughtCount, [0, 8], [0.03, 0.2], { extrapolateRight: "clamp" });

  // After all 8 caught (~frame 133), zoom the phone
  const allCaught = frame >= 133;
  const phoneZoom = allCaught
    ? spring({ frame: Math.max(0, frame - 138), fps, config: { damping: 14, stiffness: 40 } })
    : 0;
  const zoomScale = 1 + phoneZoom * 0.3; // scale from 1.0 to 1.3

  const exitOpacity = interpolate(frame, [180, 210], [1, 0], { extrapolateLeft: "clamp" });

  // Scroll offset for set cards list when more than fit
  const cardListScroll = interpolate(caughtCount, [5, 8], [0, 120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background, opacity: exitOpacity }}>
      {/* Background glow */}
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", background: `radial-gradient(circle, rgba(196,30,58,${phoneGlow}) 0%, transparent 55%)`, transform: `scale(${1 + Math.sin(frame * 0.06) * 0.03})` }} />

      {/* Orbit ring — fades after all caught */}
      <div style={{ position: "absolute", width: orbitRadius * 2, height: orbitRadius * 2, borderRadius: "50%", border: "1px solid rgba(196,30,58,0.06)", opacity: interpolate(frame, [10, 25, 133, 150], [0, 0.6, 0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }} />

      {/* Orbiting link cards — dark themed */}
      {orbitLinks.map((link, i) => {
        const appearFrame = 5 + i * 3;
        const itemAppear = spring({ frame: Math.max(0, frame - appearFrame), fps, config: { damping: 14, stiffness: 60 } });
        const baseAngle = (i / orbitLinks.length) * Math.PI * 2;
        const angle = baseAngle + frame * 0.03;
        const isCatching = frame >= link.catchFrame;
        const catchProgress = isCatching
          ? interpolate(frame, [link.catchFrame, link.catchFrame + 12], [0, 1], { extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) })
          : 0;
        if (catchProgress >= 1) return null;
        const orbitX = Math.cos(angle) * orbitRadius;
        const orbitY = Math.sin(angle) * orbitRadius;
        const x = orbitX * (1 - catchProgress);
        const y = orbitY * (1 - catchProgress);
        const cardScale = (0.65 + Math.sin(angle * 0.5) * 0.05) * (1 - catchProgress * 0.6) * itemAppear;
        const cardOpacity = itemAppear * (1 - catchProgress * 0.3);
        const rotation = Math.sin(angle * 0.3) * 6;

        return (
          <div key={i} style={{ position: "absolute", transform: `translate(${x}px, ${y}px) scale(${cardScale}) rotate(${rotation}deg)`, opacity: cardOpacity, zIndex: 2 }}>
            <div style={{
              backgroundColor: colors.cardDark,
              borderRadius: 12,
              padding: "8px 12px",
              border: `1.5px solid ${link.color}30`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.25), 0 0 12px ${link.color}15`,
              width: 200,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <div style={{ width: 18, height: 18, borderRadius: link.platform === "youtube" ? 4 : 9, backgroundColor: link.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {link.platform === "youtube" ? (
                    <div style={{ width: 0, height: 0, borderLeft: "5px solid white", borderTop: "3px solid transparent", borderBottom: "3px solid transparent", marginLeft: 1 }} />
                  ) : (
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 0.7, height: 7 }}>
                      {[3, 5, 7, 5, 4, 3].map((h, j) => <div key={j} style={{ width: 1, height: h, borderRadius: 0.5, backgroundColor: "white" }} />)}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 8, fontWeight: 700, color: link.color, fontFamily: "SF Pro Display, -apple-system, sans-serif", textTransform: "capitalize" }}>{link.platform}</div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{link.title}</div>
            </div>
          </div>
        );
      })}

      {/* Catch flash rings */}
      {orbitLinks.map((link, i) => {
        if (frame < link.catchFrame || frame > link.catchFrame + 22) return null;
        const ringProgress = interpolate(frame, [link.catchFrame + 4, link.catchFrame + 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        return <div key={`ring-${i}`} style={{ position: "absolute", width: 180 + ringProgress * 180, height: 180 + ringProgress * 180, borderRadius: "50%", border: `2px solid rgba(196,30,58,${0.3 * (1 - ringProgress)})`, opacity: 1 - ringProgress }} />;
      })}

      {/* Phone — zooms after all caught */}
      <div style={{ transform: `scale(${phoneEntrance * phonePulse * zoomScale})`, zIndex: 10 }}>
        <IPhoneFrame width={300} height={600}>
          <div style={{ width: "100%", height: "100%", backgroundColor: colors.background, padding: 12, paddingTop: 45, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -0.5, marginBottom: 8, flexShrink: 0 }}>trakd</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginBottom: 6, flexShrink: 0 }}>Your Sets</div>

            {/* Set cards — dark themed, scrolls as more appear */}
            <div style={{ flex: 1, overflow: "hidden" }}>
              <div style={{ transform: `translateY(${-cardListScroll}px)` }}>
                {setCards.map((card, i) => {
                  const cardCatchFrame = orbitLinks[i].catchFrame;
                  const cardAppear = spring({ frame: Math.max(0, frame - cardCatchFrame - 8), fps, config: { damping: 16, stiffness: 80 } });
                  if (frame < cardCatchFrame + 5) return null;
                  return (
                    <div key={i} style={{ opacity: cardAppear, transform: `translateY(${(1 - cardAppear) * 12}px) scale(${0.95 + cardAppear * 0.05})`, marginBottom: 4 }}>
                      <div style={{ backgroundColor: colors.cardDarkSoft, borderRadius: 9, padding: "6px 9px", border: `1px solid rgba(255,255,255,0.06)`, display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${card.accent}, ${card.accent}88)`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: "white", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>{card.artist.charAt(0)}</div>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 8, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.artist}</div>
                          <div style={{ fontSize: 7, color: "rgba(255,255,255,0.5)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>{card.venue} • {card.tracks} tracks</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </IPhoneFrame>
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: Import → Logo Fill → Tracklist Build (continuous phone) ──────
const ImportAndBuildScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const tracks = [
    { artist: "ADR & OUTTEN", title: "Good Luck", time: "0:00", gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
    { artist: "Leon", title: "The Snake", time: "4:20", gradient: "linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%)" },
    { artist: "M-High", title: "ID", time: "8:00", gradient: "linear-gradient(135deg, #2d3436 0%, #636e72 100%)", badge: "UNRELEASED" },
    { artist: "Prunk", title: "Holding On", time: "11:15", gradient: "linear-gradient(135deg, #55efc4 0%, #00b894 100%)" },
    { artist: "Floorplan", title: "Never Grow Old", time: "14:30", gradient: "linear-gradient(135deg, #fd79a8 0%, #e84393 100%)" },
    { artist: "Daft Punk", title: "HBFS (Alessi & Brando Edit)", time: "18:26", gradient: "linear-gradient(135deg, #fdcb6e 0%, #e17055 100%)" },
    { artist: "Folamour", title: "Devoted To U", time: "20:45", gradient: "linear-gradient(135deg, #a29bfe 0%, #6c5ce7 100%)" },
    { artist: "Special Ed", title: "Club Scene (Stussy Edit)", time: "22:30", gradient: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)" },
    { artist: "Across Boundaries", title: "Pumpin'", time: "26:00", gradient: "linear-gradient(135deg, #e17055 0%, #d63031 100%)" },
    { artist: "Soulphiction", title: "Freebase", time: "28:30", gradient: "linear-gradient(135deg, #b8e994 0%, #78e08f 100%)" },
    { artist: "J.K. Rollin", title: "Where's The Party At?", time: "31:30", gradient: "linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)" },
    { artist: "Session Victim", title: "Dawn", time: "33:45", gradient: "linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%)" },
    { artist: "Hidde Van Wee", title: "Aspire To Inspire", time: "36:30", gradient: "linear-gradient(135deg, #55a3f8 0%, #2d6cdf 100%)" },
    { artist: "Boo Williams", title: "Residual", time: "38:15", gradient: "linear-gradient(135deg, #636e72 0%, #2d3436 100%)" },
    { artist: "Chris Stussy", title: "Won't Stop (Don't)", time: "40:00", gradient: "linear-gradient(135deg, #C41E3A 0%, #9E1830 100%)" },
    { artist: "ID", title: "ID", time: "45:13", gradient: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)", badge: "ID" },
    { artist: "Roman Flügel", title: "Wilkie", time: "47:00", gradient: "linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)" },
    { artist: "Milion", title: "LET'S GO B$NG", time: "50:00", gradient: "linear-gradient(135deg, #ff6b9d 0%, #c44569 100%)" },
    { artist: "Fantastic Man", title: "Solar Surfing", time: "52:15", gradient: "linear-gradient(135deg, #f9ca24 0%, #f0932b 100%)" },
    { artist: "Chris Stussy & S.A.M.", title: "Breather", time: "54:30", gradient: "linear-gradient(135deg, #00b894 0%, #00cec9 100%)" },
    { artist: "DJ Seinfeld", title: "U", time: "56:00", gradient: "linear-gradient(135deg, #dfe6e9 0%, #b2bec3 100%)" },
    { artist: "Papa Nugs", title: "Move It Or Lose It", time: "58:00", gradient: "linear-gradient(135deg, #ff7675 0%, #fab1a0 100%)" },
    { artist: "Palms Trax", title: "Equation", time: "1:00:00", gradient: "linear-gradient(135deg, #55efc4 0%, #81ecec 100%)" },
    { artist: "Julian Fijma", title: "Get Stupid", time: "1:02:30", gradient: "linear-gradient(135deg, #fdcb6e 0%, #f39c12 100%)" },
  ];

  const phoneScale = spring({ frame, fps, config: { damping: 20, stiffness: 40 } });

  // ── Phase 1: Links converge (15-55) ──
  const convergeProgress = interpolate(frame, [15, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const ytX = -400 * (1 - convergeProgress);
  const ytY = -260 * (1 - convergeProgress);
  const scX = 400 * (1 - convergeProgress);
  const scY = -210 * (1 - convergeProgress);
  const linkScale = 1 - convergeProgress * 0.7;
  const linkOpacity = 1 - convergeProgress * 0.8;
  const flashOpacity = convergeProgress > 0.95 ? interpolate(frame, [55, 60, 70], [0, 0.25, 0], { extrapolateRight: "clamp" }) : 0;

  // ── Phase 2: Buttons fill (60-90) — dark buttons with platform color fill ──
  const ytFill = interpolate(frame, [60, 78], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const scFill = interpolate(frame, [70, 88], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  // ── Phase 3: Logo fill (95-160) ──
  const logoAppear = spring({ frame: Math.max(0, frame - 95), fps, config: { damping: 16, stiffness: 60 } });
  const logoFillProgress = interpolate(frame, [100, 155], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const logoVisible = interpolate(frame, [95, 100, 160, 178], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // ── Phase 4: Import fades, tracklist appears (175+) ──
  const importSectionOpacity = interpolate(frame, [168, 182], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tracklistAppear = spring({ frame: Math.max(0, frame - 182), fps, config: { damping: 18, stiffness: 50 } });

  // ── Scroll ──
  const scrollOffset = interpolate(frame, [290, 355], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });

  // ── Exit ──
  const exitOpacity = interpolate(frame, [355, 382], [1, 0], { extrapolateLeft: "clamp" });

  const inTracklist = frame >= 182;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background, opacity: exitOpacity }}>
      <div style={{ position: "absolute", inset: 0, backgroundColor: `rgba(196,30,58,${flashOpacity})`, zIndex: 20 }} />
      <div style={{ position: "absolute", width: 700, height: 700, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,30,58,0.08) 0%, transparent 55%)", opacity: phoneScale }} />

      {/* YouTube link card — dark themed */}
      {convergeProgress < 1 && (
        <div style={{ position: "absolute", transform: `translate(${ytX}px, ${ytY}px) scale(${linkScale})`, opacity: linkOpacity, zIndex: 5 }}>
          <div style={{ backgroundColor: colors.cardDark, borderRadius: 14, padding: "12px 16px", border: `1.5px solid ${colors.youtube}30`, boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 12px ${colors.youtube}15`, width: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 5, backgroundColor: colors.youtube, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 0, height: 0, borderLeft: "7px solid white", borderTop: "4px solid transparent", borderBottom: "4px solid transparent", marginLeft: 1 }} />
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Chris Stussy @ Alexandra Palace</div>
            </div>
          </div>
        </div>
      )}

      {/* SoundCloud link card — dark themed */}
      {convergeProgress < 1 && (
        <div style={{ position: "absolute", transform: `translate(${scX}px, ${scY}px) scale(${linkScale})`, opacity: linkOpacity, zIndex: 5 }}>
          <div style={{ backgroundColor: colors.cardDark, borderRadius: 14, padding: "12px 16px", border: `1.5px solid ${colors.soundcloud}30`, boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 12px ${colors.soundcloud}15`, width: 300 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.soundcloud, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 10 }}>
                  {[5, 8, 11, 9, 6, 4].map((h, j) => <div key={j} style={{ width: 1.5, height: h, borderRadius: 1, backgroundColor: "white" }} />)}
                </div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Chris Stussy @ Alexandra Palace</div>
            </div>
          </div>
        </div>
      )}

      {/* Phone */}
      <div style={{ transform: `scale(${phoneScale})`, zIndex: 10 }}>
        <IPhoneFrame width={400} height={800}>
          <div style={{ width: "100%", height: "100%", backgroundColor: colors.background, padding: 16, paddingTop: 50, display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexShrink: 0 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -0.5 }}>trakd</div>
              {inTracklist && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, opacity: tracklistAppear }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "#22C55E" }} />
                  <div style={{ fontSize: 10, fontWeight: 600, color: "#22C55E", fontFamily: "SF Mono, monospace" }}>Imported</div>
                </div>
              )}
            </div>

            {/* ═══ Import Phase ═══ */}
            {!inTracklist && (
              <div style={{ opacity: importSectionOpacity, display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginBottom: 16 }}>Add a Set</div>

                {/* Dark platform buttons with color fill */}
                <div style={{ display: "flex", gap: 10, marginBottom: 24, flexShrink: 0 }}>
                  {/* YouTube button */}
                  <div style={{ flex: 1, position: "relative", borderRadius: 14, overflow: "hidden", backgroundColor: colors.cardDarkSoft, border: `2px solid ${ytFill > 50 ? colors.youtube : "rgba(255,255,255,0.08)"}`, height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${ytFill}%`, backgroundColor: `${colors.youtube}25` }} />
                    <div style={{ width: 20, height: 20, borderRadius: 4, backgroundColor: colors.youtube, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, opacity: ytFill > 30 ? 1 : 0.5 }}>
                      <div style={{ width: 0, height: 0, borderLeft: "5px solid white", borderTop: "3px solid transparent", borderBottom: "3px solid transparent", marginLeft: 1 }} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: ytFill > 30 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)", fontFamily: "SF Pro Display, -apple-system, sans-serif", zIndex: 1 }}>YouTube</div>
                    {ytFill >= 100 && <div style={{ fontSize: 13, color: "#22C55E", fontWeight: 800, zIndex: 1 }}>✓</div>}
                  </div>
                  {/* SoundCloud button */}
                  <div style={{ flex: 1, position: "relative", borderRadius: 14, overflow: "hidden", backgroundColor: colors.cardDarkSoft, border: `2px solid ${scFill > 50 ? colors.soundcloud : "rgba(255,255,255,0.08)"}`, height: 52, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${scFill}%`, backgroundColor: `${colors.soundcloud}25` }} />
                    <div style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.soundcloud, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, opacity: scFill > 30 ? 1 : 0.5 }}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 0.8, height: 8 }}>
                        {[3, 6, 9, 7, 5, 3].map((h, j) => <div key={j} style={{ width: 1.2, height: h, borderRadius: 0.6, backgroundColor: "white" }} />)}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: scFill > 30 ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.4)", fontFamily: "SF Pro Display, -apple-system, sans-serif", zIndex: 1 }}>SoundCloud</div>
                    {scFill >= 100 && <div style={{ fontSize: 13, color: "#22C55E", fontWeight: 800, zIndex: 1 }}>✓</div>}
                  </div>
                </div>

                {/* Logo fill — below buttons */}
                {logoVisible > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, opacity: logoVisible * logoAppear }}>
                    <div style={{ position: "relative", fontSize: 56, fontWeight: 900, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -3, lineHeight: 1 }}>
                      <div style={{ color: "rgba(196,30,58,0.12)", WebkitTextStroke: "1.5px rgba(196,30,58,0.15)" }}>
                        trak<span style={{ fontWeight: 900 }}>d</span>
                      </div>
                      <div style={{ position: "absolute", top: 0, left: 0, color: colors.primary, clipPath: `inset(0 ${100 - logoFillProgress}% 0 0)`, textShadow: `0 0 ${20 + logoFillProgress * 0.3}px rgba(196,30,58,${0.1 + logoFillProgress * 0.002})` }}>
                        trak<span style={{ fontWeight: 900 }}>d</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: colors.textMuted, fontFamily: "SF Mono, monospace", marginTop: 12, letterSpacing: 1 }}>
                      {logoFillProgress < 100 ? "identifying tracks..." : "complete"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ═══ Tracklist Phase ═══ */}
            {inTracklist && (
              <div style={{ opacity: tracklistAppear, transform: `translateY(${(1 - tracklistAppear) * 20}px)`, display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
                {/* Set card — dark themed */}
                <div style={{ backgroundColor: colors.cardDarkSoft, borderRadius: 14, padding: 12, marginBottom: 10, border: `1.5px solid ${colors.primary}50`, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 7, backgroundColor: colors.youtube, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(255,0,0,0.2)" }}>
                        <div style={{ width: 0, height: 0, borderLeft: "8px solid white", borderTop: "5px solid transparent", borderBottom: "5px solid transparent", marginLeft: 1 }} />
                      </div>
                      <div style={{ width: 32, height: 32, borderRadius: 7, backgroundColor: colors.soundcloud, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(255,85,0,0.2)" }}>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: 0.8, height: 9 }}>
                          {[4, 7, 10, 8, 5, 3].map((h, j) => <div key={j} style={{ width: 1.3, height: h, borderRadius: 0.8, backgroundColor: "white" }} />)}
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>Chris Stussy</div>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", fontFamily: "SF Pro Display, -apple-system, sans-serif", marginTop: 1 }}>Alexandra Palace • 34 tracks</div>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 9, color: colors.textMuted, letterSpacing: 2, fontWeight: 600, marginBottom: 6, fontFamily: "SF Pro Display, -apple-system, sans-serif", flexShrink: 0 }}>FULL SETLIST</div>

                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ transform: `translateY(${-scrollOffset}px)` }}>
                    {tracks.map((track, index) => {
                      const trackDelay = index * 5;
                      const trackProgress = spring({ frame: Math.max(0, frame - 190 - trackDelay), fps, config: { damping: 20, stiffness: 80 } });
                      return (
                        <div key={index} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 3px", borderBottom: `1px solid ${colors.borderLight}`, opacity: trackProgress, transform: `translateX(${(1 - trackProgress) * 30}px)` }}>
                          <div style={{ width: 32, height: 32, borderRadius: 7, background: track.gradient, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
                            <div style={{ width: 13, height: 13, borderRadius: "50%", background: "radial-gradient(circle, rgba(0,0,0,0.2) 0%, transparent 70%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ width: 3, height: 3, borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.5)" }} />
                            </div>
                          </div>
                          <div style={{ fontSize: 8, color: colors.textMuted, fontFamily: "SF Mono, monospace", width: 38, fontWeight: 500, flexShrink: 0 }}>{track.time}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.title}</div>
                              {(track as any).badge && (
                                <div style={{ fontSize: 5, fontWeight: 800, color: "#FFF", backgroundColor: colors.primary, padding: "1px 3px", borderRadius: 2, letterSpacing: 0.5, flexShrink: 0, fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>{(track as any).badge}</div>
                              )}
                            </div>
                            <div style={{ fontSize: 8, color: colors.textSecondary, fontFamily: "SF Pro Display, -apple-system, sans-serif", marginTop: 1 }}>{track.artist}</div>
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

// ─── Scene 3: CTA — centered ───────────────────────────────────────────────
const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const taglineProgress = spring({ frame, fps, config: { damping: 14, stiffness: 70 } });
  const logoProgress = spring({ frame: Math.max(0, frame - 22), fps, config: { damping: 12, stiffness: 65 } });
  const ctaProgress = spring({ frame: Math.max(0, frame - 42), fps, config: { damping: 16, stiffness: 60 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", background: "radial-gradient(circle, rgba(196,30,58,0.12) 0%, transparent 55%)", transform: `scale(${1 + Math.sin(frame * 0.08) * 0.04})` }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, width: "100%", maxWidth: 900, padding: "0 36px", marginTop: -60 }}>
        {/* Platform pills — dark themed */}
        <div style={{ display: "flex", gap: 12, opacity: taglineProgress, transform: `translateY(${(1 - taglineProgress) * 15}px)`, alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: colors.cardDarkSoft, borderRadius: 12, padding: "10px 20px" }}>
            <div style={{ width: 24, height: 24, borderRadius: 5, backgroundColor: colors.youtube, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 0, height: 0, borderLeft: "7px solid white", borderTop: "4px solid transparent", borderBottom: "4px solid transparent", marginLeft: 1 }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>YouTube</div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 300, color: colors.textMuted }}>+</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, backgroundColor: colors.cardDarkSoft, borderRadius: 12, padding: "10px 20px" }}>
            <div style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.soundcloud, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 1, height: 10 }}>
                {[4, 7, 10, 8, 5, 3].map((h, j) => <div key={j} style={{ width: 1.5, height: h, borderRadius: 1, backgroundColor: "white" }} />)}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.9)", fontFamily: "SF Pro Display, -apple-system, sans-serif" }}>SoundCloud</div>
          </div>
        </div>

        <div style={{ fontSize: 30, color: colors.textMuted, opacity: taglineProgress, transform: `translateY(${(1 - taglineProgress) * 10}px)`, textAlign: "center" }}>↓</div>

        <div style={{ fontSize: 120, fontWeight: 900, color: colors.primary, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -5, textShadow: "0 0 80px rgba(196,30,58,0.25)", opacity: logoProgress, transform: `scale(${logoProgress})`, textAlign: "center" }}>trakd</div>

        <div style={{ fontSize: 32, fontWeight: 600, color: colors.text, fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: -0.5, opacity: logoProgress, textAlign: "center", lineHeight: 1.3 }}>
          every set. every track. instant.
        </div>

        {/* Unreleased stat */}
        <div style={{ fontSize: 20, fontWeight: 600, color: colors.textSecondary, fontFamily: "SF Pro Display, -apple-system, sans-serif", textAlign: "center", opacity: logoProgress, letterSpacing: -0.3 }}>
          yes, even the unreleased ones.
        </div>

        <div style={{ opacity: ctaProgress, transform: `translateY(${(1 - ctaProgress) * 15}px)`, marginTop: 6, textAlign: "center" }}>
          <div style={{ backgroundColor: colors.primary, borderRadius: 18, padding: "18px 56px", boxShadow: "0 6px 30px rgba(196,30,58,0.3)", display: "inline-block" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#FFFFFF", fontFamily: "SF Pro Display, -apple-system, sans-serif", letterSpacing: 0.5 }}>Join the Waitlist</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
