import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { usePersistentState } from './storage';
import {
  DEFAULT_RULES,
  MatchSchema,
  RosterSchema,
  type Assignment,
  type Match,
  type MatchRules,
  type Roster,
  type Substitution,
} from './schema';

/**
 * Stato condiviso del modulo Squadra, persistent in localStorage (chiavi
 * con prefisso `rv-`, come il resto del progetto). È condiviso tra le due
 * voci principali:
 *  - "Squadra" (rosa + regole globali)
 *  - "Campionato" (lista partite → convocazioni/ruoli/cambi per partita)
 *
 * Pattern coerente con AppStateContext: un provider alto nell'albero
 * (vedi main.tsx) e l'hook `useTeamState` ovunque serva leggere o
 * scrivere i dati della squadra. Nessun backend: la rosa è personale per
 * dispositivo.
 */

const STORAGE_KEYS = {
  roster: 'rv-roster',
  matches: 'rv-matches',
  assignments: 'rv-assignments',
  substitutions: 'rv-substitutions',
  rules: 'rv-rules',
  selectedMatch: 'rv-selected-match',
} as const;

const MIGRATION_FLAG = 'rv-migrated-v2';

const EMPTY_ROSTER: Roster = { players: [], updatedAt: new Date().toISOString() };

/**
 * Migrazione una-tantum dal modello precedente (callups piatte) al modello
 * "partita di campionato". Idempotente: se il flag `rv-migrated-v2` è già
 * presente non fa nulla. Preserva i dati esistenti rimappando i campi
 * (`label`→`opponent`, `callupId`→`matchId`, `assignmentId`→`matchId`).
 */
function migrateOnce(): void {
  try {
    if (localStorage.getItem(MIGRATION_FLAG)) return;

    const callupsRaw = localStorage.getItem('rv-callups');
    if (callupsRaw) {
      const parsed: unknown = JSON.parse(callupsRaw);
      if (Array.isArray(parsed)) {
        const matches = parsed
          .map((c): Match | null => {
            if (!c || typeof c !== 'object') return null;
            const obj = c as Record<string, unknown>;
            return {
              id: String(obj.id ?? ''),
              opponent: typeof obj.label === 'string' ? obj.label : undefined,
              date: typeof obj.date === 'string' ? obj.date : undefined,
              playerIds: Array.isArray(obj.playerIds) ? (obj.playerIds as string[]) : [],
              updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString(),
            };
          })
          .filter((m): m is Match => !!m && !!m.id);
        localStorage.setItem(STORAGE_KEYS.matches, JSON.stringify(matches));
      }
    }

    // assignments: rinomina `callupId` -> `matchId` (stesso valore).
    const assignRaw = localStorage.getItem(STORAGE_KEYS.assignments);
    if (assignRaw) {
      const parsed: unknown = JSON.parse(assignRaw);
      if (parsed && typeof parsed === 'object') {
        const remapped: Record<string, Assignment> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (!value || typeof value !== 'object') continue;
          const a = value as Record<string, unknown>;
          remapped[key] = {
            matchId: typeof a.matchId === 'string' ? a.matchId : String(a.callupId ?? ''),
            configId: String(a.configId ?? ''),
            setterPosition: (a.setterPosition ?? 2) as Assignment['setterPosition'],
            symbolicToRosterId:
              a.symbolicToRosterId && typeof a.symbolicToRosterId === 'object'
                ? (a.symbolicToRosterId as Record<string, string>)
                : {},
            updatedAt: typeof a.updatedAt === 'string' ? a.updatedAt : new Date().toISOString(),
          } as Assignment;
        }
        localStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify(remapped));
      }
    }

    // substitutions: rinomina `assignmentId` -> `matchId` (stesso valore).
    const subsRaw = localStorage.getItem(STORAGE_KEYS.substitutions);
    if (subsRaw) {
      const parsed: unknown = JSON.parse(subsRaw);
      if (Array.isArray(parsed)) {
        const remapped = parsed.map((s) => {
          if (!s || typeof s !== 'object') return s;
          const obj = s as Record<string, unknown>;
          const { assignmentId, ...rest } = obj;
          return { ...rest, matchId: rest.matchId ?? assignmentId };
        });
        localStorage.setItem(STORAGE_KEYS.substitutions, JSON.stringify(remapped));
      }
    }

    // selected-callup -> selected-match (stesso valore, l'id della partita).
    const sel = localStorage.getItem('rv-selected-callup');
    if (sel) localStorage.setItem(STORAGE_KEYS.selectedMatch, sel);

    localStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    // localStorage non disponibile (modalità privata, ecc.): si prosegue
    // con i default; la migrazione verrà ritentata al prossimo avvio.
  }
}

export interface TeamState {
  roster: Roster;
  setRoster: (next: Roster | ((prev: Roster) => Roster)) => void;

  matches: Match[];
  setMatches: (next: Match[] | ((prev: Match[]) => Match[])) => void;

  /** Per partita, l'associazione ruoli corrente (o undefined). */
  assignmentsByMatch: Record<string, Assignment>;
  setAssignmentForMatch: (matchId: string, next: Assignment | undefined) => void;

  substitutions: Substitution[];
  setSubstitutions: (next: Substitution[] | ((prev: Substitution[]) => Substitution[])) => void;

  rules: MatchRules;
  setRules: (next: MatchRules | ((prev: MatchRules) => MatchRules)) => void;
  resetRules: () => void;

  selectedMatchId: string | null;
  setSelectedMatchId: (id: string | null) => void;
  /** La partita selezionata (o undefined). */
  selectedMatch: Match | undefined;
  /** L'associazione della partita selezionata (o undefined). */
  selectedAssignment: Assignment | undefined;

  exportJson: () => void;
  importJson: (file: File) => void;
}

const TeamStateContext = createContext<TeamState | null>(null);

export function TeamStateProvider({ children }: { children: ReactNode }) {
  // Migrazione una-tantum, prima che gli usePersistentState leggano.
  migrateOnce();

  const [roster, setRoster] = usePersistentState<Roster>(STORAGE_KEYS.roster, EMPTY_ROSTER, JSON.stringify, (raw) => {
    const parsed: unknown = JSON.parse(raw);
    const result = RosterSchema.safeParse(parsed);
    return result.success ? result.data : EMPTY_ROSTER;
  });
  const [matches, setMatches] = usePersistentState<Match[]>(STORAGE_KEYS.matches, [], JSON.stringify, (raw) => {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry) => {
      const result = MatchSchema.safeParse(entry);
      return result.success ? [result.data] : [];
    });
  });
  const [assignmentsByMatch, setAssignmentsByMatch] = usePersistentState<Record<string, Assignment>>(
    STORAGE_KEYS.assignments,
    {},
  );
  const [substitutions, setSubstitutions] = usePersistentState<Substitution[]>(STORAGE_KEYS.substitutions, []);
  const [rules, setRules] = usePersistentState<MatchRules>(STORAGE_KEYS.rules, DEFAULT_RULES);
  const [selectedMatchId, setSelectedMatchId] = usePersistentState<string | null>(
    STORAGE_KEYS.selectedMatch,
    null,
    String,
    (raw) => (typeof raw === 'string' && raw ? raw : null),
  );

  const setAssignmentForMatch = useCallback((matchId: string, next: Assignment | undefined) => {
    setAssignmentsByMatch((prev) => {
      const copy = { ...prev };
      if (next) copy[matchId] = next;
      else delete copy[matchId];
      return copy;
    });
  }, [setAssignmentsByMatch]);

  const resetRules = useCallback(() => setRules(DEFAULT_RULES), [setRules]);

  const selectedMatch = useMemo(
    () => (selectedMatchId ? matches.find((m) => m.id === selectedMatchId) : undefined),
    [matches, selectedMatchId],
  );
  const selectedAssignment = selectedMatchId ? assignmentsByMatch[selectedMatchId] : undefined;

  const exportJson = useCallback(() => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      roster,
      matches,
      assignments: assignmentsByMatch,
      substitutions,
      rules,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `squadra-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [roster, matches, assignmentsByMatch, substitutions, rules]);

  const importJson = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed: unknown = JSON.parse(String(reader.result));
          if (!parsed || typeof parsed !== 'object') throw new Error('formato non valido');
          const obj = parsed as Record<string, unknown>;
          const rosterResult = RosterSchema.safeParse(obj.roster);
          if (obj.roster && !rosterResult.success) throw new Error('rosa non valida');
          if (rosterResult.success && rosterResult.data) setRoster(rosterResult.data);
          // v1 usava `callups`, v2 usa `matches`: accettiamo entrambi.
          if (Array.isArray(obj.matches)) setMatches(obj.matches as Match[]);
          else if (Array.isArray(obj.callups)) {
            setMatches(
              (obj.callups as Array<Record<string, unknown>>).map((c) => ({
                id: String(c.id ?? ''),
                opponent: typeof c.label === 'string' ? c.label : undefined,
                date: typeof c.date === 'string' ? c.date : undefined,
                playerIds: Array.isArray(c.playerIds) ? (c.playerIds as string[]) : [],
                updatedAt: typeof c.updatedAt === 'string' ? c.updatedAt : new Date().toISOString(),
              })),
            );
          }
          if (obj.assignments && typeof obj.assignments === 'object') {
            setAssignmentsByMatch(obj.assignments as Record<string, Assignment>);
          }
          if (Array.isArray(obj.substitutions)) setSubstitutions(obj.substitutions as Substitution[]);
          if (obj.rules && typeof obj.rules === 'object') setRules({ ...DEFAULT_RULES, ...(obj.rules as MatchRules) });
        } catch (err) {
          window.alert(`File non valido: ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      reader.readAsText(file);
    },
    [setRoster, setMatches, setAssignmentsByMatch, setSubstitutions, setRules],
  );

  const value = useMemo<TeamState>(
    () => ({
      roster,
      setRoster,
      matches,
      setMatches,
      assignmentsByMatch,
      setAssignmentForMatch,
      substitutions,
      setSubstitutions,
      rules,
      setRules,
      resetRules,
      selectedMatchId,
      setSelectedMatchId,
      selectedMatch,
      selectedAssignment,
      exportJson,
      importJson,
    }),
    [
      roster,
      setRoster,
      matches,
      setMatches,
      assignmentsByMatch,
      setAssignmentForMatch,
      substitutions,
      setSubstitutions,
      rules,
      setRules,
      resetRules,
      selectedMatchId,
      setSelectedMatchId,
      selectedMatch,
      selectedAssignment,
      exportJson,
      importJson,
    ],
  );

  return <TeamStateContext.Provider value={value}>{children}</TeamStateContext.Provider>;
}

export function useTeamState(): TeamState {
  const ctx = useContext(TeamStateContext);
  if (!ctx) {
    throw new Error('useTeamState deve essere usato dentro <TeamStateProvider>');
  }
  return ctx;
}
