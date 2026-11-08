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
 * I default sono codificati in `DEFAULT_RULES` (vedi schema.ts): 7 giocatori,
 * 3 donne minimo, libero obbligatorio, sostituisce un uomo, divieto 3 uomini
 * davanti disattivato.
 */
export function RulesPanel({ rules, onChange, onReset }: RulesPanelProps) {
  const { t } = useI18n();

  function touch(partial: Partial<MatchRules>) {
    onChange({ ...rules, ...partial });
  }

  return (
    <section className="team-card">
      <h3>{t('rules.title')}</h3>
      <p className="team-card__intro">{t('rules.intro')}</p>

      <div className="team-form" style={{ marginBottom: '1rem' }}>
        <label>
          {t('rules.squadSize')}
          <select
            className="team-select"
            value={rules.squadSize}
            onChange={(e) => touch({ squadSize: Number(e.target.value) })}
          >
            {[6, 7, 8, 9, 10, 11, 12].map((n) => (
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
            Tra i convocati deve esserci almeno un giocatore con ruolo libero.
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
        Regole attuali: {rules.squadSize} giocatori, minimo {rules.minWomen} donne, libero{' '}
        {rules.liberoRequired ? 'obbligatorio' : 'facoltativo'}
        {rules.liberoRequired && rules.liberoReplacesMan ? ', sostituisce un uomo' : ''}
        {rules.forbidThreeMenInFront ? ', 3 uomini davanti vietati' : ''}.
      </div>
    </section>
  );
}
