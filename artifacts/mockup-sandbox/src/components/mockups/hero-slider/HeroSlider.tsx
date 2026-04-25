import { useState, useEffect, useRef, useCallback } from "react";

const slides = [
  {
    id: 1,
    nurse: "/__mockup/images/nurses/nurse-female-1.png",
    nurseName: "Maria Santos",
    nurseTitle: "BSN, RN — California Licensed",
    badge: "⚡ NCLEX Made Simple",
    headline: "Your Trusted Partner for",
    highlight: "NCLEX Processing",
    sub: "Simplify your journey to becoming a licensed nurse in the USA. Fast, secure, and reliable application processing with real-time tracking.",
    stat1: { value: "500+", label: "Applications Processed" },
    stat2: { value: "98%", label: "Success Rate" },
    quote: "GritSync made the whole process stress-free. I got my ATT in record time!",
  },
  {
    id: 2,
    nurse: "/__mockup/images/nurses/nurse-female-2.png",
    nurseName: "Ana Reyes",
    nurseTitle: "BSN, RN — New York Licensed",
    badge: "🌟 Free Business Email Included",
    headline: "Your Dedicated",
    highlight: "@gritsync.com Email",
    sub: "Every account gets a professional business email for NCLEX correspondence — at no extra cost. Stand out and stay organized.",
    stat1: { value: "Free", label: "Business Email" },
    stat2: { value: "24/7", label: "Support Available" },
    quote: "Having a gritsync.com email made my applications look so professional!",
  },
  {
    id: 3,
    nurse: "/__mockup/images/nurses/nurse-male.png",
    nurseName: "Carlo Mendoza",
    nurseTitle: "BSN, RN — Texas Licensed",
    badge: "🚀 Start Today, Pass Tomorrow",
    headline: "Real-Time Tracking for",
    highlight: "Every Step Forward",
    sub: "Monitor your application status live. Get instant notifications, document reminders, and expert guidance — all in one dashboard.",
    stat1: { value: "50%", label: "Faster Processing" },
    stat2: { value: "5-Star", label: "Client Experience" },
    quote: "The tracking dashboard kept me informed every single day. Incredible!",
  },
];

export function HeroSlider() {
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goTo = useCallback(
    (idx: number) => {
      if (isAnimating || idx === current) return;
      setPrev(current);
      setCurrent(idx);
      setIsAnimating(true);
      setTimeout(() => {
        setPrev(null);
        setIsAnimating(false);
      }, 700);
    },
    [current, isAnimating]
  );

  const next = useCallback(() => {
    goTo((current + 1) % slides.length);
  }, [current, goTo]);

  useEffect(() => {
    autoRef.current = setTimeout(next, 5500);
    return () => {
      if (autoRef.current) clearTimeout(autoRef.current);
    };
  }, [current, next]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      setMousePos({ x, y });
    };
    el.addEventListener("mousemove", handleMove);
    return () => el.removeEventListener("mousemove", handleMove);
  }, []);

  const slide = slides[current];
  const prevSlide = prev !== null ? slides[prev] : null;

  const parallaxChar = {
    transform: `translate(${mousePos.x * -18}px, ${mousePos.y * -12}px)`,
    transition: "transform 0.15s ease-out",
  };

  const parallaxText = {
    transform: `translate(${mousePos.x * 8}px, ${mousePos.y * 5}px)`,
    transition: "transform 0.2s ease-out",
  };

  const parallaxBg = {
    transform: `translate(${mousePos.x * 4}px, ${mousePos.y * 3}px) scale(1.06)`,
    transition: "transform 0.3s ease-out",
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-screen overflow-hidden select-none cursor-default"
      style={{ background: "#0a1628" }}
    >
      {/* Fixed background (moves subtly with cursor) */}
      <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute inset-[-3%]"
          style={{
            ...parallaxBg,
            backgroundImage: `url(/__mockup/images/nurses/hero-bg.png)`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Dark overlay gradient */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(10,22,40,0.85) 0%, rgba(10,22,40,0.65) 50%, rgba(10,22,40,0.80) 100%)",
          }}
        />
        {/* Red accent glow left side */}
        <div
          className="absolute"
          style={{
            left: "-10%",
            top: "20%",
            width: "40%",
            height: "60%",
            background:
              "radial-gradient(ellipse at center, rgba(220,38,38,0.15) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Slide content wrapper */}
      <div className="relative h-full flex items-center" style={{ zIndex: 1 }}>
        <div className="w-full max-w-7xl mx-auto px-8 lg:px-16 flex items-center gap-8 lg:gap-16">

          {/* LEFT: Text content (parallax) */}
          <div className="flex-1 min-w-0" style={{ zIndex: 2 }}>
            <div style={parallaxText}>
              {/* Exiting text */}
              {prevSlide && (
                <div
                  key={`prev-text-${prev}`}
                  className="absolute"
                  style={{
                    animation: "slideOutLeft 0.6s ease-in-out forwards",
                    width: "100%",
                  }}
                >
                  <TextContent slide={prevSlide} />
                </div>
              )}

              {/* Entering text */}
              <div
                key={`curr-text-${current}`}
                style={{
                  animation: isAnimating
                    ? "slideInRight 0.6s ease-in-out forwards"
                    : "none",
                }}
              >
                <TextContent slide={slide} />
              </div>
            </div>
          </div>

          {/* RIGHT: Character (parallax, stronger) */}
          <div
            className="relative flex-shrink-0"
            style={{
              width: "clamp(280px, 38vw, 520px)",
              height: "clamp(420px, 75vh, 700px)",
              zIndex: 3,
            }}
          >
            <div
              className="w-full h-full relative"
              style={parallaxChar}
            >
              {/* Exiting character */}
              {prevSlide && (
                <img
                  key={`prev-char-${prev}`}
                  src={prevSlide.nurse}
                  alt={prevSlide.nurseName}
                  className="absolute inset-0 w-full h-full object-contain object-bottom"
                  style={{
                    animation: "charExitDown 0.55s ease-in forwards",
                    filter: "drop-shadow(0 20px 60px rgba(0,0,0,0.6))",
                  }}
                />
              )}

              {/* Entering character */}
              <img
                key={`curr-char-${current}`}
                src={slide.nurse}
                alt={slide.nurseName}
                className="absolute inset-0 w-full h-full object-contain object-bottom"
                style={{
                  animation: isAnimating
                    ? "charEnterUp 0.65s ease-out forwards"
                    : "none",
                  filter: "drop-shadow(0 20px 60px rgba(0,0,0,0.6))",
                }}
              />

              {/* Glow under character */}
              <div
                className="absolute bottom-0 left-1/2"
                style={{
                  transform: "translateX(-50%)",
                  width: "80%",
                  height: "60px",
                  background:
                    "radial-gradient(ellipse at center, rgba(220,38,38,0.35) 0%, transparent 70%)",
                  filter: "blur(12px)",
                }}
              />

              {/* Stat badges */}
              <StatBadge
                value={slide.stat1.value}
                label={slide.stat1.label}
                style={{ top: "12%", left: "-20%", animationDelay: "0.3s" }}
                accentColor="#DC2626"
                isAnimating={isAnimating}
              />
              <StatBadge
                value={slide.stat2.value}
                label={slide.stat2.label}
                style={{ top: "38%", right: "-18%", animationDelay: "0.5s" }}
                accentColor="#1d4ed8"
                isAnimating={isAnimating}
              />

              {/* Name card at bottom */}
              <div
                className="absolute bottom-4 left-1/2"
                style={{
                  transform: "translateX(-50%)",
                  background: "rgba(10,22,40,0.90)",
                  border: "1px solid rgba(220,38,38,0.4)",
                  borderRadius: "12px",
                  padding: "10px 20px",
                  whiteSpace: "nowrap",
                  backdropFilter: "blur(8px)",
                  animation: isAnimating ? "fadeInUp 0.5s 0.4s ease-out both" : "none",
                }}
              >
                <p className="text-white font-bold text-sm">{slide.nurseName}</p>
                <p className="text-sm" style={{ color: "#DC2626" }}>{slide.nurseTitle}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide navigation dots */}
      <div
        className="absolute bottom-8 left-1/2 flex gap-3"
        style={{
          transform: "translateX(-50%)",
          zIndex: 10,
        }}
      >
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="relative overflow-hidden"
            style={{
              width: i === current ? "36px" : "10px",
              height: "10px",
              borderRadius: "5px",
              background:
                i === current
                  ? "#DC2626"
                  : "rgba(255,255,255,0.3)",
              border: "none",
              cursor: "pointer",
              transition: "all 0.4s ease",
              padding: 0,
            }}
          >
            {i === current && (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  height: "100%",
                  width: "100%",
                  background:
                    "linear-gradient(90deg, rgba(255,255,255,0.4), transparent)",
                  animation: "shimmer 5.5s linear",
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Navigation arrows */}
      <button
        onClick={() => goTo((current - 1 + slides.length) % slides.length)}
        className="absolute left-4 top-1/2"
        style={{
          transform: "translateY(-50%)",
          zIndex: 10,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "50%",
          width: "44px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "white",
          fontSize: "18px",
          backdropFilter: "blur(8px)",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) =>
          ((e.target as HTMLButtonElement).style.background =
            "rgba(220,38,38,0.35)")
        }
        onMouseLeave={(e) =>
          ((e.target as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.08)")
        }
      >
        ‹
      </button>
      <button
        onClick={() => goTo((current + 1) % slides.length)}
        className="absolute right-4 top-1/2"
        style={{
          transform: "translateY(-50%)",
          zIndex: 10,
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "50%",
          width: "44px",
          height: "44px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "white",
          fontSize: "18px",
          backdropFilter: "blur(8px)",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) =>
          ((e.target as HTMLButtonElement).style.background =
            "rgba(220,38,38,0.35)")
        }
        onMouseLeave={(e) =>
          ((e.target as HTMLButtonElement).style.background =
            "rgba(255,255,255,0.08)")
        }
      >
        ›
      </button>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutLeft {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(-60px); }
        }
        @keyframes charEnterUp {
          from { opacity: 0; transform: translateY(60px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes charExitDown {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(60px) scale(0.96); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(100%); }
        }
        @keyframes badgePop {
          0%   { opacity: 0; transform: scale(0.7); }
          70%  { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

function TextContent({ slide }: { slide: (typeof slides)[0] }) {
  return (
    <div className="space-y-6">
      {/* Badge */}
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
        style={{
          background: "rgba(220,38,38,0.15)",
          border: "1px solid rgba(220,38,38,0.35)",
          color: "#fca5a5",
        }}
      >
        {slide.badge}
      </div>

      {/* Headline */}
      <div>
        <h1
          className="font-black leading-tight"
          style={{
            fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
            color: "white",
            lineHeight: 1.1,
          }}
        >
          {slide.headline}{" "}
          <span style={{ color: "#DC2626" }}>{slide.highlight}</span>
        </h1>
      </div>

      {/* Subtitle */}
      <p
        className="max-w-lg leading-relaxed"
        style={{ color: "rgba(255,255,255,0.7)", fontSize: "1rem" }}
      >
        {slide.sub}
      </p>

      {/* Quote */}
      <div
        className="flex items-start gap-3 p-4 rounded-xl max-w-md"
        style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(4px)",
        }}
      >
        <span style={{ color: "#DC2626", fontSize: "1.5rem", lineHeight: 1 }}>
          "
        </span>
        <p className="text-sm italic" style={{ color: "rgba(255,255,255,0.75)" }}>
          {slide.quote}
        </p>
      </div>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          className="px-7 py-3 rounded-lg font-bold text-white transition-all"
          style={{
            background: "#DC2626",
            boxShadow: "0 4px 24px rgba(220,38,38,0.4)",
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLButtonElement).style.background = "#b91c1c")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLButtonElement).style.background = "#DC2626")
          }
        >
          Apply Now →
        </button>
        <button
          className="px-7 py-3 rounded-lg font-semibold transition-all"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "white",
          }}
          onMouseEnter={(e) => {
            const el = e.target as HTMLButtonElement;
            el.style.background = "rgba(255,255,255,0.15)";
          }}
          onMouseLeave={(e) => {
            const el = e.target as HTMLButtonElement;
            el.style.background = "rgba(255,255,255,0.08)";
          }}
        >
          Get a Quote
        </button>
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap gap-4 pt-1">
        {["✓ No hidden fees", "✓ Free @gritsync.com email", "✓ 24/7 support"].map(
          (t) => (
            <span
              key={t}
              className="text-xs font-medium"
              style={{ color: "rgba(255,255,255,0.5)" }}
            >
              {t}
            </span>
          )
        )}
      </div>
    </div>
  );
}

function StatBadge({
  value,
  label,
  style,
  accentColor,
  isAnimating,
}: {
  value: string;
  label: string;
  style: React.CSSProperties;
  accentColor: string;
  isAnimating: boolean;
}) {
  return (
    <div
      className="absolute"
      style={{
        ...style,
        background: "rgba(10,22,40,0.88)",
        border: `1px solid ${accentColor}44`,
        borderRadius: "12px",
        padding: "10px 16px",
        backdropFilter: "blur(10px)",
        boxShadow: `0 8px 30px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}22`,
        animation: isAnimating
          ? `badgePop 0.5s ease-out forwards`
          : "float 4s ease-in-out infinite",
        minWidth: "110px",
        zIndex: 5,
      }}
    >
      <p
        className="text-xl font-black"
        style={{ color: accentColor, lineHeight: 1 }}
      >
        {value}
      </p>
      <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
        {label}
      </p>
    </div>
  );
}
