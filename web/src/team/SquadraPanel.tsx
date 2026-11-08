import { useRef } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { RosterPanel } from './RosterPanel';
import { RulesPanel } from './RulesPanel';
import { useTeamState } from './TeamStateContext';
import './team.css';

/**
 * Vista "Squadra": la rosa della squadra + le regole globali della
 * formazione mista + esportazione/importazione JSON. È una delle due
 * voci principali del modulo (l'altra è "Campionato"). Tutti i dati
 * vivono in localStorage sul dispositivo: nessun backend, i nomi dei
 * giocatori non lasciano mai il dispositivo.
 */
interface SquadraPanelProps {
  onClose: () => void;
}

export function SquadraPanel({ onClose }: SquadraPanelProps) {
  const { t } = useI18n();
  const {
    roster,
    setRoster,
    rules,
    setRules,
    resetRules,
    exportJson,
    importJson,
  } = useTeamState();

  const fileInputRef = useRef<HTMLInputElement>(null);

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) importJson(file);
    e.target.value = '';
  }

  return (
    <div className="team-page">
      <header className="team-page__header">
        <h2>{t('team.title')}</h2>
        <div className="team-actions">
          <button type="button" className="team-btn" onClick={exportJson}>
            {t('team.export')}
          </button>
          <button type="button" className="team-btn" onClick={() => fileInputRef.current?.click()}>
            {t('team.import')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={onImportFile}
          />
          <button type="button" className="team-page__back" onClick={onClose}>
            {t('team.back')}
          </button>
        </div>
      </header>

      <RosterPanel roster={roster} onChange={setRoster} />

      <div style={{ marginTop: '1rem' }}>
        <RulesPanel rules={rules} onChange={setRules} onReset={resetRules} />
      </div>
    </div>
  );
}
