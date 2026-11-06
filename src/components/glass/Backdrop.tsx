/** SVG refraction filter + slow moving halos that the glass refracts. */
export function GlassFilters() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        <filter id="meld-refract" x="0%" y="0%" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="7" result="noise" />
          <feGaussianBlur in="noise" stdDeviation="2" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

export function Halo() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden>
      <div className="halo-coral absolute left-[5%] top-[30%] h-[55vh] w-[55vh] blur-3xl" />
      <div className="halo-sage absolute right-[0%] top-[45%] h-[60vh] w-[60vh] blur-3xl" />
      <div className="grain absolute inset-0" />
    </div>
  );
}
