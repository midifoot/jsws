/**
 * src/theory/ModalVoyager.js
 * Intermodal Interchange & Pivot Modulation Engine ("Harmonic Voyager").
 *
 * Implements the 9-Mode x 7-Degree Harmonic Matrix (Ionian, Dorian, Phrygian, Lydian,
 * Mixolydian, Aeolian, Locrian, Harmonic Minor, Melodic Minor) from Modal_harmo_chords.jpg,
 * supporting:
 *  1. Parallel Modal Interchange (borrowing degrees across modes in the same key center)
 *  2. Pivot-Chord Key Modulation (e.g., Dm7 = II in C Ionian pivoting as IV in A Locrian,
 *     VI in F Lydian, III in Bb Ionian, etc., shifting subsequent chords into the new key/mode)
 *  3. Constant-Structure Modal Shift (replacing a chord with another chord of the same quality
 *     family [-7, M7, 7, -7b5] from a target mode/degree, e.g. Dm7 [II Ionian] -> Fm7 [IV Locrian])
 *  4. Home-Key Gravity ("Return Home" anchor on Bar 1 and turnaround resolution on the final bar)
 */

import { chordDictionary } from './ChordDictionary.js';

export const VOYAGE_ORBITS = [
  { value: 'off',     label: 'Voyage: Off (Written)' },
  { value: 'tension', label: 'Voyage: Tension-Linked' },
  { value: 'near',    label: 'Voyage: Near Orbit (Smooth)' },
  { value: 'medium',  label: 'Voyage: Medium (Modal & Pivot)' },
  { value: 'far',     label: 'Voyage: Far (Free / Locrian)' }
];

export const VOYAGE_METHODS = [
  { value: 'hybrid',   label: 'Hybrid Blend (Parallel + Pivot + Constant)' },
  { value: 'parallel', label: 'Parallel Modal Borrowing (Same Key)' },
  { value: 'pivot',    label: 'Pivot Key Modulation (New Key/Mode)' },
  { value: 'constant', label: 'Constant Structure (Same Quality Family)' }
];

export const DEFAULT_VOYAGE_CONFIG = {
  orbit: 'off',          // 'off' | 'tension' | 'near' | 'medium' | 'far'
  method: 'hybrid',      // 'hybrid' | 'parallel' | 'pivot' | 'constant'
  returnHome: true,      // Anchor Bar 1 to Home Key & resolve on final bar
  cycleVariation: true   // Evolve modal choices across loop cycles on Main Stage
};

const ROMAN_DEGREES = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const PITCH_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PITCH_NAMES_SHARP = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Complete 9-Mode x 7-Degree Harmonic Chart (matching docs/Modal-Interchange/Modal_harmo_chords.jpg).
 * Each degree entry specifies:
 *  - degreeIdx: 0..6 (I..VII)
 *  - roman: 'I'..'VII'
 *  - semitones: offset (0..11) from the mode's tonic
 *  - family: 'M7' | '-7' | '7' | '-7b5' | '-M7' | 'M7#5' | '7b9' | 'dim'
 *  - suffix: canonical ChordDictionary quality suffix
 */
export const MODAL_HARMONY_CHART = [
  {
    id: 'ionian',
    name: 'Ionian (Major)',
    distanceTier: 1, // 1 = Near, 2 = Medium, 3 = Far
    degrees: [
      { degreeIdx: 0, roman: 'I',   semitones: 0,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 1, roman: 'II',  semitones: 2,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 2, roman: 'III', semitones: 4,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 3, roman: 'IV',  semitones: 5,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 4, roman: 'V',   semitones: 7,  family: '7',    suffix: '7' },
      { degreeIdx: 5, roman: 'VI',  semitones: 9,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 6, roman: 'VII', semitones: 11, family: '-7b5', suffix: 'm7b5' }
    ]
  },
  {
    id: 'dorian',
    name: 'Dorian',
    distanceTier: 1,
    degrees: [
      { degreeIdx: 0, roman: 'I',   semitones: 0,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 1, roman: 'II',  semitones: 2,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 2, roman: 'III', semitones: 3,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 3, roman: 'IV',  semitones: 5,  family: '7',    suffix: '7' },
      { degreeIdx: 4, roman: 'V',   semitones: 7,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 5, roman: 'VI',  semitones: 9,  family: '-7b5', suffix: 'm7b5' },
      { degreeIdx: 6, roman: 'VII', semitones: 10, family: 'M7',   suffix: 'maj7' }
    ]
  },
  {
    id: 'lydian',
    name: 'Lydian',
    distanceTier: 1,
    degrees: [
      { degreeIdx: 0, roman: 'I',   semitones: 0,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 1, roman: 'II',  semitones: 2,  family: '7',    suffix: '7' },
      { degreeIdx: 2, roman: 'III', semitones: 4,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 3, roman: 'IV',  semitones: 6,  family: '-7b5', suffix: 'm7b5' },
      { degreeIdx: 4, roman: 'V',   semitones: 7,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 5, roman: 'VI',  semitones: 9,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 6, roman: 'VII', semitones: 11, family: '-7',   suffix: 'm7' }
    ]
  },
  {
    id: 'mixolydian',
    name: 'Mixolydian',
    distanceTier: 1,
    degrees: [
      { degreeIdx: 0, roman: 'I',   semitones: 0,  family: '7',    suffix: '7' },
      { degreeIdx: 1, roman: 'II',  semitones: 2,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 2, roman: 'III', semitones: 4,  family: '-7b5', suffix: 'm7b5' },
      { degreeIdx: 3, roman: 'IV',  semitones: 5,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 4, roman: 'V',   semitones: 7,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 5, roman: 'VI',  semitones: 9,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 6, roman: 'VII', semitones: 10, family: 'M7',   suffix: 'maj7' }
    ]
  },
  {
    id: 'aeolian',
    name: 'Aeolian (Natural Minor)',
    distanceTier: 1,
    degrees: [
      { degreeIdx: 0, roman: 'I',   semitones: 0,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 1, roman: 'II',  semitones: 2,  family: '-7b5', suffix: 'm7b5' },
      { degreeIdx: 2, roman: 'III', semitones: 3,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 3, roman: 'IV',  semitones: 5,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 4, roman: 'V',   semitones: 7,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 5, roman: 'VI',  semitones: 8,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 6, roman: 'VII', semitones: 10, family: '7',    suffix: '7' }
    ]
  },
  {
    id: 'phrygian',
    name: 'Phrygian',
    distanceTier: 2,
    degrees: [
      { degreeIdx: 0, roman: 'I',   semitones: 0,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 1, roman: 'II',  semitones: 1,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 2, roman: 'III', semitones: 3,  family: '7',    suffix: '7' },
      { degreeIdx: 3, roman: 'IV',  semitones: 5,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 4, roman: 'V',   semitones: 7,  family: '-7b5', suffix: 'm7b5' },
      { degreeIdx: 5, roman: 'VI',  semitones: 8,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 6, roman: 'VII', semitones: 10, family: '-7',   suffix: 'm7' }
    ]
  },
  {
    id: 'melodic_minor',
    name: 'Melodic Minor',
    distanceTier: 2,
    degrees: [
      { degreeIdx: 0, roman: 'I',   semitones: 0,  family: '-M7',  suffix: 'mMaj7' },
      { degreeIdx: 1, roman: 'II',  semitones: 2,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 2, roman: 'III', semitones: 3,  family: 'M7#5', suffix: 'maj7#5' },
      { degreeIdx: 3, roman: 'IV',  semitones: 5,  family: '7',    suffix: '7' },
      { degreeIdx: 4, roman: 'V',   semitones: 7,  family: '7',    suffix: '7' },
      { degreeIdx: 5, roman: 'VI',  semitones: 9,  family: '-7b5', suffix: 'm7b5' },
      { degreeIdx: 6, roman: 'VII', semitones: 11, family: '-7b5', suffix: 'm7b5' }
    ]
  },
  {
    id: 'harmonic_minor',
    name: 'Harmonic Minor',
    distanceTier: 2,
    degrees: [
      { degreeIdx: 0, roman: 'I',   semitones: 0,  family: '-M7',  suffix: 'mMaj7' },
      { degreeIdx: 1, roman: 'II',  semitones: 2,  family: '-7b5', suffix: 'm7b5' },
      { degreeIdx: 2, roman: 'III', semitones: 3,  family: 'M7#5', suffix: 'maj7#5' },
      { degreeIdx: 3, roman: 'IV',  semitones: 5,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 4, roman: 'V',   semitones: 7,  family: '7b9',  suffix: '7b9' },
      { degreeIdx: 5, roman: 'VI',  semitones: 8,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 6, roman: 'VII', semitones: 11, family: 'dim',  suffix: 'dim7' }
    ]
  },
  {
    id: 'locrian',
    name: 'Locrian',
    distanceTier: 3,
    degrees: [
      { degreeIdx: 0, roman: 'I',   semitones: 0,  family: '-7b5', suffix: 'm7b5' },
      { degreeIdx: 1, roman: 'II',  semitones: 1,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 2, roman: 'III', semitones: 3,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 3, roman: 'IV',  semitones: 5,  family: '-7',   suffix: 'm7' },
      { degreeIdx: 4, roman: 'V',   semitones: 6,  family: 'M7',   suffix: 'maj7' },
      { degreeIdx: 5, roman: 'VI',  semitones: 8,  family: '7',    suffix: '7' },
      { degreeIdx: 6, roman: 'VII', semitones: 10, family: '-7',   suffix: 'm7' }
    ]
  }
];

export class ModalVoyager {
  static _seededHash(a, b = 0, c = 0) {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = ((h ^ (h >> 13)) * 1274126177) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  /**
   * Circle-of-Fifths distance between two pitch classes (0..6 steps).
   */
  static fifthsDistance(semiA, rootB) {
    const diff = (((semiA - rootB) % 12) + 12) % 12;
    const circleOrder = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
    const idx = circleOrder.indexOf(diff);
    return Math.min(idx, 12 - idx);
  }

  /**
   * Maps any parsed chord into one of the 8 canonical chart families:
   * 'M7', '-7', '7', '-7b5', '-M7', 'M7#5', '7b9', 'dim'
   */
  static classifyChordFamily(parsed) {
    if (!parsed || !parsed.valid) return 'M7';
    const q = parsed.qualityKey || '';
    const cat = parsed.definition?.category || '';

    if (q === 'mMaj7') return '-M7';
    if (q === 'maj7#5' || q === 'aug') return 'M7#5';
    if (q === 'dim' || q === 'dim7') return 'dim';
    if (q.includes('m7b5')) return '-7b5';
    if (q === '7b9' || q === '7#9' || q === '7b5' || q === '7#5') return '7b9';
    if (cat === 'Minor' || /^m(?!aj)/.test(q)) return '-7';
    if (cat === 'Dominant' || (/^(7|9|11|13)/.test(q) && !q.includes('maj'))) return '7';
    return 'M7';
  }

  /**
   * Builds a validated chord symbol from a root semitone (0..11) and chart suffix,
   * optionally enriching extensions when tension > 0.
   */
  static buildModalChordSymbol(rootSemi, suffix, preferFlats = true, tension = 0) {
    const names = preferFlats ? PITCH_NAMES_FLAT : PITCH_NAMES_SHARP;
    const rootName = names[((rootSemi % 12) + 12) % 12];

    // If high positive tension is active, allow richer extensions of the modal suffix
    const candidates = [];
    if (tension >= 2) {
      if (suffix === 'maj7') candidates.push('maj9', 'maj7#11', '6/9');
      else if (suffix === 'm7') candidates.push('m9', 'm11');
      else if (suffix === '7') candidates.push('9', '13');
    } else if (tension <= -3) {
      if (suffix === 'maj7') candidates.push('');
      else if (suffix === 'm7') candidates.push('m');
    }
    candidates.push(suffix, 'maj7', 'm7', '7');

    for (const sfx of candidates) {
      const sym = `${rootName}${sfx}`;
      const check = chordDictionary.parseChordSymbol(sym);
      if (check && check.valid) return sym;
    }
    return `${rootName}maj7`;
  }

  /**
   * Infers the Home Key tonic semitone (0..11) from the first valid chord of a progression.
   */
  static inferHomeTonicSemitone(measures) {
    if (!Array.isArray(measures)) return 0; // Default C
    for (const bar of measures) {
      if (!Array.isArray(bar)) continue;
      for (const sym of bar) {
        const parsed = chordDictionary.parseChordSymbol(sym);
        if (parsed && parsed.valid) {
          return parsed.rootSemitone;
        }
      }
    }
    return 0;
  }

  /**
   * Finds all modal interpretations (Mode + Degree + Target Tonic Key) that contain
   * a given chord quality family ('-7', 'M7', '7', '-7b5', etc.).
   *
   * Example: For Dm7 (root D = 2, family '-7'):
   *  - In Ionian II (semitones=2) -> Tonic = (2 - 2) = 0 (Key of C Ionian II)
   *  - In Locrian IV (semitones=5) -> Tonic = (2 - 5 + 12) = 9 (Key of A Locrian IV)
   *  - In Dorian I (semitones=0) -> Tonic = 2 (Key of D Dorian I)
   *  - In Lydian III (semitones=4) -> Tonic = 10 (Key of Bb Lydian III)
   */
  static findPivotInterpretations(chordRootSemi, family, homeTonicSemi = 0, maxTier = 3) {
    const pivots = [];
    const maxFifths = maxTier === 1 ? 2 : (maxTier === 2 ? 4 : 6);

    for (const mode of MODAL_HARMONY_CHART) {
      if (mode.distanceTier > maxTier) continue;
      for (const deg of mode.degrees) {
        if (deg.family === family || (family === '7b9' && deg.family === '7')) {
          const targetTonic = ((chordRootSemi - deg.semitones) % 12 + 12) % 12;
          const fifthsDist = this.fifthsDistance(homeTonicSemi, targetTonic);
          if (fifthsDist <= maxFifths) {
            pivots.push({
              mode,
              degree: deg,
              targetTonic,
              fifthsDist
            });
          }
        }
      }
    }
    return pivots;
  }

  /**
   * Core Single-Chord Modal Interchange & Modulation Transformer.
   * Returns { symbol, label, changed, newActiveTonic, newActiveMode }
   */
  static extrapolateChord({
    symbol,
    homeTonicSemi = 0,
    currentTonicSemi = 0,
    barIdx = 0,
    slotIdx = 0,
    totalBars = 4,
    isFirstSlotOfLoop = false,
    isLastSlotOfLoop = false,
    orbit = 'medium',     // 'near' | 'medium' | 'far'
    method = 'hybrid',    // 'hybrid' | 'parallel' | 'pivot' | 'constant'
    returnHome = true,
    tension = 0,
    cycleSeed = 0
  }) {
    if (!symbol || typeof symbol !== 'string') {
      return { symbol, label: '', changed: false, activeTonic: currentTonicSemi };
    }
    const clean = symbol.trim();
    if (!clean || /^(o|0|-|—|nc|n\.c\.|rest|silence|ø)$/i.test(clean)) {
      return { symbol: clean, label: '', changed: false, activeTonic: currentTonicSemi };
    }

    const parsed = chordDictionary.parseChordSymbol(clean);
    if (!parsed || !parsed.valid) {
      return { symbol: clean, label: '', changed: false, activeTonic: currentTonicSemi };
    }

    // Rule 1: Home-Key Gravity on the very first slot of Bar 1
    if (returnHome && isFirstSlotOfLoop && totalBars > 1) {
      const homeName = PITCH_NAMES_FLAT[homeTonicSemi];
      return {
        symbol: clean,
        label: `Home Key (${homeName})`,
        changed: false,
        activeTonic: homeTonicSemi
      };
    }

    const maxTier = orbit === 'near' ? 1 : (orbit === 'medium' ? 2 : 3);
    const family = this.classifyChordFamily(parsed);
    const chordRoot = parsed.rootSemitone;
    const relSemitoneToHome = ((chordRoot - homeTonicSemi) % 12 + 12) % 12;

    const rnd1 = this._seededHash(barIdx + 1, slotIdx + 1, cycleSeed + 17);
    const rnd2 = this._seededHash(barIdx + 3, slotIdx + 7, cycleSeed + 53);

    // Rule 2: Turnaround / Return-Home Gravity on the final slot of the loop
    if (returnHome && isLastSlotOfLoop && totalBars > 1) {
      // Pick a magnetic cadential return chord into homeTonicSemi:
      // V7b9 (Harmonic Minor V), bIImaj7 (Phrygian/Locrian II tritone sub), or ivm7 (Aeolian/Dorian IV)
      const cadentialChoices = [
        { semi: (homeTonicSemi + 7) % 12, suffix: maxTier >= 2 ? '7b9' : '7', tag: 'V7 → Home' },
        { semi: (homeTonicSemi + 1) % 12, suffix: 'maj7', tag: 'Phrygian II → Home' },
        { semi: (homeTonicSemi + 5) % 12, suffix: 'm7', tag: 'Aeolian IV → Home' },
        { semi: (homeTonicSemi + 10) % 12, suffix: '7', tag: 'Aeolian VII (Backdoor) → Home' }
      ];
      const pickCad = cadentialChoices[Math.floor(rnd1 * cadentialChoices.length)];
      const cadSym = this.buildModalChordSymbol(pickCad.semi, pickCad.suffix, true, tension);
      const homeName = PITCH_NAMES_FLAT[homeTonicSemi];
      return {
        symbol: cadSym,
        label: `Return to ${homeName} (${pickCad.tag})`,
        changed: cadSym !== clean,
        activeTonic: homeTonicSemi
      };
    }

    // Decide which mechanism to apply for this slot:
    // 'parallel' (Mechanism B1), 'constant' (Mechanism B2), or 'pivot' (Mechanism A)
    let activeMethod = method;
    if (method === 'hybrid') {
      if (rnd1 < 0.36) activeMethod = 'parallel';
      else if (rnd1 < 0.68) activeMethod = 'constant';
      else activeMethod = 'pivot';
    }

    const allowedModes = MODAL_HARMONY_CHART.filter((m) => m.distanceTier <= maxTier);

    // MECHANISM 1: PARALLEL MODAL INTERCHANGE (Same Key Center, Borrowed Mode Degree)
    if (activeMethod === 'parallel') {
      // Map the chord's relative position in the home key to a degree index (0..6)
      const approxDegreeMap = { 0: 0, 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6 };
      const degIdx = approxDegreeMap[relSemitoneToHome] ?? 0;

      // Collect candidate degrees across all allowed modes at this degreeIdx (or adjacent modal color)
      const candidates = [];
      for (const mode of allowedModes) {
        const d = mode.degrees[degIdx];
        if (d) {
          const candRoot = (homeTonicSemi + d.semitones) % 12;
          // Prefer candidates that actually change either root or quality from the original chord
          if (candRoot !== chordRoot || d.family !== family) {
            candidates.push({ mode, degree: d, root: candRoot });
          }
        }
      }

      if (candidates.length > 0) {
        const chosen = candidates[Math.floor(rnd2 * candidates.length)];
        const newSym = this.buildModalChordSymbol(chosen.root, chosen.degree.suffix, true, tension);
        const tonicName = PITCH_NAMES_FLAT[homeTonicSemi];
        return {
          symbol: newSym,
          label: `${tonicName} ${chosen.mode.name.split(' ')[0]} ${chosen.degree.roman}`,
          changed: newSym !== clean,
          activeTonic: homeTonicSemi
        };
      }
    }

    // MECHANISM 2: CONSTANT-STRUCTURE MODAL MODULATION (Same Chord Quality Family, New Modal Degree/Root)
    // Example: Dm7 (II in C Ionian, '-7') -> Fm7 (IV in C Locrian/Aeolian, '-7') or Ebm7 (III in C Locrian, '-7')
    if (activeMethod === 'constant') {
      const sameFamilyPool = [];
      const refTonic = currentTonicSemi ?? homeTonicSemi;

      for (const mode of allowedModes) {
        for (const deg of mode.degrees) {
          if (deg.family === family) {
            const targetRoot = (refTonic + deg.semitones) % 12;
            if (targetRoot !== chordRoot) {
              sameFamilyPool.push({ mode, degree: deg, root: targetRoot, refTonic });
            }
          }
        }
      }

      if (sameFamilyPool.length > 0) {
        const chosen = sameFamilyPool[Math.floor(rnd2 * sameFamilyPool.length)];
        const newSym = this.buildModalChordSymbol(chosen.root, chosen.degree.suffix, true, tension);
        const tonicName = PITCH_NAMES_FLAT[chosen.refTonic];
        return {
          symbol: newSym,
          label: `${tonicName} ${chosen.mode.name.split(' ')[0]} ${chosen.degree.roman} (${family})`,
          changed: newSym !== clean,
          activeTonic: chosen.refTonic
        };
      }
    }

    // MECHANISM 3: PIVOT-CHORD KEY & MODE MODULATION
    // Re-interprets the current chord as a degree in a new Key & Mode (e.g. Dm7 = IV in A Locrian),
    // and steps to a characteristic degree of that new Key & Mode!
    const pivots = this.findPivotInterpretations(chordRoot, family, homeTonicSemi, maxTier);
    if (pivots.length > 0) {
      // Prefer pivots that shift the tonic away from homeTonicSemi when possible
      const modulatingPivots = pivots.filter((p) => p.targetTonic !== homeTonicSemi);
      const pool = modulatingPivots.length > 0 ? modulatingPivots : pivots;
      const chosenPivot = pool[Math.floor(rnd1 * pool.length)];

      // Now pick a characteristic destination degree inside chosenPivot.mode in the new Key (chosenPivot.targetTonic)
      const destDegrees = chosenPivot.mode.degrees.filter(
        (d) => ((chosenPivot.targetTonic + d.semitones) % 12) !== chordRoot
      );
      const chosenDest = destDegrees.length > 0
        ? destDegrees[Math.floor(rnd2 * destDegrees.length)]
        : chosenPivot.degree;

      const newRoot = (chosenPivot.targetTonic + chosenDest.semitones) % 12;
      const newSym = this.buildModalChordSymbol(newRoot, chosenDest.suffix, true, tension);
      const newKeyName = PITCH_NAMES_FLAT[chosenPivot.targetTonic];
      const modeShort = chosenPivot.mode.name.split(' ')[0];

      return {
        symbol: newSym,
        label: `Pivot (${clean}=${newKeyName} ${modeShort} ${chosenPivot.degree.roman}) → ${chosenDest.roman}`,
        changed: newSym !== clean,
        activeTonic: chosenPivot.targetTonic
      };
    }

    return { symbol: clean, label: '', changed: false, activeTonic: currentTonicSemi };
  }

  /**
   * Transforms an entire bar's chord array using the Modal Voyager rules.
   * Returns { chords: string[], annotations: string[] }
   */
  static transformBarWithVoyage({
    barChords = ['Am7'],
    allMeasures = null,
    barIdx = 0,
    slotTension = 0,
    voyageConfig = DEFAULT_VOYAGE_CONFIG,
    cycleSeed = 0
  }) {
    if (!Array.isArray(barChords) || barChords.length === 0) {
      return { chords: ['Am7'], annotations: [''] };
    }

    const cfg = { ...DEFAULT_VOYAGE_CONFIG, ...(voyageConfig || {}) };
    let effectiveOrbit = cfg.orbit || 'off';

    // When 'tension' mode is selected, map slotTension (+1..+5) to Near / Medium / Far orbit!
    if (effectiveOrbit === 'tension') {
      if (slotTension <= 0) {
        return { chords: [...barChords], annotations: barChords.map(() => '') };
      } else if (slotTension <= 2) {
        effectiveOrbit = 'near';
      } else if (slotTension <= 4) {
        effectiveOrbit = 'medium';
      } else {
        effectiveOrbit = 'far';
      }
    }

    if (effectiveOrbit === 'off') {
      return { chords: [...barChords], annotations: barChords.map(() => '') };
    }

    const totalBars = Array.isArray(allMeasures) && allMeasures.length > 0 ? allMeasures.length : 4;
    const homeTonicSemi = this.inferHomeTonicSemitone(allMeasures || [barChords]);
    let runningTonic = homeTonicSemi;

    const outChords = [];
    const outAnnotations = [];

    for (let s = 0; s < barChords.length; s++) {
      const isFirstSlotOfLoop = (barIdx % totalBars === 0) && s === 0;
      const isLastSlotOfLoop = (barIdx % totalBars === totalBars - 1) && (s === barChords.length - 1);

      const res = this.extrapolateChord({
        symbol: barChords[s],
        homeTonicSemi,
        currentTonicSemi: runningTonic,
        barIdx,
        slotIdx: s,
        totalBars,
        isFirstSlotOfLoop,
        isLastSlotOfLoop,
        orbit: effectiveOrbit,
        method: cfg.method || 'hybrid',
        returnHome: cfg.returnHome !== false,
        tension: slotTension,
        cycleSeed: cfg.cycleVariation !== false ? cycleSeed : 0
      });

      runningTonic = res.activeTonic ?? runningTonic;
      outChords.push(res.symbol);
      outAnnotations.push(res.label || '');
    }

    return { chords: outChords, annotations: outAnnotations };
  }

  /**
   * Mutates a Chord Pattern's measures in-place (for the "VOYAGE 🧭" button inside the Chord Editor)
   * and stores modal annotations on pat.modalAnnotations[barIdx][slotIdx] so the user can see
   * the exact modal/pivot path on each chord card!
   */
  static applyVoyageToChordPattern(pat, { orbit = 'medium', method = 'hybrid', returnHome = true } = {}) {
    if (!pat || pat.type !== 'chords' || !Array.isArray(pat.measures)) return pat;

    const cycleSeed = Math.floor(Math.random() * 10000);
    const snapshotMeasures = pat.measures.map((m) => [...m]);
    const totalBars = snapshotMeasures.length;
    const homeTonicSemi = this.inferHomeTonicSemitone(snapshotMeasures);
    let runningTonic = homeTonicSemi;

    pat.modalAnnotations = [];

    for (let b = 0; b < totalBars; b++) {
      const bar = snapshotMeasures[b] || ['Cmaj7'];
      const newBar = [];
      const barNotes = [];

      for (let s = 0; s < bar.length; s++) {
        const isFirstSlotOfLoop = b === 0 && s === 0;
        const isLastSlotOfLoop = b === totalBars - 1 && s === bar.length - 1;

        const res = this.extrapolateChord({
          symbol: bar[s],
          homeTonicSemi,
          currentTonicSemi: runningTonic,
          barIdx: b,
          slotIdx: s,
          totalBars,
          isFirstSlotOfLoop,
          isLastSlotOfLoop,
          orbit,
          method,
          returnHome,
          tension: 0,
          cycleSeed: cycleSeed + b * 13 + s * 7
        });

        runningTonic = res.activeTonic ?? runningTonic;
        newBar.push(res.symbol);
        barNotes.push(res.label || '');
      }

      pat.measures[b] = newBar;
      pat.modalAnnotations.push(barNotes);
    }

    return pat;
  }
}

export default ModalVoyager;
