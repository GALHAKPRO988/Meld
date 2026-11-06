const COLORS = ["#ff806b", "#9be3c2", "#ffffff"];
const DURATION = 2000;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  color: string;
}

export function fireConfetti(): void {
  if (typeof window === "undefined" || typeof document === "undefined" || !document.body) return;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return;

  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * pixelRatio;
  canvas.height = height * pixelRatio;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "90",
  });
  document.body.appendChild(canvas);
  context.scale(pixelRatio, pixelRatio);

  const particles: Particle[] = Array.from({ length: 110 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 8;
    return {
      x: width / 2,
      y: height * 0.38,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.24,
      size: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    };
  });

  const startedAt = performance.now();
  const draw = (now: number) => {
    const elapsed = now - startedAt;
    if (elapsed >= DURATION) {
      canvas.remove();
      return;
    }

    context.clearRect(0, 0, width, height);
    const opacity = 1 - elapsed / DURATION;
    for (const particle of particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += 0.16;
      particle.vx *= 0.99;
      particle.rotation += particle.spin;

      context.save();
      context.globalAlpha = opacity;
      context.fillStyle = particle.color;
      context.translate(particle.x, particle.y);
      context.rotate(particle.rotation);
      context.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.65);
      context.restore();
    }
    window.requestAnimationFrame(draw);
  };

  window.requestAnimationFrame(draw);
}
