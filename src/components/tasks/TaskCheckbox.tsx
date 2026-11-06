import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Satisfying checkbox: stroke draws in, small bounce. */
export function TaskCheckbox({ checked, onToggle, color, label }: { checked: boolean; onToggle: () => void; color: string; label: string }) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      whileTap={{ scale: 0.8 }}
      animate={checked ? { scale: [1, 1.22, 0.94, 1] } : { scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn("relative grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2 transition-colors")}
      style={{ borderColor: color, background: checked ? color : "transparent" }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <motion.path
          d="M5 12.5l4.2 4.2L19 7"
          stroke="var(--background)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.3, delay: checked ? 0.08 : 0 }}
        />
      </svg>
      {checked && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 0 0 ${color}` }}
          initial={{ boxShadow: `0 0 0 0px ${color}`, opacity: 0.7 }}
          animate={{ boxShadow: `0 0 0 10px ${color}`, opacity: 0 }}
          transition={{ duration: 0.5 }}
        />
      )}
    </motion.button>
  );
}
