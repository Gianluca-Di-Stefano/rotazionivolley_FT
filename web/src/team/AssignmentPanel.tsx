import { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { builtInConfigs, defaultConfig } from '../configs';
import type { FormationConfig, PlayerRole, SetterPosition } from '../configs/schema';
import type { Assignment, Match, MatchRules, Roster } from './schema';
import { validateAssignment } from './rules';
import { IssuesCard } from './CallupPanel';

/**
 * Scheda "Ruoli" di una partita: mappa i convocati sui ruoli simbolici
 * dello schema scelto. I controlli della regola mista scattano in tempo
 * reale. Riceve la partita selezionata e la sua associazione corrente.
 */
interface AssignmentPanelProps {
  roster: Roster;
  match: Match;
  rules: MatchRules;
  assignment: Assignment | undefined;
  onChange: (next: Assignment | undefined) => void;
}

const ROLE_LABEL: Record<PlayerRole, string> = {
  setter: 'Palleggiatore',
  opposite: 'Opposto',
  middle: 'Centrale',
  hitter: 'Schiacciatore',
  libero: 'Libero',
};

const CUSTOM_CONFIGS_KEY = 'rv-custom-configs';

/** Carica gli schemi custom da localStorage, come fa AppStateContext. */
function loadCustomConfigs(): FormationConfig[] {
  try {
    const raw = localStorage.getItem(CUSTOM_CONFIGS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FormationConfig[];
  } catch {
    return [];
  }
}

export function AssignmentPanel({ roster, match, rules, assignment, onChange }: AssignmentPanelProps) {
  const { t } = useI18n();

  // Lista di tutti gli schemi disponibili (built-in + custom da localStorage),
  // così l'utente può mappare su qualunque schema abbia creato.
  const allConfigs = useMemo(() => {
    const custom = loadCustomConfigs();
    const customIds = new Set(custom.map((c) => c.id));
    return [...builtInConfigs.filter((c) => !customIds.has(c.id)), ...custom];
  }, []);

  // Config e setterPosition derivano dall'assignment (se esiste), altrimenti default.
  const configId = assignment?.configId ?? defaultConfig.id;
  const config = allConfigs.find((c) => c.id === configId) ?? defaultConfig;
  const setterPosition: SetterPosition = (assignment?.setterPosition ?? 2) as SetterPosition;

  // Costruisce o ricostruisce l'assignment in modo immutabile quando cambia config/rotazione.
  function ensureAssignment(): Assignment {
    if (assignment && assignment.configId === config.id && assignment.setterPosition === setterPosition) {
      return assignment;
    }
    return {
      matchId: match.id,
      configId: config.id,
      setterPosition,
      symbolicToRosterId: assignment?.symbolicToRosterId ?? {},
      updatedAt: new Date().toISOString(),
    };
  }

  function setConfigOrRotation(nextConfigId: string, nextSetterPosition: SetterPosition) {
    const next: Assignment = {
      matchId: match.id,
      configId: nextConfigId,
      setterPosition: nextSetterPosition,
      symbolicToRosterId: assignment?.symbolicToRosterId ?? {},
      updatedAt: new Date().toISOString(),
    };
    onChange(next);
  }

  function assignPlayer(symbolicId: string, rosterId: string | undefined) {
    const current = ensureAssignment();
    const next: Assignment = {
      ...current,
      symbolicToRosterId: { ...current.symbolicToRosterId, [symbolicId]: rosterId ?? '' },
      updatedAt: new Date().toISOString(),
    };
    // Rimuovi la chiave se rosterId è vuoto, per non lasciare entry "false".
    if (!rosterId) delete next.symbolicToRosterId[symbolicId];
    onChange(next);
  }

  function autoFill() {
    const current = ensureAssignment();
    const map: Record<string, string> = { ...current.symbolicToRosterId };
    // Per ogni slot simbolico non ancora assegnato, cerca un convocato con
    // ruolo preferito uguale e non ancora usato altrove.
    const allSlots = [...config.players, ...config.liberos];
    const used = new Set(Object.values(map));
    for (const slot of allSlots) {
      if (map[slot.id]) continue;
      const candidate = match.playerIds
        .map((id) => roster.players.find((p) => p.id === id))
        .find((p) => p && p.preferredRole === slot.role && !used.has(p.id));
      if (candidate) {
        map[slot.id] = candidate.id;
        used.add(candidate.id);
      }
    }
    onChange({ ...current, symbolicToRosterId: map, updatedAt: new Date().toISOString() });
  }

  function clearAll() {
    const current = ensureAssignment();
    onChange({ ...current, symbolicToRosterId: {}, updatedAt: new Date().toISOString() });
  }

  const allSlots = [...config.players, ...config.liberos];
  const validation = assignment ? validateAssignment(roster, match, config, assignment, rules) : null;

  return (
    <div className="assignment-grid">
      <div>
        <section className="team-card">
          <h3>{t('assignment.title')}</h3>
          <p className="team-card__intro">{t('assignment.intro')}</p>

          <div className="team-form" style={{ marginBottom: '0.8rem' }}>
            <label>
              {t('assignment.config')}
              <select
                className="team-select"
                value={configId}
                onChange={(e) => setConfigOrRotation(e.target.value, setterPosition)}
              >
                {allConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('assignment.rotation')}
              <select
                className="team-select"
                value={setterPosition}
                onChange={(e) => setConfigOrRotation(configId, Number(e.target.value) as SetterPosition)}
              >
                {[1, 2, 3, 4, 5, 6].map((p) => (
                  <option key={p} value={p}>
                    P{p}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="team-actions">
            <button type="button" className="team-btn team-btn--primary" onClick={autoFill}>
              {t('assignment.autoFill')}
            </button>
            <button type="button" className="team-btn" onClick={clearAll}>
              {t('assignment.clear')}
            </button>
          </div>

          <table className="team-table">
            <thead>
              <tr>
                <th>{t('assignment.slot')}</th>
                <th>{t('assignment.player')}</th>
              </tr>
            </thead>
            <tbody>
              {allSlots.map((slot) => {
                const value = assignment?.symbolicToRosterId[slot.id] ?? '';
                const options = match.playerIds
                  .map((id) => roster.players.find((p) => p.id === id))
                  .filter((p): p is NonNullable<typeof p> => !!p);
                return (
                  <tr key={slot.id}>
                    <td>
                      <strong>{slot.label}</strong>
                      <br />
                      <span style={{ color: '#6b7280', fontSize: '0.8rem' }}>{ROLE_LABEL[slot.role]}</span>
                    </td>
                    <td>
                      <select
                        className="team-select"
                        value={value}
                        onChange={(e) => assignPlayer(slot.id, e.target.value || undefined)}
                      >
                        <option value="">{t('assignment.unassigned')}</option>
                        {options.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.firstName} {p.lastName} ({t(`team.common.sex.${p.sex}`)}
                            {p.level ? `, ${t('team.common.level')} ${p.level}` : ''})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {validation && <IssuesCard issues={validation.issues} />}
      </div>
    </div>
  );
}
