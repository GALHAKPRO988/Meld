import type { SVGProps } from "react";
import type { ProviderId } from "@/lib/ai/providers";

type P = SVGProps<SVGSVGElement> & { size?: number };

export function OverlapSquaresIcon({ size = 30, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" {...p}>
      <rect x="1.5" y="1.5" width="18.5" height="18.5" rx="5" fill="currentColor" />
      <rect x="9.6" y="9.6" width="19" height="19" rx="5" fill="currentColor" stroke="oklch(0.24 0 0)" strokeWidth="2.4" />
    </svg>
  );
}

export function SlidersIcon({ size = 30, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...p}>
      <path d="M3 8h13M22 8h7" />
      <circle cx="19" cy="8" r="3" />
      <path d="M3 16h5M14 16h15" />
      <circle cx="11" cy="16" r="3" />
      <path d="M3 24h15M24 24h5" />
      <circle cx="21" cy="24" r="3" />
    </svg>
  );
}

export function WrenchIcon({ size = 22, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M21.3 6.2a.6.6 0 0 0-1-.3l-2.9 2.9-2.4-.6-.6-2.4 2.9-2.9a.6.6 0 0 0-.3-1A6 6 0 0 0 9.6 9.4L2.9 16.1a2.6 2.6 0 0 0 3.7 3.7l6.7-6.7a6 6 0 0 0 8-6.9ZM4.8 19a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
    </svg>
  );
}

export function ClaudeLogo({ size = 24, ...p }: P) {
  const rays: [number, number][] = [
    [0, 11],
    [28, 9],
    [58, 11.5],
    [90, 9.5],
    [118, 11],
    [150, 9],
    [180, 11.5],
    [208, 9.5],
    [238, 11],
    [270, 9],
    [300, 11.5],
    [330, 10],
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...p}>
      <g stroke="var(--coral)" strokeWidth="1.9" strokeLinecap="round">
        {rays.map(([deg, len]) => (
          <line key={deg} x1="12" y1="12" x2={12 + len * Math.cos((deg * Math.PI) / 180)} y2={12 + len * Math.sin((deg * Math.PI) / 180)} />
        ))}
      </g>
    </svg>
  );
}

export function OpenAILogo({ size = 22, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}>
      {[0, 60, 120, 180, 240, 300].map((r) => (
        <path key={r} transform={`rotate(${r} 12 12)`} d="M12 3.2c2.2 0 4 1.6 4.3 3.7L12 9.4 8 7.1V6.9c.3-2.1 1.8-3.7 4-3.7Z" />
      ))}
    </svg>
  );
}

export function GeminiLogo({ size = 22, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...p}>
      <defs>
        <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--info)" />
          <stop offset="1" stopColor="var(--coral)" />
        </linearGradient>
      </defs>
      <path fill="url(#gem)" d="M12 2c.6 5.3 4.7 9.4 10 10-5.3.6-9.4 4.7-10 10-.6-5.3-4.7-9.4-10-10 5.3-.6 9.4-4.7 10-10Z" />
    </svg>
  );
}

export function OpenRouterLogo({ size = 22, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" {...p}>
      <path d="M3 12h4c3 0 4-5 7-5h4M3 12h4c3 0 4 5 7 5h4" />
      <path d="m16 4 3 3-3 3M16 14l3 3-3 3" />
    </svg>
  );
}

export function ProviderLogo({ provider, size = 22 }: { provider: ProviderId; size?: number }) {
  switch (provider) {
    case "anthropic":
      return <ClaudeLogo size={size} />;
    case "openai":
      return <OpenAILogo size={size} />;
    case "google":
      return <GeminiLogo size={size} />;
    case "openrouter":
      return <OpenRouterLogo size={size} />;
  }
}
