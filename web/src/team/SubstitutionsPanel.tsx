import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { FormationConfig } from '../configs/schema';
import { builtInConfigs, defaultConfig } from '../configs';
import { newId, type Assignment, type Match, type Roster, type Substitution } from './schema';
import { MiniCourt } from './MiniCourt';

/**
 * Scheda "Cambi" di una partita: traccia le sostituzioni durante la gara.
 * L'anteprima animata sul campo si aggiorna a ogni cambio. Riceve la
 * partita selezionata e la sua associazione; filtra le sostituzioni per
 * `matchId`.
 */
interface SubstitutionsPanelProps {
  roster: Roster;
  match: Match;
  assignment: Assignment | undefined;
  /** Tutte le sostituzioni (di tutte le partite); filtriamo per matchId. */
  substitutions: Substitution[];
  onChange: (next: Substitution[]) => void;
}

const CUSTOM_CONFIGS_KEY = 'rv-custom-configs';

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

/**
 * Applica la cronologia dei cambi all'assignment iniziale, restituendo per
 * ogni slot simbolico il RosterPlayer attualmente in campo.
 */
function applySubs(
  initial: Record<string, string>,
  subs: Substitution[],
): Record<string, string> {
  const current: Record<string, string> = { ...initial };
  for (const sub of subs) {
    // Trova lo slot in cui sta il giocatore che esce.
    const entry = Object.entries(current).find(([, id]) => id === sub.exitsRosterId);
    if (entry) {
      current[entry[0]] = sub.entersRosterId;
    }
  }
  return current;
}

export function SubstitutionsPanel({
  roster,
  match,
  assignment,
  substitutions,
  onChange,
}: SubstitutionsPanelProps) {
  const { t } = useI18n();
  const [entersId, setEntersId] = useState('');
  const [exitsId, setExitsId] = useState('');
  const [moment, setMoment] = useState('');
  const [reason, setReason] = useState('');

  const allConfigs = useMemo(() => {
    const custom = loadCustomConfigs();
    const customIds = new Set(custom.map((c) => c.id));
    return [...builtInConfigs.filter((c) => !customIds.has(c.id)), ...custom];
  }, []);

  const config = useMemo(
    () => allConfigs.find((c) => c.id === assignment?.configId) ?? defaultConfig,
    [allConfigs, assignment?.configId],
  );

  const matchSubs = useMemo(() => {
    if (!assignment) return [];
    return substitutions
      .filter((s) => s.matchId === match.id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [substitutions, assignment, match.id]);

  // Formazione attuale (dopo i cambi): per ogni slot simbolico, il RosterPlayer in campo.
  const currentRosterBySlot = useMemo(() => {
    if (!assignment) return {} as Record<string, string>;
    return applySubs(assignment.symbolicToRosterId, matchSubs);
  }, [assignment, matchSubs]);

  // Giocatori in campo ora (id dei rosterPlayer attualmente attivi).
  const onCourtIds = new Set(Object.values(currentRosterBySlot));

  // Convocati totali (per popolare i select).
  const matchPlayers = useMemo(() => {
    return match.playerIds
      .map((id) => roster.players.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => !!p);
  }, [match, roster]);

  const onCourtPlayers = matchPlayers.filter((p) => onCourtIds.has(p.id));
  const benchPlayers = matchPlayers.filter((p) => !onCourtIds.has(p.id));

  function recordSub() {
    if (!assignment || !entersId || !exitsId) return;
    if (entersId === exitsId) return;
    const sub: Substitution = {
      id: newId('sub'),
      matchId: match.id,
      entersRosterId: entersId,
      exitsRosterId: exitsId,
      moment: moment.trim() || undefined,
      reason: reason.trim() || undefined,
      timestamp: new Date().toISOString(),
    };
    onChange([...substitutions, sub]);
    setEntersId('');
    setExitsId('');
    setMoment('');
    setReason('');
  }

  function undoLast() {
    if (matchSubs.length === 0) return;
    if (!window.confirm(t('subs.confirmUndo'))) return;
    const last = matchSubs[matchSubs.length - 1];
    onChange(substitutions.filter((s) => s.id !== last.id));
  }

  function fullName(id: string): string {
    const p = roster.players.find((rp) => rp.id === id);
    return p ? `${p.firstName} ${p.lastName}`.trim() : id;
  }

  if (!assignment) {
    return (
      <section className="team-card">
        <h3>{t('subs.title')}</h3>
        <p className="team-empty">{t('subs.noAssignment')}</p>
      </section>
    );
  }

  // Map per MiniCourt: per ogni slot, i dati del RosterPlayer attualmente in campo.
  const rosterBySlot: Record<
    string,
    { firstName: string; lastName: string; sex: 'M' | 'F' } | undefined
  > = {};
  for (const [slotId, rosterId] of Object.entries(currentRosterBySlot)) {
    const p = roster.players.find((rp) => rp.id === rosterId);
    if (p) rosterBySlot[slotId] = { firstName: p.firstName, lastName: p.lastName, sex: p.sex };
  }

  return (
    <div className="subs-layout">
      <div>
        <section className="team-card">
          <h3>{t('subs.title')}</h3>
          <p className="team-card__intro">{t('subs.intro')}</p>

          <div className="team-form" style={{ marginBottom: '0.8rem' }}>
            <label>
              {t('subs.enters')}
              <select
                className="team-select"
                value={entersId}
                onChange={(e) => setEntersId(e.target.value)}
                disabled={benchPlayers.length === 0}
              >
                <option value="">—</option>
                {benchPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({t(`team.common.sex.${p.sex}`)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('subs.exits')}
              <select
                className="team-select"
                value={exitsId}
                onChange={(e) => setExitsId(e.target.value)}
                disabled={onCourtPlayers.length === 0}
              >
                <option value="">—</option>
                {onCourtPlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({t(`team.common.sex.${p.sex}`)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('subs.moment')}
              <input
                type="text"
                value={moment}
                onChange={(e) => setMoment(e.target.value)}
                placeholder="Set 2 - 12-8"
              />
            </label>
            <label>
              {t('subs.reason')}
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="difesa"
              />
            </label>
            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button
                type="button"
                className="team-btn team-btn--primary"
                onClick={recordSub}
                disabled={!entersId || !exitsId || entersId === exitsId}
              >
                {t('subs.add')}
              </button>
            </div>
          </div>

          {matchSubs.length === 0 ? (
            <p className="team-empty">{t('subs.empty')}</p>
          ) : (
            <>
              <div className="team-actions">
                <button type="button" className="team-btn" onClick={undoLast}>
                  {t('subs.undo')}
                </button>
              </div>
              <h4 style={{ margin: '0.6rem 0 0.3rem', fontSize: '0.85rem', color: '#164863' }}>
                {t('subs.list')}
              </h4>
              <ul className="subs-list">
                {matchSubs.map((sub) => (
                  <li key={sub.id} className="subs-item">
                    <div>
                      <strong>{fullName(sub.entersRosterId)}</strong>{' '}
                      <span className="subs-item__arrows">→</span>{' '}
                      <span style={{ color: '#6b7280' }}>{fullName(sub.exitsRosterId)}</span>
                      {sub.reason && <div style={{ fontSize: '0.85rem' }}>{sub.reason}</div>}
                    </div>
                    {sub.moment && <span className="subs-item__moment">{sub.moment}</span>}
                    <button
                      type="button"
                      className="team-btn team-btn--small team-btn--danger"
                      onClick={() => onChange(substitutions.filter((s) => s.id !== sub.id))}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="team-card">
          <h3>{t('subs.now')}</h3>
          <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            {config.name} — P{assignment.setterPosition}
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0.4rem 0 0', display: 'grid', gap: '0.2rem' }}>
            {[...config.players, ...config.liberos].map((slot) => {
              const rosterId = currentRosterBySlot[slot.id];
              const p = roster.players.find((rp) => rp.id === rosterId);
              return (
                <li key={slot.id} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <span style={{ minWidth: 110, color: '#6b7280' }}>{slot.label}</span>
                  {p ? (
                    <>
                      <strong>
                        {p.firstName} {p.lastName}
                      </strong>
                      <span className={`badge badge--${p.sex}`}>{t(`team.common.sex.${p.sex}`)}</span>
                    </>
                  ) : (
                    <span style={{ color: '#b00020' }}>{t('assignment.unassigned')}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="subs-preview">
        <section className="team-card">
          <h3>{t('subs.now')}</h3>
          <MiniCourt
            config={config}
            setterPosition={assignment.setterPosition}
            rosterBySlot={rosterBySlot}
          />
        </section>
      </div>
    </div>
  );
}
