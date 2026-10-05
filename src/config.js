/* ============================================================================
   TUNING. Every number that changes how the game feels lives in this file.
   Units: milliseconds for timing, feet for distance, miles per hour for speed.
   ============================================================================ */
const CFG = {
  // Pitch flight time in ms = MPH_TO_MS / mph. 50 mph takes one second.
  MPH_TO_MS: 50000,
  // Trick pitches must travel at steady speed from this fraction of the flight onward.
  STEADY_FROM: 0.72,

  // A swing within this many ms of dead-on is a grand slam (also must be inside the home run window).
  GRAND_MS: 8,

  /* DIFFICULTY follows the streak number and nothing else, so two players on the same streak face
     the same game whoever is pitching. Each value slides from START toward a limit it never quite
     reaches; TAU is how many hits it takes to cover about two thirds of the way. */
  CURVE: {
    WIN_START: [30, 90, 135], // home run / hit / foul windows at streak 0, ± ms
    WIN_FLOOR: [11, 22, 34], // what they tighten toward
    WIN_TAU: 30,
    MPH_START: 46, // slowest fastball at streak 0
    MPH_GAIN: 52, // how much faster it can ever get
    MPH_TAU: 35,
    MPH_BAND: 6, // a pitcher's fastballs vary by this much
    MPH_MAX: 104, // never faster: the ball must stay readable
  },

  /* KNOCKOUTS. A pitcher leaves after this many home runs or one grand slam.
     He is also pulled after PULL_HITS hits, so every player keeps meeting new pitchers. */
  KO: { HOMERS: 3, PULL_HITS: 10, COINS: 20 }, // COINS x pitcher number, paid on a knockout
  MIMIC_MIN_STREAK: 20, // the final boss never enters before this streak
  MIMIC_LEVEL_HITS: 5, // he learns something new every this many hits

  /* DISTANCE. Home run feet = (BASE + mph * PER_MPH + trick * PER_TRICK + precision * PRECISION)
     x launch roll x bat. Only home runs get a distance. */
  DIST: { BASE: 340, PER_MPH: 0.9, PER_TRICK: 18, PRECISION: 35 },
  LAUNCH: { MIN: 0.9, MAX: 1.14, JACKPOT_ODDS: 0.07, JACKPOT: 1.12 }, // luck of the launch angle
  HOMER_MIN: 385, // a home run always clears the wall
  HOMER_MAX: 555, // and a regular one always lands inside the park
  // Grand slam distance = the home run distance times a multiplier that grows with the pitch:
  // a slow rookie fastball clears the wall and rattles the light tower, the final boss at full speed reaches the moon.
  GRAND: { MULT_LO: 1.45, MULT_HI: 3.8, MPH0: 48, MPH_SPAN: 48, PER_TRICK: 0.06, CURVE: 1.2 },
  BAT_MULT: 1, // store bats will raise this

  // Coins: per foot of home run, and a flat amount for a base hit.
  COIN_PER_FT: 0.06,
  COIN_PER_HIT: 2,

  /* HOME RUN STREAK. Home runs in a row (grand slams count; a foul does not break it).
     From the first tier on, a counter shows on screen, the celebration grows, and coins multiply. */
  /* Home runs in a row. The first four tiers are built out (embers, trail, strobe, fireworks, slow motion,
     golden lights); the last three inherit the top tier's effects with their own name, colour and coins
     until anyone gets near them. `fire` = fireworks per home run, `slow` = ms of slow motion on contact. */
  HR_STREAK: [
    { at: 3, name: 'HOT BAT', coins: 2, trail: 0xff8a2a },
    { at: 5, name: 'ON FIRE', coins: 3, trail: 0xff5a36, fire: 2 },
    { at: 10, name: 'UNSTOPPABLE', coins: 5, trail: 0x6aa8ff, fire: 4, slow: 260 },
    { at: 25, name: 'LEGENDARY', coins: 8, trail: 0xe7d9ff, fire: 6, slow: 380, gold: true },
    { at: 50, name: 'MYTHIC', coins: 10, trail: 0xff4df2, fire: 8, slow: 380, gold: true },
    { at: 100, name: 'IMMORTAL', coins: 15, trail: 0x7cff5a, fire: 10, slow: 380, gold: true },
    { at: 200, name: 'MOONSHOT', coins: 25, trail: 0xffffff, fire: 12, slow: 380, gold: true },
  ],

  /* STRIKES. Three strikes and the run is over. In a streak run the third strike can be bought back
     once, for CHANCE.CAPS[0] gum; after that one more strike ends it for good. Fouls are not strikes. */
  STRIKES: 3,
  /* EXTRA CHANCES. CAPS[0] is the price of the one paid chance.
     Caps are never bought; they come only from achievements and accolades (see awards.js). */
  CHANCE: { CAPS: [1, 2, 3], MODES: ['streak'] },

  /* PACE. Milliseconds of waiting. Lower = snappier. tests/pace.js measures seconds per pitch. */
  PACE: {
    FIRST_PITCH: 1100, // after PLAY BALL
    AFTER_HIT: 120, // gap before the next windup
    AFTER_HOMER: 450,
    AFTER_FOUL: 200,
    AFTER_STRIKE: 650, // how long a strike sits before the chance sheet or the next pitch
    TALK: 950, // extra hold when someone has a speech bubble up
    BLUFF: 750, // how long the pitcher's line shows before he winds up
    WINDUP: 0.9, // multiplies every pitcher's windup time
    NEW_PITCH: 1400, // new-pitch banner
    KNOCKOUT: 1300,
    PULLED: 900,
    SWAP: 1100, // one pitcher walks off, the next walks on
  },

  /* WEEKLY DIVISIONS, by best streak this week. Everyone drops back to the bottom on Monday. */
  DIVISIONS: [
    { from: 0, name: 'ROOKIE LEAGUE' },
    { from: 10, name: 'SINGLE-A' },
    { from: 20, name: 'DOUBLE-A' },
    { from: 35, name: 'TRIPLE-A' },
    { from: 50, name: 'THE MAJORS' },
    { from: 75, name: 'HALL OF FAME' },
  ],
  PERCENTILE_MIN_PLAYERS: 10, // "top X%" is only shown once this many real players are on the board

  WARMUP_PITCHES: 3, // guided pitches on first launch; they also set the tap timing

  // Tap delay compensation (ms). The game re-centres on recent swings by itself.
  OFFSET_DEFAULT: 60,
  OFFSET_MIN: -60,
  OFFSET_MAX: 140,
  // The ring meets the circle this many ms before the ball truly reaches the plate: a phone shows
  // each frame about one frame late, so the picture of the perfect moment arrives on time.
  CUE_LEAD_MS: 16,

  // Timing cue: target radius in feet at the plate, and how many target-radii out the ring starts.
  TGT_R: 0.5,
  RING_START: 8,

  DAILY_PER_PITCHER: 5, // pitches each pitcher throws in the Daily Pitch
  NINTH_PITCHES: 3, // pitches in Bottom of the 9th
  /* The 9th's story: game seven, bottom of the ninth, bases loaded, two out, down three. A grand slam
     wins it. The pitcher works at his own pace: between DRAMA_STEPS[0] and [1] bits of business
     before each pitch, each lasting its own while. */
  NINTH: { VIS: 6, HOME: 3, OUTS: 2, DRAMA_STEPS: [2, 4], INTRO_MS: 3400 },
  NINTH_LEVELS: [20, 35, 50], // how hard each of the three pitches is, as a streak number
  LEAD_MS: 55, // how long the bat takes to reach the ball after a good tap

  // TESTING: Daily and the 9th can be replayed and every attempt posts as a new row.
  TEST_REPLAY: true,
};

const MOUND = 54,
  MOUND_H = 0.75,
  ZONE_Y = 2.7,
  BALL_R = 0.3;

/* Where a ball lands, by distance. `kind` drives the landing effect. */
const HOMER_ZONES = [
  { from: 0, label: 'HOME RUN', kind: 'stands' },
  { from: 480, label: 'UPPER DECK', kind: 'upper' },
];
const GRAND_ZONES = [
  { from: 0, label: 'OFF THE LIGHTS', kind: 'lights' },
  { from: 660, label: 'SCOREBOARD', kind: 'board' },
  { from: 760, label: 'OUT OF THE PARK', kind: 'street' },
  { from: 900, label: 'PARKING LOT', kind: 'cars' },
  { from: 1150, label: 'DOWNTOWN', kind: 'city' },
  { from: 1450, label: 'OUT OF TOWN', kind: 'beyond' },
  { from: 1800, label: 'MOONSHOT', kind: 'moon' },
];

const bump = (p, k) => Math.sin(PI * Math.pow(clamp(p, 0, 1), k));
/* A smooth dip or rise in speed between `a` and `b`, zero outside. */
const hump = (u, a, b) => (u <= a || u >= b ? 0 : Math.pow(Math.sin((PI * (u - a)) / (b - a)), 2));

/* Pitch types.
   speed    fraction of the pitcher's fastball speed. At most 0.88, so even his slowest fastball
            is faster than any other pitch he throws.
   minMph / maxMph   optional limits on the pitch's speed
   bonus    how much harder than a fastball; feeds home run distance
   velocity relative speed along the flight (u = 0 at release, 1 at the plate). It is normalised,
            so only the shape matters. Must be flat from CFG.STEADY_FROM on: the last stretch is readable.
   off      sideways / vertical movement in feet, returning to zero at the plate
   trail    trail colour that tells the pitch apart
   tell     one line shown the first time a player meets the pitch */
const TYPES = {
  fast: { label: 'FASTBALL', bonus: 0, tell: '' },
  change: { label: 'CHANGEUP', bonus: 0.7, speed: 0.78, tell: 'Same windup, slower ball.' },
  curve: {
    label: 'CURVEBALL',
    bonus: 0.9,
    speed: 0.84,
    tell: 'Loops high, then drops in.',
    off: (p, s) => ({ x: s * 2.6 * bump(p, 1.6), y: 2.6 * bump(p, 1) }),
  },
  slider: {
    label: 'SLIDER',
    bonus: 0.9,
    speed: 0.87,
    tell: 'Starts wide, cuts back late.',
    off: (p, s) => ({ x: -s * 3.2 * bump(p, 2.4), y: 0 }),
  },
  eephus: {
    label: 'EEPHUS',
    bonus: 1.1,
    speed: 0.5,
    minMph: 30,
    maxMph: 44,
    tell: 'A slow rainbow. Wait for it.',
    off: (p) => ({ x: 0, y: 9 * Math.sin(PI * p) }),
  },
  knuckle: {
    label: 'KNUCKLEBALL',
    bonus: 1.5,
    speed: 0.82,
    tell: 'Wobbles on the way, steady at the end.',
    velocity: (u, r) => 1 + 0.14 * Math.sin(u * 18 + r.a) * (1 - sstep((u - 0.5) / 0.2)),
    off: (p, s, r) => ({
      x: 1.0 * Math.sin(p * 9 + r.a) * Math.sin(PI * p),
      y: 0.9 * Math.sin(p * 13 + r.b) * Math.sin(PI * p),
    }),
  },
  stutter: {
    label: 'STOP-N-GO',
    bonus: 1.5,
    speed: 0.86,
    trail: 0x5ec4c4,
    tell: 'Stalls early, then comes in steady. Teal trail.',
    velocity: (u) => 1 - 0.62 * hump(u, 0.14, 0.5),
  },
  burner: {
    label: 'AFTERBURNER',
    bonus: 1.3,
    speed: 0.78, // it finishes at about fastball speed
    trail: 0xff5a36,
    tell: 'Starts slow, kicks, then holds. Red trail.',
    velocity: (u) => lerp(0.62, 1.3, sstep((u - 0.3) / 0.3)),
  },
  brake: {
    label: 'PARACHUTE',
    bonus: 1.3,
    speed: 0.8, // it starts at about fastball speed
    trail: 0x6aa8ff,
    tell: 'Starts fast, brakes, then holds. Blue trail.',
    velocity: (u) => lerp(1.35, 0.75, sstep((u - 0.3) / 0.3)),
  },
  ghost: {
    label: 'GHOST BALL',
    bonus: 2.0,
    speed: 0.8,
    maxMph: 64, // slow enough to show, vanish and show again
    trail: 0xb38cf0,
    tell: 'Fades out mid-flight. Watch its shadow.',
  },
};

/* A ghost ball is always visible for this long after release and before the plate (ms). */
const GHOST = { SHOW_START: 300, FADE: 120, SHOW_END: 330, FADE_IN: 90 };

/* Pitchers bring style: which pitches they throw, windup tricks, and how much they talk.
   Speed and timing windows come from the streak (CFG.CURVE), never from the pitcher.
   bluff  = chance he says something about the next pitch
   honest = chance that what he says is true */
const PITCHERS = [
  {
    name: 'ROOKIE',
    bluff: 0.25,
    honest: 1,
    tag: 'Straight heat, nothing sneaky.',
    pool: { fast: 1 },
    wind: 900,
    hes: 0,
    size: 1,
    jersey: '#f2ede0',
    trim: '#2b6cb0',
    cap: '#2b6cb0',
    skin: '#f0c39a',
    look: 'plain',
    pre: ['Here it comes. I think.', 'Coach said aim for the glove.', 'Please do not hit this.'],
    hit: ['Coach? COACH?', 'That was supposed to work.'],
    melt: 'I want to go back to the minors!',
    k: ['I did it! Did you see that?'],
    heckle: ['Rookie! Your shoes are untied!', 'Does your mom know you are out this late?'],
  },
  {
    name: 'HOOKS',
    bluff: 0.22,
    honest: 0.75,
    tag: 'Curveballs that drop late.',
    pool: { fast: 4, curve: 4, change: 2 },
    wind: 950,
    hes: 0,
    size: 1.04,
    jersey: '#d8432f',
    trim: '#1b1033',
    cap: '#1b1033',
    skin: '#d9a57c',
    look: 'stache',
    pre: ['Watch it drop, kid.', 'You like rollercoasters?', 'This one bends.'],
    hit: ['That one hung.', 'Lucky swing.'],
    melt: 'My curveball! What did you do to it?',
    k: ['Sit down.', 'Fell right off the table.'],
    heckle: ['Your curve is straighter than my commute!', 'Nice mustache. Did it come with the curveball?'],
  },
  {
    name: 'SIDEWINDER',
    bluff: 0.22,
    honest: 0.6,
    tag: 'Lefty. Slings sliders from the side.',
    pool: { fast: 3, slider: 4, curve: 1, change: 2 },
    wind: 780,
    hes: 0,
    size: 0.98,
    jersey: '#19a3a3',
    trim: '#ffc83d',
    cap: '#ffc83d',
    skin: '#a9744f',
    look: 'shades',
    side: true,
    lefty: true,
    quick: 0.25,
    pre: ['You will not see where it is from.', 'Blink and it is by you.'],
    hit: ['Wind-aided.', 'I slipped.'],
    melt: 'I am calling my agent!',
    k: ['Too quick for you.'],
    heckle: ['Stand up straight, Sidewinder!', 'Take the shades off, it is dusk!'],
  },
  {
    name: 'THE PROFESSOR',
    bluff: 0.3,
    honest: 0.4,
    tag: 'Pauses mid-windup. Lobs the eephus.',
    pool: { fast: 3, eephus: 2, change: 3, curve: 2, brake: 2 },
    wind: 1100,
    hes: 0.55,
    size: 0.96,
    jersey: '#7a66b8',
    trim: '#f2ede0',
    cap: '#f2ede0',
    skin: '#e8c4a0',
    look: 'glasses',
    pre: ['Pop quiz.', 'Patience. Wait for it.', 'Today we study timing.'],
    hit: ['Statistically, that should not happen.', 'An outlier.'],
    melt: 'This was not in the syllabus!',
    k: ['Class dismissed.'],
    heckle: ['Throw it today, Professor!', 'Class dismissed, Professor!'],
  },
  {
    name: 'FLUTTER',
    bluff: 0.22,
    honest: 0.5,
    tag: 'Knuckleballs and stop-n-go.',
    pool: { knuckle: 5, stutter: 2, fast: 3, burner: 2 },
    wind: 950,
    hes: 0.2,
    size: 1,
    jersey: '#f59324',
    trim: '#2a5d34',
    cap: '#2a5d34',
    skin: '#c98d63',
    look: 'hair',
    pre: ['Even I do not know where it is going.', 'Hope you like butterflies.'],
    hit: ['It fluttered the wrong way.', 'That one had no dance in it.'],
    melt: 'The butterflies betrayed me!',
    k: ['Could not catch a butterfly.'],
    heckle: ['That knuckleball needs a flight plan!', 'Pick a direction, Flutter!'],
  },
  {
    name: 'PHANTOM',
    bluff: 0.22,
    honest: 0.45,
    tag: 'The ball disappears.',
    pool: { ghost: 5, fast: 2, slider: 2, stutter: 2, burner: 1 },
    wind: 850,
    hes: 0.2,
    size: 1.02,
    jersey: '#3a3166',
    trim: '#9ff7ff',
    cap: '#15102a',
    skin: '#cfd6e6',
    look: 'ghost',
    pre: ['Now you see it.', 'Boo.'],
    hit: ['...you could see that?', 'Impossible.'],
    melt: 'I am haunting a different sport!',
    k: ['Never saw it, did you?'],
    heckle: ['We can see right through you!', 'Boo! Wait, that is your line.'],
  },
  {
    name: 'THE CLOSER',
    bluff: 0.25,
    honest: 0.4,
    tag: 'Everything, faster.',
    pool: { fast: 3, curve: 2, slider: 2, knuckle: 2, stutter: 2, burner: 2, brake: 2, ghost: 3, eephus: 1, change: 2 },
    wind: 800,
    hes: 0.35,
    size: 1.12,
    jersey: '#17151c',
    trim: '#e5352b',
    cap: '#e5352b',
    skin: '#b57f59',
    look: 'beard',
    combo: 0.3,
    quick: 0.2,
    pre: ['Game over.', 'Nobody gets past me.'],
    hit: ['Enjoy it. Last one.', 'Hm.'],
    melt: '',
    k: ['Good night.', 'That is why they call me.'],
    heckle: ['Closer? You could not close a door!', 'Nice beard. Is it hiding the fear?'],
  },
  {
    // The final boss: a fusion of the seven. He starts with four pitches and learns the rest (MIMIC_LEARNS).
    name: 'MIMIC',
    final: true,
    bluff: 0.3,
    honest: 0.5,
    tag: 'Every pitch. Every trick. Still learning.',
    pool: { fast: 3, change: 1, curve: 1, slider: 1 },
    wind: 820,
    hes: 0.15,
    size: 1.16,
    jersey: '#17151c',
    trim: '#ffc83d',
    cap: '#2b6cb0',
    skin: '#cfc3b4',
    look: 'mimic',
    quick: 0.1,
    combo: 0,
    pre: ['I have seen all of them pitch.', 'Which one am I now?'],
    hit: ['Noted.', 'I will remember that swing.'],
    melt: '',
    k: ['I learned that one from you.', 'Seven teachers. One student.'],
    heckle: ['Pick a uniform, pal!', 'Seven jerseys and no style!'],
  },
];
/* What the final boss picks up, in order, each time he levels up. */
const MIMIC_LEARNS = [
  { say: 'Sidewinder taught me this.', add: { slider: 2 }, quick: 0.25, side: true },
  { say: 'The Professor says: wait.', add: { eephus: 1, brake: 2 }, hes: 0.4 },
  { say: 'Flutter showed me butterflies.', add: { knuckle: 2, stutter: 2 } },
  { say: 'Phantom lent me this one.', add: { ghost: 3 } },
  { say: 'The Closer never finished. I will.', add: { burner: 2 }, combo: 0.3, hes: 0.5 },
];
/* What a pitcher says before a pitch, by what he claims is coming. He may be lying. */
const BLUFFS = {
  fast: ['This one is gonna be fast!', 'Here comes the heat!', 'Fastball. Promise.'],
  slow: ['Nice and slow for you.', 'Taking something off this one.', 'Do not blink. Or do. It is slow.'],
  bend: ['Watch it bend!', 'This one moves.', 'Curving in, heads up!'],
  trick: ['You will not see this one.', 'Something special coming.', 'Try timing this.'],
};
/* Which claim is the truth for each pitch type. */
const BLUFF_TRUTH = { fast: 'fast', change: 'slow', eephus: 'slow', curve: 'bend', slider: 'bend', knuckle: 'bend', stutter: 'trick', burner: 'trick', brake: 'trick', ghost: 'trick' };
const LINES = {
  hit: [
    'Hey pitcher, that one had a family!',
    'My grandma throws harder. She is 91.',
    'Warm up the bullpen!',
    'Was that a pitch or a gift?',
    'He is throwing batting practice!',
    'I have had warmer soup than that heat!',
  ],
  homer: [
    'TUNG TUNG TUNG!',
    'Six seven! Six seven!',
    'That ball needs a passport!',
    'Souvenir! Souvenir!',
    'See ya! Write when you land!',
    'Somebody call air traffic control!',
    'It is still going!',
  ],
  grand: ['Whose car is that?', 'That one left the zip code!', 'Call the insurance company!', 'Somebody check on that ball!'],
  record: ['NEW RECORD!', 'Nobody has seen this before!', 'History! We are watching history!'],
  pulled: ['He has seen enough!', 'Get him out of there!'],
  foul: ['Straight back. He is on it!', 'Just missed it!', 'Ooh, that was close!'],
  out: ['Shake it off!', 'We still love you!', 'You will get him next time!'],
  ko: ['Hit the showers!', 'Taxi for the pitcher!', 'Next victim, please!', 'Do not forget your glove!'],
  go: ["LET'S GO!", 'ONE MORE!', 'KEEP IT ROLLING!', 'SIX! SEVEN!', 'TUNG TUNG TUNG!'],
  ninth: ['Two outs. It is all on you!', 'Bring us home!', 'One swing. That is all we need!', 'WE BELIEVE!', 'GRAND SLAM! GRAND SLAM!'],
  // what the closer says while he makes you wait
  ninthTaunt: ["Bases loaded. Don't choke.", 'Two outs. Everyone is watching you.', 'This one is for the pennant.', 'Breathe. It will not help.', 'You are not the hero here.', 'Take your time. I have all night.', 'Heard your hands are shaking.'],
  walkoff: ['WALK-OFF! WALK-OFF!', 'THEY WIN THE PENNANT!', 'STORM THE FIELD!'],
};
const lastLine = {};
function line(key, arr) {
  let i = (Math.random() * arr.length) | 0;
  if (arr.length > 1 && lastLine[key] === i) i = (i + 1) % arr.length;
  lastLine[key] = i;
  return arr[i];
}
