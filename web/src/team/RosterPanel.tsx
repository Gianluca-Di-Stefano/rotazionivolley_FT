import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext';
import type { PlayerRole } from '../configs/schema';
import { newId, type Roster, type RosterPlayer, type Sex } from './schema';

interface RosterPanelProps {
  roster: Roster;
  onChange: (next: Roster) => void;
}

const ROLE_OPTIONS: { value: PlayerRole; label: string }[] = [
  { value: 'setter', label: 'Palleggiatore' },
  { value: 'opposite', label: 'Opposto' },
  { value: 'middle', label: 'Centrale' },
  { value: 'hitter', label: 'Schiacciatore' },
  { value: 'libero', label: 'Libero' },
];

const ROLE_LABEL: Record<PlayerRole, string> = {
  setter: 'Palleggiatore',
  opposite: 'Opposto',
  middle: 'Centrale',
  hitter: 'Schiacciatore',
  libero: 'Libero',
};

const EMPTY_FORM: Omit<RosterPlayer, 'id'> = {
  firstName: '',
  lastName: '',
  sex: 'M',
  preferredRole: 'hitter',
  secondaryRole: undefined,
  level: undefined,
  notes: '',
};

export function RosterPanel({ roster, onChange }: RosterPanelProps) {
  const { t } = useI18n();
  const [form, setForm] = useState<Omit<RosterPlayer, 'id'>>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  function touch(partial: Partial<Omit<RosterPlayer, 'id'>>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function submit() {
    if (!form.firstName.trim() && !form.lastName.trim()) return;
    const player: RosterPlayer = {
      id: editingId ?? newId('rp'),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      sex: form.sex,
      preferredRole: form.preferredRole,
      secondaryRole: form.secondaryRole,
      level: form.level,
      notes: form.notes?.trim() || undefined,
    };
    const players = editingId
      ? roster.players.map((p) => (p.id === editingId ? player : p))
      : [...roster.players, player];
    onChange({ ...roster, players, updatedAt: new Date().toISOString() });
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function edit(player: RosterPlayer) {
    setEditingId(player.id);
    setForm({
      firstName: player.firstName,
      lastName: player.lastName,
      sex: player.sex,
      preferredRole: player.preferredRole,
      secondaryRole: player.secondaryRole,
      level: player.level,
      notes: player.notes ?? '',
    });
  }

  function remove(id: string) {
    const player = roster.players.find((p) => p.id === id);
    if (!player) return;
    if (!window.confirm(t('team.common.confirmDelete', { name: `${player.firstName} ${player.lastName}`.trim() }))) {
      return;
    }
    onChange({
      ...roster,
      players: roster.players.filter((p) => p.id !== id),
      updatedAt: new Date().toISOString(),
    });
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY_FORM);
    }
  }

  function setTeamName(name: string) {
    onChange({ ...roster, teamName: name || undefined, updatedAt: new Date().toISOString() });
  }

  /**
   * Esporta solo la rosa come file JSON (backup separato dalle partite).
   * Il file è autosufficiente: può essere reimportato con "Importa JSON"
   * (che accetta sia la forma completa che quella con sola rosa).
   */
  function saveRosterJson() {
    const payload = {
      version: 2,
      type: 'roster',
      exportedAt: new Date().toISOString(),
      roster,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (roster.teamName ?? 'rosa').replace(/[^a-z0-9-_]+/gi, '_');
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `rosa_${safeName}_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="roster-layout">
      <section className="team-card">
        <h3>{t('roster.title')}</h3>
        <p className="team-card__intro">{t('roster.intro')}</p>
        <p className="team-card__hint">{t('roster.persistenceHint')}</p>

        <div className="team-form" style={{ marginBottom: '0.8rem' }}>
          <label>
            {t('roster.teamName')}
            <input
              type="text"
              value={roster.teamName ?? ''}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="es. Volley Club"
            />
          </label>
        </div>

        <div className="team-form" aria-label="Aggiungi giocatore">
          <label>
            {t('team.common.firstName')}
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => touch({ firstName: e.target.value })}
              placeholder="Mario"
            />
          </label>
          <label>
            {t('team.common.lastName')}
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => touch({ lastName: e.target.value })}
              placeholder="Rossi"
            />
          </label>
          <label>
            {t('team.common.sex')}
            <select value={form.sex} onChange={(e) => touch({ sex: e.target.value as Sex })}>
              <option value="M">{t('team.common.sex.M')}</option>
              <option value="F">{t('team.common.sex.F')}</option>
            </select>
          </label>
          <label>
            {t('team.common.role')}
            <select
              value={form.preferredRole}
              onChange={(e) => touch({ preferredRole: e.target.value as PlayerRole })}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('team.common.secondaryRole')}
            <select
              value={form.secondaryRole ?? ''}
              onChange={(e) =>
                touch({ secondaryRole: e.target.value ? (e.target.value as PlayerRole) : undefined })
              }
            >
              <option value="">{t('team.common.none')}</option>
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('team.common.level')}
            <select
              value={form.level ?? ''}
              onChange={(e) => touch({ level: e.target.value ? (Number(e.target.value) as 1 | 2 | 3 | 4 | 5) : undefined })}
            >
              <option value="">{t('team.common.none')}</option>
              {[1, 2, 3, 4, 5].map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t('team.common.notes')}
            <input
              type="text"
              value={form.notes ?? ''}
              onChange={(e) => touch({ notes: e.target.value })}
              placeholder="(opzionale)"
            />
          </label>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'end' }}>
            <button type="button" className="team-btn team-btn--primary" onClick={submit}>
              {editingId ? t('team.common.save') : t('roster.add')}
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

        {roster.players.length === 0 ? (
          <p className="team-empty">{t('roster.empty')}</p>
        ) : (
          <table className="team-table">
            <thead>
              <tr>
                <th>{t('team.common.firstName')}</th>
                <th>{t('team.common.lastName')}</th>
                <th>{t('team.common.sex')}</th>
                <th>{t('team.common.role')}</th>
                <th>{t('team.common.secondaryRole')}</th>
                <th>{t('team.common.level')}</th>
                <th>{t('team.common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {roster.players.map((p) => (
                <tr key={p.id}>
                  <td>{p.firstName}</td>
                  <td>{p.lastName}</td>
                  <td>
                    <span className={`badge badge--${p.sex}`}>{t(`team.common.sex.${p.sex}`)}</span>
                  </td>
                  <td>
                    <span className="badge badge--role">{ROLE_LABEL[p.preferredRole]}</span>
                  </td>
                  <td>
                    {p.secondaryRole ? (
                      <span className="badge badge--role badge--role-secondary">
                        {ROLE_LABEL[p.secondaryRole]}
                      </span>
                    ) : (
                      t('team.common.none')
                    )}
                  </td>
                  <td>{p.level ? <span className="badge badge--level">{p.level}</span> : t('team.common.none')}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>
                      <button
                        type="button"
                        className="team-btn team-btn--small"
                        onClick={() => edit(p)}
                      >
                        {t('team.common.edit')}
                      </button>
                      <button
                        type="button"
                        className="team-btn team-btn--small team-btn--danger"
                        onClick={() => remove(p.id)}
                      >
                        {t('team.common.delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="team-actions" style={{ marginTop: '0.8rem', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280', flex: 1 }}>
            {t('roster.count', { count: roster.players.length })}
          </p>
          <button
            type="button"
            className="team-btn team-btn--primary"
            onClick={saveRosterJson}
            disabled={roster.players.length === 0}
            title={t('roster.saveHint')}
          >
            {t('roster.save')}
          </button>
        </div>
      </section>
    </div>
  );
}
