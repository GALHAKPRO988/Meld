import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { GlassFilters, Halo } from "@/components/glass/Backdrop";
import { useSettings } from "@/lib/settings";
import { Sidebar } from "@/components/Sidebar";
import { useReminders } from "@/hooks/use-reminders";
import { UpdateButton } from "@/components/UpdateButton";

function useSettingsHydration() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useSettings.persist.onFinishHydration(() => setHydrated(true));
    void useSettings.persist.rehydrate();
    if (useSettings.persist.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

function Splash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] grid place-items-center bg-background"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="relative">
            <div className="absolute inset-[-40px] rounded-full bg-coral/15 blur-3xl" aria-hidden />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, letterSpacing: "0.2em" }}
              animate={{ opacity: 1, scale: 1, letterSpacing: "-0.02em" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative text-5xl font-semibold text-foreground"
            >
              Meld
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const hydrated = useSettingsHydration();
  const theme = useSettings((s) => s.theme);
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        void navigate({ to: "/buscar" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);
  useEffect(() => {
    document.documentElement.classList.toggle("sidebar-collapsed", collapsed);
  }, [collapsed]);
  const [splash, setSplash] = useState(true);
  useReminders();

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => setSplash(false), 650);
    return () => clearTimeout(t);
  }, [hydrated]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("reduce-motion", reduceMotion);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#171717" : "#f2f2ef");
  }, [theme, reduceMotion]);

  useEffect(() => {
    // backdrop-filter: url() refraction only works in Chromium; others keep plain blur.
    const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
    if (brands?.some((b) => /Chromium/.test(b.brand))) document.documentElement.classList.add("refract");
  }, []);

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <GlassFilters />
      <Halo />
      <Sidebar />
      <div className="app-col relative min-h-dvh w-full">{children}</div>
      <UpdateButton />
      <Splash show={splash} />
      <Toaster
        position="top-center"
        swipeDirections={["left", "right", "top"]}
        closeButton
        theme={theme}
        style={
          {
            "--normal-bg": "var(--glass-bg-solid)",
            "--normal-text": "var(--foreground)",
            "--normal-border": "var(--border)",
            "--border-radius": "20px",
          } as React.CSSProperties
        }
      />
    </MotionConfig>
  );
}
