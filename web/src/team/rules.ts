import type { FormationConfig, SetterPosition } from '../configs/schema';
import { getPositions } from '../state/selectors';
import type { Assignment, Match, MatchRules, Roster, RosterPlayer } from './schema';

export type Severity = 'error' | 'warning';

export interface RuleIssue {
  severity: Severity;
  code: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: RuleIssue[];
}

function issue(severity: Severity, code: string, message: string): RuleIssue {
  return { severity, code, message };
}

function fullName(p: RosterPlayer): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/**
 * Conta uomini/donne tra i convocati e controlla le regole che non
 * dipendono dall'associazione ai ruoli (squad size, sesso minimo,
 * presenza di un libero).
 */
export function validateMatch(roster: Roster, match: Match, rules: MatchRules): ValidationResult {
  const issues: RuleIssue[] = [];
  const players = match.playerIds
    .map((id) => roster.players.find((p) => p.id === id))
    .filter((p): p is RosterPlayer => !!p);

  // Giocatori mancanti (id nella partita ma non nella rosa): segnalati come
  // error perché significa che la rosa è cambiata dopo la convocazione.
  const missing = match.playerIds.length - players.length;
  if (missing > 0) {
    issues.push(issue('error', 'missing_players', `${missing} convocato/i non più in rosa.`));
  }

  if (players.length !== rules.squadSize) {
    issues.push(
      issue(
        'error',
        'squad_size',
        `Servono ${rules.squadSize} giocatori (6 + 1 libero), ora sono ${players.length}.`,
      ),
    );
  }

  const women = players.filter((p) => p.sex === 'F').length;
  if (women < rules.minWomen) {
    issues.push(
      issue(
        'error',
        'min_women',
        `Servono almeno ${rules.minWomen} donne, ora sono ${women}.`,
      ),
    );
  }

  if (rules.liberoRequired) {
    const hasLibero = players.some((p) => p.preferredRole === 'libero');
    if (!hasLibero) {
      issues.push(
        issue(
          'error',
          'libero_required',
          `Tra i convocati deve esserci almeno un giocatore con ruolo libero.`,
        ),
      );
    }
  }

  // Bilanciamento di livello: solo informativo (warning), mai bloccante.
  const levels = players.map((p) => p.level ?? 3);
  if (levels.length >= 2) {
    const max = Math.max(...levels);
    const min = Math.min(...levels);
    if (max - min >= 3) {
      issues.push(
        issue(
          'warning',
          'level_spread',
          `Disomogeneità di livello nella squadra (delta ${max - min}).`,
        ),
      );
    }
  }

  return { ok: issues.every((i) => i.severity !== 'error'), issues };
}

/**
 * Dato uno schema, una rotazione e un assignment, restituisce per ogni
 * giocatore simbolico la zona di rotazione (1-6) in cui si trova, derivata
 * dalla fase "base" (l'unica le cui coordinate corrispondono alle zone reali).
 * Zone 4-3-2 = prima linea; 5-6-1 = seconda linea.
 */
export interface SlotZone {
  symbolicId: string;
  rosterId: string | undefined;
  zone: 1 | 2 | 3 | 4 | 5 | 6;
  isFrontRow: boolean;
}

const FRONT_ROW_ZONES: ReadonlySet<number> = new Set([2, 3, 4]);

/**
 * Deriva la zona (1-6) di ogni giocatore titolare dalla fase "base".
 * Approccio relativo (robusto a qualunque range di coordinate): ordina i
 * 6 titolari per y asc, i primi 3 sono prima linea (zona rete, y piccolo),
 * gli altri 3 seconda linea. Dentro ciascun gruppo, ordina per x asc e
 * assegna le zone: front = 4, 3, 2 (sx→dx); back = 5, 6, 1 (sx→dx).
 * I liberi non hanno zona di rotazione.
 */
export function computeSlotZones(
  config: FormationConfig,
  setterPosition: SetterPosition,
  assignment: Assignment,
): SlotZone[] {
  const basePositions = getPositions(config, 'base', setterPosition);
  const titleHolders = config.players.filter((p) => basePositions[p.id]);

  const sortedByY = [...titleHolders].sort((a, b) => basePositions[a.id]!.y - basePositions[b.id]!.y);
  const front = sortedByY.slice(0, 3);
  const back = sortedByY.slice(3, 6);

  const frontByX = [...front].sort((a, b) => basePositions[a.id]!.x - basePositions[b.id]!.x);
  const backByX = [...back].sort((a, b) => basePositions[a.id]!.x - basePositions[b.id]!.x);

  const zoneOf = new Map<string, 1 | 2 | 3 | 4 | 5 | 6>();
  frontByX.forEach((p, i) => zoneOf.set(p.id, ([4, 3, 2] as const)[i]));
  backByX.forEach((p, i) => zoneOf.set(p.id, ([5, 6, 1] as const)[i]));

  const allSlots = [...config.players, ...config.liberos];
  return allSlots
    .map((slot) => {
      const zone = zoneOf.get(slot.id) ?? 4;
      return {
        symbolicId: slot.id,
        rosterId: assignment.symbolicToRosterId[slot.id],
        zone,
        isFrontRow: FRONT_ROW_ZONES.has(zone),
      };
    })
    .sort((a, b) => a.zone - b.zone);
}

/**
 * Controlla le regole che dipendono dall'associazione giocatore→ruolo:
 * - tutti gli slot hanno un rosterPlayer assegnato
 * - tutti i rosterPlayer assegnati sono tra i convocati della partita
 * - se `liberoReplacesMan`: il libero sostituisce un uomo
 * - se `forbidThreeMenInFront`: non ci sono 3 uomini in prima linea
 */
export function validateAssignment(
  roster: Roster,
  match: Match,
  config: FormationConfig,
  assignment: Assignment,
  rules: MatchRules,
): ValidationResult {
  const issues: RuleIssue[] = [];
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  const allSlots = [...config.players, ...config.liberos];

  // I 6 titolari sono sempre obbligatori. I liberi sono obbligatori solo se
  // "attivi", cioè referenziati in almeno un liberoSwap: un libero dichiarato
  // ma mai usato (es. una riserva) resta opzionale. Così una convocazione da
  // 7 (6 + 1 libero) è valida anche su schemi che dichiarano 2 liberi.
  const activeLiberoIds = new Set(
    Object.values(config.liberoSwaps ?? {}).flatMap((byTeam) =>
      Object.values(byTeam).map((sw) => sw.libero),
    ),
  );
  const requiredSlots = [
    ...config.players,
    ...config.liberos.filter((l) => activeLiberoIds.has(l.id)),
  ];

  // Slot non assegnati (solo quelli obbligatori)
  const unassigned = requiredSlots.filter((s) => !assignment.symbolicToRosterId[s.id]);
  if (unassigned.length > 0) {
    issues.push(
      issue(
        'error',
        'unassigned_slots',
        `${unassigned.length} ruolo/i senza giocatore assegnato.`,
      ),
    );
  }

  // RosterPlayer non nella convocazione della partita
  for (const slot of allSlots) {
    const rosterId = assignment.symbolicToRosterId[slot.id];
    if (rosterId && !match.playerIds.includes(rosterId)) {
      const player = byId.get(rosterId);
      issues.push(
        issue(
          'error',
          'not_in_callup',
          `${player ? fullName(player) : rosterId} non è tra i convocati.`,
        ),
      );
    }
  }

  // Stesso rosterPlayer assegnato a due slot
  const used = new Map<string, string>(); // rosterId -> symbolicId
  for (const slot of allSlots) {
    const rosterId = assignment.symbolicToRosterId[slot.id];
    if (!rosterId) continue;
    const prev = used.get(rosterId);
    if (prev) {
      issues.push(
        issue('error', 'duplicate_assignment', `Un giocatore è assegnato a due ruoli (${prev}, ${slot.id}).`),
      );
    } else {
      used.set(rosterId, slot.id);
    }
  }

  // Regola "libero sostituisce un uomo"
  if (rules.liberoReplacesMan) {
    const liberoSlots = config.liberos;
    for (const liberoSlot of liberoSlots) {
      const liberoRosterId = assignment.symbolicToRosterId[liberoSlot.id];
      if (!liberoRosterId) continue;
      const liberoPlayer = byId.get(liberoRosterId);
      if (!liberoPlayer) continue;
      // Il libero entra per il back-row middle: lo individuiamo dalla fase base.
      // Per la regola mista, basta sapere se il sostituito è un uomo.
      const slotZones = computeSlotZones(config, assignment.setterPosition, assignment);
      // Il "replaces" è il middle di seconda linea. Lo individuiamo come il
      // middle il cui rosterId è un uomo, sostituito dal libero — qui non
      // abbiamo il replacesId esplicito, quindi controlliamo indirettamente:
      // se il libero è donna, il back-row middle che sostituisce deve essere
      // un uomo (altrimenti la regola mista è violata). Lo individuiamo dal
      // middle di seconda linea assegnato.
      const middleSlots = config.players.filter((p) => p.role === 'middle');
      const backRowMiddles = middleSlots
        .map((m) => slotZones.find((sz) => sz.symbolicId === m.id))
        .filter((sz): sz is SlotZone => !!sz && !sz.isFrontRow);
      for (const brm of backRowMiddles) {
        const replaced = brm.rosterId ? byId.get(brm.rosterId) : undefined;
        if (replaced && replaced.sex === 'F' && liberoPlayer.sex === 'F') {
          issues.push(
            issue(
              'warning',
              'libero_replaces_woman',
              `La regola vuole che il libero sostituisca un uomo, ma il centrale di seconda linea (${fullName(replaced)}) è donna.`,
            ),
          );
        }
      }
    }
  }

  // Regola "3 uomini davanti"
  if (rules.forbidThreeMenInFront) {
    const slotZones = computeSlotZones(config, assignment.setterPosition, assignment);
    const frontRow = slotZones.filter((sz) => sz.isFrontRow);
    const frontMen = frontRow.filter((sz) => {
      const p = sz.rosterId ? byId.get(sz.rosterId) : undefined;
      return p?.sex === 'M';
    });
    if (frontMen.length >= 3) {
      issues.push(
        issue(
          'error',
          'three_men_in_front',
          `Ci sono ${frontMen.length} uomini in prima linea: la regola vieta 3 uomini davanti.`,
        ),
      );
    }
  }

  return { ok: issues.every((i) => i.severity !== 'error'), issues };
}

/** Hook di utilità: trova i giocatori convocati non ancora assegnati a uno slot. */
export function unassignedMatchPlayers(
  match: Match,
  assignment: Assignment,
): string[] {
  const used = new Set(Object.values(assignment.symbolicToRosterId));
  return match.playerIds.filter((id) => !used.has(id));
}
