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
//             asks for one gesture and advances once it is done.

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
  { id: 'doors', minutes: 4, ready: false },
  { id: 'squad', minutes: 3, ready: false },
  { id: 'defend', minutes: 4, ready: false },
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
