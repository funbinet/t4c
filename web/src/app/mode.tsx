import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export type Stage = 'recon' | 'exploit' | 'objectives'

export const STAGES: readonly Stage[] = ['recon', 'exploit', 'objectives'] as const

const STORAGE_KEY = 't4c.mode'

// Icon + accent metadata used by the mode toggle, stage banners and chain
// screens so every stage renders with a consistent identity.
export const STAGE_META: Record<Stage, { label: string; shortLabel: string; description: string }> = {
  recon: {
    label: 'Reconnaissance',
    shortLabel: 'Recon',
    description: 'Discover and map the external attack surface.',
  },
  exploit: {
    label: 'Exploitation',
    shortLabel: 'Exploit',
    description: 'Validate findings and breach classified assets.',
  },
  objectives: {
    label: 'Objectives',
    shortLabel: 'Objectives',
    description: 'Extract, inspect and export the produce of a breach.',
  },
}

// Base path prefix for a stage: recon keeps the existing top-level routes,
// exploit/objectives live under their mode prefix (plan §2.3).
export function stageBase(stage: Stage): string {
  switch (stage) {
    case 'exploit':
      return '/exploit'
    case 'objectives':
      return '/objectives'
    default:
      return ''
  }
}

function stageFromPath(pathname: string): Stage {
  if (pathname.startsWith('/exploit')) return 'exploit'
  if (pathname.startsWith('/objectives')) return 'objectives'
  return 'recon'
}

function readStoredStage(): Stage {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return STAGES.includes(raw as Stage) ? (raw as Stage) : 'recon'
  } catch {
    return 'recon'
  }
}

// A mode-prefixed URL is authoritative (deep links, refresh, back/forward).
// Plain recon URLs fall back to the persisted choice so the console resumes
// the operator's last stage instead of flashing the wrong mode on mount.
function resolveStage(pathname: string): Stage {
  const fromPath = stageFromPath(pathname)
  return fromPath !== 'recon' ? fromPath : readStoredStage()
}

type ModeContextValue = { mode: Stage; setMode: (stage: Stage) => void }

const ModeContext = createContext<ModeContextValue | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setModeState] = useState<Stage>(() => resolveStage(location.pathname))

  // Resolve synchronously on every navigation so the stage never lags behind
  // the URL (the initial state above already uses the same resolution rule).
  useEffect(() => {
    setModeState(resolveStage(location.pathname))
  }, [location.pathname])

  const setMode = useCallback(
    (stage: Stage) => {
      setModeState(stage)
      try {
        window.localStorage.setItem(STORAGE_KEY, stage)
      } catch {
        // Storage may be unavailable (private mode); mode still works in-memory.
      }
      navigate(stageBase(stage) || '/')
    },
    [navigate],
  )

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode])
  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>
}

export function useMode() {
  const context = useContext(ModeContext)
  if (!context) throw new Error('useMode must be used inside ModeProvider')
  return context
}
