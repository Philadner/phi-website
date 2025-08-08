import React, { useEffect, useRef, useState } from "react";
import "../stylesheets/home.css";

const middlePhrases = [
  "welcome",
  "epic website",
  "we hate trump",
  "enjoy your summer",
  "chillest website ever ever",
  "we love south park",
  "do people actually read these?",
  "NO mind control",
  "does not collect data. - we promise. seriously'nt.",
  "with much effort",
  "finding the meaning of life since 2025",
  "failing to understand the meaning of life since 2025",
  "we love kanye",
  "we hate taylor swift",
  "32.5% homosexual",
  "did i really say that?",
  "these ARE pregenerated, right?",
  "we love you",
  "twitch.tv/fieryvipers",
  "shitass code. theres a reason the repo is private",
  "we hate you",
  "was this £1 domain really worth it?",
  "homophobes shunned but welcome",
  "everyone knows why you're here",
  "we CAN see your dumbass, you know.",
  "#1 onlyfans alternative",
  "we all dont appreciate nail clippers enough",
  "do NOT go to zain barber 4 men. they fucked my hair up bad.",
  "Kyle Broflovski",
  "Keep those neck muscles extended",
  "2763", //fuck you and your stupid object shows chloe
  "Oh my god! THEY KILLED KENNY!",
  "Yes, sir Four big guys and they grab on my thighs Blow up my guts like the Fourth of July If they keep fuckin' my butt, then I might just cry Poop and semen sprayin' on my eyes He lick my dick and the cum start sprayin' Charging up my dick, I'ma go super saiyan When he cum the fuckin' booty I don't do much playing Then I whispered in his ear, like, Hey, are you stayin' He said, Yeah, I'm not leavin' I guess he George Floyd, 'cause always leavin' Not breathin' he chew on my dick like a baby, that's teethin' I'm fuckin' a nigga, I think it's named Steven Hawking Fuck him 'til he ain't walkin' Dick stone-cold call him BBC Austin It's a booty massacre when I visit him in Boston Bought him new titties, I don't care what they costin', bitch Hop on the dick do a split Shout out Lil Baby, my dick is as real as it gets I'm not fuckin' on him, if he don't have tits I'm catchin' his balls like my name Kyle Bitz There's four big guys, they're grabbin' on my thighs They blow my guts like the Fourth of July If he keep fuckin' my butt, then I might cry There's poop and semen sprayin' on my eyes Yes sir, that is a fact tho, take out my dick slip it in his asshole Swinging my dick through the air like a lasso Painted his face like Pablo Picasso (ugh) But I'm not a very good artist Fuck 'em all good until that nigga farted Planted my seeds in his ass like a garden The way I play with balls, you should call me James Harden Yeah, DigBar is elite, there's four big guys, and I'm takin' their meat I eat the boy's butt, then I chase him with skeet And I charge for booty, I promise DigBar isn't cheap And I count dudes when I sleep, not sheep Get up in my sheets, and I'm beatin' on my meat Bitch We got four big guys And they grab on my thighs And they gon' bust on my eyes",
  "clash royale",
  "kanbye weft",
  "making you jazz the fuck out since 1901",
  "fuck the online safey act",
  "the system knows",
  "r/bonersinpublic",
  "wow these require creativity",
  "jacob is a bitch",
  "is 6 inches alright?",
  "xbox > playstation",
  "on sight",
];

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildCycle() {
  return ["phi", ...shuffle(middlePhrases).slice(0, 3)];
}

const Home: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const phiRef = useRef<HTMLDivElement>(null);

  const pos = useRef({ x: 0, y: 0 });
  const target = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);

  const popScale = useRef(1);

  const [phrases, setPhrases] = useState<string[]>(() => buildCycle());
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Mouse movement animation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const nx = (e.clientX - cx) / (rect.width / 2);
      const ny = (e.clientY - cy) / (rect.height / 2);

      const maxDrift = 45;
      target.current.x = Math.max(-1, Math.min(1, nx)) * maxDrift;
      target.current.y = Math.max(-1, Math.min(1, ny)) * maxDrift;
    };

    const animate = () => {
      const k = 0.08;
      pos.current.x += (target.current.x - pos.current.x) * k;
      pos.current.y += (target.current.y - pos.current.y) * k;

      const tiltMax = 6;
      const twistMax = 2;
      const rx = (-pos.current.y / 45) * tiltMax;
      const ry = (pos.current.x / 45) * tiltMax;
      const rz = (pos.current.x / 45) * twistMax;

      const maxDrift = 45;
      const distance = Math.sqrt(
        Math.pow(pos.current.x / maxDrift, 2) + Math.pow(pos.current.y / maxDrift, 2)
      );
      const baseScale = 1 + distance * 0.05;

      // ease popScale back to 1
      popScale.current += (1 - popScale.current) * 0.2;

      const el = phiRef.current;
      if (el && containerRef.current) {
        const available = containerRef.current.offsetWidth * 0.9;
        const textWidth = Math.max(el.scrollWidth, 1);
        const scale = Math.min(1, available / textWidth) * baseScale * popScale.current;

        el.style.transform =
          `translate(-50%, -50%) translate3d(${pos.current.x}px, ${pos.current.y}px, 0)
           rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)
           scale(${scale})`;

        el.style.textShadow =
          `0 0 ${8 + Math.abs(pos.current.x) * 0.1 + Math.abs(pos.current.y) * 0.1}px rgba(255,221,51,.45)`;
      }

      rafId.current = requestAnimationFrame(animate);
    };

    container.addEventListener("mousemove", onMove);
    rafId.current = requestAnimationFrame(animate);

    return () => {
      container.removeEventListener("mousemove", onMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // Typing effect with acceleration + pop effect
  useEffect(() => {
    const current = phrases[phraseIndex];
    if (!current) return;

    const baseSpeed = deleting ? 50 : 80; // start speed
    const accelFactor = 0.85; // faster each char
    const typingSpeed = Math.max(20, baseSpeed * Math.pow(accelFactor, text.length));
    const pauseTime = current === "phi" ? 2500 : 1200;

    const timer = setTimeout(() => {
      if (!deleting && text.length < current.length) {
        setText(current.slice(0, text.length + 1));
        popScale.current = 1.15; // pop bump
      } else if (!deleting && text.length === current.length) {
        setTimeout(() => setDeleting(true), pauseTime);
      } else if (deleting && text.length > 0) {
        setText(current.slice(0, text.length - 1));
      } else if (deleting && text.length === 0) {
        setDeleting(false);
        if (phraseIndex + 1 >= phrases.length) {
          setPhrases(buildCycle());
          setPhraseIndex(0);
        } else {
          setPhraseIndex(phraseIndex + 1);
        }
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [text, deleting, phraseIndex, phrases]);

  return (
    <div ref={containerRef} className="home-stage">
      <div ref={phiRef} className="phi-floating">{text}</div>
    </div>
  );
};

export default Home;
