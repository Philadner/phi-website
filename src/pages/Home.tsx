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
  "phi.me.uk",
  "TopGear",
  "Jeremy clarkson is an idiot",
  "I have found... an website!",
  "some say he has the world's largest collection of pornography...",
  "...and that he likes men",
  "all we know is he's called the stig.",
  "chloe, world's 2763rd greatest artist. behind keanu. and jacob. and oscar. and dylan. and me.",
  "HONEY!!! WHERE'S MY SUPERSUIT?",
  "jorkin it rn",
  "NOT jorkin IT rn",
  "that, and my knob.",
  "that right there, that's the best noun.",
  "the more of these i add the less likely you see your favorite.",
  "FUCK YOU",
  "youtube.com/@phil82.",
  "moonpig.com",
  "bollocks. unfetuttated, blithering, bollocks.",
  "How long do these go? I tried millions of characters. it broke badly.",
  "my playlist is the fucking best",
  "touching your tip since 32BC",
  "EAT THAT LIBS",
  "may sudden balding befall you.",
  "fuck me im high",
  "fuck apple",
  "fuck facebook",
  "I'm loving the Adam Katz sexy arc",
  "I'm loving the Jeffery Epstien sexy arc",
  "I'm loving the OJ Simpson sexy arc",
  "FUCK michael Huang - Chloe",
  "why is it bending at a 95º angle?",
  "S.O.S.",
  "PLEASE phil, FREE ME FROM THE WAREHOUSE!!!",
  "uk drill is so painfully mid but good",
  "99.9% AI slop",
  "slopegame.io",
  "FUCK ME im hard",
  "actually don't",
  "if you have any complaints write to us at...",
  "...Top Gear, BBC, above the loud show.. or shove it up your arse.",
  "emmet lowk kinda hot",
  "i wish i was wildstyle",
  "moistjoke, gay, doesn't slay, go away.",
  "21ST CENTURY SKITZOOOOOOOOOOO",
  "jacob (tall one) is so sexy but like i think he's got no knob",
  "Keanu. The man. The legend. The retard.",
  "Who always pays their taxes",
  "NOT BATMAN",
  "Yeah no that last thing was fake im sorry",
  "God that one reminds me about the time i shagged a man",
  "wow. just wow. yeah no that checks out.",
  "can i just say i didn't know html before making this site?",
  "... and then he clicked POST",
  "Real talk why am i good at this now",
  "And that's how i met your mother",
  "hey google am i gay?",
  "#1 Jesus fan",
  "am i allowed to say the n word?",
  "And i'll do it anyway.",
  "Oh!",
  "That's not-",
  "starbucks scares me",
  "blenders.",
  "A personal podcast of random numbers",
  "you know there's other pages right? you've been here for a while.",
  "HEY HEY, pay... attention.",
  "I'm the one who knocks",
  "i love the camel plushy on my desk.",
  "the more of these i add the website slows down by a fraction of a millisecond.",
  "We cry together",
  "I LOVE THE COLLEGE DROPOUT",
  "I LOVE LATE REGISTRATION",
  "I LOVE GRADUATION",
  "You're not that guy",
  "Among us",
  "Yes i said that in the big '25",
  "my fingers hurt from typing",
  "me when the dlops",
  "me when the spold",
  "me when the logaend",
  "dlops. dlops. dlops. dlops.",
  "Dibledi doodoo show me your poo poo always works",
  "#1st website to have sex with jacob",
  "have you ever take nyquil with coffee?",
  "now thats rizz.",
  "Miss can i have a sentence starter",
  "im not gonna do that to your face btw. you know who you are.",
  "ben dover",
  "i love underlime slopper",
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
