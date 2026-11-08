import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { GlassFilters, Halo } from "@/components/glass/Backdrop";
import { useSettings } from "@/lib/settings";
import { Sidebar } from "@/components/Sidebar";
import { useReminders } from "@/hooks/use-reminders";
import { UpdateButton } from "@/components/UpdateButton";
import { LockScreen } from "@/components/security/LockScreen";

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
  const location = useLocation();
  const hydrated = useSettingsHydration();
  const theme = useSettings((s) => s.theme);
  const reduceMotion = useSettings((s) => s.reduceMotion);
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const lockEnabled = useSettings((s) => s.lockEnabled);
  const lockScope = useSettings((s) => s.lockScope);
  const autoLock = useSettings((s) => s.autoLock);
  const [locked, setLocked] = useState(false);
  const previousPath = useRef(location.pathname);
  const lockInitialized = useRef(false);
  const journalActive = location.pathname.startsWith("/diario");

  useEffect(() => {
    if (!hydrated) return;
    if (!lockInitialized.current) {
      lockInitialized.current = true;
      if (lockEnabled && (lockScope === "app" || journalActive)) setLocked(true);
      return;
    }
    if (!lockEnabled) {
      setLocked(false);
    }
  }, [hydrated, lockEnabled, lockScope, journalActive]);

  useEffect(() => {
    if (
      lockScope === "journal" &&
      location.pathname.startsWith("/diario") &&
      !previousPath.current.startsWith("/diario")
    ) {
      setLocked(true);
    }
    previousPath.current = location.pathname;
  }, [location.pathname, lockScope]);

  useEffect(() => {
    if (!lockEnabled || (lockScope === "journal" && !journalActive)) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const cancelTimer = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const scheduleLock = () => {
      cancelTimer();
      const delay = autoLock === "immediate" ? 0 : Number(autoLock) * 60_000;
      timer = setTimeout(() => setLocked(true), delay);
    };
    const onVisibilityChange = () => (document.hidden ? scheduleLock() : cancelTimer());
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", scheduleLock);
    window.addEventListener("focus", cancelTimer);
    if (document.hidden) scheduleLock();
    return () => {
      cancelTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", scheduleLock);
      window.removeEventListener("focus", cancelTimer);
    };
  }, [lockEnabled, lockScope, autoLock, journalActive]);

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
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#171717" : "#f2f2ef");
  }, [theme, reduceMotion]);

  useEffect(() => {
    // backdrop-filter: url() refraction only works in Chromium; others keep plain blur.
    const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } })
      .userAgentData?.brands;
    if (brands?.some((b) => /Chromium/.test(b.brand)))
      document.documentElement.classList.add("refract");
  }, []);

  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <GlassFilters />
      <Halo />
      <Sidebar />
      <div className="app-col relative min-h-dvh w-full">{children}</div>
      <UpdateButton />
      {hydrated && lockEnabled && (lockScope === "app" || journalActive) && locked && (
        <LockScreen onUnlock={() => setLocked(false)} />
      )}
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
