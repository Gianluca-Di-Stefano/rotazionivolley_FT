import { Layer, Stage } from 'react-konva';
import { useEffect, useRef, useState } from 'react';
import { CourtBackground } from '../court/CourtBackground';
import { COURT_VIEWBOX } from '../court/courtGeometry';
import { PlayerMarker } from '../court/PlayerMarker';
import type { FormationConfig, PlayerDef, Point, SetterPosition } from '../configs/schema';
import { getPositions } from '../state/selectors';

interface MiniCourtProps {
  config: FormationConfig;
  setterPosition: SetterPosition;
  /** Per ogni slot simbolico (id), il giocatore reale da mostrare (o undefined). */
  rosterBySlot: Record<string, { firstName: string; lastName: string; sex: 'M' | 'F' } | undefined>;
  /** Larghezza massima del contenitore; l'altezza deriva dall'aspect ratio. */
  width?: number;
}

const SEX_COLOURS = {
  M: '#1d4e8a',
  F: '#9c2a6b',
} as const;

/**
 * Anteprima semplificata del campo usata dalla scheda Cambi: solo il campo
 * e i 6+1 giocatori, con label che mostrano il nome reale (invece del
 * shortLabel simbolico). Niente overlay (zone/faults) e niente editor.
 *
 * Pattern di rendering identico a CourtStage (scale e offset sul Layer, non
 * sullo Stage) così il risultato è visivamente coerente con il campo
 * principale dell'app. Le posizioni vengono dalla fase "base" del config.
 */
export function MiniCourt({ config, setterPosition, rosterBySlot, width = 320 }: MiniCourtProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [actualWidth, setActualWidth] = useState(width);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setActualWidth(Math.max(160, entry.contentRect.width));
    });
    observer.observe(el);
    setActualWidth(el.clientWidth || width);
    return () => observer.disconnect();
  }, [width]);

  const height = actualWidth * (COURT_VIEWBOX.height / COURT_VIEWBOX.width);
  const scale = actualWidth / COURT_VIEWBOX.width;

  const basePositions = getPositions(config, 'base', setterPosition);

  // Costruisce PlayerDef custom per ogni slot, con label = nome reale e
  // shortLabel = iniziali. L'id resta quello simbolico così le posizioni
  // tornano dal config.
  const players: PlayerDef[] = [...config.players, ...config.liberos].map((slot) => {
    const real = rosterBySlot[slot.id];
    if (!real) return slot;
    return {
      ...slot,
      label: `${real.firstName} ${real.lastName}`.trim(),
      shortLabel: shortLabelFor(real.firstName, real.lastName),
    };
  });

  const positions: Record<string, Point> = {};
  for (const slot of [...config.players, ...config.liberos]) {
    const p = basePositions[slot.id];
    if (p) positions[slot.id] = p;
  }

  const womenCount = Object.values(rosterBySlot).filter((p) => p?.sex === 'F').length;
  const menCount = Object.values(rosterBySlot).filter((p) => p?.sex === 'M').length;

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <Stage width={actualWidth} height={height} aria-label="Anteprima formazione">
        <Layer x={-COURT_VIEWBOX.minX * scale} y={-COURT_VIEWBOX.minY * scale} scaleX={scale} scaleY={scale}>
          <CourtBackground />
          {players.map((p) => (
            <PlayerMarker
              key={p.id}
              player={p}
              position={positions[p.id] ?? { x: 0, y: 0 }}
              durationMs={400}
              highlighted={false}
            />
          ))}
        </Layer>
      </Stage>
      <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.4rem' }}>
        Anteprima della formazione attuale.
      </p>
      <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.3rem', fontSize: '0.82rem' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: SEX_COLOURS.M,
              display: 'inline-block',
            }}
          />
          {menCount} uomini in campo
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: SEX_COLOURS.F,
              display: 'inline-block',
            }}
          />
          {womenCount} donne in campo
        </span>
      </div>
    </div>
  );
}

/** Genera uno shortLabel di 2 caratteri dal nome reale. */
function shortLabelFor(firstName: string, lastName: string): string {
  const a = (firstName.trim()[0] ?? '').toUpperCase();
  const b = (lastName.trim()[0] ?? '').toUpperCase();
  return (a + b).trim() || '?';
}
