import { useMemo } from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { PlayerRole } from '../configs/schema';
import type { Match, MatchRules, Roster } from './schema';
import { validateMatch, type RuleIssue } from './rules';

/**
 * Scheda "Convocazioni" di una partita: seleziona i giocatori della rosa
 * da convocare per questa gara. La regola mista viene controllata in tempo
 * reale (validateMatch). Riceve la singola partita selezionata (non più la
 * lista delle convocazioni, che ora vive nella vista Campionato).
 */
interface CallupPanelProps {
  roster: Roster;
  match: Match;
  rules: MatchRules;
  onChange: (next: Match) => void;
}

const ROLE_LABEL: Record<PlayerRole, string> = {
  setter: 'Palleggiatore',
  opposite: 'Opposto',
  middle: 'Centrale',
  hitter: 'Schiacciatore',
  libero: 'Libero',
};

export function CallupPanel({ roster, match, rules, onChange }: CallupPanelProps) {
  const { t } = useI18n();

  const validation = useMemo(
    () => validateMatch(roster, match, rules),
    [roster, match, rules],
  );

  function togglePlayer(playerId: string) {
    const playerIds = match.playerIds.includes(playerId)
      ? match.playerIds.filter((id) => id !== playerId)
      : [...match.playerIds, playerId];
    onChange({ ...match, playerIds, updatedAt: new Date().toISOString() });
  }

  const women = match.playerIds.filter((id) => roster.players.find((p) => p.id === id)?.sex === 'F').length;
  const men = match.playerIds.filter((id) => roster.players.find((p) => p.id === id)?.sex === 'M').length;
  const selectedCount = match.playerIds.length;
  const sizeOk = selectedCount === rules.squadSize;
  const womenOk = women >= rules.minWomen;

  return (
    <div>
      <section className="team-card">
        <h3>{t('callup.title')}</h3>
        <p className="team-card__intro">{t('callup.intro', { size: rules.squadSize })}</p>

        <div className="team-stats">
          <div className="team-stats__item">
            <span className="team-stats__label">Selezionati</span>
            <span className={`team-stats__value ${sizeOk ? 'team-stats__value--ok' : 'team-stats__value--ko'}`}>
              {selectedCount} / {rules.squadSize}
            </span>
          </div>
          <div className="team-stats__item">
            <span className="team-stats__label">Donne</span>
            <span className={`team-stats__value ${womenOk ? 'team-stats__value--ok' : 'team-stats__value--ko'}`}>
              {women}
            </span>
          </div>
          <div className="team-stats__item">
            <span className="team-stats__label">Uomini</span>
            <span className="team-stats__value">{men}</span>
          </div>
        </div>

        {roster.players.length === 0 ? (
          <p className="team-empty">{t('team.empty')}</p>
        ) : (
          <div>
            {roster.players.map((p) => {
              const checked = match.playerIds.includes(p.id);
              const disabled = !checked && selectedCount >= rules.squadSize;
              return (
                <label
                  key={p.id}
                  className="callup-player-row"
                  style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => togglePlayer(p.id)}
                  />
                  <span style={{ flex: 1 }}>
                    <strong>
                      {p.firstName} {p.lastName}
                    </strong>{' '}
                    <span className={`badge badge--${p.sex}`}>{t(`team.common.sex.${p.sex}`)}</span>{' '}
                    <span style={{ color: '#6b7280' }}>· {ROLE_LABEL[p.preferredRole]}</span>
                  </span>
                  {p.level && <span className="badge badge--level">{p.level}</span>}
                </label>
              );
            })}
          </div>
        )}
      </section>

      <IssuesCard issues={validation.issues} />
    </div>
  );
}

export function IssuesCard({ issues }: { issues: RuleIssue[] }) {
  const { t } = useI18n();
  if (issues.length === 0) {
    return (
      <section className="team-card">
        <h3>{t('assignment.issues')}</h3>
        <p style={{ color: '#1b7a3a', fontWeight: 600 }}>✓ {t('assignment.ok')}</p>
      </section>
    );
  }
  return (
    <section className="team-card">
      <h3>{t('assignment.issues')}</h3>
      <ul className="team-issues">
        {issues.map((issue, i) => (
          <li key={i} className={`team-issue team-issue--${issue.severity}`}>
            <span className="team-issue__tag">
              {issue.severity === 'error' ? t('issues.error') : t('issues.warning')}
            </span>
            <span>{issue.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
