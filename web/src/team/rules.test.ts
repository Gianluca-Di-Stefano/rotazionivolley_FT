import { describe, expect, it } from 'vitest';
import type { FormationConfig } from '../configs/schema';
import { buildFixtureConfig } from '../configs/testFixtures';
import { withLiberoSwap } from '../state/selectors';
import { DEFAULT_RULES } from './schema';
import type { Assignment, Match, MatchRules, Roster } from './schema';
import { computeSlotZones, validateAssignment, validateMatch } from './rules';

function player(
  id: string,
  sex: 'M' | 'F',
  preferredRole: Roster['players'][number]['preferredRole'] = 'hitter',
  level = 3,
): Roster['players'][number] {
  return {
    id,
    firstName: id,
    lastName: '',
    sex,
    preferredRole,
    level,
  };
}

function buildRoster(players: Roster['players']): Roster {
  return { players, updatedAt: new Date().toISOString() };
}

function buildMatch(playerIds: string[]): Match {
  return { id: 'm1', opponent: 'Test', playerIds, updatedAt: new Date().toISOString() };
}

function buildAssignment(map: Record<string, string>): Assignment {
  return {
    matchId: 'm1',
    configId: 'fixture',
    setterPosition: 1,
    symbolicToRosterId: map,
    updatedAt: new Date().toISOString(),
  };
}

const fixtureConfig = buildFixtureConfig();
// Nella fase base di P1 del fixture (vedi testFixtures):
// front (y=50): O(100) → zona 4, C2(225) → zona 3, S1(350) → zona 2
// back (y=300): S2(100) → zona 5, C1(225) → zona 6, P(350) → zona 1

describe('validateMatch', () => {
  it('accetta una squadra con 3 donne su 7 e un libero', () => {
    const roster = buildRoster([
      player('m1', 'M', 'setter'),
      player('m2', 'M', 'opposite'),
      player('m3', 'M', 'middle'),
      player('m4', 'M', 'middle'),
      player('f1', 'F', 'hitter'),
      player('f2', 'F', 'hitter'),
      player('f3', 'F', 'libero'),
    ]);
    const match = buildMatch(['m1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3']);
    const result = validateMatch(roster, match, DEFAULT_RULES);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('rifiuta una squadra con meno di 3 donne', () => {
    const roster = buildRoster([
      player('m1', 'M'),
      player('m2', 'M'),
      player('m3', 'M'),
      player('m4', 'M'),
      player('m5', 'M'),
      player('f1', 'F'),
      player('f2', 'F', 'libero'),
    ]);
    const match = buildMatch(['m1', 'm2', 'm3', 'm4', 'm5', 'f1', 'f2']);
    const result = validateMatch(roster, match, DEFAULT_RULES);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'min_women')).toBe(true);
  });

  it('rifiuta se non c\'è un libero e liberoRequired è attivo', () => {
    const roster = buildRoster([
      player('m1', 'M'),
      player('m2', 'M'),
      player('m3', 'M'),
      player('m4', 'M'),
      player('f1', 'F'),
      player('f2', 'F'),
      player('f3', 'F'),
    ]);
    const match = buildMatch(['m1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3']);
    const result = validateMatch(roster, match, DEFAULT_RULES);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'libero_required')).toBe(true);
  });

  it('accetta squadra senza libero se liberoRequired è disattivo', () => {
    const rules: MatchRules = { ...DEFAULT_RULES, liberoRequired: false };
    const roster = buildRoster([
      player('m1', 'M'),
      player('m2', 'M'),
      player('m3', 'M'),
      player('m4', 'M'),
      player('f1', 'F'),
      player('f2', 'F'),
      player('f3', 'F'),
    ]);
    const match = buildMatch(['m1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3']);
    const result = validateMatch(roster, match, rules);
    expect(result.ok).toBe(true);
  });

  it('segnala warning (non errore) se il livello è molto disomogeneo', () => {
    const roster = buildRoster([
      player('m1', 'M', 'setter', 5),
      player('m2', 'M', 'opposite', 1),
      player('m3', 'M', 'middle', 3),
      player('m4', 'M', 'middle', 3),
      player('f1', 'F', 'hitter', 3),
      player('f2', 'F', 'hitter', 3),
      player('f3', 'F', 'libero', 3),
    ]);
    const match = buildMatch(['m1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3']);
    const result = validateMatch(roster, match, DEFAULT_RULES);
    expect(result.ok).toBe(true); // ok = no errori (i warning non bloccano)
    expect(result.issues.some((i) => i.code === 'level_spread')).toBe(true);
  });
});

describe('computeSlotZones', () => {
  it('assegna le zone 4-3-2 davanti e 5-6-1 dietro per P1', () => {
    const assignment = buildAssignment({});
    const zones = computeSlotZones(fixtureConfig, 1, assignment);
    const byId = new Map(zones.map((z) => [z.symbolicId, z]));
    // Front row (zone 2,3,4)
    expect(byId.get('O')?.zone).toBe(4);
    expect(byId.get('C2')?.zone).toBe(3);
    expect(byId.get('S1')?.zone).toBe(2);
    // Back row (zone 5,6,1)
    expect(byId.get('S2')?.zone).toBe(5);
    expect(byId.get('C1')?.zone).toBe(6);
    expect(byId.get('P')?.zone).toBe(1);
    // I liberi non hanno zona (default 4 ma isFrontRow solo se la zona è 2/3/4)
    const libero = byId.get('L1');
    expect(libero).toBeDefined();
  });
});

describe('validateAssignment', () => {
  function fullRoster(): Roster {
    return buildRoster([
      player('m1', 'M', 'setter'),
      player('m2', 'M', 'opposite'),
      player('m3', 'M', 'middle'),
      player('m4', 'M', 'middle'),
      player('f1', 'F', 'hitter'),
      player('f2', 'F', 'hitter'),
      player('f3', 'F', 'libero'),
    ]);
  }

  function fullMatch(): Match {
    return buildMatch(['m1', 'm2', 'm3', 'm4', 'f1', 'f2', 'f3']);
  }

  it('accetta un assignment completo e coerente', () => {
    const roster = fullRoster();
    const match = fullMatch();
    const assignment = buildAssignment({
      P: 'm1',
      O: 'm2',
      C1: 'm3',
      C2: 'm4',
      S1: 'f1',
      S2: 'f2',
      L1: 'f3',
    });
    const result = validateAssignment(roster, match, fixtureConfig, assignment, DEFAULT_RULES);
    expect(result.ok).toBe(true);
  });

  it('rifiuta se uno slot titolare non è assegnato', () => {
    const roster = fullRoster();
    const match = fullMatch();
    const assignment = buildAssignment({
      P: 'm1',
      O: 'm2',
      C1: 'm3',
      C2: 'm4',
      S1: 'f1',
      // S2 manca (titolare, sempre obbligatorio)
      L1: 'f3',
    });
    const result = validateAssignment(roster, match, fixtureConfig, assignment, DEFAULT_RULES);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'unassigned_slots')).toBe(true);
  });

  it('non richiede il libero se non è attivo in nessun liberoSwap (fixture senza swap)', () => {
    // Nel fixture liberoSwaps è vuoto: il libero dichiarato (L1) è una riserva
    // inattiva e resta opzionale. Una formazione da 6 soli titolari è valida.
    const roster = fullRoster();
    const match = fullMatch();
    const assignment = buildAssignment({
      P: 'm1',
      O: 'm2',
      C1: 'm3',
      C2: 'm4',
      S1: 'f1',
      S2: 'f2',
      // L1 (libero inattivo) omesso: non obbligatorio
    });
    const result = validateAssignment(roster, match, fixtureConfig, assignment, DEFAULT_RULES);
    expect(result.ok).toBe(true);
  });

  it('richiede il libero attivo (referenziato in un liberoSwap)', () => {
    // Attivo = compare in almeno un liberoSwap. Omittalor diventa obbligatorio.
    const config = withLiberoSwap(fixtureConfig, 'receive', 1, { libero: 'L1', replaces: 'C1' });
    const roster = fullRoster();
    const match = fullMatch();
    const assignment = buildAssignment({
      P: 'm1',
      O: 'm2',
      C1: 'm3',
      C2: 'm4',
      S1: 'f1',
      S2: 'f2',
      // L1 (attivo) manca
    });
    const result = validateAssignment(roster, match, config, assignment, DEFAULT_RULES);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'unassigned_slots')).toBe(true);
  });

  it('non richiede il libero riserva: 7 convocati (6+1) su uno schema con 2 liberi', () => {
    // Riproduce lo scenario reale di "ricezione-a-3": 2 liberi dichiarati,
    // ma solo L1 è attivo (in liberoSwaps). Con 7 convocati si riempiono
    // 6 titolari + L1; L2 (riserva inattiva) resta vuoto ed è valido.
    const withTwoLiberos: FormationConfig = {
      ...fixtureConfig,
      liberos: [
        { id: 'L1', label: 'Libero 1', shortLabel: 'L1', role: 'libero' },
        { id: 'L2', label: 'Libero 2', shortLabel: 'L2', role: 'libero' },
      ],
    };
    const config = withLiberoSwap(withTwoLiberos, 'receive', 1, { libero: 'L1', replaces: 'C1' });
    const roster = fullRoster();
    const match = fullMatch();
    const assignment = buildAssignment({
      P: 'm1',
      O: 'm2',
      C1: 'm3',
      C2: 'm4',
      S1: 'f1',
      S2: 'f2',
      L1: 'f3',
      // L2 (riserva inattiva) omesso: non obbligatorio
    });
    const result = validateAssignment(roster, match, config, assignment, DEFAULT_RULES);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.code === 'unassigned_slots')).toBe(false);
  });

  it('rifiuta se un rosterPlayer assegnato non è nella callup', () => {
    const roster = buildRoster([
      ...fullRoster().players,
      player('extra', 'M', 'hitter'),
    ]);
    const match = fullMatch();
    const assignment = buildAssignment({
      P: 'm1',
      O: 'm2',
      C1: 'm3',
      C2: 'm4',
      S1: 'f1',
      S2: 'extra', // non convocato
      L1: 'f3',
    });
    const result = validateAssignment(roster, match, fixtureConfig, assignment, DEFAULT_RULES);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'not_in_callup')).toBe(true);
  });

  it('rifieta se lo stesso rosterPlayer è assegnato a due slot', () => {
    const roster = fullRoster();
    const match = fullMatch();
    const assignment = buildAssignment({
      P: 'm1',
      O: 'm1', // duplicato
      C1: 'm3',
      C2: 'm4',
      S1: 'f1',
      S2: 'f2',
      L1: 'f3',
    });
    const result = validateAssignment(roster, match, fixtureConfig, assignment, DEFAULT_RULES);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'duplicate_assignment')).toBe(true);
  });

  it('segnala "3 uomini davanti" quando la regola è attiva', () => {
    // Per P1 nel fixture: front row = O(zona4), C2(zona3), S1(zona2)
    // Metto 3 uomini in quelle posizioni.
    const roster = fullRoster();
    const match = fullMatch();
    const assignment = buildAssignment({
      P: 'f1', // back row
      O: 'm1', // front row
      C1: 'f2', // back row
      C2: 'm2', // front row
      S1: 'm3', // front row
      S2: 'm4', // back row
      L1: 'f3',
    });
    const rules: MatchRules = { ...DEFAULT_RULES, forbidThreeMenInFront: true };
    const result = validateAssignment(roster, match, fixtureConfig, assignment, rules);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'three_men_in_front')).toBe(true);
  });

  it('non segnala "3 uomini davanti" se la regola è disattivata (default)', () => {
    const roster = fullRoster();
    const match = fullMatch();
    const assignment = buildAssignment({
      P: 'f1',
      O: 'm1',
      C1: 'f2',
      C2: 'm2',
      S1: 'm3',
      S2: 'm4',
      L1: 'f3',
    });
    const result = validateAssignment(roster, match, fixtureConfig, assignment, DEFAULT_RULES);
    expect(result.ok).toBe(true);
    expect(result.issues.some((i) => i.code === 'three_men_in_front')).toBe(false);
  });
});
