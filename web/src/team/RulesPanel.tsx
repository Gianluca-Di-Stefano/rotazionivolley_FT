import { useI18n } from '../i18n/I18nContext';
import { DEFAULT_RULES, type MatchRules } from './schema';

interface RulesPanelProps {
  rules: MatchRules;
  onChange: (next: MatchRules) => void;
  onReset: () => void;
}

/**
 * Pagina delle regole della formazione mista. Tutti i parametri sono
 * modificabili qui: quando l'allenatore chiarisce i dubbi (libero
 * obbligatorio? deve sostituire un uomo?), basta cambiare un flag.
 *
 * I default sono codificati in `DEFAULT_RULES` (vedi schema.ts): 7-12
 * giocatori (min-max), 3 donne minimo, libero obbligatorio, sostituisce
 * un uomo, divieto 3 uomini davanti disattivato.
 */
export function RulesPanel({ rules, onChange, onReset }: RulesPanelProps) {
  const { t } = useI18n();

  function touch(partial: Partial<MatchRules>) {
    onChange({ ...rules, ...partial });
  }

  // Mantiene min <= max quando l'utente cambia uno dei due.
  function touchSize(partial: Partial<Pick<MatchRules, 'squadSize' | 'squadSizeMax'>>) {
    const next = { ...rules, ...partial };
    if (next.squadSize > next.squadSizeMax) {
      if (partial.squadSize !== undefined) next.squadSizeMax = next.squadSize;
      if (partial.squadSizeMax !== undefined) next.squadSize = next.squadSizeMax;
    }
    onChange(next);
  }

  return (
    <section className="team-card">
      <h3>{t('rules.title')}</h3>
      <p className="team-card__intro">{t('rules.intro')}</p>

      <div className="team-form" style={{ marginBottom: '1rem' }}>
        <label>
          {t('rules.squadSizeMin')}
          <select
            className="team-select"
            value={rules.squadSize}
            onChange={(e) => touchSize({ squadSize: Number(e.target.value) })}
          >
            {[6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('rules.squadSizeMax')}
          <select
            className="team-select"
            value={rules.squadSizeMax}
            onChange={(e) => touchSize({ squadSizeMax: Number(e.target.value) })}
          >
            {[6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('rules.minWomen')}
          <select
            className="team-select"
            value={rules.minWomen}
            onChange={(e) => touch({ minWomen: Number(e.target.value) })}
          >
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="team-check">
        <input
          type="checkbox"
          checked={rules.liberoRequired}
          onChange={(e) => touch({ liberoRequired: e.target.checked })}
        />
        <span>
          <strong>{t('rules.liberoRequired')}</strong>
          <br />
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            {t('rules.liberoRequiredHint')}
          </span>
        </span>
      </label>

      <label className="team-check">
        <input
          type="checkbox"
          checked={rules.liberoReplacesMan}
          onChange={(e) => touch({ liberoReplacesMan: e.target.checked })}
        />
        <span>
          <strong>{t('rules.liberoReplacesMan')}</strong>
          <br />
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            Il centrale di seconda linea sostituito dal libero deve essere un uomo.
          </span>
        </span>
      </label>

      <label className="team-check">
        <input
          type="checkbox"
          checked={rules.forbidThreeMenInFront}
          onChange={(e) => touch({ forbidThreeMenInFront: e.target.checked })}
        />
        <span>
          <strong>{t('rules.forbidThreeMenInFront')}</strong>
          <br />
          <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>{t('rules.note')}</span>
        </span>
      </label>

      <div className="team-actions" style={{ marginTop: '1rem' }}>
        <button
          type="button"
          className="team-btn"
          onClick={() => {
            if (
              JSON.stringify(rules) === JSON.stringify(DEFAULT_RULES) ||
              window.confirm('Ripristinare le regole di default?')
            ) {
              onReset();
            }
          }}
        >
          {t('rules.reset')}
        </button>
      </div>

      <div className="team-note">
        {t('rules.summary', {
          min: rules.squadSize,
          max: rules.squadSizeMax,
          minWomen: rules.minWomen,
          libero: rules.liberoRequired ? t('rules.summaryLiberoYes') : t('rules.summaryLiberoNo'),
          replacesMan:
            rules.liberoRequired && rules.liberoReplacesMan ? t('rules.summaryReplacesMan') : '',
          forbid: rules.forbidThreeMenInFront ? t('rules.summaryForbid') : '',
        })}
      </div>
    </section>
  );
}
