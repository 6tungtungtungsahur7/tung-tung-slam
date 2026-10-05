/* ============================================================================
   STATE. Everything the game remembers while running, in one place.
   ============================================================================ */

/* Where the game is. One of:
   menu, ready (between pitches), intro (new-pitch banner), taunt (pitcher talks before the pitch),
   windup, flight, lead (bat coming through), miss (ball past the bat), hit (base hit in play), foul,
   homer (home run, camera stays home), hitstop + grand (grand slam, camera follows),
   ko, swap (pitching change), cut (the final boss walks in), chance, over */
let state = 'menu';

/* Clocks. `gt` is game time in ms and stops during a hit-stop or pause. */
let gtStep = 0, // game time that passed this frame
  gt = 0,
  freeze = 0,
  nextAt = 0,
  lastT = performance.now(),
  lastP = performance.now(),
  paused = false,
  pitchVoided = false, // paused while the ball was live: that pitch is thrown out and replaced
  heartAt = 0;

/* The current run. */
let run = {
  mode: 'streak', // streak | daily | ninth | practice | challenge (a friend's code) | warmup (first launch)
  streak: 0,
  bomb: 0, // longest home run this run, ft
  revived: false,
  idx: 0, // pitches thrown
  kos: [],
  rng: Math.random,
  snap: null, // screenshot of the farthest hit, for the share card
  snapD: 0,
  feet: 0, // Bottom of the 9th total
  shots: [],
  coins: 0, // earned this run (already added to the saved total)
  tally: { homers: 0, hits: 0 }, // against the current pitcher
  bought: 0, // extra chances paid for this run
  mimicLevel: 0, // how many things the final boss has learned
  mimicHits: 0,
  grands: 0,
  hrRun: 0, // home runs in a row right now
  faced: 0, // pitches seen from the current pitcher
  rec: null, // what this run did, for the career record (see newRunRecord)
  gains: [], // Rally Caps earned this run: [{ title, caps }]
};

/* Saved on this device. */
let best = +store.get('best', 0) || 0,
  bestBomb = +store.get('bomb', 0) || 0,
  coins = +store.get('coins', 0) || 0,
  koMap = store.json('ko', {}),
  caps = +store.get('caps', 0) || 0, // Rally Caps: earned from awards only, spent on extra chances
  career = Object.assign(newCareer(), store.json('career', {})), // lifetime record: feeds achievements
  dayRec = store.json('days', { last: '', streak: 0 }), // Daily Pitch day streak
  weekRec = store.json('week', { event: '', best: 0 }), // best streak this week: sets the division
  paid = store.json('paid', {}), // accolades already paid, by key (so each pays once per day or week)
  dailyRec = store.json('daily', {}),
  ninthRec = store.json('ninth', {}),
  seen = store.json('seen', {}); // pitch types already introduced

/* The pitch in the air and what happened to it. */
let pitch = null,
  pitchCount = 0,
  wStart = 0, // windup start
  tRel = 0, // release time
  tA = 0, // arrival time at the plate
  swung = false,
  lead = null, // bat lead-in after a good tap
  hit = null, // base hit or foul in flight
  homer = null, // regular home run in flight
  pay = null, // grand slam in flight
  overInfo = null,
  lastSwing = null,
  introUntil = 0,
  tauntUntil = 0,
  cut = null, // the final boss entrance in progress
  cueFlash = false,
  koUntil = 0,
  swapT0 = 0;
const ball = { pos: V(0, 0, 0), a: 1, on: false };

/* Camera and screen effects. */
let shake = 0,
  zoom = 0,
  hype = 0, // crowd excitement 0..1
  wantSnap = false,
  slowUntil = 0, // real time until which the game runs in slow motion
  pitMood = 'idle',
  moodUntil = 0,
  ribOn = -1e9,
  camIntro = -1e9,
  cuePos = { x: 0, y: 0, r: 20 };

/* Tap delay compensation. */
let tapOff = clamp(+store.get('off', CFG.OFFSET_DEFAULT) || 0, CFG.OFFSET_MIN, CFG.OFFSET_MAX),
  offSamples = [];

/* Online: ranks, account, downloads. */
let db = null,
  user = null,
  uid = null,
  dl = null,
  boardState = 'wait',
  posting = false,
  tab = 'streak',
  holder = null;
const boards = { streak: [], bomb: [], daily: [], ninth: [], ninthPrev: [], week: [] };

/* Timing windows in force right now: [home run, hit, foul] in ± ms. */
const win = () => (pitch ? pitch.win : windowsAt(difficulty()));
const dailyBest = () => (dailyRec.day === today() ? dailyRec.streak || 0 : 0);
const ninthPlayed = () => !CFG.TEST_REPLAY && (ninthRec.event === eventId() || boards.ninth.some((r) => r.id === uid));
/* True while the ball is live: nothing may cover the middle of the screen. */
const pitchLive = () => state === 'windup' || state === 'flight' || state === 'lead' || (state === 'miss' && ball.on);
