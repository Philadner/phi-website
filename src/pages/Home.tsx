import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../stylesheets/home.css";
import { is1998ModeEnabled } from "../hooks/use1998Mode";

const PHRASE_INTERVAL_MS = 2500;
const VISIBLE_RADIUS = 10;
const SMALL_PHRASE_SIZE = 12;
const SMALL_STACK_STEP = 14;

const FALLBACK_PHRASES = [
  "welcome",
  "epic website",
  "the system knows",
  "with much effort",
  "we love you",
  "2763",
];

function shuffle<T>(items: T[]) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function samePhrases(left: string[], right: string[]) {
  return left.length === right.length && left.every((phrase, index) => phrase === right[index]);
}

const Home = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const phraseWallRef = useRef<HTMLDivElement>(null);
  const phraseWheelZoneRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef<HTMLDivElement>(null);
  const phiPosition = useRef({ x: 0, y: 0 });
  const phiTarget = useRef({ x: 0, y: 0 });
  const scrollPositionRef = useRef(0);
  const phraseDeckRef = useRef<string[]>([]);
  const lastDrawnPhraseRef = useRef<string | null>(null);
  const phraseTapeRef = useRef<Map<number, string>>(new Map());

  const [sourcePhrases, setSourcePhrases] = useState<string[]>([]);
  const [displayPhrases, setDisplayPhrases] = useState<string[]>([]);
  const [phraseTape, setPhraseTape] = useState<Map<number, string>>(new Map());
  const [scrollPosition, setScrollPosition] = useState(0);
  const [heroSize, setHeroSize] = useState(144);

  const slots = useMemo(
    () => Array.from({ length: VISIBLE_RADIUS * 2 + 1 }, (_, index) => index - VISIBLE_RADIUS),
    [],
  );

  const drawPhrase = useCallback(() => {
    if (!displayPhrases.length) return "";

    if (!phraseDeckRef.current.length) {
      const freshDeck = shuffle(displayPhrases);
      if (
        freshDeck.length > 1
        && freshDeck[freshDeck.length - 1] === lastDrawnPhraseRef.current
      ) {
        [freshDeck[0], freshDeck[freshDeck.length - 1]] = [
          freshDeck[freshDeck.length - 1],
          freshDeck[0],
        ];
      }
      phraseDeckRef.current = freshDeck;
    }

    const phrase = phraseDeckRef.current.pop() ?? "";
    lastDrawnPhraseRef.current = phrase;
    return phrase;
  }, [displayPhrases]);

  useEffect(() => {
    document.body.classList.add("body--home-lock");
    return () => document.body.classList.remove("body--home-lock");
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch("https://api.phi.me.uk/kv/phrases", { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        const phrases: unknown[] = Array.isArray(data)
          ? data
          : (data && typeof data === "object" && "phrases" in data && Array.isArray(data.phrases)
            ? data.phrases
            : []);
        const cleanPhrases = Array.from(
          new Set<string>(
            phrases
              .filter((phrase: unknown): phrase is string => typeof phrase === "string")
              .map((phrase: string) => phrase.trim())
              .filter(Boolean),
          ),
        );

        setSourcePhrases(shuffle(cleanPhrases.length ? cleanPhrases : FALLBACK_PHRASES));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSourcePhrases(shuffle(FALLBACK_PHRASES));
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const wall = phraseWallRef.current;
    const phi = phiRef.current;
    if (!container || !wall || !phi || !sourcePhrases.length) return;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    let measurementFrame = 0;

    const measure = () => {
      const containerBounds = container.getBoundingClientRect();
      const wallBounds = wall.getBoundingClientRect();
      const phiBounds = phi.getBoundingClientRect();
      const phiStyles = window.getComputedStyle(phi);
      const focusSize = Number.parseFloat(phiStyles.fontSize) || 144;
      const mobileLayout = containerBounds.width <= 700;
      const maximumPhraseWidth = mobileLayout
        ? Math.max(80, containerBounds.width - 32)
        : Math.max(
          80,
          phiBounds.left
            - Math.max(28, containerBounds.width * 0.035)
            - (wallBounds.left + Math.max(24, Math.min(containerBounds.width * 0.05, 76))),
        );

      setHeroSize(focusSize);

      if (!context) {
        setDisplayPhrases(sourcePhrases);
        return;
      }

      context.font = `850 ${focusSize}px ${phiStyles.fontFamily}`;
      const letterSpacing = focusSize * -0.055;
      const fittingPhrases = sourcePhrases.filter((phrase) => {
        const measuredWidth = context.measureText(phrase).width
          + Math.max(0, phrase.length - 1) * letterSpacing;
        return measuredWidth <= maximumPhraseWidth;
      });
      const nextPhrases = fittingPhrases.length
        ? fittingPhrases
        : sourcePhrases.filter((phrase) => phrase.length <= 8);

      setDisplayPhrases((current) => samePhrases(current, nextPhrases) ? current : nextPhrases);
    };

    const scheduleMeasurement = () => {
      window.cancelAnimationFrame(measurementFrame);
      measurementFrame = window.requestAnimationFrame(measure);
    };

    const resizeObserver = new ResizeObserver(scheduleMeasurement);
    resizeObserver.observe(container);
    resizeObserver.observe(wall);
    resizeObserver.observe(phi);
    scheduleMeasurement();

    return () => {
      window.cancelAnimationFrame(measurementFrame);
      resizeObserver.disconnect();
    };
  }, [sourcePhrases]);

  useEffect(() => {
    scrollPositionRef.current = 0;
    setScrollPosition(0);
    phraseDeckRef.current = [];
    lastDrawnPhraseRef.current = null;

    if (!displayPhrases.length) {
      const emptyTape = new Map<number, string>();
      phraseTapeRef.current = emptyTape;
      setPhraseTape(emptyTape);
      return;
    }

    const initialTape = new Map<number, string>();
    for (let index = -VISIBLE_RADIUS - 4; index <= VISIBLE_RADIUS + 4; index += 1) {
      initialTape.set(index, drawPhrase());
    }
    phraseTapeRef.current = initialTape;
    setPhraseTape(initialTape);
  }, [displayPhrases, drawPhrase]);

  useEffect(() => {
    if (displayPhrases.length < 2) return;

    const wheelZone = phraseWheelZoneRef.current;
    if (!wheelZone) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileLayout = window.matchMedia("(max-width: 700px)");
    let animationFrame = 0;
    let autoTimer = 0;
    let wheelResetTimer = 0;
    let wheelAccumulator = 0;
    let wheelTickCount = 0;
    let wheelTickDirection = 0;
    let targetPosition: number | null = null;
    let velocity = 0;
    let dragging = false;
    let lastFrameTime = performance.now();
    let pointerY = 0;
    let pointerTime = 0;
    let dragStepPixels = 64;
    let cancelled = false;

    const setPosition = (nextPosition: number) => {
      const previousPosition = scrollPositionRef.current;
      const movingForward = nextPosition > previousPosition;
      const crossedFocus = movingForward
        ? Math.floor(nextPosition + 0.000001) > Math.floor(previousPosition + 0.000001)
        : Math.ceil(nextPosition - 0.000001) < Math.ceil(previousPosition - 0.000001);

      scrollPositionRef.current = nextPosition;
      setScrollPosition(nextPosition);

      if (crossedFocus && mobileLayout.matches && "vibrate" in navigator) {
        navigator.vibrate(7);
      }
    };

    const resetAutoTimer = () => {
      window.clearTimeout(autoTimer);
      autoTimer = window.setTimeout(() => {
        if (dragging) {
          resetAutoTimer();
          return;
        }

        const base = targetPosition ?? Math.round(scrollPositionRef.current);
        targetPosition = base - 1;
      }, PHRASE_INTERVAL_MS);
    };

    const queueStep = (direction: number) => {
      const base = targetPosition ?? Math.round(scrollPositionRef.current);
      const nextTarget = base - direction;
      resetAutoTimer();

      if (reducedMotion.matches) {
        targetPosition = nextTarget;
        velocity = 0;
        setPosition(nextTarget);
        targetPosition = null;
        return;
      }

      targetPosition = nextTarget;
    };

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      resetAutoTimer();
      window.clearTimeout(wheelResetTimer);
      wheelResetTimer = window.setTimeout(() => {
        wheelAccumulator = 0;
        wheelTickCount = 0;
        wheelTickDirection = 0;
      }, 450);

      const pixelDelta = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
        ? event.deltaY
        : event.deltaY * 40;

      if (Math.abs(pixelDelta) >= 50) {
        const direction = pixelDelta > 0 ? 1 : -1;
        if (wheelTickDirection !== direction) {
          wheelTickCount = 0;
          wheelTickDirection = direction;
        }

        wheelTickCount += 1;
        if (wheelTickCount >= 3) {
          queueStep(direction);
          wheelTickCount = 0;
        }
        wheelAccumulator = 0;
        return;
      }

      wheelAccumulator += pixelDelta;
      if (Math.abs(wheelAccumulator) < 90) return;

      queueStep(wheelAccumulator > 0 ? 1 : -1);
      wheelAccumulator %= 90;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!mobileLayout.matches) return;

      event.preventDefault();
      wheelZone.setPointerCapture(event.pointerId);
      dragging = true;
      targetPosition = null;
      velocity = 0;
      pointerY = event.clientY;
      pointerTime = event.timeStamp;
      dragStepPixels = Math.max(52, Math.min(window.innerHeight * 0.09, 78));
      resetAutoTimer();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;

      event.preventDefault();
      const elapsedSeconds = Math.max(0.008, (event.timeStamp - pointerTime) / 1000);
      const deltaPosition = -(event.clientY - pointerY) / dragStepPixels;
      const nextPosition = scrollPositionRef.current + deltaPosition;
      const immediateVelocity = deltaPosition / elapsedSeconds;

      velocity = velocity * 0.52 + immediateVelocity * 0.48;
      setPosition(nextPosition);
      pointerY = event.clientY;
      pointerTime = event.timeStamp;
    };

    const finishPointer = (event: PointerEvent, cancelledPointer = false) => {
      if (!dragging) return;

      dragging = false;
      if (wheelZone.hasPointerCapture(event.pointerId)) {
        wheelZone.releasePointerCapture(event.pointerId);
      }

      velocity = cancelledPointer ? 0 : Math.max(-18, Math.min(18, velocity));
      targetPosition = Math.abs(velocity) < 0.28
        ? Math.round(scrollPositionRef.current)
        : null;
      resetAutoTimer();
    };

    const onPointerCancel = (event: PointerEvent) => finishPointer(event, true);

    const animate = (now: number) => {
      if (cancelled) return;

      const elapsedSeconds = Math.min(0.032, Math.max(0.001, (now - lastFrameTime) / 1000));
      lastFrameTime = now;

      if (!dragging) {
        if (targetPosition !== null) {
          const displacement = targetPosition - scrollPositionRef.current;
          velocity += displacement * 600 * elapsedSeconds;
          velocity *= Math.exp(-50 * elapsedSeconds);
          velocity = Math.max(-24, Math.min(24, velocity));

          if (Math.abs(displacement) < 0.0015 && Math.abs(velocity) < 0.025) {
            setPosition(targetPosition);
            velocity = 0;
            targetPosition = null;
          } else {
            const nextPosition = scrollPositionRef.current + velocity * elapsedSeconds;
            const wouldOvershoot = Math.sign(targetPosition - nextPosition) !== Math.sign(displacement);

            if (wouldOvershoot) {
              setPosition(targetPosition);
              velocity = 0;
              targetPosition = null;
            } else {
              setPosition(nextPosition);
            }
          }
        } else if (Math.abs(velocity) > 0.02) {
          setPosition(scrollPositionRef.current + velocity * elapsedSeconds);
          velocity *= Math.exp(-4.6 * elapsedSeconds);

          if (Math.abs(velocity) < 0.24) {
            targetPosition = Math.round(scrollPositionRef.current);
          }
        } else {
          const snappedPosition = Math.round(scrollPositionRef.current);
          if (Math.abs(snappedPosition - scrollPositionRef.current) > 0.001) {
            targetPosition = snappedPosition;
          }
        }
      }

      animationFrame = window.requestAnimationFrame(animate);
    };

    wheelZone.addEventListener("wheel", onWheel, { passive: false });
    wheelZone.addEventListener("pointerdown", onPointerDown);
    wheelZone.addEventListener("pointermove", onPointerMove);
    wheelZone.addEventListener("pointerup", finishPointer);
    wheelZone.addEventListener("pointercancel", onPointerCancel);
    resetAutoTimer();
    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      cancelled = true;
      window.clearTimeout(autoTimer);
      window.clearTimeout(wheelResetTimer);
      window.cancelAnimationFrame(animationFrame);
      wheelZone.removeEventListener("wheel", onWheel);
      wheelZone.removeEventListener("pointerdown", onPointerDown);
      wheelZone.removeEventListener("pointermove", onPointerMove);
      wheelZone.removeEventListener("pointerup", finishPointer);
      wheelZone.removeEventListener("pointercancel", onPointerCancel);
    };
  }, [displayPhrases]);

  useEffect(() => {
    if (is1998ModeEnabled()) return;

    const container = containerRef.current;
    if (!container) return;

    let animationFrame = 0;

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;

      const bounds = container.getBoundingClientRect();
      const normalX = (event.clientX - bounds.left - bounds.width / 2) / (bounds.width / 2);
      const normalY = (event.clientY - bounds.top - bounds.height / 2) / (bounds.height / 2);
      const maximumDrift = 18;

      phiTarget.current.x = Math.max(-1, Math.min(1, normalX)) * maximumDrift;
      phiTarget.current.y = Math.max(-1, Math.min(1, normalY)) * maximumDrift;
    };

    const resetTarget = () => {
      phiTarget.current.x = 0;
      phiTarget.current.y = 0;
    };

    const animatePhi = () => {
      const smoothing = 0.075;
      phiPosition.current.x += (phiTarget.current.x - phiPosition.current.x) * smoothing;
      phiPosition.current.y += (phiTarget.current.y - phiPosition.current.y) * smoothing;

      const x = phiPosition.current.x;
      const y = phiPosition.current.y;
      const phi = phiRef.current;

      if (phi) {
        phi.style.transform = `translate3d(-50%, -50%, 0) translate3d(${x}px, ${y}px, 0) rotateX(${-y * 0.12}deg) rotateY(${x * 0.12}deg)`;
        phi.style.textShadow = `0 0 ${16 + Math.abs(x) * 0.18 + Math.abs(y) * 0.18}px rgba(255, 221, 51, 0.52)`;
      }

      animationFrame = window.requestAnimationFrame(animatePhi);
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", resetTarget);
    animationFrame = window.requestAnimationFrame(animatePhi);

    return () => {
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", resetTarget);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  const centredPhraseIndex = Math.round(scrollPosition);
  useEffect(() => {
    if (!displayPhrases.length) return;

    const nextTape = new Map(phraseTapeRef.current);
    let changed = false;

    for (
      let index = centredPhraseIndex - VISIBLE_RADIUS - 4;
      index <= centredPhraseIndex + VISIBLE_RADIUS + 4;
      index += 1
    ) {
      if (nextTape.has(index)) continue;
      nextTape.set(index, drawPhrase());
      changed = true;
    }

    if (changed) {
      phraseTapeRef.current = nextTape;
      setPhraseTape(nextTape);
    }
  }, [centredPhraseIndex, displayPhrases.length, drawPhrase]);

  const activePhrase = displayPhrases.length
    ? (phraseTape.get(centredPhraseIndex) ?? "")
    : "";

  const phraseRows = useMemo(() => {
    if (!displayPhrases.length) return [];

    const rows = slots.map((relativeIndex) => {
      const unwrappedPhraseIndex = centredPhraseIndex + relativeIndex;
      const position = unwrappedPhraseIndex - scrollPosition;
      const distanceFromCentre = Math.abs(position);
      const centreProximity = Math.pow(Math.max(0, 1 - distanceFromCentre), 2.45);
      const edgeFade = Math.max(0, 1 - Math.pow(distanceFromCentre / (VISIBLE_RADIUS + 0.35), 4));
      const fontSize = SMALL_PHRASE_SIZE + (heroSize - SMALL_PHRASE_SIZE) * centreProximity;
      const focusCorridor = heroSize * 0.46 + 18;
      const corridorPosition = Math.max(-1, Math.min(1, position));

      return {
        relativeIndex,
        phraseIndex: unwrappedPhraseIndex,
        phrase: phraseTape.get(unwrappedPhraseIndex) ?? "",
        centreProximity,
        edgeFade,
        fontSize,
        y: position * SMALL_STACK_STEP + corridorPosition * focusCorridor,
      };
    });

    return rows;
  }, [centredPhraseIndex, displayPhrases.length, heroSize, phraseTape, scrollPosition, slots]);

  return (
    <div ref={containerRef} className="home-stage">
      <div ref={phraseWheelZoneRef} className="home-phrase-wheel-zone" aria-hidden="true" />
      <div ref={phraseWallRef} className="home-phrase-wall" aria-hidden="true">
        {phraseRows.map((row) => {
          const red = Math.round(80 + 175 * row.centreProximity);
          const green = Math.round(80 + 141 * row.centreProximity);
          const blue = Math.round(80 - 29 * row.centreProximity);
          const opacity = row.edgeFade * (0.24 + 0.76 * row.centreProximity);

          return (
            <span
              key={`${row.phraseIndex}:${row.relativeIndex}`}
              className="home-phrase-line"
              style={{
                color: `rgb(${red} ${green} ${blue})`,
                fontSize: `${row.fontSize}px`,
                opacity,
                textShadow: row.centreProximity > 0.01
                  ? `0 0 ${4 + row.centreProximity * 22}px rgba(255, 221, 51, ${0.15 + row.centreProximity * 0.42})`
                  : "none",
                transform: `translate3d(var(--home-phrase-x), calc(-50% + ${row.y}px), 0)`,
                zIndex: Math.round(row.centreProximity * 100),
              }}
            >
              {row.phrase}
            </span>
          );
        })}
      </div>

      <span className="home-phrase-announcement" role="status" aria-live="polite">
        {activePhrase}
      </span>

      <div ref={phiRef} className="phi-floating" aria-label="phi">
        phi
      </div>
    </div>
  );
};

export default Home;
