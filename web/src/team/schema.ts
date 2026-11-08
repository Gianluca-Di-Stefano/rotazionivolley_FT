import { z } from 'zod';
import { PlayerRoleSchema, type SetterPosition } from '../configs/schema';

/**
 * Modulo "Squadra": un livello sopra gli schemi di rotazione esistenti.
 * Mappa giocatori reali (con sesso, ruolo, livello) sui ruoli simbolici
 * di un FormationConfig, gestisce convocazioni e cambi.
 *
 * La rosa è personale per dispositivo (localStorage, chiavi con prefisso
 * `rv-`), esportabile come JSON. Nessun backend: i nomi dei giocatori non
 * lasciano mai il dispositivo.
 *
 * La navigazione è suddivisa in due voci:
 *  - "Squadra" (rosa + regole globali)
 *  - "Campionato" (lista partite → per ogni partita: Convocazioni,
 *    Ruoli, Cambi)
 */

export const SexSchema = z.enum(['M', 'F']);
export type Sex = z.infer<typeof SexSchema>;

/** Livello soggettivo 1-5 (1=principiante, 5=esperto). Opzionale. */
export const PlayerLevelSchema = z.number().int().min(1).max(5);
export type PlayerLevel = z.infer<typeof PlayerLevelSchema>;

/**
 * Un giocatore della rosa. Diverso da PlayerDef (che è il placeholder
 * simbolico dentro uno schema): qui stiamo descrivendo una persona reale.
 * `preferredRole` è solo un suggerimento per la UI di associazione; non
 * vincola dove può giocare. `level` è facoltativo.
 */
export const RosterPlayerSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  sex: SexSchema,
  preferredRole: PlayerRoleSchema,
  level: PlayerLevelSchema.optional(),
  notes: z.string().optional(),
});
export type RosterPlayer = z.infer<typeof RosterPlayerSchema>;

export const RosterSchema = z.object({
  teamName: z.string().optional(),
  players: z.array(RosterPlayerSchema).default([]),
  updatedAt: z.string(),
});
export type Roster = z.infer<typeof RosterSchema>;

/**
 * Una partita di campionato. Contiene i metadati della gara (avversario,
 * data, casa/fuori, giornata, luogo, note) e la lista dei convocati
 * (`playerIds`). Ogni partita ha la sua associazione ruoli e la sua
 * cronologia cambi, collegate via `matchId`.
 */
export const HomeAwaySchema = z.enum(['home', 'away']);
export type HomeAway = z.infer<typeof HomeAwaySchema>;

export const MatchSchema = z.object({
  id: z.string().min(1),
  opponent: z.string().optional(),
  date: z.string().optional(),
  homeAway: HomeAwaySchema.optional(),
  round: z.string().optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  playerIds: z.array(z.string().min(1)).default([]),
  updatedAt: z.string(),
});
export type Match = z.infer<typeof MatchSchema>;

/**
 * Mappa i convocati di una partita sui 6+1 "slot" (ruoli simbolici) di
 * uno schema. La chiave è l'id del giocatore simbolico nel FormationConfig
 * (uno in config.players o config.liberos); il valore è l'id del
 * RosterPlayer. Per ogni slot simbolico deve esserci un rosterPlayerId.
 */
export const AssignmentSchema = z.object({
  matchId: z.string().min(1),
  configId: z.string().min(1),
  setterPosition: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  symbolicToRosterId: z.record(z.string(), z.string()).default({}),
  updatedAt: z.string(),
});
export type Assignment = z.infer<typeof AssignmentSchema>;

/**
 * Un cambio durante la gara. `entersRosterId` e `exitsRosterId` sono
 * id di RosterPlayer; `moment` è testo libero (es. "Set 2 - 12-8").
 */
export const SubstitutionSchema = z.object({
  id: z.string().min(1),
  matchId: z.string().min(1),
  entersRosterId: z.string().min(1),
  exitsRosterId: z.string().min(1),
  moment: z.string().optional(),
  reason: z.string().optional(),
  timestamp: z.string(),
});
export type Substitution = z.infer<typeof SubstitutionSchema>;

/**
 * Regole configurabili della formazione mista. Tutti i parametri sono
 * modificabili dalla UI (sezione Regole, nella vista Squadra) così,
 * quando l'allenatore chiarisce i dubbi (libero obbligatorio? deve
 * sostituire un uomo?), basta cambiare il flag senza toccare il codice.
 *
 * Default: 7 giocatori (6+1 libero), almeno 3 donne, libero obbligatorio,
 * sostituisce un uomo. Il divieto "3 uomini davanti" è disattivato di
 * default (come da analisi dell'utente: con libero donna le altre due
 * donne sarebbero opposte, quindi è già coperto).
 */
export const MatchRulesSchema = z.object({
  squadSize: z.number().int().min(1).max(12).default(7),
  minWomen: z.number().int().min(0).max(12).default(3),
  liberoRequired: z.boolean().default(true),
  liberoReplacesMan: z.boolean().default(true),
  forbidThreeMenInFront: z.boolean().default(false),
});
export type MatchRules = z.infer<typeof MatchRulesSchema>;

export const DEFAULT_RULES: MatchRules = MatchRulesSchema.parse({});

/** Crea un id breve e sufficientemente unico per uso locale. */
export function newId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}_${time}${rand}`;
}

export type SetterPosition1to6 = SetterPosition;

/** Etichetta leggibile di una partita, usata nelle liste e nei confirm. */
export function matchLabel(match: Match): string {
  const opp = match.opponent?.trim();
  const base = opp ? `vs ${opp}` : 'Partita';
  return match.date ? `${base} (${match.date})` : base;
}
