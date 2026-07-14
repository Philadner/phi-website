import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../stylesheets/ElectrolysisSimulator.css";

type ElectrolyteKey = "lead-bromide" | "copper-sulfate" | "brine";
type IonKind = "cation" | "anion";

type IonTemplate = {
  id: string;
  type: IonKind;
  charge: number;
  mass: number;
  radius: number;
  mobility: number;
};

type ElectrolyteOption = {
  name: string;
  subtitle: string;
  cathode: string;
  anode: string;
  explanation: string;
  equation: string;
  ions: IonTemplate[];
};

type SimIon = IonTemplate & {
  x: number;
  y: number;
  vx: number;
  vy: number;
  reacted: boolean;
  slot: number;
};

const SIM_BOUNDS = {
  minX: 8,
  maxX: 92,
  minY: 10,
  maxY: 90,
};

const ELECTRODE_X = {
  cathode: 20,
  anode: 80,
};

const ELECTRODE_CAPTURE_X = {
  cathode: 24,
  anode: 76,
};

const electrolytes: Record<ElectrolyteKey, ElectrolyteOption> = {
  "lead-bromide": {
    name: "Molten lead bromide",
    subtitle: "Simple molten ionic compound",
    cathode: "Lead forms at the negative electrode",
    anode: "Bromine forms at the positive electrode",
    explanation:
      "Lead ions gain electrons at the cathode, while bromide ions lose electrons at the anode.",
    equation: "Pb2+ + 2e- -> Pb     |     2Br- -> Br2 + 2e-",
    ions: [
      { id: "pb-1", type: "cation", charge: 2, mass: 2.1, radius: 2.45, mobility: 0.72 },
      { id: "pb-2", type: "cation", charge: 2, mass: 2.1, radius: 2.45, mobility: 0.72 },
      { id: "pb-3", type: "cation", charge: 2, mass: 2.1, radius: 2.45, mobility: 0.72 },
      { id: "pb-4", type: "cation", charge: 2, mass: 2.1, radius: 2.45, mobility: 0.72 },
      { id: "pb-5", type: "cation", charge: 2, mass: 2.1, radius: 2.45, mobility: 0.72 },
      { id: "pb-6", type: "cation", charge: 2, mass: 2.1, radius: 2.45, mobility: 0.72 },
      { id: "pb-7", type: "cation", charge: 2, mass: 2.1, radius: 2.45, mobility: 0.72 },
      { id: "pb-8", type: "cation", charge: 2, mass: 2.1, radius: 2.45, mobility: 0.72 },
      { id: "br-1", type: "anion", charge: -1, mass: 1.25, radius: 2.9, mobility: 1.08 },
      { id: "br-2", type: "anion", charge: -1, mass: 1.25, radius: 2.9, mobility: 1.08 },
      { id: "br-3", type: "anion", charge: -1, mass: 1.25, radius: 2.9, mobility: 1.08 },
      { id: "br-4", type: "anion", charge: -1, mass: 1.25, radius: 2.9, mobility: 1.08 },
      { id: "br-5", type: "anion", charge: -1, mass: 1.25, radius: 2.9, mobility: 1.08 },
      { id: "br-6", type: "anion", charge: -1, mass: 1.25, radius: 2.9, mobility: 1.08 },
      { id: "br-7", type: "anion", charge: -1, mass: 1.25, radius: 2.9, mobility: 1.08 },
      { id: "br-8", type: "anion", charge: -1, mass: 1.25, radius: 2.9, mobility: 1.08 },
    ],
  },
  "copper-sulfate": {
    name: "Copper sulfate solution",
    subtitle: "Aqueous solution with inert electrodes",
    cathode: "Copper is deposited at the cathode",
    anode: "Oxygen forms at the anode",
    explanation:
      "Copper ions are less reactive than hydrogen, so they get discharged at the cathode. Hydroxide ions from water are discharged at the anode.",
    equation: "Cu2+ + 2e- -> Cu     |     4OH- -> O2 + 2H2O + 4e-",
    ions: [
      { id: "cu-1", type: "cation", charge: 2, mass: 1.7, radius: 2.35, mobility: 0.78 },
      { id: "cu-2", type: "cation", charge: 2, mass: 1.7, radius: 2.35, mobility: 0.78 },
      { id: "cu-3", type: "cation", charge: 2, mass: 1.7, radius: 2.35, mobility: 0.78 },
      { id: "cu-4", type: "cation", charge: 2, mass: 1.7, radius: 2.35, mobility: 0.78 },
      { id: "cu-5", type: "cation", charge: 2, mass: 1.7, radius: 2.35, mobility: 0.78 },
      { id: "cu-6", type: "cation", charge: 2, mass: 1.7, radius: 2.35, mobility: 0.78 },
      { id: "cu-7", type: "cation", charge: 2, mass: 1.7, radius: 2.35, mobility: 0.78 },
      { id: "cu-8", type: "cation", charge: 2, mass: 1.7, radius: 2.35, mobility: 0.78 },
      { id: "oh-1", type: "anion", charge: -1, mass: 0.85, radius: 2.25, mobility: 1.2 },
      { id: "oh-2", type: "anion", charge: -1, mass: 0.85, radius: 2.25, mobility: 1.2 },
      { id: "oh-3", type: "anion", charge: -1, mass: 0.85, radius: 2.25, mobility: 1.2 },
      { id: "oh-4", type: "anion", charge: -1, mass: 0.85, radius: 2.25, mobility: 1.2 },
      { id: "so4-1", type: "anion", charge: -2, mass: 1.9, radius: 3.25, mobility: 0.68 },
      { id: "so4-2", type: "anion", charge: -2, mass: 1.9, radius: 3.25, mobility: 0.68 },
      { id: "so4-3", type: "anion", charge: -2, mass: 1.9, radius: 3.25, mobility: 0.68 },
      { id: "so4-4", type: "anion", charge: -2, mass: 1.9, radius: 3.25, mobility: 0.68 },
    ],
  },
  brine: {
    name: "Brine",
    subtitle: "Concentrated sodium chloride solution",
    cathode: "Hydrogen forms at the cathode",
    anode: "Chlorine forms at the anode",
    explanation:
      "Hydrogen is produced at the cathode because sodium is too reactive to be discharged in solution. Chloride ions are discharged at the anode in concentrated brine.",
    equation: "2H2O + 2e- -> H2 + 2OH-     |     2Cl- -> Cl2 + 2e-",
    ions: [
      { id: "na-1", type: "cation", charge: 1, mass: 1.05, radius: 2.1, mobility: 0.98 },
      { id: "na-2", type: "cation", charge: 1, mass: 1.05, radius: 2.1, mobility: 0.98 },
      { id: "na-3", type: "cation", charge: 1, mass: 1.05, radius: 2.1, mobility: 0.98 },
      { id: "na-4", type: "cation", charge: 1, mass: 1.05, radius: 2.1, mobility: 0.98 },
      { id: "h-1", type: "cation", charge: 1, mass: 0.55, radius: 1.7, mobility: 1.35 },
      { id: "h-2", type: "cation", charge: 1, mass: 0.55, radius: 1.7, mobility: 1.35 },
      { id: "h-3", type: "cation", charge: 1, mass: 0.55, radius: 1.7, mobility: 1.35 },
      { id: "h-4", type: "cation", charge: 1, mass: 0.55, radius: 1.7, mobility: 1.35 },
      { id: "cl-1", type: "anion", charge: -1, mass: 1.18, radius: 2.75, mobility: 1.05 },
      { id: "cl-2", type: "anion", charge: -1, mass: 1.18, radius: 2.75, mobility: 1.05 },
      { id: "cl-3", type: "anion", charge: -1, mass: 1.18, radius: 2.75, mobility: 1.05 },
      { id: "cl-4", type: "anion", charge: -1, mass: 1.18, radius: 2.75, mobility: 1.05 },
      { id: "cl-5", type: "anion", charge: -1, mass: 1.18, radius: 2.75, mobility: 1.05 },
      { id: "cl-6", type: "anion", charge: -1, mass: 1.18, radius: 2.75, mobility: 1.05 },
      { id: "cl-7", type: "anion", charge: -1, mass: 1.18, radius: 2.75, mobility: 1.05 },
      { id: "cl-8", type: "anion", charge: -1, mass: 1.18, radius: 2.75, mobility: 1.05 },
    ],
  },
};

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function targetSlotY(slot: number) {
  return 20 + slot * 8;
}

function createParticles(ions: IonTemplate[]): SimIon[] {
  const cationCount = ions.filter((ion) => ion.type === "cation").length;
  const anionCount = ions.length - cationCount;
  let cationSlot = 0;
  let anionSlot = 0;

  return ions.map((ion) => {
    const slot = ion.type === "cation" ? cationSlot++ % Math.max(1, cationCount) : anionSlot++ % Math.max(1, anionCount);
    return {
      ...ion,
      x: randomBetween(18, 82),
      y: randomBetween(18, 82),
      vx: randomBetween(-12, 12),
      vy: randomBetween(-10, 10),
      reacted: false,
      slot,
    };
  });
}

export default function ElectrolysisSimulator() {
  const [selectedKey] = useState<ElectrolyteKey>("lead-bromide");
  const [running, setRunning] = useState(true);
  const [power, setPower] = useState(0);
  const [displayParticles, setDisplayParticles] = useState<SimIon[]>(() =>
    createParticles(electrolytes["lead-bromide"].ions)
  );

  const selected = electrolytes[selectedKey];
  const currentStrength = running ? power / 100 : 0;
  const bubbleCount = running ? Math.max(0, Math.round(power / 14)) : 0;
  const particlesRef = useRef<SimIon[]>(displayParticles);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const nextParticles = createParticles(selected.ions);
    particlesRef.current = nextParticles;
    setDisplayParticles(nextParticles);
    lastFrameRef.current = null;
  }, [selected.ions, selectedKey]);

  useEffect(() => {
    particlesRef.current = displayParticles;
  }, [displayParticles]);

  useEffect(() => {
    const animate = (timestamp: number) => {
      const last = lastFrameRef.current ?? timestamp;
      const dt = Math.min(0.028, (timestamp - last) / 1000);
      lastFrameRef.current = timestamp;

      const next = particlesRef.current.map((particle) => ({ ...particle }));
      const fieldStrength = currentStrength * currentStrength * 185;
      const brownian = running ? 11 - currentStrength * 7 : 8;
      const hasField = currentStrength > 0.001;

      for (let index = 0; index < next.length; index += 1) {
        const ion = next[index];
        const targetX = ion.type === "cation" ? ELECTRODE_X.cathode : ELECTRODE_X.anode;
        const captureX = ion.type === "cation" ? ELECTRODE_CAPTURE_X.cathode : ELECTRODE_CAPTURE_X.anode;
        const slotY = targetSlotY(ion.slot);
        const direction = ion.type === "cation" ? -1 : 1;

        if (!ion.reacted) {
          const jitterX = randomBetween(-brownian, brownian) * dt * ion.mobility;
          const jitterY = randomBetween(-brownian, brownian) * dt * ion.mobility;
          const towardElectrode =
            hasField ? (targetX - ion.x) * fieldStrength * dt * 0.03 * ion.mobility / ion.mass : 0;
          const settleY = hasField
            ? (slotY - ion.y) * (currentStrength * currentStrength * 2.1) * dt
            : 0;
          const directionalPush = hasField
            ? direction * (currentStrength * currentStrength * 2.2) * dt
            : 0;
          const drag = running
            ? (0.985 - currentStrength * 0.022 - ion.mobility * 0.01)
            : 0.962;

          ion.vx += towardElectrode + jitterX + directionalPush;
          ion.vy += settleY + jitterY;
          ion.vx *= drag;
          ion.vy *= drag;

          ion.x += ion.vx * dt * 12;
          ion.y += ion.vy * dt * 12;

          if (ion.x < SIM_BOUNDS.minX + ion.radius) {
            ion.x = SIM_BOUNDS.minX + ion.radius;
            ion.vx *= -0.82;
          }
          if (ion.x > SIM_BOUNDS.maxX - ion.radius) {
            ion.x = SIM_BOUNDS.maxX - ion.radius;
            ion.vx *= -0.82;
          }
          if (ion.y < SIM_BOUNDS.minY + ion.radius) {
            ion.y = SIM_BOUNDS.minY + ion.radius;
            ion.vy *= -0.82;
          }
          if (ion.y > SIM_BOUNDS.maxY - ion.radius) {
            ion.y = SIM_BOUNDS.maxY - ion.radius;
            ion.vy *= -0.82;
          }

          if (
            hasField &&
            currentStrength > 0.72 &&
            Math.abs(ion.x - captureX) < 2.2 &&
            Math.abs(ion.y - slotY) < 3.4
          ) {
            ion.reacted = true;
            ion.x = captureX;
            ion.y = slotY;
            ion.vx = 0;
            ion.vy = 0;
          }
        } else {
          if (!hasField) {
            ion.reacted = false;
            ion.vx = randomBetween(-14, 14);
            ion.vy = randomBetween(-14, 14);
          } else {
            ion.x += (captureX - ion.x) * 0.22;
            ion.y += (slotY - ion.y) * 0.22;
          }
        }
      }

      for (let i = 0; i < next.length; i += 1) {
        for (let j = i + 1; j < next.length; j += 1) {
          const a = next[i];
          const b = next[j];
          if (a.reacted || b.reacted) continue;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distanceSq = dx * dx + dy * dy;
          if (distanceSq === 0) continue;

          const distance = Math.sqrt(distanceSq);
          const minDistance = a.radius + b.radius;
          const nx = dx / distance;
          const ny = dy / distance;
          const lowFieldBias = 1 - Math.min(1, currentStrength * 1.6);
          const preferredBondDistance = minDistance * 1.18;
          const attractionRadius = minDistance * 3.3;
          const screenedRange = minDistance * 2.8;
          const inverseMassA = 1 / a.mass;
          const inverseMassB = 1 / b.mass;
          const chargeProduct = a.charge * b.charge;

          if (distance < attractionRadius) {
            const screening = Math.exp(-distance / screenedRange);
            const coulombMagnitude =
              (chargeProduct / Math.max(distanceSq, minDistance * minDistance * 0.55)) * screening;
            const force =
              coulombMagnitude *
              (chargeProduct < 0 ? 0.18 * lowFieldBias : 0.34);

            a.vx += nx * force * inverseMassA;
            a.vy += ny * force * inverseMassA;
            b.vx -= nx * force * inverseMassB;
            b.vy -= ny * force * inverseMassB;
          }

          if (a.type !== b.type && distance < attractionRadius) {
            const bondStretch = distance - preferredBondDistance;
            const attractionStrength = lowFieldBias * 0.18 * 0.22;

            if (bondStretch > 0) {
              const attract = bondStretch * attractionStrength;
              a.vx += nx * attract * inverseMassA;
              a.vy += ny * attract * inverseMassA;
              b.vx -= nx * attract * inverseMassB;
              b.vy -= ny * attract * inverseMassB;
            } else {
              const tooCloseRepel = Math.abs(bondStretch) * 0.06;
              a.vx -= nx * tooCloseRepel * inverseMassA;
              a.vy -= ny * tooCloseRepel * inverseMassA;
              b.vx += nx * tooCloseRepel * inverseMassB;
              b.vy += ny * tooCloseRepel * inverseMassB;
            }
          }

          if (distance < minDistance * 1.06) {
            const overlap = minDistance - distance;
            const push = overlap * 0.5;
            const bornRepulsion = Math.pow(minDistance / Math.max(distance, minDistance * 0.45), 8) * 0.18;

            a.x -= nx * push;
            a.y -= ny * push;
            b.x += nx * push;
            b.y += ny * push;

            a.vx -= nx * (overlap * 1.1 + bornRepulsion) * inverseMassA;
            a.vy -= ny * (overlap * 1.1 + bornRepulsion) * inverseMassA;
            b.vx += nx * (overlap * 1.1 + bornRepulsion) * inverseMassB;
            b.vy += ny * (overlap * 1.1 + bornRepulsion) * inverseMassB;
          }
        }
      }

      setDisplayParticles(next);
      particlesRef.current = next;
      rafRef.current = window.requestAnimationFrame(animate);
    };

    rafRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, [currentStrength]);

  const disperseIons = () => {
    const next = particlesRef.current.map((particle) => ({
      ...particle,
      reacted: false,
      x: randomBetween(18, 82),
      y: randomBetween(18, 82),
      vx: randomBetween(-70, 70),
      vy: randomBetween(-60, 60),
    }));

    particlesRef.current = next;
    setDisplayParticles(next);
  };

  return (
    <main id="main-site" className="electrolysis-page">
      <div className="electrolysis-shell">
        <div className="electrolysis-head">
          <p className="electrolysis-breadcrumb">
            <Link to="/revise">Chemistry Revision</Link> / Electrolysis
          </p>
          <h1 className="CenterTitle">Interactive Electrolysis Simulator</h1>
          <p className="BodyTextCentre electrolysis-intro">
            Raise the current to drive ions toward their electrodes — cations migrate to the
            cathode, anions to the anode.
          </p>
        </div>

        <section className="electrolysis-layout">
          <div className="electrolysis-panel">
            <h2 className="HeadingLeft electrolysis-subtitle">Controls</h2>
            <div className="electrolysis-buttonRow">
              <button
                type="button"
                className="electrolysis-toggle"
                onClick={() => setRunning((value) => !value)}
              >
                {running ? "Pause current" : "Resume current"}
              </button>
              <button
                type="button"
                className="electrolysis-toggle electrolysis-toggle--ghost"
                onClick={disperseIons}
              >
                Disperse ions
              </button>
            </div>

            <div className="electrolysis-electrodes">
              <div className="electrolysis-electrode-card electrolysis-electrode-card--cathode">
                <span className="electrolysis-electrode-label">− Cathode</span>
                <p>{selected.cathode}</p>
              </div>
              <div className="electrolysis-electrode-card electrolysis-electrode-card--anode">
                <span className="electrolysis-electrode-label">+ Anode</span>
                <p>{selected.anode}</p>
              </div>
            </div>
          </div>

          <div className="electrolysis-panel electrolysis-panel--visual">
            <h2 className="HeadingLeft electrolysis-subtitle">Cell view</h2>
            <div className="electrolysis-cellBadges">
              <span className="electrolysis-badge electrolysis-badge--electrolyte">{selected.name}</span>
              <span className="electrolysis-badge">{selected.subtitle}</span>
              <span className={`electrolysis-badge ${running ? "is-live" : "is-idle"}`}>
                {running ? "Current live" : "Current paused"}
              </span>
            </div>
            <div className="electrolysis-cellMeta" aria-live="polite">
              <span>Current strength</span>
              <strong>{power}%</strong>
            </div>
            <div className={`electrolysis-cell ${running ? "is-running" : "is-paused"}`}>
              <div className="electrolysis-stageAura" aria-hidden="true" />
              <div className="electrolysis-battery">
                <div className="electrolysis-battery__cap electrolysis-battery__cap--negative">-</div>
                <div className="electrolysis-battery__body">
                  <div
                    className="electrolysis-battery__charge"
                    style={{ width: `${power}%` }}
                    aria-hidden="true"
                  />
                  <input
                    className="electrolysis-range electrolysis-range--battery"
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={power}
                    aria-label="Current strength battery slider"
                    onChange={(event) => setPower(Number(event.target.value))}
                  />
                </div>
                <div className="electrolysis-battery__cap electrolysis-battery__cap--positive">+</div>
              </div>
              <div className="electrolysis-busbar electrolysis-busbar--left" />
              <div className="electrolysis-busbar electrolysis-busbar--right" />
              <div className="electrolysis-wire electrolysis-wire--left" />
              <div className="electrolysis-wire electrolysis-wire--right" />
              <div className="electrode electrode--left">
                <div className="electrode__stem" />
                <div className="electrode__plate">
                  <span>-</span>
                  <small>Cathode</small>
                </div>
              </div>
              <div className="electrode electrode--right">
                <div className="electrode__stem" />
                <div className="electrode__plate">
                  <span>+</span>
                  <small>Anode</small>
                </div>
              </div>
              <div className="electrolysis-tank">
                <div className="electrolysis-tank__rim" aria-hidden="true" />
                <div className="electrolysis-tank__wall electrolysis-tank__wall--left" aria-hidden="true" />
                <div className="electrolysis-tank__wall electrolysis-tank__wall--right" aria-hidden="true" />
                <div className="electrolysis-tank__floor" aria-hidden="true" />
                <div className="electrolyte-liquid">
                {displayParticles.map((ion) => (
                  <div
                    key={`${selectedKey}-${ion.id}`}
                    className={`ion ion--${ion.type} ${ion.reacted ? "ion--reacted" : ""}`}
                    style={{
                      left: `${clamp(ion.x, SIM_BOUNDS.minX, SIM_BOUNDS.maxX)}%`,
                      top: `${clamp(ion.y, SIM_BOUNDS.minY, SIM_BOUNDS.maxY)}%`,
                      width: `${ion.radius * 10}px`,
                      height: `${ion.radius * 10}px`,
                    }}
                  >
                    <span>{ion.type === "cation" ? "+" : "-"}</span>
                  </div>
                ))}

                {Array.from({ length: bubbleCount }).map((_, index) => (
                  <span
                    key={`left-bubble-${index}`}
                    className="bubble bubble--left"
                    style={{
                      left: `${18 + (index % 3) * 2.6}%`,
                      animationDelay: `${index * 0.25}s`,
                      animationDuration: `${Math.max(0.7, 2.2 - power * 0.013)}s`,
                    }}
                  />
                ))}
                {Array.from({ length: bubbleCount }).map((_, index) => (
                  <span
                    key={`right-bubble-${index}`}
                    className="bubble bubble--right"
                    style={{
                      right: `${18 + (index % 3) * 2.6}%`,
                      animationDelay: `${index * 0.28}s`,
                      animationDuration: `${Math.max(0.7, 2.2 - power * 0.013)}s`,
                    }}
                  />
                ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="electrolysis-notes">
          <article className="electrolysis-note">
            <h2 className="HeadingLeft electrolysis-subtitle">What is happening</h2>
            <p className="BodyTextLeft">{selected.explanation}</p>
          </article>
          <article className="electrolysis-note">
            <h2 className="HeadingLeft electrolysis-subtitle">Half equations</h2>
            <p className="electrolysis-equation">{selected.equation}</p>
          </article>
        </section>
      </div>
    </main>
  );
}
