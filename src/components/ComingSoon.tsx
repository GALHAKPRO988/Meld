import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export function ComingSoon({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="px-4">
      <div className="glass glass-refract flex flex-col items-center gap-3 rounded-[28px] px-6 py-12 text-center">
        <span className="relative z-10 grid h-14 w-14 place-items-center rounded-full bg-muted">
          <Icon className="h-6 w-6" strokeWidth={1.7} />
        </span>
        <p className="relative z-10 text-sm text-muted-foreground">{text}</p>
      </div>
    </motion.div>
  );
}
