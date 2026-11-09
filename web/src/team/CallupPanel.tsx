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
 *
 * Il numero di convocati deve stare tra rules.squadSize (min) e
 * rules.squadSizeMax (max): sotto il minimo si può comunque selezionare
 * (la validazione segnala l'errore), sopra il max la checkbox si disabilita.
 *
 * L'allenatore può anche specificare, gara per gara, quali ruoli servono
 * (requiredRoles): se impostato con almeno un valore > 0, sovrascrive le
 * regole globali (liberoRequired). Così può decidere "per questa partita
 * voglio solo 1 libero e 2 palleggiatori" oppure "nessun requisito di ruolo".
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

const ROLE_OPTIONS: PlayerRole[] = ['setter', 'opposite', 'middle', 'hitter', 'libero'];

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

  function setRequiredRole(role: PlayerRole, count: number) {
    const current = match.requiredRoles ?? {};
    const next = { ...current, [role]: count };
    // Rimuovi gli zeri per tenere pulito il persisted state.
    if (count <= 0) delete next[role];
    onChange({
      ...match,
      requiredRoles: Object.keys(next).length > 0 ? next : undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  function clearRequiredRoles() {
    if (match.requiredRoles === undefined) return;
    onChange({ ...match, requiredRoles: undefined, updatedAt: new Date().toISOString() });
  }

  const women = match.playerIds.filter((id) => roster.players.find((p) => p.id === id)?.sex === 'F').length;
  const men = match.playerIds.filter((id) => roster.players.find((p) => p.id === id)?.sex === 'M').length;
  const selectedCount = match.playerIds.length;
  const sizeMinOk = selectedCount >= rules.squadSize;
  const sizeMaxOk = selectedCount <= rules.squadSizeMax;
  const womenOk = women >= rules.minWomen;
  const requiredRoles = match.requiredRoles ?? {};
  const hasCustomRoleReqs = ROLE_OPTIONS.some((r) => (requiredRoles[r] ?? 0) > 0);

  // Conta per ruolo tra i convocati (per l'editor requiredRoles).
  const roleCounts = useMemo(() => {
    const counts: Record<PlayerRole, number> = {
      setter: 0,
      opposite: 0,
      middle: 0,
      hitter: 0,
      libero: 0,
    };
    for (const id of match.playerIds) {
      const p = roster.players.find((rp) => rp.id === id);
      if (p) counts[p.preferredRole]++;
    }
    return counts;
  }, [match.playerIds, roster.players]);

  return (
    <div>
      <section className="team-card">
        <h3>{t('callup.title')}</h3>
        <p className="team-card__intro">
          {t('callup.introRange', { min: rules.squadSize, max: rules.squadSizeMax })}
        </p>

        <div className="team-stats">
          <div className="team-stats__item">
            <span className="team-stats__label">{t('callup.selectedLabel')}</span>
            <span
              className={`team-stats__value ${
                sizeMinOk && sizeMaxOk ? 'team-stats__value--ok' : 'team-stats__value--ko'
              }`}
            >
              {selectedCount} / {rules.squadSize}–{rules.squadSizeMax}
            </span>
          </div>
          <div className="team-stats__item">
            <span className="team-stats__label">{t('callup.womenLabel')}</span>
            <span className={`team-stats__value ${womenOk ? 'team-stats__value--ok' : 'team-stats__value--ko'}`}>
              {women}
            </span>
          </div>
          <div className="team-stats__item">
            <span className="team-stats__label">{t('callup.menLabel')}</span>
            <span className="team-stats__value">{men}</span>
          </div>
        </div>

        {roster.players.length === 0 ? (
          <p className="team-empty">{t('team.empty')}</p>
        ) : (
          <div>
            {roster.players.map((p) => {
              const checked = match.playerIds.includes(p.id);
              // Disabilita solo oltre il massimo: sotto il minimo si può
              // ancora selezionare (la validazione segnalerà l'errore).
              const disabled = !checked && selectedCount >= rules.squadSizeMax;
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
                    <span style={{ color: '#6b7280' }}>
                      · {ROLE_LABEL[p.preferredRole]}
                      {p.secondaryRole ? ` / ${ROLE_LABEL[p.secondaryRole]}` : ''}
                    </span>
                  </span>
                  {p.level && <span className="badge badge--level">{p.level}</span>}
                </label>
              );
            })}
          </div>
        )}
      </section>

      <section className="team-card">
        <h3>{t('callup.requiredRolesTitle')}</h3>
        <p className="team-card__intro">{t('callup.requiredRolesIntro')}</p>
        <p className="team-card__hint">
          {hasCustomRoleReqs ? t('callup.requiredRolesActive') : t('callup.requiredRolesInactive')}
        </p>
        <div className="team-form">
          {ROLE_OPTIONS.map((role) => {
            const required = requiredRoles[role] ?? 0;
            const have = roleCounts[role];
            const ok = have >= required;
            return (
              <label key={role}>
                {ROLE_LABEL[role]}
                <select
                  className="team-select"
                  value={required}
                  onChange={(e) => setRequiredRole(role, Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? t('callup.requiredRoleAny') : n}
                    </option>
                  ))}
                </select>
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: ok ? '#1b7a3a' : '#b91c1c',
                    marginTop: '0.2rem',
                  }}
                >
                  {t('callup.requiredRoleHave', { have, required })}
                </span>
              </label>
            );
          })}
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'end' }}>
            <button
              type="button"
              className="team-btn"
              onClick={clearRequiredRoles}
              disabled={!hasCustomRoleReqs}
            >
              {t('callup.requiredRolesClear')}
            </button>
          </div>
        </div>
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
