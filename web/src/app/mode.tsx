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

const STAGES: readonly Stage[] = ['recon', 'exploit', 'objectives'] as const

const STORAGE_KEY = 't4c.mode'

export const STAGE_META: Record<Stage, { label: string; shortLabel: string }> = {
  recon: { label: 'Reconnaissance', shortLabel: 'Recon' },
  exploit: { label: 'Exploitation', shortLabel: 'Exploit' },
  objectives: { label: 'Objectives', shortLabel: 'Objectives' },
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

type ModeContextValue = { mode: Stage; setMode: (stage: Stage) => void }

const ModeContext = createContext<ModeContextValue | null>(null)

export function ModeProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setModeState] = useState<Stage>(() => readStoredStage())

  // The URL wins over localStorage so deep links into /exploit or /objectives
  // select the right stage even if a different one was persisted.
  useEffect(() => {
    setModeState(stageFromPath(location.pathname))
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
