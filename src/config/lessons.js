// The tutorial's lessons as data (owner: gameplay): each one a round set up
// by hand to teach one thing, with its steps (session/Tutorial.js runs them,
// ui/TutorialCard.js shows them; texts in ui/flowTexts.js T.flow.tutorial and
// T.flow.lessons). A new lesson is an entry here, its steps' checks in
// session/Tutorial.js and its texts — the engine does not change.
//
//   id        key of its texts and of "done" on the device
//   minutes   about how long it takes (shown in the menu)
//   ready     false: listed as coming soon
//   scenario  the round: seed (fixed: the same set-up every time), site, team
//             (the player's side), defenders (which posts of the site's `defense`
//             layout are manned) and skip (round phases that go by on their own)
//   steps     in order. info: a card to close; phase: shown only in that
//             session phase; ready: LISTO is allowed (it is what the step asks
//             for, or the lesson is past that point). A step without `info`
//             asks for one gesture and advances once it is done: `check` names
//             the gesture (session/Tutorial.js stepDone; omitted: the step's id)

const ASSAULT = Object.freeze(['buy', 'prep', 'drone']); // straight to planning the assault

export const LESSONS = Object.freeze([
  {
    id: 'basic',
    minutes: 3,
    ready: true,
    scenario: Object.freeze({ seed: 1, site: 'B', team: 'attackers', defenders: Object.freeze([0, 2]), skip: ASSAULT }), // the anchor and the hall guard who rotates
    steps: Object.freeze([
      { id: 'welcome', info: true, phase: 'planning' },
      { id: 'plan', info: true, phase: 'planning' },
      { id: 'select', phase: 'planning' },
      { id: 'route', phase: 'planning' },
      { id: 'door', phase: 'planning' },
      { id: 'hold', phase: 'planning' },
      { id: 'look', phase: 'planning' },
      { id: 'execute', ready: true },
      { id: 'go', ready: true },
      { id: 'turnEnd', info: true, phase: 'planning', ready: true },
    ]),
  },
  {
    // Doors with the whole squad at the main door: a grenade from beside the frame, a teammate
    // who waits for the blast, a throw from where he stands. Two defenders far from it.
    id: 'doors',
    minutes: 4,
    ready: true,
    scenario: Object.freeze({ seed: 1, site: 'B', team: 'attackers', defenders: Object.freeze([0, 1]), skip: ASSAULT }),
    steps: Object.freeze([
      { id: 'doorsWelcome', info: true, phase: 'planning' },
      { id: 'doorAsk', check: 'ask', phase: 'planning' },
      { id: 'doorBeside', check: 'beside', phase: 'planning' },
      { id: 'doorWait', check: 'waitDoor', phase: 'planning' },
      { id: 'doorHere', check: 'toss', phase: 'planning' },
      { id: 'doorsExecute', check: 'execute', ready: true },
      { id: 'doorsEnd', info: true, phase: 'planning', ready: true },
    ]),
  },
  {
    // Two groups on two doors (the main one and the office's), each with its GO: a pincer.
    id: 'squad',
    minutes: 4,
    ready: true,
    scenario: Object.freeze({ seed: 1, site: 'B', team: 'attackers', defenders: Object.freeze([0, 2]), skip: ASSAULT }),
    steps: Object.freeze([
      { id: 'squadWelcome', info: true, phase: 'planning' },
      { id: 'squadFile', check: 'follow', phase: 'planning' },
      { id: 'squadGroups', check: 'groups', phase: 'planning' },
      { id: 'squadSneak', check: 'sneak', phase: 'planning' },
      { id: 'squadExecute', check: 'execute', ready: true },
      { id: 'squadGo', check: 'go', ready: true },
      { id: 'squadEnd', info: true, phase: 'planning', ready: true },
    ]),
  },
  {
    // The defender's side: the recon (barricade, cameras), then one operator placed and aimed,
    // and a turn of the assault against the attacking AI. No purchase, no drone.
    id: 'defend',
    minutes: 4,
    ready: true,
    scenario: Object.freeze({ seed: 3, site: 'B', team: 'defenders', defenders: null, skip: Object.freeze(['buy', 'drone']) }),
    steps: Object.freeze([
      { id: 'defWelcome', info: true, phase: 'prep' },
      { id: 'defBarricade', check: 'barricade', phase: 'prep' },
      { id: 'defRecon', check: 'recon', phase: 'prep', ready: true },
      { id: 'defSelect', check: 'select', phase: 'prep' },
      { id: 'defPlace', check: 'place', phase: 'prep' },
      { id: 'defWatch', check: 'watch', phase: 'prep' },
      { id: 'defReady', check: 'setupDone', ready: true },
      { id: 'defPlan', info: true, phase: 'planning', ready: true },
      { id: 'defExecute', check: 'execute', ready: true },
      { id: 'defEnd', info: true, phase: 'planning', ready: true },
    ]),
  },
  {
    // A whole round against the AI, every phase with its card: buy, entry, drone, then the assault.
    id: 'round',
    minutes: 5,
    ready: true,
    scenario: Object.freeze({ seed: 5, site: 'A', team: 'attackers', defenders: null, skip: Object.freeze([]) }),
    steps: Object.freeze([
      { id: 'roundWelcome', info: true, phase: 'buy' },
      { id: 'introBuy', info: true, phase: 'buy' },
      { id: 'introPrep', info: true, phase: 'prep', ready: true },
      { id: 'introDrone', info: true, phase: 'drone', ready: true },
      { id: 'roundPlan', info: true, phase: 'planning', ready: true },
    ]),
  },
]);

export const lessonById = (id) => LESSONS.find((l) => l.id === id) || null;

/** The next lesson to take: the first ready one not done yet (null: all done). */
export const nextLesson = (done) => LESSONS.find((l) => l.ready && !done.includes(l.id)) || null;
