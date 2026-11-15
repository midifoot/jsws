/**
 * src/defaults.js - Centralized Factory Defaults & GM Catalogs for AutoBand
 * Edit this file to customize startup GM timbres, 10-slot drum mappings,
 * initial patterns, and stage snapshots.
 */

// 1. Default General MIDI SoundFont Timbres
export const DEFAULT_GM_PRESETS = {
  rhythm: { bank: 128, program: 32, name: 'Jazz Kit (32)' },
  bass:   { bank: 0,   program: 33, name: 'Fingered Bass (33)' },
  chords: { bank: 0,   program: 4,  name: 'Rhodes EP 1 (4)' }
};

// Dropdown options for Stage & Editor GM Preset Selectors
export const GM_PRESET_OPTIONS = {
  drums: [
    { value: 0,  label: 'Standard Kit (0)' },
    { value: 8,  label: 'Room Kit (8)' },
    { value: 16, label: 'Power Kit (16)' },
    { value: 24, label: '808 / Electronic (24)' },
    { value: 32, label: 'Jazz Kit (32)' },
    { value: 40, label: 'Brush Kit (40)' }
  ],
  bass: [
    { value: 33, label: 'Fingered Bass (33)' },
    { value: 34, label: 'Picked Bass (34)' },
    { value: 35, label: 'Fretless Bass (35)' },
    { value: 36, label: 'Slap Bass 1 (36)' },
    { value: 37, label: 'Slap Bass 2 (37)' },
    { value: 38, label: 'Synth Bass 1 (38)' },
    { value: 39, label: 'Synth Bass 2 (39)' }
  ],
  chords: [
    { value: 0,  label: 'Grand Piano (0)' },
    { value: 1,  label: 'Bright Piano (1)' },
    { value: 4,  label: 'Rhodes EP 1 (4)' },
    { value: 5,  label: 'DX EP 2 (5)' },
    { value: 7,  label: 'Clavinet (7)' },
    { value: 11, label: 'Vibraphone (11)' },
    { value: 89, label: 'Warm Synth Pad (89)' }
  ]
};

// 2. Default Drum Step Velocity Levels (MIDI 1-127, configurable in System Settings)
export const DEFAULT_DRUM_VELOCITIES = {
  accent: 127, // State 2: Hi / Accent hit
  normal: 90,  // State 1: Normal hit
  ghost: 25    // State 3: Ghost note hit
};

// 3. Default 10-Slot Rhythm Instrument Mapping for Drum Lab Editor
export const DEFAULT_DRUM_SLOTS = [
  { code: 'BD',     label: 'Bass Drum 1',      pitch: 36 },
  { code: 'SD',     label: 'Acoustic Snare',   pitch: 38 },
  { code: 'CH',     label: 'Closed Hi-Hat',    pitch: 42 },
  { code: 'OH',     label: 'Open Hi-Hat',      pitch: 46 },
  { code: 'LT',     label: 'Low Tom',          pitch: 45 },
  { code: 'HT',     label: 'High Tom',         pitch: 50 },
  { code: 'CYM',    label: 'Ride Cymbal 1',    pitch: 51 },
  { code: 'PERC 1', label: 'Hand Clap',        pitch: 39 },
  { code: 'PERC 2', label: 'Maracas / Shaker', pitch: 70 },
  { code: 'MISC',   label: 'Cowbell',          pitch: 56 }
];

// Full General MIDI Channel 10 Drum/Percussion Catalog for System Settings Mapper
export const GM_DRUM_CATALOG = [
  {
    group: 'Kicks',
    items: [
      { pitch: 35, label: 'Acoustic Bass Drum' },
      { pitch: 36, label: 'Bass Drum 1' }
    ]
  },
  {
    group: 'Snares, Rim & Clap',
    items: [
      { pitch: 37, label: 'Side Stick / Rim' },
      { pitch: 38, label: 'Acoustic Snare' },
      { pitch: 39, label: 'Hand Clap' },
      { pitch: 40, label: 'Electric Snare' }
    ]
  },
  {
    group: 'Hi-Hats',
    items: [
      { pitch: 42, label: 'Closed Hi-Hat' },
      { pitch: 44, label: 'Pedal Hi-Hat' },
      { pitch: 46, label: 'Open Hi-Hat' }
    ]
  },
  {
    group: 'Toms',
    items: [
      { pitch: 41, label: 'Low Floor Tom' },
      { pitch: 43, label: 'High Floor Tom' },
      { pitch: 45, label: 'Low Tom' },
      { pitch: 47, label: 'Low-Mid Tom' },
      { pitch: 48, label: 'Hi-Mid Tom' },
      { pitch: 50, label: 'High Tom' }
    ]
  },
  {
    group: 'Cymbals (Ride / Crash)',
    items: [
      { pitch: 49, label: 'Crash Cymbal 1' },
      { pitch: 51, label: 'Ride Cymbal 1' },
      { pitch: 52, label: 'Chinese Cymbal' },
      { pitch: 53, label: 'Ride Bell' },
      { pitch: 55, label: 'Splash Cymbal' },
      { pitch: 57, label: 'Crash Cymbal 2' },
      { pitch: 59, label: 'Ride Cymbal 2' }
    ]
  },
  {
    group: 'GM Percussion & Latin',
    items: [
      { pitch: 54, label: 'Tambourine' },
      { pitch: 56, label: 'Cowbell' },
      { pitch: 58, label: 'Vibra-slap' },
      { pitch: 60, label: 'High Bongo' },
      { pitch: 61, label: 'Low Bongo' },
      { pitch: 62, label: 'Mute Hi Conga' },
      { pitch: 63, label: 'Open Hi Conga' },
      { pitch: 64, label: 'Low Conga' },
      { pitch: 65, label: 'High Timbale' },
      { pitch: 66, label: 'Low Timbale' },
      { pitch: 67, label: 'High Agogo' },
      { pitch: 68, label: 'Low Agogo' },
      { pitch: 69, label: 'Cabasa' },
      { pitch: 70, label: 'Maracas / Shaker' },
      { pitch: 75, label: 'Claves' },
      { pitch: 76, label: 'Hi Wood Block' },
      { pitch: 77, label: 'Low Wood Block' },
      { pitch: 80, label: 'Mute Triangle' },
      { pitch: 81, label: 'Open Triangle' }
    ]
  }
];

// Step Resolution definitions
// - stepsPerQuarter: slots per 1/4 note (when Time Signature lower = 4)
// - stepsPerEighth:  slots per 1/8 note (when Time Signature lower = 8)
export const STEP_RESOLUTIONS = {
  '1/8':  { label: '1/8 (Eighth)',          stepsPerQuarter: 2, stepsPerEighth: 1 },
  '1/8T': { label: '1/8T (Ternary Triplet)', stepsPerQuarter: 3, stepsPerEighth: 3 },
  '1/16': { label: '1/16 (Sixteenth)',      stepsPerQuarter: 4, stepsPerEighth: 2 },
  '1/32': { label: '1/32 (Thirty-Second)',  stepsPerQuarter: 8, stepsPerEighth: 4 }
};

// Time-Signature & Polyrhythm Sync Modes (Configurable in System Settings, Default = 'independent')
export const DEFAULT_TIME_SIG_SYNC_MODE = 'independent';

export const TIME_SIG_SYNC_MODES = {
  'bar-fit': {
    id: 'bar-fit',
    title: 'Option 1 — Auto Bar-Fit (Polyrhythmic Stretch to Master Bar)',
    shortLabel: 'Auto Bar-Fit (Polyrhythm)',
    description: 'Automatically scales Bass & Chords step speed so 1 bar of their pattern matches the exact duration of 1 Master (Drum) bar.',
    example: 'Example: A 6/8 Bass pattern over a 4/4 Drum pattern plays its 6 eighth-notes evenly across the 4 drum beats (6-over-4 polyrhythm), landing together on Beat 1 of every bar.'
  },
  'independent': {
    id: 'independent',
    title: 'Option 2 (Default) — Independent Polymetric Clocks (Multi-Bar Phasing & Sequential Sync)',
    shortLabel: 'Independent Polymetric (Default)',
    description: 'Each track advances its steps and Loop Slots strictly by its own time signature, bar count, and Tempo Ratio.',
    example: 'Example: Sequential changes (4/4 → 7/8 across all tracks) stay 100% locked. Mixed meters (6/8 Bass @ 1:1 over 4/4 Drums) phase across bars and realign every 3 Drum bars (4 Bass bars), or lock with a 3:2 / 3:4 Tempo Ratio.'
  },
  'master-reset': {
    id: 'master-reset',
    title: 'Option 3 — Master Bar Hard Reset (Truncate / Cut to Master Bar)',
    shortLabel: 'Master Bar Hard Reset',
    description: 'All tracks run at their step speed, but whenever the Master (Drum) bar ends, Bass & Chords immediately reset to Step 1 of the next slot.',
    example: 'Example: A 5/4 Bass pattern over 4/4 Drums is cut after beat 4 so all instruments are forced to land together on Beat 1 of the next bar.'
  }
};

// Per-Pattern Tempo Ratio / Metric Equivalence Multipliers (Relative to Master BPM)
export const TEMPO_RATIO_OPTIONS = [
  { value: '1:1', label: '1:1 (1.0× Std Pulse)',        factor: 1.0 },
  { value: '3:2', label: '3:2 (1.5× Triplet 6/8→4/4)',  factor: 1.5 },
  { value: '3:4', label: '3:4 (0.75× Bar-Fit 6/8→4/4)', factor: 0.75 },
  { value: '4:3', label: '4:3 (1.33× Cross 4 over 3)',  factor: 4 / 3 },
  { value: '1:2', label: '1:2 (0.5× Half-Time)',        factor: 0.5 },
  { value: '2:1', label: '2:1 (2.0× Double-Time)',      factor: 2.0 },
  { value: '5:4', label: '5:4 (1.25× Quintuplet 5:4)',  factor: 1.25 },
  { value: '7:4', label: '7:4 (1.75× Septuplet 7:4)',   factor: 1.75 }
];

export function parseTempoRatio(ratioStr = '1:1') {
  const found = TEMPO_RATIO_OPTIONS.find(o => o.value === ratioStr);
  if (found) return found.factor;
  if (typeof ratioStr === 'string' && ratioStr.includes(':')) {
    const [a, b] = ratioStr.split(':').map(Number);
    if (a > 0 && b > 0) return a / b;
  }
  return 1.0;
}

/**
 * Compute the default visual amber beat-separator interval (1..9)
 * for a given time signature (upper/lower) and step resolution.
 */
export function getDefaultBeatSeparator(timeSig = '4/4', resolution = '1/16') {
  const [numStr, denStr] = (timeSig || '4/4').split('/');
  const upper = Math.max(1, Math.min(21, parseInt(numStr, 10) || 4));
  const lower = parseInt(denStr, 10) === 8 ? 8 : 4;
  const res = STEP_RESOLUTIONS[resolution] || STEP_RESOLUTIONS['1/16'];

  if (lower === 4) {
    return Math.max(1, Math.min(9, res.stepsPerQuarter)); // 2 for 1/8, 3 for 1/8T, 4 for 1/16, 8 for 1/32
  }
  // lower === 8 (e.g. 6/8, 7/8, 9/8, 12/8)
  if (upper % 3 === 0) {
    // Compound ternary meters (3/8, 6/8, 9/8, 12/8...): group by dotted-quarter (3 eighth-notes)
    return Math.max(1, Math.min(9, 3 * res.stepsPerEighth)); // 3 for 1/8, 6 for 1/16
  }
  // Odd / asymmetric /8 meters (e.g. 7/8, 5/8)
  if (resolution === '1/8') return 2;
  return Math.max(1, Math.min(9, res.stepsPerEighth)); // 2 for 1/16, 4 for 1/32
}

// 3. Default Pattern Library Generator
export function createDefaultPatterns() {
  const makeDrumGrid = (presetType = 'funk', totalSteps = 16) => {
    const grid = DEFAULT_DRUM_SLOTS.map(() => new Array(totalSteps).fill(0));
    if (presetType === 'funk') {
      [0, 6, 8, 10].forEach(s => { if (s < totalSteps) grid[0][s] = 1; }); // BD
      [4, 12].forEach(s => { if (s < totalSteps) grid[1][s] = 2; });       // SD Accent
      [7, 9, 15].forEach(s => { if (s < totalSteps) grid[1][s] = 3; });    // SD Ghost
      for (let s = 0; s < totalSteps; s += 2) grid[2][s] = 1;              // CH
      if (14 < totalSteps) grid[3][14] = 1;                                // OH
    } else if (presetType === 'odd78') {
      // 7/8 at 1/8 resolution = 7 slots per bar (grouped 2 + 2 + 3)
      [0, 2, 4].forEach(s => { if (s < totalSteps) grid[0][s] = 1; });     // BD on 1, 3, 5
      [2, 6].forEach(s => { if (s < totalSteps) grid[1][s] = 2; });        // SD Accent
      if (5 < totalSteps) grid[1][5] = 3;                                  // SD Ghost
      for (let s = 0; s < totalSteps; s++) {
        grid[2][s] = (s === 0 || s === 2 || s === 4) ? 2 : 1;              // CH pulse
      }
    } else if (presetType === 'swingTernary') {
      // 1/8T Ternary Jazz Swing (12 steps per bar: 3 steps per beat)
      [0, 6].forEach(s => { if (s < totalSteps) grid[0][s] = 1; });        // BD on Beat 1 & 3
      [3, 9].forEach(s => { if (s < totalSteps) grid[2][s] = 2; });        // Hi-Hat chick on Beat 2 & 4
      [0, 2, 3, 5, 6, 8, 9, 11].forEach(s => {
        if (s < totalSteps) grid[6][s] = (s % 3 === 0) ? 2 : 1;            // Jazz Ride pattern (spang-a-lang)
      });
      [5, 11].forEach(s => { if (s < totalSteps) grid[1][s] = 3; });       // Ghost snare on triplet let
    }
    return grid;
  };

  const makeBassSteps = (totalSteps = 16) => {
    const notes = ['A1', 'A1', 'C2', 'D2', 'E2', 'E2', 'G2', 'E2', 'D2', 'D2', 'F1', 'G1', 'A1', 'C2', 'D2', 'E2'];
    const degrees = ['R', 'R', 'b3', '4', '5', '5', 'b7', '5', 'R', 'b3', '4', '5', 'R', '5', 'b7', 'R8'];
    return Array.from({ length: totalSteps }, (_, idx) => ({
      pitch: notes[idx % notes.length],
      degree: degrees[idx % degrees.length],
      gate: idx % 4 === 0 ? 100 : (idx % 2 === 0 ? 50 : 25),
      accent: idx % 4 === 0,
      slide: idx === 7 || idx === 15,
      rest: idx === 3 || idx === 11
    }));
  };

  return [
    {
      id: 'D-01',
      type: 'drums',
      name: 'FunkBeat',
      timeSig: '4/4',
      syncMaster: true,
      bpm: 120,
      bars: 1,
      resolution: '1/16',
      beatSep: 4,
      humanize: 0,
      preset: 32,
      preview: [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1],
      rowMutes: new Array(10).fill(false),
      rowSolos: new Array(10).fill(false),
      drumGrid: makeDrumGrid('funk', 16)
    },
    {
      id: 'D-02',
      type: 'drums',
      name: 'OddPocket',
      timeSig: '7/8',
      syncMaster: true,
      bpm: 120,
      bars: 1,
      resolution: '1/8',
      beatSep: 2,
      humanize: 0,
      preset: 32,
      preview: [1, 1, 1, 1, 1, 1, 1],
      rowMutes: new Array(10).fill(false),
      rowSolos: new Array(10).fill(false),
      drumGrid: makeDrumGrid('odd78', 7)
    },
    {
      id: 'D-03',
      type: 'drums',
      name: 'JazzSwingT',
      timeSig: '4/4',
      syncMaster: true,
      bpm: 120,
      bars: 1,
      resolution: '1/8T',
      beatSep: 3,
      humanize: 0,
      preset: 32,
      preview: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
      rowMutes: new Array(10).fill(false),
      rowSolos: new Array(10).fill(false),
      drumGrid: makeDrumGrid('swingTernary', 12)
    },
    {
      id: 'B-01',
      type: 'bass',
      name: 'Walking',
      timeSig: '4/4',
      syncMaster: true,
      bpm: 120,
      bars: 1,
      resolution: '1/8T',
      beatSep: 3,
      humanize: 0,
      preset: 33,
      mode: 'follower',
      preview: [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
      bassSteps: makeBassSteps(12)
    },
    {
      id: 'B-02',
      type: 'bass',
      name: 'SlapGroove',
      timeSig: '4/4',
      syncMaster: true,
      bpm: 120,
      bars: 1,
      resolution: '1/16',
      beatSep: 4,
      humanize: 0,
      preset: 36,
      mode: 'strict',
      preview: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
      bassSteps: makeBassSteps(16)
    },
    {
      id: 'B-03',
      type: 'bass',
      name: 'SynthPulse',
      timeSig: '4/4',
      syncMaster: true,
      bpm: 120,
      bars: 1,
      resolution: '1/8',
      beatSep: 2,
      humanize: 0,
      preset: 38,
      mode: 'follower',
      preview: [1, 1, 1, 1, 1, 1, 1, 1],
      bassSteps: makeBassSteps(8)
    },
    {
      id: 'C-01',
      type: 'chords',
      name: 'Drop2',
      timeSig: '4/4',
      syncMaster: true,
      bpm: 120,
      bars: 4,
      resolution: '1/2',
      voicing: 'Jazz Drop-2',
      octave: 0,
      humanize: 0,
      preset: 4,
      preview: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      measures: [
        ['Am7', 'D7'],
        ['Gmaj7', 'Cmaj7'],
        ['F#m7b5', 'B7b9'],
        ['Em7', 'A7#5']
      ]
    },
    {
      id: 'C-02',
      type: 'chords',
      name: 'DorianVamp',
      timeSig: '4/4',
      syncMaster: true,
      bpm: 120,
      bars: 4,
      resolution: '1/1',
      voicing: 'Quartal Open',
      octave: 0,
      humanize: 0,
      preset: 4,
      preview: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      measures: [
        ['Dm7'],
        ['G7'],
        ['Dm7'],
        ['Em7']
      ]
    },
    {
      id: 'C-03',
      type: 'chords',
      name: 'NeoSoul',
      timeSig: '4/4',
      syncMaster: true,
      bpm: 120,
      bars: 4,
      resolution: '1/4',
      voicing: 'Lush Pad',
      octave: 0,
      humanize: 0,
      preset: 4,
      preview: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      measures: [
        ['Fmaj7', 'Fmaj7', 'Em7', 'A7'],
        ['Dm7', 'Dm7', 'G7', 'C7'],
        ['Fmaj7', 'Em7', 'Dm7', 'Cmaj7'],
        ['Bb7', 'Bb7', 'A7#5', 'A7']
      ]
    }
  ];
}

// 4. Default Stage Track Chains
export const DEFAULT_TRACK_SLOTS = {
  drums: [
    { patternId: 'D-03', tension: 0 },
    { patternId: 'D-01', tension: 1 },
    { patternId: 'D-02', tension: 2 },
    { patternId: 'D-03', tension: 0 }
  ],
  bass: [
    { patternId: 'B-01', tension: 0 },
    { patternId: 'B-02', tension: 1 }
  ],
  chords: [
    { patternId: 'C-01', tension: 0 },
    { patternId: 'C-02', tension: 1 },
    { patternId: 'C-03', tension: 0 }
  ]
};

// 5. Default Stage Snapshots
export function createDefaultSnapshots() {
  return {
    'Snapshot 1 (Default)': {
      tempo: 120,
      drumSlots: DEFAULT_DRUM_SLOTS.map(s => ({ ...s })),
      trackHumanize: { drums: 0, bass: 0, chords: 0 },
      tracks: {
        drums: DEFAULT_TRACK_SLOTS.drums.map(s => ({ ...s })),
        bass: DEFAULT_TRACK_SLOTS.bass.map(s => ({ ...s })),
        chords: DEFAULT_TRACK_SLOTS.chords.map(s => ({ ...s }))
      }
    },
    'Verse Groove': {
      tempo: 112,
      drumSlots: DEFAULT_DRUM_SLOTS.map(s => ({ ...s })),
      trackHumanize: { drums: 0, bass: 0, chords: 0 },
      tracks: {
        drums: [{ patternId: 'D-03', tension: 0 }, { patternId: 'D-03', tension: 0 }],
        bass: [{ patternId: 'B-01', tension: 0 }, { patternId: 'B-01', tension: 1 }],
        chords: [{ patternId: 'C-01', tension: 0 }, { patternId: 'C-02', tension: 0 }]
      }
    },
    'Chorus Lift': {
      tempo: 126,
      drumSlots: DEFAULT_DRUM_SLOTS.map((s, idx) =>
        idx === 6 ? { code: 'CYM', label: 'Crash Cymbal 1', pitch: 49 } : { ...s }
      ),
      trackHumanize: { drums: 0, bass: 0, chords: 0 },
      tracks: {
        drums: [
          { patternId: 'D-01', tension: 2 },
          { patternId: 'D-02', tension: 3 },
          { patternId: 'D-01', tension: 2 },
          { patternId: 'D-03', tension: 4 }
        ],
        bass: [
          { patternId: 'B-02', tension: 2 },
          { patternId: 'B-03', tension: 3 },
          { patternId: 'B-02', tension: 2 }
        ],
        chords: [
          { patternId: 'C-03', tension: 2 },
          { patternId: 'C-01', tension: 2 },
          { patternId: 'C-02', tension: 3 },
          { patternId: 'C-03', tension: 1 }
        ]
      }
    }
  };
}

