import { motion, AnimatePresence, type HTMLMotionProps } from "framer-motion";
import { forwardRef, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const spring = { type: "spring", stiffness: 520, damping: 32, mass: 0.7 } as const;
export const softSpring = { type: "spring", stiffness: 300, damping: 30 } as const;

/* ---------- GlassButton: round icon button ---------- */
type GlassButtonProps = HTMLMotionProps<"button"> & { size?: "md" | "lg" | "sm" };

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { className, size = "lg", children, ...props },
  ref,
) {
  const sizes = { sm: "h-9 w-9", md: "h-11 w-11", lg: "h-16 w-16" };
  return (
    <motion.button
      ref={ref}
      type="button"
      whileTap={{ scale: 0.96 }}
      transition={spring}
      className={cn(
        "glass glass-refract grid shrink-0 place-items-center rounded-full text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        sizes[size],
        className,
      )}
      {...props}
    >
      <span className="relative z-10 grid place-items-center">{children as ReactNode}</span>
    </motion.button>
  );
});

/* ---------- GlassPill: small pill button ---------- */
export const GlassPill = forwardRef<HTMLButtonElement, HTMLMotionProps<"button"> & { active?: boolean }>(
  function GlassPill({ className, children, active, ...props }, ref) {
    return (
      <motion.button
        ref={ref}
        type="button"
        whileTap={{ scale: 0.96 }}
        transition={spring}
        data-pressed={active ? "true" : undefined}
        className={cn(
          "glass inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[11px] px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        {...props}
      >
        <span className="relative z-10 inline-flex items-center gap-1.5">{children as ReactNode}</span>
      </motion.button>
    );
  },
);

/* ---------- GlassSurface: static glass container ---------- */
export function GlassSurface({ className, children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div className={cn("glass rounded-3xl", className)} {...props}>
      <div className="relative z-10">{children as ReactNode}</div>
    </motion.div>
  );
}

/* ---------- GlassInput ---------- */
export const GlassInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function GlassInput({ className, ...props }, ref) {
    return (
      <div className={cn("glass rounded-2xl", className)}>
        <input
          ref={ref}
          className="relative z-10 h-11 w-full bg-transparent px-4 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          {...props}
        />
      </div>
    );
  },
);

/* ---------- GlassSwitch ---------- */
export function GlassSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-[26px] w-[44px] shrink-0 rounded-full border border-border transition-colors duration-300",
        checked ? "bg-coral" : "bg-muted",
      )}
    >
      <motion.span
        layout
        transition={spring}
        className={cn(
          "glass glass-strong absolute top-[2px] h-5 w-5 rounded-full",
          checked ? "right-[2px]" : "left-[2px]",
        )}
      />
    </button>
  );
}

/* ---------- Segmented ---------- */
export function GlassSegmented<T extends string>({
  value,
  options,
  onChange,
  layoutId,
  size = "md",
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  layoutId: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("inline-flex rounded-full bg-muted p-0.5", size === "sm" ? "text-[11px]" : "text-sm")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "relative rounded-full font-medium transition-colors",
            size === "sm" ? "px-2 py-1" : "px-3.5 py-1.5",
            value === o.value ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {value === o.value && (
            <motion.span layoutId={layoutId} transition={spring} className="glass glass-strong absolute inset-0 rounded-full" />
          )}
          <span className="relative z-10 whitespace-nowrap">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- GlassDropdown: morphs out of its trigger ---------- */
export function GlassDropdown({
  open,
  onClose,
  children,
  placement = "bottom",
  align = "center",
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  placement?: "top" | "bottom";
  align?: "start" | "center" | "end";
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const alignCls = { start: "left-0", center: "left-1/2 -translate-x-1/2", end: "right-0" }[align];
  const origin = `${placement === "bottom" ? "top" : "bottom"} ${align === "start" ? "left" : align === "end" ? "right" : "center"}`;

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onPointerDown={onClose} aria-hidden />
          <div className={cn("absolute z-50", alignCls, placement === "bottom" ? "top-full mt-2" : "bottom-full mb-2")}>
            <motion.div
              role="menu"
              initial={{ opacity: 0, scale: 0.35, filter: "blur(10px)", borderRadius: 18 }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)", borderRadius: 24 }}
              exit={{ opacity: 0, scale: 0.5, filter: "blur(8px)" }}
              transition={{ type: "spring", stiffness: 420, damping: 30 }}
              style={{ transformOrigin: origin, maxHeight: placement === "bottom" ? "min(36dvh, 440px)" : "min(60dvh, 480px)" }}
              className={cn("glass glass-solid glass-refract no-scrollbar w-[300px] overflow-y-auto p-1.5", className)}
            >
              <div className="relative z-10">{children}</div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- GlassSheet: draggable bottom sheet ---------- */
export function GlassSheet({
  open,
  onClose,
  children,
  title,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="bg-scrim absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label={title}
            initial={{ y: "100%", scale: 0.96 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: "100%", scale: 0.96 }}
            transition={softSpring}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 600) onClose();
            }}
            className={cn(
              "glass glass-solid glass-refract relative mx-2 mb-2 w-full max-w-[430px] rounded-[30px] pb-safe",
              className,
            )}
          >
            <div className="relative z-10 px-5 pb-5 pt-2.5">
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted-foreground/40" />
              {title && <h2 className="mb-3 text-lg font-semibold tracking-tight">{title}</h2>}
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
