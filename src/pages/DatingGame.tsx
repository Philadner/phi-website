import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import "../stylesheets/DatingGame.css";

const JAY_IMAGE_URL = "https://cdn.phi.me.uk/pictures/Jay.png";
const JAY_CONFUSED_IMAGE_URL = "https://cdn.phi.me.uk/pictures/jay/jay-confused.jpg";
const AIRPORT_IMAGE_URL = "https://cdn.phi.me.uk/pictures/locations/ben-gurion-airport.png";

type CharacterId = "jay" | "phil" | "dylan" | "oscar" | "benjamin";
type Phase = "title" | "name" | "dialogue" | "morse" | "hub" | "ending";
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
  sad: "https://cdn.phi.me.uk/pictures/dylan/dylan-sad.png",
  sadBlinking: "https://cdn.phi.me.uk/pictures/dylan/dylan-sad-blinking.png",
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
  backgroundImage?: string;
  portraitImage?: string;
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
const INTRODUCTION_TITLES: Record<CharacterId, string> = {
  jay: "Jay · Scratching therapy",
  phil: "Phil · Introduction placeholder",
  dylan: "Dylan · Red light rescue",
  oscar: "Oscar · In the tree",
  benjamin: "Bibi · Ice cream interrogation",
};

const MORSE_MESSAGE = "SOS HE TAKING ME TO THE AMAZING DIGITAL CIRCUS FINAL PREMIERE";
const MORSE_UNLOCK_TEXT = "SOS HE";
const MORSE_CODE: Record<string, string> = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
};

type MorseSignalToken =
  | { kind: "pulse"; symbol: "." | "-"; duration: number }
  | { kind: "separator"; text: string; duration: number };

function makeMorseSignal(message: string): MorseSignalToken[] {
  const tokens: MorseSignalToken[] = [];

  Array.from(message).forEach((character, characterIndex) => {
    if (character === " ") {
      tokens.push({ kind: "separator", text: " / ", duration: 420 });
      return;
    }

    Array.from(MORSE_CODE[character]).forEach((symbol) => {
      tokens.push({
        kind: "pulse",
        symbol: symbol as "." | "-",
        duration: symbol === "." ? 150 : 460,
      });
    });

    if (message[characterIndex + 1] && message[characterIndex + 1] !== " ") {
      tokens.push({ kind: "separator", text: " ", duration: 230 });
    }
  });

  return tokens;
}

function nextMorseCharacterIndex(startIndex: number) {
  let nextIndex = startIndex;
  while (MORSE_MESSAGE[nextIndex] === " ") nextIndex += 1;
  return nextIndex;
}

const MORSE_SIGNAL = makeMorseSignal(MORSE_MESSAGE);

type ChoiceStats = {
  question: string;
  total: number;
  options: Record<string, { votes: number; percent: number }>;
};

async function recordDatingChoice(question: string, option: string) {
  const response = await fetch("/api/dating-choice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, option }),
  });
  const payload = (await response.json()) as ChoiceStats & { error?: string };
  if (!response.ok) throw new Error(payload.error || "Choice tally failed");
  return payload;
}

function bibiPollReaction(direction: "left" | "right", stats: ChoiceStats): Line[] {
  const leftVotes = stats.options.left?.votes ?? 0;
  const rightVotes = stats.options.right?.votes ?? 0;
  const directionVotes = leftVotes + rightVotes;
  const leftPercent = directionVotes === 0 ? 0 : Math.round((leftVotes / directionVotes) * 100);
  const rightPercent = directionVotes === 0 ? 0 : 100 - leftPercent;
  const selectedPercent = direction === "left" ? leftPercent : rightPercent;
  const otherDirection = direction === "left" ? "right" : "left";
  const selectedPeople = direction === "left" ? "lefties" : "righties";
  const response: Line[] = [];

  if (direction === "left") {
    response.push({ speaker: "Bibi", text: "ME TOO!" });
  }

  if (selectedPercent >= 90) {
    response.push({
      speaker: "Bibi",
      text: `Literally everyone who has played this has said ${direction}.`,
    });
  } else if (selectedPercent >= 75) {
    response.push({
      speaker: "Bibi",
      text: `I know, like who the hell has a ${otherDirection}-bending dick? ${selectedPercent}% of people who played have ${selectedPeople}.`,
    });
  } else if (selectedPercent >= 50) {
    response.push({
      speaker: "Bibi",
      text: `Oh really? Cool! I mean it's half and half, to be fair. ${leftPercent}% left and ${rightPercent}% right.`,
    });
  } else if (selectedPercent >= 25) {
    response.push({
      speaker: "Bibi",
      text: `Man, you're kinda in the minority here. Like, the ${selectedPeople} are under threat. Only ${selectedPercent}% of people have 'em.`,
    });
  } else {
    response.push({
      speaker: "Bibi",
      text: `Okay, you're kinda on your own here. Only ${selectedPercent}% of people have ${selectedPeople}.`,
    });
  }

  return response;
}

const INITIAL_CAST: Record<CharacterId, CharacterState> = {
  jay: {
    id: "jay",
    name: "Jay",
    description: "Heartthrob. Average guy, kinda a degenerate? But come on. He's kinda cute :3",
    colour: "#ffcf4a",
    affection: 2,
    trust: 0,
    weirdness: 0,
    jealousy: 0,
    progress: 0,
    status: "Sneaking glances at you 👀",
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
    description: "Aura farmer. Also allegedly somebody else's soulmate.",
    colour: "#9f8cff",
    affection: 0,
    trust: 0,
    weirdness: 0,
    jealousy: 0,
    progress: 0,
    status: "Scribbling something in a small orange notebook",
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
  const [metCharacters, setMetCharacters] = useState<CharacterId[]>([]);
  const [completedScenes, setCompletedScenes] = useState<string[]>([]);
  const [sceneLabel, setSceneLabel] = useState("Opening");
  const [lines, setLines] = useState<Line[]>([]);
  const [lineIndex, setLineIndex] = useState(0);
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [choices, setChoices] = useState<ChoiceButton[]>([]);
  const [ending, setEnding] = useState<Ending | null>(null);
  const [morseCharacterIndex, setMorseCharacterIndex] = useState(0);
  const [morsePulseIndex, setMorsePulseIndex] = useState(0);
  const [morseEnteredCode, setMorseEnteredCode] = useState("");
  const [morseMistake, setMorseMistake] = useState("");
  const [morseButtonPressed, setMorseButtonPressed] = useState(false);
  const [morseBlinking, setMorseBlinking] = useState(false);
  const [morseSignalTrail, setMorseSignalTrail] = useState("");
  const [morseSignalStatus, setMorseSignalStatus] = useState("WAITING FOR DYLAN");
  const [morseReplayKey, setMorseReplayKey] = useState(0);
  const afterLinesRef = useRef<() => void>(() => undefined);
  const morsePressStartedAtRef = useRef<number | null>(null);

  const activeLine = lines[lineIndex];
  const lineIsComplete = !activeLine || visibleCharacters >= activeLine.text.length;
  const scenesPlayed = completedScenes.length;
  const introductionsComplete = metCharacters.length === CHARACTER_ORDER.length;
  const morseDecodedText = MORSE_MESSAGE.slice(0, morseCharacterIndex).trimEnd();
  const morseUnlocked = morseDecodedText.startsWith(MORSE_UNLOCK_TEXT);
  const morseComplete = morseCharacterIndex >= MORSE_MESSAGE.length;

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

  useEffect(() => {
    if (phase !== "morse") return;

    let timer: number | undefined;
    let cancelled = false;
    setMorseSignalTrail("");
    setMorseSignalStatus("DYLAN IS BLINKING");
    setMorseBlinking(false);

    const runToken = (tokenIndex: number) => {
      if (cancelled) return;
      const token = MORSE_SIGNAL[tokenIndex];

      if (!token) {
        setMorseBlinking(false);
        setMorseSignalStatus("TRANSMISSION COMPLETE — REPLAY AVAILABLE");
        return;
      }

      if (token.kind === "separator") {
        setMorseSignalTrail((current) => `${current}${token.text}`);
        timer = window.setTimeout(() => runToken(tokenIndex + 1), token.duration);
        return;
      }

      setMorseSignalStatus(token.symbol === "." ? "SHORT BLINK · DOT" : "LONG BLINK · DASH");
      setMorseBlinking(true);
      timer = window.setTimeout(() => {
        if (cancelled) return;
        setMorseBlinking(false);
        setMorseSignalTrail((current) => `${current}${token.symbol}`);
        timer = window.setTimeout(() => runToken(tokenIndex + 1), 115);
      }, token.duration);
    };

    timer = window.setTimeout(() => runToken(0), 650);
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [morseReplayKey, phase]);

  const recordSilently = (question: string, option: string) => {
    void recordDatingChoice(question, option).catch((error) => {
      console.warn("Dating choice tally failed", error);
    });
  };

  const finishIntroduction = (id: CharacterId, outcome: Line[]) => {
    play(`${INTRODUCTION_TITLES[id]} · Complete`, outcome, () => {
      setMetCharacters((current) => (current.includes(id) ? current : [...current, id]));
      setPhase("hub");
    });
  };

  const startJayIntroduction = () => {
    const label = INTRODUCTION_TITLES.jay;
    play(
      label,
      [
        { text: "Jay is in Bob Scratchit's scratching therapy." },
        { text: "You walk through the door and see… uhhh." },
        { text: "Jay is lying tummy-down on a bed, with Bob Scratchit vigorously itching his butt." },
        { text: "Bob Scratchit is getting DEEP in there. Like, disturbingly committed." },
        { text: "Jay has a whip in one hand, and there's a table piled with small gold coins in front of him." },
        { text: "You stand there in silence." },
        { text: "Two agonising minutes pass. Then Jay looks at you." },
        { speaker: "Jay", text: "Oh hey! What's your name?" },
        { speaker: playerName, text: `Oh! My name is ${playerName}.` },
        { speaker: "Jay", text: "So, like, why are you in my private scratching session?" },
      ],
      () =>
        showChoices(label, { text: "Choose how to respond." }, [
          {
            label: "I'm just… confused.",
            action: () => {
              recordSilently("intro:jay:scratching", "confused");
              finishIntroduction("jay", [
                { speaker: "Jay", text: "So this is just kinda standard scratching therapy." },
                {
                  speaker: "Jay",
                  text: "But I'm a VIP customer, so I get a deluxe roleplay scratch—and I chose A Christmas Carol roleplay.",
                },
                {
                  speaker: "Jay",
                  text: "Basically, Bob Scratchit scratches me, and if it's good, I flick him a coin. He's gotta catch it to, like, feed his family.",
                },
                { speaker: "Jay", text: "And if it's a bad scratch, I whip him." },
                { speaker: playerName, text: "Ohhh, okay. Yeah, that makes total sense." },
              ]);
            },
          },
          {
            label: "I'm watching. Hard. As fuck.",
            action: () => {
              recordSilently("intro:jay:scratching", "watching");
              finishIntroduction("jay", [
                { speaker: "Jay", text: "YO, YOU ALSO HAVE A KINK FOR THIS?" },
                { speaker: "Jay", text: "OH MY GOD. OH—OH MY GOD, I AM ACTUALLY—" },
                {
                  speaker: "Jay",
                  text: "Okay, wait. Genuinely, have my fucking number. TAKE IT. TAKE IT. TAKE IT.",
                },
                {
                  speaker: playerName,
                  text: "Okay, YES. Oh my God, this is actually so hot. Like, can—",
                },
                { speaker: playerName, text: "…Can WE do this?" },
                {
                  speaker: "Jay",
                  text: "I just, like, wanna get to know you, man. I've never met a soul who finds this hot too.",
                },
                { speaker: "Jay", text: "Just—oh my God. Meet me at Arby's. PLEASE." },
              ]);
            },
          },
        ]),
    );
  };

  const startOscarIntroduction = () => {
    const label = INTRODUCTION_TITLES.oscar;
    play(
      label,
      [
        {
          text: "You walk up to a tree and look up to see what you presume is Oscar, sitting in the branches, covered by a blanket.",
        },
        { speaker: playerName, text: "Hey, what you doing?" },
        { speaker: "Oscar", text: "Hi, yeah, I'm just having a wank." },
      ],
      () =>
        showChoices(label, { text: "Choose how to respond." }, [
          {
            label: "Back away slowly",
            action: () => {
              recordSilently("intro:oscar:tree", "slowly");
              finishIntroduction("oscar", [
                { text: "You start walking backwards." },
                { speaker: "Oscar", text: "Honestly, you should try it sometime. It's so calming." },
                { speaker: "Oscar", text: "The tree wood. My wood. All in synergy." },
                { text: "Only to bump into someone." },
                { speaker: "Dylan", text: "Oh hey! Sorry, didn't see you there." },
                {
                  speaker: "Dylan",
                  text: "Anyway, I'll be off. My friend's told me to meet him in, like, a tree or something. I don't know—I think he meant under one.",
                },
                { speaker: playerName, text: "Oh, it's completely fine. Uhh, I'll be off then!" },
              ]);
            },
          },
          {
            label: "Back away quickly",
            action: () => {
              recordSilently("intro:oscar:tree", "quickly");
              finishIntroduction("oscar", [{ text: "You get the fuck out of there." }]);
            },
          },
          {
            label: "What to?",
            action: () => {
              recordSilently("intro:oscar:tree", "what-to");
              play(
                `${label} · What to?`,
                [
                  { speaker: playerName, text: "So, like, what to?" },
                  { speaker: "Oscar", text: "Okay, it's like this really niche artist on Twitter." },
                  { speaker: "Oscar", text: "Like, the way they animate these Marvel Rivals skins." },
                  { speaker: "Oscar", text: "Fucking radical." },
                ],
                () =>
                  showChoices(`${label} · Follow-up`, { text: "This information changes everything." }, [
                    {
                      label: "Write that shit down",
                      action: () => {
                        recordSilently("intro:oscar:artist", "write-it-down");
                        finishIntroduction("oscar", [
                          {
                            text: "You open your notes app and start questioning Oscar about his taste for a good ten minutes.",
                          },
                          { text: "Your eyes are opened to a whole new world in your phone." },
                        ]);
                      },
                    },
                    {
                      label: "Leave",
                      action: () => {
                        recordSilently("intro:oscar:artist", "leave");
                        finishIntroduction("oscar", [{ text: "You leave." }]);
                      },
                    },
                  ]),
              );
            },
          },
        ]),
    );
  };

  const resetMorseDecoder = () => {
    setMorseCharacterIndex(0);
    setMorsePulseIndex(0);
    setMorseEnteredCode("");
    setMorseMistake("");
    setMorseButtonPressed(false);
    morsePressStartedAtRef.current = null;
  };

  const startDylanIntroduction = () => {
    const label = INTRODUCTION_TITLES.dylan;
    const driverName = metCharacters.includes("benjamin") ? "Bibi" : "Netanyahu";

    play(
      label,
      [
        {
          text: `You walk up to a car stopped at a red light and see Dylan and ${driverName} in there.`,
          portraitImage: DYLAN_IMAGE_URLS.sad,
        },
        {
          text: `Dylan has his face smushed against the window, and ${driverName} is driving.`,
          portraitImage: DYLAN_IMAGE_URLS.sad,
        },
        { speaker: playerName, text: "Hey Dylan, are you alright?", portraitImage: DYLAN_IMAGE_URLS.sad },
        {
          text: "Dylan blinks in Morse code, and you whip out your Morse code translator from TikTok Shop to translate it.",
          portraitImage: DYLAN_IMAGE_URLS.sadBlinking,
        },
      ],
      () => {
        resetMorseDecoder();
        setMorseReplayKey((current) => current + 1);
        setPhase("morse");
      },
    );
  };

  const changeDylanIntroductionStats = (
    stats: Partial<Pick<CharacterState, "affection" | "trust" | "weirdness">>,
    status: string,
  ) => {
    setCast((current) => ({
      ...current,
      dylan: {
        ...current.dylan,
        affection: current.dylan.affection + (stats.affection ?? 0),
        trust: current.dylan.trust + (stats.trust ?? 0),
        weirdness: current.dylan.weirdness + (stats.weirdness ?? 0),
        status,
      },
    }));
  };

  const showDylanRescueChoices = () => {
    const label = INTRODUCTION_TITLES.dylan;
    showChoices(`${label} · SOS intercepted`, { text: "You have decoded enough. Dylan needs you to DO SOMETHING." }, [
      {
        label: "Open the child-locked door and save him",
        detail: "Grab Dylan and run.",
        action: () => {
          recordSilently("intro:dylan:car", "save");
          changeDylanIntroductionStats(
            { affection: 3, trust: 2 },
            "Safe from the Digital Circus finale",
          );
          finishIntroduction("dylan", [
            { text: "You open the door, grab Dylan, and run away with him." },
            { speaker: "Dylan", text: "Oh my GOD, thank you." },
            { speaker: "Dylan", text: "I did NOT wanna go to The Amazing Digital Circus final premiere." },
            { speaker: "Dylan", text: "Like, I love Bibi, but I did NOT want to go to that shit." },
          ]);
        },
      },
      {
        label: "Leave him there to accept his fate",
        detail: "The premiere waits for no man.",
        action: () => {
          recordSilently("intro:dylan:car", "leave");
          changeDylanIntroductionStats(
            { affection: -4, trust: -2 },
            "Devastated and en route to the final premiere",
          );
          finishIntroduction("dylan", [
            { text: "You stand there pulling a nice smug face as you watch his ass get driven to the premiere." },
            { text: "Dylan looks at you, devastated.", portraitImage: DYLAN_IMAGE_URLS.sad },
          ]);
        },
      },
      {
        label: "Get in the car with him",
        detail: "An exclusive, deeply regrettable route.",
        action: () => {
          recordSilently("intro:dylan:car", "join");
          changeDylanIntroductionStats(
            { weirdness: 3 },
            "Trapped at The Amazing Digital Circus final premiere",
          );
          play(
            "Dylan · Full steam ahead",
            [
              { text: "You get in the car." },
              { speaker: playerName, text: "OH MY GOD, I am so excited. I LOVE The Amazing Digital Circus!!!" },
              {
                speaker: "Dylan",
                text: "Bro, what the FUCK? You were supposed to help me. You're a fan of this shit??",
              },
              { speaker: "Bibi", text: "Full steam ahead!! I wanna see this premiere." },
            ],
            () =>
              finishIntroduction("dylan", [
                {
                  text: "EXCLUSIVE SCENE PLACEHOLDER: The Amazing Digital Circus final premiere starts here. This path is only reachable by getting into the car.",
                  effect: "location",
                },
              ]),
          );
        },
      },
    ]);
  };

  const submitMorseSymbol = (symbol: "." | "-") => {
    if (morseComplete) return;
    const currentCharacter = MORSE_MESSAGE[morseCharacterIndex];
    const expectedCode = MORSE_CODE[currentCharacter];

    if (!expectedCode || expectedCode[morsePulseIndex] !== symbol) {
      setMorseMistake("SIGNAL MISMATCH — that letter has reset. Watch Dylan and try it again.");
      setMorsePulseIndex(0);
      setMorseEnteredCode("");
      navigator.vibrate?.([45, 35, 45]);
      return;
    }

    const nextEnteredCode = `${morseEnteredCode}${symbol}`;
    setMorseMistake("");
    navigator.vibrate?.(symbol === "." ? 18 : [25, 18, 35]);

    if (morsePulseIndex + 1 === expectedCode.length) {
      setMorseCharacterIndex(nextMorseCharacterIndex(morseCharacterIndex + 1));
      setMorsePulseIndex(0);
      setMorseEnteredCode("");
      return;
    }

    setMorseEnteredCode(nextEnteredCode);
    setMorsePulseIndex((current) => current + 1);
  };

  const startMorsePress = () => {
    if (morseComplete || morsePressStartedAtRef.current !== null) return;
    morsePressStartedAtRef.current = performance.now();
    setMorseButtonPressed(true);
    setMorseMistake("");
  };

  const finishMorsePress = () => {
    const startedAt = morsePressStartedAtRef.current;
    if (startedAt === null) return;
    const duration = performance.now() - startedAt;
    morsePressStartedAtRef.current = null;
    setMorseButtonPressed(false);
    submitMorseSymbol(duration >= 340 ? "-" : ".");
  };

  const cancelMorsePress = () => {
    morsePressStartedAtRef.current = null;
    setMorseButtonPressed(false);
  };

  const chooseBibiDirection = async (direction: "left" | "right") => {
    const label = INTRODUCTION_TITLES.benjamin;
    play(`${label} · Live results`, [{ speaker: "Bibi", text: "One moment. I'm consulting the figures." }], () => undefined);

    try {
      const stats = await recordDatingChoice("intro:benjamin:direction", direction);
      finishIntroduction("benjamin", bibiPollReaction(direction, stats));
    } catch (error) {
      console.warn("Bibi poll failed", error);
      finishIntroduction("benjamin", [
        { speaker: "Bibi", text: "The national penis-direction figures are temporarily unavailable." },
        { speaker: "Bibi", text: `Your answer was ${direction}. I will remember this spiritually.` },
      ]);
    }
  };

  const startBibiIntroduction = () => {
    const label = INTRODUCTION_TITLES.benjamin;
    play(
      label,
      [
        { text: "You walk up to Benjamin Netanyahu. He's sitting on a bench, eating some ice cream." },
        { speaker: playerName, text: "Hello, Benjamin Netanyahu!" },
        {
          speaker: "Bibi",
          text: "Hello, fellow Israeli! I must implore that you do not call me Netanyahu. It is only needed of you to call me Bibi.",
        },
        { speaker: playerName, text: "Okay." },
        { speaker: "Bibi", text: "So, does your penis bend to the left or to the right?" },
      ],
      () =>
        showChoices(label, { text: "Bibi waits for an answer." }, [
          {
            label: "Left",
            detail: "Compare your answer with the live player poll.",
            action: () => {
              void chooseBibiDirection("left");
            },
          },
          {
            label: "Right",
            detail: "Compare your answer with the live player poll.",
            action: () => {
              void chooseBibiDirection("right");
            },
          },
          {
            label: "Who the fuck starts a conversation like that?",
            action: () => {
              recordSilently("intro:benjamin:direction", "rebuke");
              finishIntroduction("benjamin", [
                { speaker: "Bibi", text: "Well FUCK YOU TOO!" },
                { speaker: "Bibi", text: "It's just like a question, like I'm just asking you." },
                { speaker: "Bibi", text: "It's like a reasonable question." },
                { speaker: playerName, text: "My dick is none of your business." },
              ]);
            },
          },
        ]),
    );
  };

  const startPlaceholderIntroduction = (id: "phil") => {
    const character = cast[id];
    const flavour = "For now, imagine I arrived with suspiciously bad hot chocolate.";
    const question = `intro:${id}:placeholder`;
    const label = INTRODUCTION_TITLES[id];

    play(
      label,
      [
        { text: `PLACEHOLDER: ${character.name}'s proper introduction has not been written yet.`, effect: "location" },
        { speaker: character.name, text: flavour },
      ],
      () =>
        showChoices(label, { text: "This placeholder still counts as meeting them." }, [
          {
            label: `Meet ${character.name} (placeholder)`,
            action: () => {
              recordSilently(question, "continue");
              finishIntroduction(id, [{ text: `${character.name}'s finished introduction will replace this scene later.` }]);
            },
          },
        ]),
    );
  };

  const startIntroduction = (id: CharacterId) => {
    if (metCharacters.includes(id)) return;
    if (id === "jay") return startJayIntroduction();
    if (id === "dylan") return startDylanIntroduction();
    if (id === "oscar") return startOscarIntroduction();
    if (id === "benjamin") return startBibiIntroduction();
    return startPlaceholderIntroduction(id);
  };

  const submitName = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const chosenName = draftName.trim() || "Mystery Legend";
    setPlayerName(chosenName);
    play(
      "Arrival · Ben Gurion Airport",
      [
        {
          text: "LOCATION: Ben Gurion Airport, Tel Aviv",
          effect: "location",
          backgroundImage: AIRPORT_IMAGE_URL,
        },
        {
          text: "Welcome to Tel Aviv, Israel.",
          backgroundImage: AIRPORT_IMAGE_URL,
        },
        {
          text: "Life is exciting all of a sudden. You're in a new place, and you're getting ready for your new place at Streamer University.",
          backgroundImage: AIRPORT_IMAGE_URL,
        },
        { text: "All the doors are open.", backgroundImage: AIRPORT_IMAGE_URL },
        { text: "But your heart feels so closed.", backgroundImage: AIRPORT_IMAGE_URL },
        { text: "Right now, you need to make some friends.", backgroundImage: AIRPORT_IMAGE_URL },
        { text: "Or maybe something more.", backgroundImage: AIRPORT_IMAGE_URL },
      ],
      () => setPhase("hub"),
    );
  };

  const chooseScene = (scene: Scene, choice: StoryChoice, choiceIndex: number) => {
    const context = { playerName, cast };
    recordSilently(`route:${scene.id}`, String(choiceIndex + 1));
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
    if (!introductionsComplete) return;
    const progress = cast[id].progress;
    if (progress >= 2) return;
    const scene = SCENES[id][progress];
    const context = { playerName, cast };
    play(scene.title, scene.intro(context), () =>
      showChoices(
        scene.title,
        scene.prompt,
        scene.choices.map((choice, choiceIndex) => ({
          label: choice.label,
          detail: choice.detail,
          action: () => chooseScene(scene, choice, choiceIndex),
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
    setMetCharacters([]);
    setCompletedScenes([]);
    setSceneLabel("Opening");
    setLines([]);
    setLineIndex(0);
    setVisibleCharacters(0);
    setChoices([]);
    setEnding(null);
    resetMorseDecoder();
    setMorseSignalTrail("");
    setMorseSignalStatus("WAITING FOR DYLAN");
    setMorseBlinking(false);
  };

  const activeColour = useMemo(() => {
    const speakerMatch = activeLine?.speaker === "Bibi"
      ? "benjamin"
      : CHARACTER_ORDER.find((id) => cast[id].name === activeLine?.speaker);
    return speakerMatch ? cast[speakerMatch].colour : "#ffe66f";
  }, [activeLine?.speaker, cast]);

  const activePortraitUrl = useMemo(() => {
    if (activeLine?.portraitImage) return activeLine.portraitImage;
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
    if (activeLine?.speaker === "Benjamin Netanyahu" || activeLine?.speaker === "Bibi") {
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
            <span className="dating-game__status-light" />{" "}
            {phase === "hub"
              ? introductionsComplete
                ? "FREE ROAM"
                : "ORIENTATION"
              : phase === "morse"
                ? "MORSE INTERCEPT"
                : sceneLabel.toUpperCase()}
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
              Five mandatory introductions. Ten questionable romance encounters. One judgemental pigeon. Every answer
              joins the anonymous stats, even when everyone wishes it hadn't.
            </p>
            <button className="dating-title__start" type="button" onClick={() => setPhase("name")}>
              <span>▶</span> Start making mistakes
            </button>
            <p className="dating-title__controls">SPACE / ENTER / CLICK to advance dialogue</p>
          </section>
        )}

        {phase === "name" && (
          <section className="dating-name-card">
            <p className="dating-name-card__speaker">STREAMER UNIVERSITY</p>
            <h1>Before you land—what's your name?</h1>
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

        {phase === "morse" && (
          <section className="dating-morse">
            <div className="dating-morse__heading">
              <div>
                <p className="dating-morse__kicker">TIKTOK SHOP EMERGENCY EQUIPMENT</p>
                <h1>Translate Dylan's blinks.</h1>
              </div>
              <p>
                Tap the triangle for a dot. Hold it for a dash. Decode through <strong>SOS HE</strong> and you can
                intervene.
              </p>
            </div>

            <div className="dating-morse__workspace">
              <div className={`dating-morse__dylan ${morseBlinking ? "is-blinking" : ""}`}>
                <img
                  src={morseBlinking ? DYLAN_IMAGE_URLS.sadBlinking : DYLAN_IMAGE_URLS.sad}
                  alt={morseBlinking ? "Dylan blinking a Morse-code pulse" : "Dylan looking devastated in the car"}
                />
                <div className="dating-morse__signal-badge">
                  <span className={morseBlinking ? "is-live" : ""} />
                  {morseSignalStatus}
                </div>
                <div className="dating-morse__incoming" aria-live="polite">
                  <span>INCOMING MORSE</span>
                  <code>{morseSignalTrail || "Signal begins in a moment…"}</code>
                </div>
                <button
                  className="dating-morse__replay"
                  type="button"
                  onClick={() => setMorseReplayKey((current) => current + 1)}
                >
                  ↻ Replay Dylan's blinks
                </button>
              </div>

              <div className="dating-morse__device-shell">
                <div className="dating-morse__device">
                  <span className="dating-morse__screw dating-morse__screw--left" aria-hidden="true" />
                  <span className="dating-morse__screw dating-morse__screw--right" aria-hidden="true" />
                  <div className="dating-morse__device-title">
                    <span>MORSE</span>
                    <span>CODE</span>
                  </div>

                  <svg className="dating-morse__circuit" viewBox="0 0 300 430" aria-hidden="true">
                    <path d="M36 72H112V132H70V208H128V316H72" />
                    <path d="M264 72H188V132H230V208H172V316H228" />
                    <path d="M112 132H150V242H128" />
                    <path d="M188 132H150V242H172" />
                    <path d="M72 316H112V382H150V338H188V382H228V316" />
                    <circle cx="36" cy="72" r="12" />
                    <circle cx="70" cy="132" r="12" />
                    <circle cx="70" cy="208" r="12" />
                    <circle cx="128" cy="208" r="12" />
                    <circle cx="128" cy="316" r="12" />
                    <circle cx="264" cy="72" r="12" />
                    <circle cx="230" cy="132" r="12" />
                    <circle cx="230" cy="208" r="12" />
                    <circle cx="172" cy="208" r="12" />
                    <circle cx="172" cy="316" r="12" />
                    <rect x="61" y="304" width="22" height="24" />
                    <rect x="217" y="304" width="22" height="24" />
                    <rect x="139" y="326" width="22" height="26" />
                  </svg>

                  <div className="dating-morse__readout">
                    <span>TRANSLATION</span>
                    <strong>{morseDecodedText || "…"}</strong>
                    <small>{MORSE_MESSAGE.replace(/[A-Z]/g, "_")}</small>
                  </div>

                  <div className="dating-morse__pulse-readout">
                    <span>CURRENT LETTER</span>
                    <code>{morseEnteredCode || "READY"}</code>
                  </div>

                  <button
                    className={`dating-morse__pulse-button ${morseButtonPressed ? "is-pressed" : ""}`}
                    type="button"
                    aria-label="Morse pulse: tap for dot, hold for dash"
                    disabled={morseComplete}
                    onContextMenu={(event) => event.preventDefault()}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(event.pointerId);
                      startMorsePress();
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      finishMorsePress();
                    }}
                    onPointerCancel={cancelMorsePress}
                    onKeyDown={(event) => {
                      if (event.key !== " " && event.key !== "Enter") return;
                      event.preventDefault();
                      if (!event.repeat) startMorsePress();
                    }}
                    onKeyUp={(event) => {
                      if (event.key !== " " && event.key !== "Enter") return;
                      event.preventDefault();
                      finishMorsePress();
                    }}
                  >
                    <span aria-hidden="true">▽</span>
                  </button>

                  <div className="dating-morse__legend">
                    <span><i /> SHORT = DOT</span>
                    <span><i /> LONG = DASH</span>
                  </div>
                  <div className={`dating-morse__lights ${morseUnlocked ? "is-unlocked" : ""}`} aria-hidden="true">
                    <i /><i /><i />
                  </div>
                </div>

                <p className={`dating-morse__feedback ${morseMistake ? "is-error" : ""}`} aria-live="polite">
                  {morseMistake || (morseComplete
                    ? "FULL MESSAGE DECODED. Dylan's fate is in your hands."
                    : morseUnlocked
                      ? "SOS HE decoded. You can act now or keep translating."
                      : "Match Dylan's short and long blinks with the triangle.")}
                </p>
                <div className="dating-morse__device-actions">
                  <button type="button" onClick={resetMorseDecoder}>Clear translator</button>
                  {morseUnlocked && (
                    <button className="dating-morse__intervene" type="button" onClick={showDylanRescueChoices}>
                      DO SOMETHING →
                    </button>
                  )}
                </div>
              </div>
            </div>
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
            <div
              className={`dating-dialogue__stage ${activeLine.backgroundImage ? "dating-dialogue__stage--image" : ""}`}
              aria-hidden="true"
            >
              {activeLine.backgroundImage && (
                <img className="dating-dialogue__background" src={activeLine.backgroundImage} alt="" />
              )}
              {activeLine.effect === "heartbeat" && <div className="dating-heart">♥</div>}
              {activeLine.effect === "creepy" && <div className="dating-glitch">ERROR / FEELINGS / ERROR</div>}
              {!activeLine.effect && !activeLine.backgroundImage && <div className="dating-orbit"><span /><span /><span /></div>}
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
                <h1>{introductionsComplete ? "Who do you want to find?" : "You should probably meet everyone."}</h1>
                <p>
                  {introductionsComplete
                    ? "Routes stay open. Date one person, several people, or create a preventable group-chat disaster."
                    : "Introductions first. Meet all five people, then their romance routes unlock on this same menu."}
                </p>
              </div>
              <div className="dating-hub__counter">
                <strong>{introductionsComplete ? scenesPlayed : `${metCharacters.length}/5`}</strong>
                <span>{introductionsComplete ? "encounters complete" : "people met"}</span>
              </div>
            </div>
            <div className="dating-hub__grid">
              {CHARACTER_ORDER.map((id, index) => {
                const character = cast[id];
                const introductionComplete = metCharacters.includes(id);
                const routeComplete = character.progress >= 2;
                const cardComplete = introductionsComplete ? routeComplete : introductionComplete;
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
                    className={`dating-route-card ${cardComplete ? "dating-route-card--complete" : ""}`}
                    style={{ "--route-colour": character.colour } as CSSProperties}
                    key={id}
                    type="button"
                    onClick={() => (introductionsComplete ? startRoute(id) : startIntroduction(id))}
                    disabled={cardComplete}
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
                      <span
                        className="dating-route-card__pips"
                        aria-label={
                          introductionsComplete
                            ? `${character.progress} of 2 encounters complete`
                            : introductionComplete
                              ? "Introduction complete"
                              : "Introduction not complete"
                        }
                      >
                        {introductionsComplete ? (
                          <>
                            <i className={character.progress >= 1 ? "is-filled" : ""} />
                            <i className={character.progress >= 2 ? "is-filled" : ""} />
                          </>
                        ) : (
                          <i className={introductionComplete ? "is-filled" : ""} />
                        )}
                      </span>
                      <span>
                        {introductionsComplete
                          ? routeComplete
                            ? "ROUTE COMPLETE"
                            : SCENES[id][character.progress].title
                          : introductionComplete
                            ? "INTRODUCTION COMPLETE"
                            : INTRODUCTION_TITLES[id]}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="dating-hub__footer">
              <p>
                <span>◆</span>{" "}
                {introductionsComplete
                  ? "Feelings are tracked privately. Dialogue choices are tallied anonymously."
                  : "Meet everybody first. Phil currently uses a clearly marked placeholder."}
              </p>
              <button
                type="button"
                onClick={endNight}
                disabled={!introductionsComplete || scenesPlayed < 4}
              >
                {!introductionsComplete
                  ? `Meet ${CHARACTER_ORDER.length - metCharacters.length} more ${
                      CHARACTER_ORDER.length - metCharacters.length === 1 ? "person" : "people"
                    }`
                  : scenesPlayed < 4
                    ? `Complete ${4 - scenesPlayed} more encounter${4 - scenesPlayed === 1 ? "" : "s"}`
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
