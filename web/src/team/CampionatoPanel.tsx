import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { CallupPanel } from './CallupPanel';
import { AssignmentPanel } from './AssignmentPanel';
import { SubstitutionsPanel } from './SubstitutionsPanel';
import { useTeamState } from './TeamStateContext';
import { matchLabel, newId, type HomeAway, type Match } from './schema';
import './team.css';

/**
 * Vista "Campionato": la lista delle partite di campionato. Selezionandone
 * una si apre il suo dettaglio con tre schede:
 *  - Convocazioni (chi gioca questa gara)
 *  - Ruoli (mappa i convocati sui ruoli dello schema)
 *  - Cambi (traccia le sostituzioni durante la gara, con anteprima campo)
 *
 * Ogni partita possiede la propria convocazione, associazione e cronologia
 * cambi, collegate via `matchId`. Tutto in localStorage, mai online.
 */
interface CampionatoPanelProps {
  onClose: () => void;
}

type MatchTab = 'callup' | 'assignment' | 'subs';

const EMPTY_FORM: {
  opponent: string;
  date: string;
  homeAway: HomeAway | '';
  round: string;
  location: string;
  notes: string;
} = {
  opponent: '',
  date: '',
  homeAway: '',
  round: '',
  location: '',
  notes: '',
};

export function CampionatoPanel({ onClose }: CampionatoPanelProps) {
  const { t } = useI18n();
  const {
    roster,
    matches,
    setMatches,
    rules,
    setAssignmentForMatch,
    substitutions,
    setSubstitutions,
    selectedMatchId,
    setSelectedMatchId,
    selectedMatch,
    selectedAssignment,
  } = useTeamState();

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tab, setTab] = useState<MatchTab>('callup');

  function touch(partial: Partial<typeof EMPTY_FORM>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function submitMatch() {
    if (!form.opponent.trim() && !form.date) return;
    const base = {
      opponent: form.opponent.trim() || undefined,
      date: form.date || undefined,
      homeAway: (form.homeAway || undefined) as HomeAway | undefined,
      round: form.round.trim() || undefined,
      location: form.location.trim() || undefined,
      notes: form.notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    if (editingId) {
      setMatches((prev) => prev.map((m) => (m.id === editingId ? { ...m, ...base } : m)));
    } else {
      const match: Match = {
        id: newId('match'),
        ...base,
        playerIds: [],
      };
      setMatches((prev) => [...prev, match]);
    }
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function editMatch(m: Match) {
    setEditingId(m.id);
    setForm({
      opponent: m.opponent ?? '',
      date: m.date ?? '',
      homeAway: m.homeAway ?? '',
      round: m.round ?? '',
      location: m.location ?? '',
      notes: m.notes ?? '',
    });
  }

  function removeMatch(m: Match) {
    if (!window.confirm(t('championship.confirmDeleteMatch', { label: matchLabel(m) }))) return;
    setMatches((prev) => prev.filter((x) => x.id !== m.id));
    setAssignmentForMatch(m.id, undefined);
    setSubstitutions((prev) => prev.filter((s) => s.matchId !== m.id));
    if (selectedMatchId === m.id) setSelectedMatchId(null);
    if (editingId === m.id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  }

  function openMatch(m: Match) {
    setSelectedMatchId(m.id);
    setTab('callup');
  }

  function backToList() {
    setSelectedMatchId(null);
  }

  // --- Detail view (selected match) ---
  if (selectedMatch) {
    const match = selectedMatch;
    return (
      <div className="team-page">
        <header className="team-page__header">
          <button type="button" className="team-page__back" onClick={backToList}>
            ← {t('championship.backToList')}
          </button>
          <h2>{matchLabel(match)}</h2>
        </header>

        <MatchInfoBar match={match} />

        <nav className="team-tabs">
          {(['callup', 'assignment', 'subs'] as MatchTab[]).map((key) => (
            <button
              key={key}
              type="button"
              className={`team-tab${tab === key ? ' team-tab--active' : ''}`}
              onClick={() => setTab(key)}
            >
              {t(`championship.tab.${key}`)}
            </button>
          ))}
        </nav>

        {tab === 'callup' && (
          <CallupPanel
            roster={roster}
            match={match}
            rules={rules}
            onChange={(next) =>
              setMatches((prev) => prev.map((m) => (m.id === next.id ? next : m)))
            }
          />
        )}

        {tab === 'assignment' && (
          <AssignmentPanel
            roster={roster}
            match={match}
            rules={rules}
            assignment={selectedAssignment}
            onChange={(next) => setAssignmentForMatch(match.id, next)}
          />
        )}

        {tab === 'subs' && (
          <SubstitutionsPanel
            roster={roster}
            match={match}
            assignment={selectedAssignment}
            substitutions={substitutions}
            onChange={setSubstitutions}
          />
        )}
      </div>
    );
  }

  // --- List view ---
  const sorted = [...matches].sort((a, b) => {
    const da = a.date ?? '9999';
    const db = b.date ?? '9999';
    return da.localeCompare(db);
  });

  return (
    <div className="team-page">
      <header className="team-page__header">
        <h2>{t('championship.title')}</h2>
        <button type="button" className="team-page__back" onClick={onClose}>
          {t('team.back')}
        </button>
      </header>

      <section className="team-card">
        <h3>{editingId ? t('championship.editMatch') : t('championship.newMatch')}</h3>
        <div className="team-form match-form">
          <label>
            {t('championship.opponent')}
            <input
              type="text"
              value={form.opponent}
              onChange={(e) => touch({ opponent: e.target.value })}
              placeholder="es. Volley Roma"
            />
          </label>
          <label>
            {t('championship.date')}
            <input
              type="date"
              value={form.date}
              onChange={(e) => touch({ date: e.target.value })}
            />
          </label>
          <label>
            {t('championship.homeAway')}
            <select
              value={form.homeAway}
              onChange={(e) => touch({ homeAway: e.target.value as HomeAway | '' })}
            >
              <option value="">{t('team.common.none')}</option>
              <option value="home">{t('championship.home')}</option>
              <option value="away">{t('championship.away')}</option>
            </select>
          </label>
          <label>
            {t('championship.round')}
            <input
              type="text"
              value={form.round}
              onChange={(e) => touch({ round: e.target.value })}
              placeholder="es. 5ª"
            />
          </label>
          <label>
            {t('championship.location')}
            <input
              type="text"
              value={form.location}
              onChange={(e) => touch({ location: e.target.value })}
              placeholder="es. Palestra XYZ"
            />
          </label>
          <label>
            {t('championship.notes')}
            <input
              type="text"
              value={form.notes}
              onChange={(e) => touch({ notes: e.target.value })}
            />
          </label>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'end' }}>
            <button type="button" className="team-btn team-btn--primary" onClick={submitMatch}>
              {editingId ? t('team.common.save') : t('championship.addMatch')}
            </button>
            {editingId && (
              <button
                type="button"
                className="team-btn"
                onClick={() => {
                  setEditingId(null);
                  setForm(EMPTY_FORM);
                }}
              >
                {t('team.common.cancel')}
              </button>
            )}
          </div>
        </div>
      </section>

      {sorted.length === 0 ? (
        <section className="team-card">
          <p className="team-empty">{t('championship.empty')}</p>
        </section>
      ) : (
        <section className="team-card">
          <h3>{t('championship.listTitle')}</h3>
          <ul className="match-list">
            {sorted.map((m) => (
              <li key={m.id} className="match-list__item">
                <button type="button" className="match-list__main" onClick={() => openMatch(m)}>
                  <span className="match-list__opponent">
                    {m.opponent || t('championship.untitled')}
                  </span>
                  <span className="match-list__meta">
                    {m.date && <span className="match-list__date">{m.date}</span>}
                    {m.homeAway && (
                      <span className={`badge badge--${m.homeAway}`}>
                        {t(`championship.${m.homeAway}`)}
                      </span>
                    )}
                    {m.round && <span className="match-list__round">{m.round}</span>}
                    <span className="match-list__count">
                      {t('championship.calledUp', { count: m.playerIds.length })}
                    </span>
                  </span>
                  {m.location && (
                    <span className="match-list__location">📍 {m.location}</span>
                  )}
                </button>
                <div className="match-list__actions">
                  <button
                    type="button"
                    className="team-btn team-btn--small"
                    onClick={() => editMatch(m)}
                  >
                    {t('team.common.edit')}
                  </button>
                  <button
                    type="button"
                    className="team-btn team-btn--small team-btn--danger"
                    onClick={() => removeMatch(m)}
                  >
                    {t('team.common.delete')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function MatchInfoBar({ match }: { match: Match }) {
  const { t } = useI18n();
  const parts: string[] = [];
  if (match.date) parts.push(match.date);
  if (match.homeAway) parts.push(t(`championship.${match.homeAway}`));
  if (match.round) parts.push(match.round);
  if (match.location) parts.push(`📍 ${match.location}`);
  if (parts.length === 0 && !match.notes) return null;
  return (
    <div className="match-info-bar">
      {parts.length > 0 && <p className="match-info-bar__meta">{parts.join(' · ')}</p>}
      {match.notes && <p className="match-info-bar__notes">{match.notes}</p>}
    </div>
  );
}
