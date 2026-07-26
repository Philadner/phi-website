import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import "../stylesheets/DatingGame.css";

const JAY_IMAGE_URL = "https://cdn.phi.me.uk/pictures/Jay.png";
const JAY_CONFUSED_IMAGE_URL = "https://cdn.phi.me.uk/pictures/jay/jay-confused.jpg";

type CharacterId = "jay" | "phil" | "dylan" | "oscar" | "benjamin";
type Phase = "title" | "name" | "dialogue" | "hub" | "ending";
type LineEffect = "location" | "heartbeat" | "creepy";

const PHIL_IMAGE_URLS = {
  default: "https://cdn.phi.me.uk/pictures/phil/phil-cat-ears.jpg",
  cool: "https://cdn.phi.me.uk/pictures/phil/phil-cool-glasses.jpg",
  field: "https://cdn.phi.me.uk/pictures/phil/phil-field.jpg",
  floor: "https://cdn.phi.me.uk/pictures/phil/phil-floor.jpg",
  shocked: "https://cdn.phi.me.uk/pictures/phil/phil-shocked.jpg",
  smug: "https://cdn.phi.me.uk/pictures/phil/phil-smug.jpg",
} as const;

const DYLAN_IMAGE_URLS = {
  default: "https://cdn.phi.me.uk/pictures/dylan/dylan-default.jpg",
  allegiance: "https://cdn.phi.me.uk/pictures/dylan/dylan-allegiance.jpg",
  headset: "https://cdn.phi.me.uk/pictures/dylan/dylan-headset.jpg",
  sad: "https://cdn.phi.me.uk/pictures/dylan/dylan-sad.jpg",
  serious: "https://cdn.phi.me.uk/pictures/dylan/dylan-dead-serious.jpg",
  tree: "https://cdn.phi.me.uk/pictures/dylan/dylan-tree.jpg",
  withOscar: "https://cdn.phi.me.uk/pictures/dylan/dylan-oscar-couple.jpg",
} as const;

const OSCAR_IMAGE_URLS = {
  default: "https://cdn.phi.me.uk/pictures/oscar/oscar-default-aura.jpg",
  car: "https://cdn.phi.me.uk/pictures/oscar/oscar-car.jpg",
  happy: "https://cdn.phi.me.uk/pictures/oscar/oscar-happy.jpg",
  milk: "https://cdn.phi.me.uk/pictures/oscar/oscar-milk.jpg",
  serious: "https://cdn.phi.me.uk/pictures/oscar/oscar-serious.jpg",
} as const;

const BIBI_IMAGE_URLS = {
  serious: "https://cdn.phi.me.uk/pictures/bibi/bibi-serious.jpg",
  smile: "https://cdn.phi.me.uk/pictures/bibi/bibi-smile.jpg",
  shrug: "https://cdn.phi.me.uk/pictures/bibi/bibi-shrug.jpg",
  lecture: "https://cdn.phi.me.uk/pictures/bibi/bibi-lecture.jpg",
} as const;

type Line = {
  speaker?: string;
  text: string;
  effect?: LineEffect;
};

type CharacterState = {
  id: CharacterId;
  name: string;
  description: string;
  colour: string;
  affection: number;
  trust: number;
  weirdness: number;
  jealousy: number;
  progress: number;
  status: string;
};

type StoryContext = {
  playerName: string;
  cast: Record<CharacterId, CharacterState>;
};

type StoryChoice = {
  label: string;
  detail?: string;
  stats: Partial<Pick<CharacterState, "affection" | "trust" | "weirdness" | "jealousy">>;
  status: string;
  outcome: (context: StoryContext) => Line[];
};

type Scene = {
  id: string;
  character: CharacterId;
  title: string;
  intro: (context: StoryContext) => Line[];
  prompt: Line;
  choices: StoryChoice[];
};

type ChoiceButton = {
  label: string;
  detail?: string;
  action: () => void;
};

type Ending = {
  eyebrow: string;
  title: string;
  text: string;
};

const CHARACTER_ORDER: CharacterId[] = ["jay", "phil", "dylan", "oscar", "benjamin"];

const INITIAL_CAST: Record<CharacterId, CharacterState> = {
  jay: {
    id: "jay",
    name: "Jay",
    description: "Heartthrob. Average guy. Terrifyingly committed to Arby's.",
    colour: "#ffcf4a",
    affection: 0,
    trust: 0,
    weirdness: 0,
    jealousy: 0,
    progress: 0,
    status: "Pretending not to look at you",
  },
  phil: {
    id: "phil",
    name: "Phil",
    description: "Desperate for Jay. Unless his eyes have been on the wrong prize.",
    colour: "#ff6ea9",
    affection: 0,
    trust: 0,
    weirdness: 1,
    jealousy: 2,
    progress: 0,
    status: "Scheming near a vending machine",
  },
  dylan: {
    id: "dylan",
    name: "Dylan",
    description: "Charming, calm, and allegedly somebody else's soulmate.",
    colour: "#68d7ff",
    affection: 0,
    trust: 0,
    weirdness: 0,
    jealousy: 0,
    progress: 0,
    status: "Watching the roof access door",
  },
  oscar: {
    id: "oscar",
    name: "Oscar",
    description: "Quietly magnetic. Also allegedly somebody else's soulmate.",
    colour: "#9f8cff",
    affection: 0,
    trust: 0,
    weirdness: 0,
    jealousy: 0,
    progress: 0,
    status: "Drawing something suspiciously romantic",
  },
  benjamin: {
    id: "benjamin",
    name: "Benjamin Netanyahu",
    description: "Politically present. Somehow on the dating roster.",
    colour: "#72e0a0",
    affection: 0,
    trust: 0,
    weirdness: 5,
    jealousy: 0,
    progress: 0,
    status: "Waiting beside an unexplained motorcade",
  },
};

const cloneInitialCast = () =>
  Object.fromEntries(CHARACTER_ORDER.map((id) => [id, { ...INITIAL_CAST[id] }])) as Record<
    CharacterId,
    CharacterState
  >;

const SCENES: Record<CharacterId, [Scene, Scene]> = {
  jay: [
    {
      id: "jay-invite",
      character: "jay",
      title: "Jay · The invitation",
      intro: ({ playerName }) => [
        { speaker: "Jay", text: `Hey ${playerName}! Man, you look cute. Wanna go to Arby's, me and you?` },
        { text: "Your heart starts BEATING.", effect: "heartbeat" },
      ],
      prompt: { text: "There are several correct answers. None of them are dignified." },
      choices: [
        {
          label: "Yeah, sure. (nonchalantly)",
          detail: "Attempt to behave like a normal human being.",
          stats: { affection: 2, trust: 1 },
          status: "Waiting for you at Arby's",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "Uhh, *blushes* yeah, sure. Nonchalantly." },
            { speaker: "Jay", text: "Well, okay then. *smirks* Meet me tomorrow." },
            { text: "Jay leaves. Your dignity attempts to follow him." },
          ],
        },
        {
          label: "Only if the meat aligns.",
          detail: "Make this weird immediately.",
          stats: { affection: 2, weirdness: 2 },
          status: "Fascinated and waiting at Arby's",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "YES. I mean—perhaps. If the meat aligns." },
            { speaker: "Jay", text: "I have no idea what that means, but okay." },
          ],
        },
      ],
    },
    {
      id: "jay-date",
      character: "jay",
      title: "Jay · Arby's, Tel Aviv branch",
      intro: ({ playerName }) => [
        { text: "TIME SKIP: Next evening...", effect: "location" },
        { text: "LOCATION: Arby's, Tel Aviv branch", effect: "location" },
        { text: "You open the door. They really do have the meat." },
        { text: "Jay waits in a corner booth. He has put effort in. He has finally showered." },
        { speaker: "Jay", text: `You made it, ${playerName}! I ordered a mountain of roast beef sandwiches.` },
      ],
      prompt: { text: "The meat mountain glistens. It expects an answer." },
      choices: [
        {
          label: "This is an unforgivable amount of meat.",
          detail: "Take a principled stand.",
          stats: { affection: -2, trust: -1 },
          status: "Emotionally defeated by roast beef",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "Are you a meat dealer? Do you sell sirloin in a back alley?" },
            { speaker: "Jay", text: "Oh. Yeah. It is quite a lot of meat. Sorry." },
            { text: "You sit in silence. The mountain remains undefeated. The date is over." },
          ],
        },
        {
          label: "Call it romantic and feed him a curly fry.",
          detail: "The intended golden route, somehow.",
          stats: { affection: 5, trust: 3 },
          status: "Officially Arby's-adjacent",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "Here comes the aiiiirrrplaneeeee." },
            { speaker: "Jay", text: "OM. I mean—wow. It tastes better from your hand." },
            { text: "The chemistry in the booth is boiling over. The tension is palpable." },
            { speaker: "Jay", text: "Let's get out of here. My place is around the corner." },
            { text: "LOCATION: Jay's Apartment", effect: "location" },
            { text: "Your chest thumps wildly.", effect: "heartbeat" },
            { text: ">>> THE DEVIL'S TANGO, PROBABLY <<<", effect: "creepy" },
            { text: "The scene cuts tastefully to a pile of abandoned Arby's wrappers." },
          ],
        },
        {
          label: "Who is ‘us’? Eat the entire mountain.",
          detail: "Establish dominance.",
          stats: { affection: 3, weirdness: 2 },
          status: "Smitten and slightly alarmed",
          outcome: () => [
            { text: "You consume the entire mountain before Jay can blink." },
            { speaker: "Jay", text: "Lesson learned. Never let you near any form of meat." },
            { text: "Jay asks for another date. Fear and romance become indistinguishable." },
          ],
        },
      ],
    },
  ],
  phil: [
    {
      id: "phil-confrontation",
      character: "phil",
      title: "Phil · Corridor interrogation",
      intro: ({ playerName }) => [
        { text: "Phil approaches, cheerful and a little too eager." },
        { speaker: "Phil", text: "Oh hey! I saw you talking to my friend Jay." },
        { speaker: "Phil", text: `So, ${playerName}... what's your motive?` },
      ],
      prompt: { text: "Phil is attempting to look casual. He is failing." },
      choices: [
        {
          label: "He just seems like a cool guy.",
          stats: { trust: 2 },
          status: "Suspiciously relieved",
          outcome: () => [
            { speaker: "Phil", text: "Oh, so you're—" },
            { speaker: "Phil", text: "Never mind. Sorry. I thought something was going on." },
            { text: "Phil walks away, then glances back at you once." },
          ],
        },
        {
          label: "Have you SEEN his cute little face?",
          stats: { affection: 1, jealousy: 2 },
          status: "Jealous, but intrigued by you",
          outcome: () => [
            { speaker: "Phil", text: "Right." },
            { speaker: "Phil", text: "I understand, because..." },
            { speaker: "Phil", text: "I feel exactly the same way.", effect: "creepy" },
          ],
        },
        {
          label: "Is this any of your business?",
          stats: { affection: 1, trust: -1 },
          status: "Annoyed in a memorable way",
          outcome: ({ playerName }) => [
            { speaker: "Phil", text: "It kind of IS my business! I am his friend." },
            { speaker: playerName, text: "That was not an answer, Phil." },
          ],
        },
      ],
    },
    {
      id: "phil-date",
      character: "phil",
      title: "Phil · After school",
      intro: () => [
        { text: "LOCATION: The vending machines, 4:07 PM", effect: "location" },
        { speaker: "Phil", text: "I asked you here because I need help making Jay jealous." },
        { speaker: "Phil", text: "Also because you are... weirdly easy to talk to." },
      ],
      prompt: { text: "Phil offers you the least romantic hot chocolate ever made." },
      choices: [
        {
          label: "Help him make Jay jealous.",
          stats: { trust: 1, jealousy: 2 },
          status: "Your reluctant co-conspirator",
          outcome: ({ cast }) => [
            { speaker: "Phil", text: "Excellent. This is definitely emotionally healthy." },
            ...(cast.jay.progress > 0 ? [{ text: "Jay watches from across the corridor. This may already be working." }] : []),
          ],
        },
        {
          label: "Tell him you came for Phil, not Jay.",
          stats: { affection: 4, trust: 2, jealousy: -1 },
          status: "Realising he might like you",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "Maybe stop trying to make Jay jealous. I came here for you." },
            { text: "Phil forgets every word he has ever learned." },
            { speaker: "Phil", text: "Oh. OH. Right. Yeah. Cool. Very cool." },
          ],
        },
        {
          label: "Make everybody jealous.",
          stats: { affection: 2, weirdness: 3 },
          status: "Planning something unwise",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "Maximum confusion. Everybody gets jealous." },
            { speaker: "Phil", text: "That is a terrible plan. I'm in." },
          ],
        },
      ],
    },
  ],
  dylan: [
    {
      id: "dylan-roof",
      character: "dylan",
      title: "Dylan · Roof access",
      intro: ({ playerName }) => [
        { text: "LOCATION: A roof you are absolutely not allowed on", effect: "location" },
        { text: "Dylan shares crisps with a very confident pigeon." },
        { speaker: "Dylan", text: `Knew you'd follow me, ${playerName}.` },
      ],
      prompt: { text: "Wind catches his jacket with suspiciously cinematic timing." },
      choices: [
        {
          label: "Ask about Oscar.",
          detail: "Risk being emotionally responsible.",
          stats: { trust: 3 },
          status: "Surprised by your honesty",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "So... you and Oscar?" },
            { speaker: "Dylan", text: "Complicated. But thanks for actually asking." },
          ],
        },
        {
          label: "Flirt shamelessly.",
          stats: { affection: 3, jealousy: 1 },
          status: "Trying not to grin",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "I came up for the view. You're in it." },
            { speaker: "Dylan", text: "That was awful. Do it again." },
          ],
        },
        {
          label: "Point out the judgemental pigeon.",
          stats: { affection: 1, weirdness: 3 },
          status: "Concerned about the pigeon",
          outcome: () => [
            { speaker: "Dylan", text: "Finally, somebody else sees it." },
            { text: "The pigeon refuses to deny anything." },
          ],
        },
      ],
    },
    {
      id: "dylan-records",
      character: "dylan",
      title: "Dylan · Record shop",
      intro: ({ cast }) => [
        { text: "LOCATION: An aggressively independent record shop", effect: "location" },
        {
          text: `Dylan waits by a crate labelled SAD BANGERS.${
            cast.oscar.progress > 0 ? " He has definitely heard that you spoke to Oscar." : ""
          }`,
        },
        { speaker: "Dylan", text: "Pick one record. It decides the entire future of our relationship." },
      ],
      prompt: { text: "No pressure, apparently." },
      choices: [
        {
          label: "Put on a record and make him dance.",
          stats: { affection: 4, trust: 1 },
          status: "Keeping your shared song",
          outcome: () => [
            { text: "You dance between the shelves with no rhythm and complete confidence." },
            { speaker: "Dylan", text: "This song is ours now." },
          ],
        },
        {
          label: "Be honest about who else you like.",
          stats: { affection: 2, trust: 4, jealousy: -1 },
          status: "Trusting you with the mess",
          outcome: ({ playerName, cast }) => [
            {
              speaker: playerName,
              text:
                cast.oscar.progress > 0
                  ? "I like you. I also spent time with Oscar. I won't lie about it."
                  : "I like you. I don't want to turn this into a game.",
            },
            { speaker: "Dylan", text: "Complicated is fine. Dishonest isn't. We're okay." },
          ],
        },
        {
          label: "Steal the promotional cardboard cut-out.",
          stats: { affection: 1, weirdness: 4, trust: -1 },
          status: "Banned from one record shop",
          outcome: () => [
            { text: "The cardboard cut-out is taller than you." },
            { speaker: "Dylan", text: "Run. I will explain never." },
          ],
        },
      ],
    },
  ],
  oscar: [
    {
      id: "oscar-art",
      character: "oscar",
      title: "Oscar · Art room",
      intro: () => [
        { text: "LOCATION: The art room after everybody sensible has gone home", effect: "location" },
        { text: "Oscar snaps his sketchbook shut one second too late." },
        { speaker: "Oscar", text: "You weren't supposed to see that yet." },
      ],
      prompt: { text: "A familiar face is visible beneath his hand." },
      choices: [
        {
          label: "Ask if he drew you.",
          stats: { affection: 2, trust: 2 },
          status: "Letting you see the sketchbook",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "Is that... me?" },
            { speaker: "Oscar", text: "It was meant to be subtle." },
          ],
        },
        {
          label: "Compliment his work.",
          stats: { affection: 3 },
          status: "Blushing behind a sketchbook",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "You're annoyingly good at this." },
            { speaker: "Oscar", text: "You are annoyingly distracting." },
          ],
        },
        {
          label: "Demand a pencil and draw him back.",
          stats: { affection: 1, weirdness: 3 },
          status: "Treasuring your terrible drawing",
          outcome: () => [
            { text: "You draw Oscar as a heroic worm with a sword." },
            { speaker: "Oscar", text: "This is the best thing anybody has ever made." },
          ],
        },
      ],
    },
    {
      id: "oscar-chips",
      character: "oscar",
      title: "Oscar · Midnight chips",
      intro: ({ cast }) => [
        { text: "LOCATION: Outside the chippy, far too late", effect: "location" },
        {
          text: `Oscar holds one bag of chips and two forks.${
            cast.dylan.progress > 0 ? " He knows you have been spending time with Dylan." : ""
          }`,
        },
        { speaker: "Oscar", text: "I bought enough chips for either outcome." },
      ],
      prompt: { text: "A seagull watches from the darkness." },
      choices: [
        {
          label: "Share the chips like this is a date.",
          stats: { affection: 4, trust: 1 },
          status: "Saving you the last chip",
          outcome: () => [
            { text: "You share one paper bag beneath a broken streetlight." },
            { speaker: "Oscar", text: "This is disgustingly romantic." },
          ],
        },
        {
          label: "Talk honestly about Dylan.",
          stats: { affection: 2, trust: 4, jealousy: -1 },
          status: "Choosing honesty over guessing",
          outcome: ({ playerName, cast }) => [
            {
              speaker: playerName,
              text:
                cast.dylan.progress > 0
                  ? "I like you. I like Dylan too. You both deserve the truth."
                  : "What actually happened between you and Dylan?",
            },
            { speaker: "Oscar", text: "Thank you for asking instead of inventing an answer." },
          ],
        },
        {
          label: "Offer a chip to the ominous seagull.",
          stats: { affection: 2, weirdness: 3 },
          status: "Your partner in bird crime",
          outcome: () => [
            { text: "The seagull accepts, then demands the entire bag." },
            { speaker: "Oscar", text: "We have made a powerful enemy." },
          ],
        },
      ],
    },
  ],
  benjamin: [
    {
      id: "benjamin-motorcade",
      character: "benjamin",
      title: "Benjamin · Unexpected cameo",
      intro: () => [
        { text: "LOCATION: Beside a completely unexplained motorcade", effect: "location" },
        { text: "Benjamin Netanyahu is here." },
        { speaker: "Benjamin Netanyahu", text: "Hello. I have been informed I am dateable." },
      ],
      prompt: { text: "No part of this is explained." },
      choices: [
        {
          label: "Call him funny and heartwarming.",
          stats: { affection: 1, trust: 1 },
          status: "Heartwarmed, apparently",
          outcome: ({ playerName }) => [
            { speaker: "Benjamin Netanyahu", text: "I is a funny and heartwarming guy :)" },
            { speaker: playerName, text: "That sentence answered nothing." },
          ],
        },
        {
          label: "Ask why he is in this game.",
          stats: { trust: 2, weirdness: 1 },
          status: "Unable to explain the plot",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "Why are you in a school dating sim?" },
            { speaker: "Benjamin Netanyahu", text: "Yes. This is a placeholder." },
          ],
        },
        {
          label: "Steal the motorcade.",
          stats: { affection: 1, weirdness: 3 },
          status: "Missing one official vehicle",
          outcome: () => [
            { text: "You climb into the nearest car. Confidence is a uniform." },
            { speaker: "Benjamin Netanyahu", text: "That one was mine." },
          ],
        },
      ],
    },
    {
      id: "benjamin-brunch",
      character: "benjamin",
      title: "Benjamin · Diplomatic brunch",
      intro: ({ playerName }) => [
        { text: "LOCATION: A brunch venue protected by three security cordons", effect: "location" },
        { speaker: "Benjamin Netanyahu", text: `Welcome, ${playerName}. Today we negotiate the future.` },
        { speaker: playerName, text: "Of what?" },
        { speaker: "Benjamin Netanyahu", text: "This relationship. And possibly the buffet." },
      ],
      prompt: { text: "The hummus has arrived under armed guard." },
      choices: [
        {
          label: "Share the last pita.",
          stats: { affection: 3, trust: 1, weirdness: 1 },
          status: "Diplomatically sharing hummus",
          outcome: () => [
            { text: "You split it with the precision of international negotiators." },
            { speaker: "Benjamin Netanyahu", text: "This is going extremely well." },
          ],
        },
        {
          label: "Propose peace and more brunch.",
          stats: { affection: 1, trust: 3 },
          status: "Considering your proposal",
          outcome: ({ playerName }) => [
            { speaker: playerName, text: "My proposal is simple: less war, more brunch." },
            { speaker: "Benjamin Netanyahu", text: "The brunch portion is compelling." },
          ],
        },
        {
          label: "Steal the motorcade again.",
          stats: { trust: -1, weirdness: 4 },
          status: "Still looking for the motorcade",
          outcome: () => [
            { text: "You escape in the motorcade for a second and more successful time." },
            { speaker: "Benjamin Netanyahu", text: "How do you keep doing that?" },
          ],
        },
      ],
    },
  ],
};

export default function DatingGame() {
  const [phase, setPhase] = useState<Phase>("title");
  const [draftName, setDraftName] = useState("");
  const [playerName, setPlayerName] = useState("Mystery Legend");
  const [cast, setCast] = useState(cloneInitialCast);
  const [completedScenes, setCompletedScenes] = useState<string[]>([]);
  const [sceneLabel, setSceneLabel] = useState("Opening");
  const [lines, setLines] = useState<Line[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [choices, setChoices] = useState<ChoiceButton[]>([]);
  const [ending, setEnding] = useState<Ending | null>(null);
  const afterLinesRef = useRef<() => void>(() => undefined);

  const activeLine = lines[lineIndex];
  const lineIsComplete = !activeLine || visibleCharacters >= activeLine.text.length;
  const scenesPlayed = completedScenes.length;

  const play = useCallback((label: string, nextLines: Line[], after?: () => void) => {
    setSceneLabel(label);
    setLines(nextLines);
    setLineIndex(0);
    setVisibleCharacters(0);
    setChoices([]);
    afterLinesRef.current = after ?? (() => setPhase("hub"));
    setPhase("dialogue");
  }, []);

  const showChoices = useCallback(
    (label: string, prompt: Line, nextChoices: ChoiceButton[]) => {
      play(label, [prompt], () => setChoices(nextChoices));
    },
    [play],
  );

  const advanceDialogue = useCallback(() => {
    if (phase !== "dialogue" || !activeLine || choices.length > 0) return;
    if (!lineIsComplete) {
      setVisibleCharacters(activeLine.text.length);
    } else if (lineIndex < lines.length - 1) {
      setLineIndex((current) => current + 1);
      setVisibleCharacters(0);
    } else {
      afterLinesRef.current();
    }
  }, [activeLine, choices.length, lineIndex, lineIsComplete, lines.length, phase]);

  useEffect(() => {
    if (phase !== "dialogue" || !activeLine || choices.length > 0 || lineIsComplete) return;
    const delay = activeLine.effect === "creepy" ? 42 : activeLine.effect === "location" ? 30 : 19;
    const timer = window.setTimeout(
      () => setVisibleCharacters((current) => Math.min(current + 1, activeLine.text.length)),
      delay,
    );
    return () => window.clearTimeout(timer);
  }, [activeLine, choices.length, lineIsComplete, phase, visibleCharacters]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (phase !== "dialogue" || choices.length > 0) return;
      if (event.key !== " " && event.key !== "Enter") return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      advanceDialogue();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advanceDialogue, choices.length, phase]);

  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const chosenName = draftName.trim() || "Mystery Legend";
    setPlayerName(chosenName);
    play(
      "Scratchit's scratching therapy",
      [
        { text: "LOCATION: Tel Aviv, Israel", effect: "location" },
        { text: "SCENE: Jay is in Bob Scratchit's scratching therapy." },
        { text: "You're sitting in a nearby chair, for some reason. You catch Jay's eye." },
        { speaker: "Jay", text: "Oh hey! What's your name?" },
        { speaker: chosenName, text: `Oh! My name is ${chosenName}.` },
        { text: "Five people are currently dateable. Nobody knows who approved this." },
      ],
      () => setPhase("hub"),
    );
  };

  const chooseScene = (scene: Scene, choice: StoryChoice) => {
    const context = { playerName, cast };
    setCast((current) => ({
      ...current,
      [scene.character]: {
        ...current[scene.character],
        affection: current[scene.character].affection + (choice.stats.affection ?? 0),
        trust: current[scene.character].trust + (choice.stats.trust ?? 0),
        weirdness: current[scene.character].weirdness + (choice.stats.weirdness ?? 0),
        jealousy: current[scene.character].jealousy + (choice.stats.jealousy ?? 0),
        progress: current[scene.character].progress + 1,
        status: choice.status,
      },
    }));
    setCompletedScenes((current) => (current.includes(scene.id) ? current : [...current, scene.id]));
    play(`${scene.title} · Complete`, choice.outcome(context), () => setPhase("hub"));
  };

  const startRoute = (id: CharacterId) => {
    const progress = cast[id].progress;
    if (progress >= 2) return;
    const scene = SCENES[id][progress];
    const context = { playerName, cast };
    play(scene.title, scene.intro(context), () =>
      showChoices(
        scene.title,
        scene.prompt,
        scene.choices.map((choice) => ({
          label: choice.label,
          detail: choice.detail,
          action: () => chooseScene(scene, choice),
        })),
      ),
    );
  };

  const calculateEnding = useCallback((): Ending => {
    const close = CHARACTER_ORDER.filter((id) => cast[id].affection >= 4 && cast[id].trust >= 0);
    const jayAndPhil = close.includes("jay") && close.includes("phil");
    const dylanAndOscar = close.includes("dylan") && close.includes("oscar");
    if (close.length >= 3) {
      return {
        eyebrow: "CHAOTIC POLYCULE ENDING",
        title: "The Calendar Catastrophe",
        text: `${close.map((id) => cast[id].name).join(", ")} all arrive for the same Friday night. After one catastrophic group chat and a surprisingly mature conversation, nobody agrees on a label—but everybody agrees you need a larger calendar.`,
      };
    }
    if (jayAndPhil) {
      return {
        eyebrow: "DOUBLE ROUTE ENDING",
        title: "The Corridor Summit",
        text: "Jay and Phil compare notes. Phil admits this stopped being about jealousy around the vending-machine hot chocolate. Jay offers everyone curly fries. Against all odds, honesty wins.",
      };
    }
    if (dylanAndOscar) {
      return {
        eyebrow: "SOULMATE INCIDENT ENDING",
        title: "Complicated, Not Impossible",
        text: "Dylan and Oscar arrive ready for drama. You tell the truth first. It takes hours, two bags of chips, and one stolen cardboard cut-out—but nobody walks away alone.",
      };
    }
    if (close.length === 1) {
      const person = cast[close[0]];
      const individual: Record<CharacterId, string> = {
        jay: "Jay takes your hand beneath the golden Arby's sign. Somewhere, a curly fry completes its final orbit.",
        phil: "Phil finally stops looking over your shoulder for Jay. The hot chocolate is still terrible, but now it is your terrible hot chocolate.",
        dylan: "Dylan gives you the other earbud and keeps walking long after you pass your street.",
        oscar: "Oscar hands you the finished portrait. This time, he signs it: ‘for us.’",
        benjamin: "A motorcade arrives with one empty seat and a heavily guarded takeaway brunch.",
      };
      return { eyebrow: "ROMANCE ENDING", title: `${person.name}: Route Complete`, text: individual[person.id] };
    }
    return scenesPlayed >= 7
      ? {
          eyebrow: "FRIENDSHIP ENDING",
          title: "Everyone Survived",
          text: "You explored almost every possibility and committed to none. The group adopts a judgemental rooftop pigeon and agrees never to discuss the motorcade again.",
        }
      : {
          eyebrow: "SPEEDRUN ENDING",
          title: "Emotionally Any%",
          text: "You leave before anybody defines the relationship. Jay is still holding a curly fry. The ominous seagull respects your efficiency.",
        };
  }, [cast, scenesPlayed]);

  const endNight = () => {
    const result = calculateEnding();
    const pursued = CHARACTER_ORDER.filter((id) => cast[id].progress > 0);
    play(
      "Finale · Everybody compares notes",
      [
        { text: "LOCATION: The corridor, Friday evening", effect: "location" },
        { text: "A terrible realisation spreads through the group." },
        { speaker: "Phil", text: `${playerName}. Why is everybody here?` },
        { speaker: "Jay", text: "Wait. Everybody?" },
        ...(pursued.includes("dylan") && pursued.includes("oscar")
          ? [
              { speaker: "Dylan", text: "I think we should let them explain." },
              { speaker: "Oscar", text: "I brought chips for this." },
            ]
          : []),
        { text: "Hidden relationship mathematics whirs ominously." },
      ],
      () => {
        setEnding(result);
        setPhase("ending");
      },
    );
  };

  const resetGame = () => {
    setPhase("title");
    setDraftName("");
    setPlayerName("Mystery Legend");
    setCast(cloneInitialCast());
    setCompletedScenes([]);
    setSceneLabel("Opening");
    setLines([]);
    setLineIndex(0);
    setVisibleCharacters(0);
    setChoices([]);
    setEnding(null);
  };

  const activeColour = useMemo(() => {
    const speakerMatch = CHARACTER_ORDER.find((id) => cast[id].name === activeLine?.speaker);
    return speakerMatch ? cast[speakerMatch].colour : "#ffe66f";
  }, [activeLine?.speaker, cast]);

  const activePortraitUrl = useMemo(() => {
    if (activeLine?.speaker === "Jay") {
      if (/no idea|quite a lot|mean—wow|lesson learned|everybody\?/i.test(activeLine.text)) {
        return JAY_CONFUSED_IMAGE_URL;
      }
      return JAY_IMAGE_URL;
    }
    if (activeLine?.speaker === "Phil") {
      if (activeLine.effect === "creepy") return PHIL_IMAGE_URLS.floor;
      if (/what's your motive|thought something|Oh\. OH\.|why is everybody/i.test(activeLine.text)) {
        return PHIL_IMAGE_URLS.shocked;
      }
      if (/cool/i.test(activeLine.text)) return PHIL_IMAGE_URLS.cool;
      if (/emotionally healthy|terrible plan|kind of IS my business/i.test(activeLine.text)) {
        return PHIL_IMAGE_URLS.smug;
      }
      if (sceneLabel === "Phil · After school") return PHIL_IMAGE_URLS.field;
      return PHIL_IMAGE_URLS.default;
    }
    if (activeLine?.speaker === "Dylan") {
      if (/dishonest|honest|we're okay/i.test(activeLine.text)) return DYLAN_IMAGE_URLS.serious;
      if (/Oscar|complicated/i.test(activeLine.text)) return DYLAN_IMAGE_URLS.withOscar;
      if (/pigeon|somebody else sees it/i.test(activeLine.text)) return DYLAN_IMAGE_URLS.allegiance;
      if (/run/i.test(activeLine.text)) return DYLAN_IMAGE_URLS.sad;
      if (/song is ours|dance/i.test(activeLine.text)) return DYLAN_IMAGE_URLS.headset;
      if (sceneLabel === "Dylan · Record shop") return DYLAN_IMAGE_URLS.tree;
      return DYLAN_IMAGE_URLS.default;
    }
    if (activeLine?.speaker === "Oscar") {
      if (/best thing|blushing|romantic/i.test(activeLine.text)) return OSCAR_IMAGE_URLS.happy;
      if (/seagull|powerful enemy/i.test(activeLine.text)) return OSCAR_IMAGE_URLS.car;
      if (/chips|forks/i.test(activeLine.text)) return OSCAR_IMAGE_URLS.milk;
      if (/honest|asking|Dylan/i.test(activeLine.text)) return OSCAR_IMAGE_URLS.serious;
      return OSCAR_IMAGE_URLS.default;
    }
    if (activeLine?.speaker === "Benjamin Netanyahu") {
      if (/funny|heartwarming/i.test(activeLine.text)) return BIBI_IMAGE_URLS.smile;
      if (/placeholder|explain|answered nothing/i.test(activeLine.text)) return BIBI_IMAGE_URLS.shrug;
      if (/mine|motorcade|vehicle/i.test(activeLine.text)) return BIBI_IMAGE_URLS.lecture;
      return BIBI_IMAGE_URLS.serious;
    }
    return null;
  }, [activeLine, sceneLabel]);

  return (
    <main className="dating-game" style={{ "--dg-active": activeColour } as CSSProperties}>
      <div className="dating-game__noise" aria-hidden="true" />
      <div className="dating-game__frame">
        <header className="dating-game__masthead">
          <button className="dating-game__brand" type="button" onClick={resetGame}>
            <span>PHI</span> HEARTWARE
          </button>
          <div className="dating-game__status">
            <span className="dating-game__status-light" /> {phase === "hub" ? "FREE ROAM" : sceneLabel.toUpperCase()}
          </div>
          {phase !== "title" && (
            <button className="dating-game__restart" type="button" onClick={resetGame}>Restart</button>
          )}
        </header>

        {phase === "title" && (
          <section className="dating-title">
            <p className="dating-title__kicker">A completely responsible social simulator</p>
            <h1>DATING<span>SIM</span></h1>
            <p className="dating-title__warning">WARNING: GETS STEAMY. CONTAINS ARBY'S.</p>
            <p className="dating-title__intro">
              Five questionable romance routes. Ten encounters. One judgemental pigeon. Your choices are remembered,
              even when everyone wishes they weren't.
            </p>
            <button className="dating-title__start" type="button" onClick={() => setPhase("name")}>
              <span>▶</span> Start making mistakes
            </button>
            <p className="dating-title__controls">SPACE / ENTER / CLICK to advance dialogue</p>
          </section>
        )}

        {phase === "name" && (
          <section className="dating-name-card">
            <p className="dating-name-card__speaker">JAY</p>
            <h1>Oh hey! What's your name?</h1>
            <form onSubmit={submitName}>
              <label htmlFor="dating-player-name">Tell the truth, probably</label>
              <input
                id="dating-player-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="Mystery Legend"
                maxLength={28}
                autoFocus
              />
              <button type="submit">That's me →</button>
            </form>
          </section>
        )}

        {phase === "dialogue" && activeLine && (
          <section
            className={`dating-dialogue ${activeLine.effect ? `dating-dialogue--${activeLine.effect}` : ""}`}
            onClick={advanceDialogue}
          >
            <div className="dating-dialogue__scene">
              <span>{sceneLabel}</span>
              <span>{lineIndex + 1} / {lines.length}</span>
            </div>
            <div className="dating-dialogue__stage" aria-hidden="true">
              {activeLine.effect === "heartbeat" && <div className="dating-heart">♥</div>}
              {activeLine.effect === "creepy" && <div className="dating-glitch">ERROR / FEELINGS / ERROR</div>}
              {!activeLine.effect && <div className="dating-orbit"><span /><span /><span /></div>}
              {activePortraitUrl && (
                <img
                  className="dating-dialogue__character"
                  src={activePortraitUrl}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              )}
            </div>
            <div className="dating-dialogue__box" aria-live="polite">
              <p className="dating-dialogue__speaker">{activeLine.speaker ?? "NARRATOR"}</p>
              <p className="dating-dialogue__line">
                {activeLine.text.slice(0, visibleCharacters)}
                {!lineIsComplete && <span className="dating-dialogue__cursor">▮</span>}
              </p>
              {choices.length === 0 && (
                <button
                  className="dating-dialogue__advance"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    advanceDialogue();
                  }}
                >
                  {lineIsComplete ? "NEXT ▾" : "SKIP ▸"}
                </button>
              )}
            </div>
            {choices.length > 0 && (
              <div className="dating-choices" onClick={(event) => event.stopPropagation()}>
                {choices.map((choice, index) => (
                  <button type="button" key={choice.label} onClick={choice.action}>
                    <span className="dating-choices__number">0{index + 1}</span>
                    <span>
                      <strong>{choice.label}</strong>
                      {choice.detail && <small>{choice.detail}</small>}
                    </span>
                    <span className="dating-choices__arrow">→</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {phase === "hub" && (
          <section className="dating-hub">
            <div className="dating-hub__intro">
              <div>
                <p className="dating-hub__kicker">SOCIAL HUB · {playerName}</p>
                <h1>Who do you want to find?</h1>
                <p>Routes stay open. Date one person, several people, or create a preventable group-chat disaster.</p>
              </div>
              <div className="dating-hub__counter">
                <strong>{scenesPlayed}</strong><span>encounters complete</span>
              </div>
            </div>
            <div className="dating-hub__grid">
              {CHARACTER_ORDER.map((id, index) => {
                const character = cast[id];
                const routeComplete = character.progress >= 2;
                const portraitUrl = id === "jay"
                  ? JAY_IMAGE_URL
                  : id === "phil"
                    ? PHIL_IMAGE_URLS.default
                    : id === "dylan"
                      ? DYLAN_IMAGE_URLS.default
                      : id === "oscar"
                        ? OSCAR_IMAGE_URLS.default
                        : BIBI_IMAGE_URLS.serious;
                return (
                  <button
                    className={`dating-route-card ${routeComplete ? "dating-route-card--complete" : ""}`}
                    style={{ "--route-colour": character.colour } as CSSProperties}
                    key={id}
                    type="button"
                    onClick={() => startRoute(id)}
                    disabled={routeComplete}
                  >
                    <span className="dating-route-card__index">0{index + 1}</span>
                    <span className={`dating-route-card__portrait ${portraitUrl ? "dating-route-card__portrait--photo" : ""}`}>
                      {character.name.charAt(0)}
                      {portraitUrl && (
                        <img
                          src={portraitUrl}
                          alt=""
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                        />
                      )}
                    </span>
                    <span className="dating-route-card__copy">
                      <strong>{character.name}</strong>
                      <small>{character.description}</small>
                      <em>{character.status}</em>
                    </span>
                    <span className="dating-route-card__footer">
                      <span className="dating-route-card__pips" aria-label={`${character.progress} of 2 encounters complete`}>
                        <i className={character.progress >= 1 ? "is-filled" : ""} />
                        <i className={character.progress >= 2 ? "is-filled" : ""} />
                      </span>
                      <span>{routeComplete ? "ROUTE COMPLETE" : SCENES[id][character.progress].title}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="dating-hub__footer">
              <p><span>◆</span> Feelings are tracked privately. No affection spreadsheet will save you.</p>
              <button type="button" onClick={endNight} disabled={scenesPlayed < 4}>
                {scenesPlayed < 4
                  ? `Meet ${4 - scenesPlayed} more time${4 - scenesPlayed === 1 ? "" : "s"}`
                  : "End the night →"}
              </button>
            </div>
            <details className="dating-hub__credits">
              <summary>Bibi portrait credits</summary>
              <p>
                Serious portrait by{" "}
                <a href="https://commons.wikimedia.org/wiki/File:Benjamin_Netanyahu,_February_2023.jpg" target="_blank" rel="noreferrer">
                  Avi Ohayon / Government Press Office of Israel
                </a>{" "}
                (resized, CC BY-SA 3.0); smiling portrait by{" "}
                <a href="https://commons.wikimedia.org/wiki/File:Benjamin_Netanyahu_2018.jpg" target="_blank" rel="noreferrer">
                  U.S. Department of State
                </a>{" "}
                (public domain); shrug by{" "}
                <a href="https://commons.wikimedia.org/wiki/File:Benjamin_Netanyahu_30498881961.jpg" target="_blank" rel="noreferrer">
                  Hudson Institute
                </a>{" "}
                (resized, CC BY 2.0); lecture portrait by{" "}
                <a href="https://commons.wikimedia.org/wiki/File:Benjamin_Netanyahu_(25968752048).jpg" target="_blank" rel="noreferrer">
                  U.S. Embassy Tel Aviv
                </a>{" "}
                (resized, CC BY 2.0).
              </p>
            </details>
          </section>
        )}

        {phase === "ending" && ending && (
          <section className="dating-ending">
            <p className="dating-ending__kicker">{ending.eyebrow}</p>
            <div className="dating-ending__heart">♥</div>
            <h1>{ending.title}</h1>
            <p>{ending.text}</p>
            <div className="dating-ending__rollcall">
              {CHARACTER_ORDER.filter((id) => cast[id].progress > 0).map((id) => (
                <div key={id} style={{ "--route-colour": cast[id].colour } as CSSProperties}>
                  <span>{cast[id].name.charAt(0)}</span>
                  <strong>{cast[id].name}</strong>
                  <small>{cast[id].status}</small>
                </div>
              ))}
            </div>
            <button type="button" onClick={resetGame}>Play another terrible timeline</button>
          </section>
        )}
      </div>
    </main>
  );
}
