import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProviderId } from "./ai/providers";
import { PROVIDERS } from "./ai/providers";

export type SectionId = "calendario" | "paginas" | "tareas" | "carpetas" | "tags" | "diario";
export type AccessMode = "read" | "write";
export interface SectionAccess {
  enabled: boolean;
  mode: AccessMode;
}
export type AccessMap = Record<SectionId, SectionAccess>;
export interface LinkedDevice {
  id: string;
  name: string;
  peerId: string;
  lastSyncedAt: number;
}

const localId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function defaultDeviceName() {
  if (typeof navigator === "undefined") return "Mi dispositivo";
  if (/iPhone/i.test(navigator.userAgent)) return "iPhone";
  if (/iPad/i.test(navigator.userAgent)) return "iPad";
  if (/Android/i.test(navigator.userAgent)) return "Móvil Android";
  if (/Windows/i.test(navigator.userAgent)) return "PC Windows";
  if (/Mac/i.test(navigator.userAgent)) return "Mac";
  return "Mi dispositivo";
}

export const SECTION_LABELS: Record<SectionId, string> = {
  calendario: "Calendario",
  paginas: "Páginas",
  tareas: "Tareas",
  carpetas: "Carpetas",
  tags: "Tags",
  diario: "Diario",
};

export const SECTION_ORDER: SectionId[] = [
  "calendario",
  "paginas",
  "tareas",
  "carpetas",
  "tags",
  "diario",
];

export const DEFAULT_ACCESS: AccessMap = {
  calendario: { enabled: true, mode: "read" },
  paginas: { enabled: true, mode: "read" },
  tareas: { enabled: true, mode: "write" },
  carpetas: { enabled: true, mode: "read" },
  tags: { enabled: true, mode: "read" },
  diario: { enabled: false, mode: "read" },
};

interface SettingsState {
  provider: ProviderId;
  models: Record<ProviderId, string>;
  apiKeys: Partial<Record<ProviderId, string>>;
  theme: "dark" | "light";
  journalEnabled: boolean;
  lockPastJournalEntries: boolean;
  reduceMotion: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  /** Hours before a timed task's due time to send the "te quedan X horas" warning; 0 = off. */
  taskWarnHours: number;
  setTaskWarnHours: (h: number) => void;
  deviceId: string;
  peerId: string;
  deviceName: string;
  linkedDevices: LinkedDevice[];
  setDeviceName: (name: string) => void;
  setPeerId: (peerId: string) => void;
  saveLinkedDevice: (device: LinkedDevice) => void;
  removeLinkedDevice: (id: string) => void;
  lockEnabled: boolean;
  lockScope: "app" | "journal";
  pinHash: string | null;
  biometricEnabled: boolean;
  biometricCredentialId: string | null;
  autoLock: "immediate" | "1" | "5";
  setLockEnabled: (v: boolean) => void;
  setLockScope: (v: "app" | "journal") => void;
  setPinHash: (v: string | null) => void;
  setBiometric: (enabled: boolean, credentialId: string | null) => void;
  setAutoLock: (v: "immediate" | "1" | "5") => void;
  language: "es";
  access: AccessMap;
  defaultAccess: AccessMap;
  setProvider: (p: ProviderId) => void;
  setModel: (p: ProviderId, m: string) => void;
  setApiKey: (p: ProviderId, key: string) => void;
  setTheme: (t: "dark" | "light") => void;
  setJournalEnabled: (v: boolean) => void;
  setLockPastJournalEntries: (locked: boolean) => void;
  setReduceMotion: (v: boolean) => void;
  setAccess: (s: SectionId, patch: Partial<SectionAccess>) => void;
  setDefaultAccess: (s: SectionId, patch: Partial<SectionAccess>) => void;
  resetAccessToDefault: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      provider: "anthropic",
      models: {
        anthropic: PROVIDERS.anthropic.models[0]?.id ?? "",
        openai: PROVIDERS.openai.models[0]?.id ?? "",
        google: PROVIDERS.google.models[0]?.id ?? "",
        openrouter: PROVIDERS.openrouter.models[0]?.id ?? "",
      },
      apiKeys: {},
      theme: "dark",
      journalEnabled: false,
      lockPastJournalEntries: true,
      reduceMotion: false,
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      taskWarnHours: 2,
      setTaskWarnHours: (taskWarnHours) => set({ taskWarnHours }),
      deviceId: localId(),
      peerId: `meld-${localId()
        .replace(/[^a-zA-Z0-9_-]/g, "")
        .slice(0, 40)}`,
      deviceName: defaultDeviceName(),
      linkedDevices: [],
      setDeviceName: (deviceName) =>
        set({ deviceName: deviceName.trim().slice(0, 40) || "Mi dispositivo" }),
      setPeerId: (peerId) => set({ peerId }),
      saveLinkedDevice: (device) =>
        set((s) => ({
          linkedDevices: [
            { ...device, lastSyncedAt: Date.now() },
            ...s.linkedDevices.filter((existing) => existing.id !== device.id),
          ],
        })),
      removeLinkedDevice: (id) =>
        set((s) => ({ linkedDevices: s.linkedDevices.filter((device) => device.id !== id) })),
      lockEnabled: false,
      lockScope: "app",
      pinHash: null,
      biometricEnabled: false,
      biometricCredentialId: null,
      autoLock: "immediate",
      setLockEnabled: (lockEnabled) => set({ lockEnabled }),
      setLockScope: (lockScope) => set({ lockScope }),
      setPinHash: (pinHash) => set({ pinHash }),
      setBiometric: (biometricEnabled, biometricCredentialId) =>
        set({ biometricEnabled, biometricCredentialId }),
      setAutoLock: (autoLock) => set({ autoLock }),
      language: "es",
      access: DEFAULT_ACCESS,
      defaultAccess: DEFAULT_ACCESS,
      setProvider: (provider) => set({ provider }),
      setModel: (p, m) => set((s) => ({ models: { ...s.models, [p]: m } })),
      setApiKey: (p, key) => set((s) => ({ apiKeys: { ...s.apiKeys, [p]: key.trim() } })),
      setTheme: (theme) => set({ theme }),
      setJournalEnabled: (journalEnabled) => set({ journalEnabled }),
      setLockPastJournalEntries: (lockPastJournalEntries) => set({ lockPastJournalEntries }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      setAccess: (sec, patch) =>
        set((s) => ({ access: { ...s.access, [sec]: { ...s.access[sec], ...patch } } })),
      setDefaultAccess: (sec, patch) =>
        set((s) => ({
          defaultAccess: { ...s.defaultAccess, [sec]: { ...s.defaultAccess[sec], ...patch } },
        })),
      resetAccessToDefault: () => set((s) => ({ access: s.defaultAccess })),
    }),
    {
      name: "meld-settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

/** Sections the AI may see, honouring the journal opt-in. */
export function effectiveAccess(access: AccessMap, journalEnabled: boolean): AccessMap {
  return { ...access, diario: journalEnabled ? access.diario : { enabled: false, mode: "read" } };
}
