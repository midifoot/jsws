/**
 * src/engine/TensionEngine.js
 * Algorithmic Predictive Tension Follower (-5 to +5 per Main Stage Loop Slot).
 *
 * Dynamically morphs Drum density/ghost notes/turnaround fills, Bass passing tones/chromatic
 * approaches/octave pops, and Chord extensions/Tritone substitutions in real time without
 * mutating the underlying saved patterns.
 */

import { chordDictionary } from '../theory/ChordDictionary.js';
import { ModalVoyager, DEFAULT_VOYAGE_CONFIG } from '../theory/ModalVoyager.js';

export const DEFAULT_TENSION_CONFIG = {
  intensityScale: 100,          // 25% to 200% master sensitivity multiplier
  predictiveTransitions: true,  // Lookahead to next slot's tension on the final beat of a bar
  chordSubMode: 'subs'          // 'subs' (Extensions + Tritone Subs >= +3), 'extensions' (Keep Root), 'comping' (Rhythm/Vel only)
};

const PITCH_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PITCH_NAMES_SHARP = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export class TensionEngine {
  /**
   * Deterministic pseudo-random float [0, 1) from integer seeds so that within a given bar,
   * Chords Displayer UI and Audio Scheduler always agree on chord substitutions, while still
   * varying naturally across bars and steps.
   */
  static _seededHash(a, b = 0, c = 0) {
    let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
    h = ((h ^ (h >> 13)) * 1274126177) | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967296;
  }

  static _effectiveTension(rawTension = 0, config = DEFAULT_TENSION_CONFIG) {
    const t = Math.max(-5, Math.min(5, Number(rawTension) || 0));
    if (t === 0) return 0;
    const scale = Math.max(0.25, Math.min(2.0, (Number(config?.intensityScale) || 100) / 100));
    return Math.max(-5, Math.min(5, t * scale));
  }

  /**
   * 1. CHORD MODAL SUBSTITUTION & EXTENSION MATRIX
   * Transforms a single chord symbol according to the slot's Tension (-5 to +5).
   * - Tension <= -3: Strip extensions down to pure triad (e.g., Cmaj9 -> C, Dm11 -> Dm, G13 -> G)
   * - Tension -2..-1: Smooth alterations into clean 7ths (e.g., G7b9 -> G7, Cmaj7#11 -> Cmaj7)
   * - Tension 0: Exact written symbol
   * - Tension +1..+2: Upgrade triads & 7ths to lush 9ths/11ths/13ths (Cmaj7 -> Cmaj9, Am7 -> Am9, G7 -> G13)
   * - Tension +3..+5:
   *     • Dominant chords: Altered dominants (7b9, 7#9, 7#5) and Tritone Substitutions when > +3 (e.g. G7 -> Db9 / Db7#9)
   *     • Major chords: Lydian maj7#11, maj9, 6/9
   *     • Minor chords: m9, m11, mMaj7
   */
  static transformChordSymbol(
    symbol,
    rawTension = 0,
    { barIdx = 0, slotIdx = 0, slotsInBar = 1, config = DEFAULT_TENSION_CONFIG } = {}
  ) {
    if (!symbol || typeof symbol !== 'string') return symbol;
    const clean = symbol.trim();
    if (!clean || /^(o|0|-|—|nc|n\.c\.|rest|silence|ø)$/i.test(clean)) return symbol;

    const effT = this._effectiveTension(rawTension, config);
    if (Math.abs(effT) < 0.15 || config?.chordSubMode === 'comping') {
      return clean;
    }

    const parsed = chordDictionary.parseChordSymbol(clean);
    if (!parsed || !parsed.valid) return clean;

    const rootSemi = parsed.rootSemitone;
    const useFlats = clean.includes('b') || ['F', 'C'].includes(parsed.rootName);
    const noteNames = useFlats ? PITCH_NAMES_FLAT : PITCH_NAMES_SHARP;
    const getNoteName = (semi) => noteNames[((semi % 12) + 12) % 12];

    const cat = (parsed.definition && parsed.definition.category) || '';
    const qual = parsed.qualityKey || '';
    const rnd = this._seededHash(barIdx + 1, slotIdx + 1, Math.round(effT * 10));

    const tryBuild = (targetSemi, candidateQuals) => {
      const rName = getNoteName(targetSemi);
      for (const q of candidateQuals) {
        const candidate = `${rName}${q}`;
        const check = chordDictionary.parseChordSymbol(candidate);
        if (check && check.valid) return candidate;
      }
      return clean;
    };

    const isMinor = cat === 'Minor' || /^m(?!aj)/.test(qual);
    const isDom = cat === 'Dominant' || (/^(7|9|11|13)/.test(qual) && !qual.includes('maj'));
    const isDim = qual.includes('dim') || qual.includes('m7b5');
    const isMaj = !isMinor && !isDom && !isDim;

    // NEGATIVE TENSION (-1 to -5): Harmonic Simplification
    if (effT < 0) {
      if (effT <= -2.8) {
        // Deep breakdown: pure triads or open sus2/5
        if (isMinor) return tryBuild(rootSemi, ['m']);
        if (isDim) return tryBuild(rootSemi, ['dim', 'm']);
        return tryBuild(rootSemi, ['']);
      } else {
        // Mild relaxation (-1 to -2): clean 7th or triad without sharp/flat alterations
        if (isMinor) return tryBuild(rootSemi, ['m7', 'm']);
        if (isDom) return tryBuild(rootSemi, ['7']);
        if (isDim) return tryBuild(rootSemi, ['m7b5']);
        return tryBuild(rootSemi, ['maj7', '6', '']);
      }
    }

    // POSITIVE TENSION (+1 to +5): Harmonic Enrichment & Modal / Tritone Substitutions
    if (effT > 0 && effT <= 2.3) {
      // Tension +1 to +2: Rich extensions (keep root)
      if (isMinor) {
        return tryBuild(rootSemi, rnd < 0.55 ? ['m9', 'm7'] : ['m11', 'm6', 'm7']);
      }
      if (isDom) {
        return tryBuild(rootSemi, rnd < 0.5 ? ['9', '7'] : ['13', '7sus4', '9']);
      }
      if (isDim) {
        return tryBuild(rootSemi, ['m7b5', 'dim7']);
      }
      return tryBuild(rootSemi, rnd < 0.5 ? ['maj9', 'maj7'] : ['6/9', 'add9', 'maj7']);
    }

    // Tension +3 to +5: Altered Dominants, Lydian #11, and Tritone Substitutions (when > +3 / >= +3)
    const allowRootSubs = (config?.chordSubMode || 'subs') === 'subs';

    if (isDom) {
      // Above +3 (or >= +3.2), apply Tritone Substitution (root + 6 semitones) on dominant chords!
      const tritoneProb = effT >= 3.8 ? 0.82 : (effT >= 2.8 ? 0.55 : 0);
      if (allowRootSubs && rnd < tritoneProb) {
        const tritoneSemi = (rootSemi + 6) % 12;
        const subQuals = effT >= 4.2 ? ['7#9', '7b9', '9', '7#5', '7'] : ['9', '13', '7'];
        // Force flat spelling for tritone subs (e.g. G7 -> Db9)
        const flatRoot = PITCH_NAMES_FLAT[tritoneSemi];
        for (const q of subQuals) {
          const cand = `${flatRoot}${q}`;
          if (chordDictionary.parseChordSymbol(cand)?.valid) return cand;
        }
      }
      // Otherwise upgrade to Altered Dominant on original root
      const altQuals = rnd < 0.35 ? ['7b9', '7#9', '7'] : (rnd < 0.7 ? ['7#9', '7#5', '13'] : ['7b5', '7b9', '9']);
      return tryBuild(rootSemi, altQuals);
    }

    if (isMinor) {
      const minHighQuals = effT >= 4.0 && rnd < 0.45 ? ['m11', 'mMaj7', 'm9'] : ['m9', 'm11', 'm6'];
      return tryBuild(rootSemi, minHighQuals);
    }

    if (isDim) {
      return tryBuild(rootSemi, ['dim7', 'm7b5']);
    }

    // Major chord at high tension (+3 to +5): Lydian maj7#11, maj13, or 6/9
    const majHighQuals = rnd < 0.55 ? ['maj7#11', 'maj9'] : ['maj13', '6/9', 'maj9'];
    return tryBuild(rootSemi, majHighQuals);
  }

  /**
   * Transforms an entire bar's chord array using both ModalVoyager (if active) and TensionEngine,
   * returning { chords: string[], annotations: string[] }.
   */
  static transformBarMeasureWithMeta(
    barChords = ['Am7'],
    rawTension = 0,
    barIdx = 0,
    config = DEFAULT_TENSION_CONFIG,
    voyageConfig = DEFAULT_VOYAGE_CONFIG,
    allMeasures = null
  ) {
    if (!Array.isArray(barChords) || barChords.length === 0) {
      return { chords: ['Am7'], annotations: [''] };
    }

    // Step 1: Apply Modal Voyager (Parallel Modal Interchange / Pivot Modulation / Constant Structure) if active
    const totalBars = Array.isArray(allMeasures) && allMeasures.length > 0 ? allMeasures.length : 4;
    const loopCycle = Math.floor(barIdx / Math.max(1, totalBars));
    const voyageRes = ModalVoyager.transformBarWithVoyage({
      barChords,
      allMeasures,
      barIdx,
      slotTension: rawTension,
      voyageConfig,
      cycleSeed: loopCycle
    });

    const baseChords = voyageRes.chords;
    const annotations = voyageRes.annotations.slice();

    // Step 2: Apply Tension Engine harmonic extensions / tritone substitutions
    const effT = this._effectiveTension(rawTension, config);
    if (Math.abs(effT) < 0.15) {
      return { chords: baseChords, annotations };
    }

    if (effT <= -4.4 && baseChords.length > 1) {
      const firstSimp = this.transformChordSymbol(baseChords[0], rawTension, {
        barIdx,
        slotIdx: 0,
        slotsInBar: 1,
        config
      });
      return {
        chords: baseChords.map(() => firstSimp),
        annotations: baseChords.map((_, i) => annotations[i] || 'Tension -5 (Triad Sustain)')
      };
    }

    const finalChords = baseChords.map((sym, sIdx) => {
      const morphed = this.transformChordSymbol(sym, rawTension, {
        barIdx,
        slotIdx: sIdx,
        slotsInBar: baseChords.length,
        config
      });
      if (morphed !== sym && !annotations[sIdx]) {
        annotations[sIdx] = `Tension ${rawTension > 0 ? `+${rawTension}` : rawTension}`;
      }
      return morphed;
    });

    return { chords: finalChords, annotations };
  }

  /**
   * Transforms an entire bar's chord array for a given slot tension (and optional voyageConfig).
   */
  static transformBarMeasure(
    barChords = ['Am7'],
    rawTension = 0,
    barIdx = 0,
    config = DEFAULT_TENSION_CONFIG,
    voyageConfig = DEFAULT_VOYAGE_CONFIG,
    allMeasures = null
  ) {
    return this.transformBarMeasureWithMeta(
      barChords,
      rawTension,
      barIdx,
      config,
      voyageConfig,
      allMeasures
    ).chords;
  }

  /**
   * Computes chord velocity & optional rhythmic comping re-strike for a chord slot.
   */
  static getChordExecutionPlan(slotDurSec, rawTension = 0, nextTension = 0, isLastSlotOfBar = false, config = DEFAULT_TENSION_CONFIG) {
    const effT = this._effectiveTension(rawTension, config);
    const effNext = this._effectiveTension(nextTension, config);
    const deltaT = config?.predictiveTransitions !== false ? (effNext - effT) : 0;

    // Velocity scaling: 85 at 0, down to ~62 at -5, up to ~108 at +5
    const baseVel = Math.max(45, Math.min(122, Math.round(85 + effT * 4.5)));

    // At high tension (+3..+5) or when building into a higher-tension bar, split long chord slots into a rhythmic comping stab
    const strikes = [];
    if (effT >= 2.8 && slotDurSec >= 0.75) {
      // Dotted-quarter / syncopated two-hit comping (e.g. 62.5% + 37.5% of slot)
      const splitRatio = effT >= 4.0 ? 0.5 : 0.625;
      const firstDur = slotDurSec * splitRatio;
      const secondDur = slotDurSec * (1 - splitRatio);
      strikes.push({ offsetSec: 0, durationSec: firstDur * 0.94, velocity: baseVel });
      strikes.push({
        offsetSec: firstDur,
        durationSec: secondDur * 0.92,
        velocity: Math.min(125, baseVel + 6)
      });
    } else if (isLastSlotOfBar && deltaT >= 2.0 && slotDurSec >= 0.6) {
      // Predictive anticipation stab at end of bar before higher-tension slot
      const firstDur = slotDurSec * 0.75;
      const pickupDur = slotDurSec * 0.25;
      strikes.push({ offsetSec: 0, durationSec: firstDur * 0.95, velocity: baseVel });
      strikes.push({
        offsetSec: firstDur,
        durationSec: pickupDur * 0.9,
        velocity: Math.min(124, baseVel + 10)
      });
    } else {
      const gateScale = effT <= -3 ? 0.99 : 0.96;
      strikes.push({ offsetSec: 0, durationSec: slotDurSec * gateScale, velocity: baseVel });
    }

    return strikes;
  }

  /**
   * 2. DRUM TENSION & PREDICTIVE TURNAROUND ENGINE
   * Returns an array of { rowIdx, pitch, velocity, duration } hits for the current step.
   */
  static evaluateDrumStep({
    pat,
    drumSlots,
    stepIndex,
    stepInBar,
    stepsPerBar,
    barIndex = 0,
    tension = 0,
    nextTension = 0,
    getStepVelocity,
    config = DEFAULT_TENSION_CONFIG
  }) {
    const hits = [];
    if (!pat || !pat.drumGrid || !drumSlots) return hits;

    const effT = this._effectiveTension(tension, config);
    const effNext = this._effectiveTension(nextTension, config);
    const deltaT = config?.predictiveTransitions !== false ? (effNext - effT) : 0;
    const anyRowSolo = pat.rowSolos && pat.rowSolos.some(Boolean);

    const isDownbeat = stepInBar === 0;
    const halfBarStep = Math.floor(stepsPerBar / 2);
    const quarterBarStep = Math.max(1, Math.floor(stepsPerBar / 4));
    const isMainBackbeat = stepInBar === halfBarStep || (stepsPerBar >= 8 && stepInBar % (quarterBarStep * 2) === quarterBarStep);
    const isQuarterPulse = stepInBar % quarterBarStep === 0;
    const isEighthPulse = stepsPerBar >= 8 ? (stepInBar % Math.max(1, Math.floor(stepsPerBar / 8)) === 0) : true;
    const isLastBeatOfBar = stepInBar >= stepsPerBar - quarterBarStep;
    const isVeryLastStep = stepInBar === stepsPerBar - 1;

    // Predictive Drop Breath: if next slot drops tension sharply (deltaT <= -2), leave the very last off-beat step silent
    if (isVeryLastStep && !isDownbeat && deltaT <= -2.0 && effT > -2) {
      return hits;
    }

    // Velocity multiplier from tension (-30% at -5 up to +22% at +5)
    const velScale = Math.max(0.55, Math.min(1.25, 1.0 + effT * 0.05));

    drumSlots.forEach((inst, rowIdx) => {
      if (pat.rowMutes && pat.rowMutes[rowIdx]) return;
      if (anyRowSolo && (!pat.rowSolos || !pat.rowSolos[rowIdx])) return;

      let state = (pat.drumGrid[rowIdx] && pat.drumGrid[rowIdx][stepIndex]) || 0;
      const rnd = Math.random();

      if (effT < -0.15) {
        // NEGATIVE TENSION: Thin out density & ghost notes
        const dropIntensity = Math.abs(effT) / 5; // 0.0 .. 1.0

        // 1. Suppress ghost notes (state 3)
        if (state === 3 && rnd < Math.min(1.0, dropIntensity * 1.35)) {
          state = 0;
        }
        // 2. Thin auxiliary percussion (Rows 4..9: Toms, Ride, Clap, Shaker, Cowbell)
        if (state > 0 && rowIdx >= 4 && !isDownbeat && rnd < dropIntensity * 0.85) {
          state = 0;
        }
        // 3. Thin closed/open hi-hats (Rows 2, 3) on fast subdivisions
        if (state > 0 && (rowIdx === 2 || rowIdx === 3)) {
          if (!isEighthPulse && rnd < dropIntensity * 1.1) {
            state = 0;
          } else if (effT <= -3.5 && !isQuarterPulse && rnd < 0.85) {
            state = 0;
          }
        }
        // 4. Thin syncopated kicks/snares at deep breakdown (-4 to -5)
        if (state > 0 && (rowIdx === 0 || rowIdx === 1) && effT <= -3.2) {
          if (!isDownbeat && !isMainBackbeat && rnd < (dropIntensity - 0.4) * 1.4) {
            state = 0;
          }
        }
      } else if (effT > 0.15) {
        // POSITIVE TENSION: Add ghost chatter, syncopated kicks, open-hat/ride energy & turnaround fills
        const boost = effT / 5; // 0.0 .. 1.0

        // 1. Snare (Row 1): Inject ghost notes (state 3) on empty off-beat steps
        if (rowIdx === 1 && state === 0 && !isDownbeat && !isMainBackbeat) {
          const ghostProb = boost * 0.42;
          if (rnd < ghostProb) {
            state = 3;
          }
        }
        // Upgrade normal backbeat snare to Accent (state 2) at high tension
        if (rowIdx === 1 && state === 1 && isMainBackbeat && rnd < boost * 0.75) {
          state = 2;
        }

        // 2. Kick (Row 0): Add syncopated pickup before backbeat or bar end
        if (rowIdx === 0 && state === 0 && !isMainBackbeat && isLastBeatOfBar && !isVeryLastStep) {
          if (rnd < boost * 0.32) {
            state = 1;
          }
        }

        // 3. Hi-Hat / Ride / Shaker energy on off-beats
        if (rowIdx === 2 && state === 0 && !isQuarterPulse && rnd < boost * 0.35) {
          state = 3; // Ghost hat
        }
        if (rowIdx === 3 && state === 0 && isVeryLastStep && effT >= 2.2 && rnd < boost * 0.5) {
          state = 1; // Open hat bark at end of bar
        }
        if (rowIdx === 8 && state === 0 && effT >= 1.8 && !isQuarterPulse && rnd < boost * 0.38) {
          state = 3; // Subtle shaker / maracas drive
        }
      }

      // Predictive / High-Tension Turnaround Fill on the final beat of the bar
      const shouldTriggerFill =
        isLastBeatOfBar &&
        (effT >= 3.0 || (deltaT >= 1.8 && effNext >= 1.0));

      if (shouldTriggerFill) {
        const fillIntensity = Math.max(effT / 5, Math.min(1, deltaT / 4));
        const posInLastBeat = (stepInBar - (stepsPerBar - quarterBarStep)) / Math.max(1, quarterBarStep);
        // High Tom (Row 5) -> Low Tom (Row 4) -> Accented Snare (Row 1)
        if (rowIdx === 5 && posInLastBeat < 0.5 && Math.random() < fillIntensity * 0.65) {
          state = 2;
        } else if (rowIdx === 4 && posInLastBeat >= 0.5 && !isVeryLastStep && Math.random() < fillIntensity * 0.7) {
          state = 2;
        } else if (rowIdx === 1 && isVeryLastStep && Math.random() < fillIntensity * 0.8) {
          state = 2;
        }
      }

      if (state > 0) {
        let baseVel = typeof getStepVelocity === 'function' ? getStepVelocity(state) : (state === 2 ? 127 : state === 1 ? 90 : 25);
        if (state === 3 && effT > 0) {
          // Proportionally lift ghost-note audibility as tension rises
          baseVel = Math.min(82, baseVel + Math.round(effT * 6.5));
        } else {
          baseVel = Math.round(baseVel * velScale);
        }
        const finalVel = Math.max(8, Math.min(127, baseVel));
        const dur = state === 2 ? 0.19 : (state === 1 ? 0.15 : 0.12);
        hits.push({ rowIdx, pitch: inst.pitch, velocity: finalVel, duration: dur, state });
      }
    });

    return hits;
  }

  /**
   * 3. BASS TENSION & PREDICTIVE HARMONIC APPROACH ENGINE
   * Returns { play: boolean, midiPitch, velocity, durationSec } for the current bass step.
   */
  static evaluateBassStep({
    pat,
    stepObj,
    stepInBar,
    stepsPerBar,
    stepDurSec,
    tension = 0,
    nextTension = 0,
    rootMidi = 45,
    nextRootMidi = 45,
    pitchToMidi = {},
    degreeToOffset = {},
    config = DEFAULT_TENSION_CONFIG
  }) {
    if (!pat) return { play: false };

    const effT = this._effectiveTension(tension, config);
    const effNext = this._effectiveTension(nextTension, config);
    const deltaT = config?.predictiveTransitions !== false ? (effNext - effT) : 0;

    const octShift = Math.max(-4, Math.min(4, parseInt(pat.octave, 10) || 0)) * 12;
    const isStrict = pat.mode === 'strict';
    const baseStep = stepObj || { pitch: 'A1', degree: 'R', gate: 50, accent: false, slide: false, rest: true };

    const isDownbeat = stepInBar === 0;
    const halfBarStep = Math.floor(stepsPerBar / 2);
    const quarterBarStep = Math.max(1, Math.floor(stepsPerBar / 4));
    const isQuarterPulse = stepInBar % quarterBarStep === 0;
    const isEighthPulse = stepsPerBar >= 8 ? (stepInBar % Math.max(1, Math.floor(stepsPerBar / 8)) === 0) : true;
    const isLastBeatOfBar = stepInBar >= stepsPerBar - quarterBarStep;
    const isVeryLastStep = stepInBar === stepsPerBar - 1;

    // Neutral Tension (0): Play exact written step
    if (Math.abs(effT) < 0.15 && Math.abs(deltaT) < 1.5) {
      if (baseStep.rest) return { play: false };
      const rawPitch = isStrict
        ? (pitchToMidi[baseStep.pitch] ?? 33)
        : (rootMidi + (degreeToOffset[baseStep.degree] ?? 0));
      const midiPitch = Math.max(12, Math.min(108, rawPitch + octShift));
      const velocity = baseStep.accent ? 120 : 92;
      const durationSec = Math.max(0.06, stepDurSec * ((baseStep.gate || 50) / 100));
      return { play: true, midiPitch, velocity, durationSec };
    }

    let play = !baseStep.rest;
    let degree = baseStep.degree || 'R';
    let gate = baseStep.gate || 50;
    let accent = !!baseStep.accent;
    let slide = !!baseStep.slide;
    let semitoneOverride = null;

    // Predictive Drop Breath before a low-tension slot
    if (isVeryLastStep && !isDownbeat && deltaT <= -2.0 && effT > -2) {
      return { play: false };
    }

    if (effT < -0.15) {
      // NEGATIVE TENSION (-1 to -5): Simplify to Root / 5th & thin out subdivisions
      const drop = Math.abs(effT) / 5; // 0.0 .. 1.0

      if (effT <= -3.5) {
        // Deep breakdown: play only Downbeat (and optionally half-bar pulse) with warm legato gate
        if (isDownbeat) {
          play = true;
          degree = 'R';
          gate = Math.max(gate, 90);
          accent = false;
        } else if (stepInBar === halfBarStep && Math.random() < 0.45) {
          play = true;
          degree = '5';
          gate = 75;
        } else {
          play = false;
        }
      } else {
        // Mild-to-medium breakdown (-1 to -3): drop off-beat 16ths and simplify passing tones to R / 5 / -5
        if (!isEighthPulse && Math.random() < drop * 1.15) {
          play = false;
        } else if (!isQuarterPulse && effT <= -2.0 && Math.random() < drop * 0.75) {
          play = false;
        }
        if (play && !['R', '5', '-5', 'R8'].includes(degree)) {
          degree = isDownbeat ? 'R' : '5';
        }
      }
    } else if (effT > 0.15 || deltaT >= 1.8) {
      // POSITIVE TENSION (+1 to +5) or Predictive Rising Transition:
      // Awaken rest steps, inject octave pops, and add chromatic approach notes into the next chord!
      const boost = Math.max(0, effT / 5);

      // 1. Awaken silent off-beat steps for syncopated drive
      if (!play && !isDownbeat) {
        const wakeProb = isEighthPulse ? boost * 0.48 : boost * 0.32;
        if (Math.random() < wakeProb) {
          play = true;
          const activePool = effT >= 3.2
            ? ['R8', 'b7', '5', '3', 'b3', 'b5', 'R']
            : ['5', '3', 'b7', 'R8', '-5'];
          degree = activePool[Math.floor(Math.random() * activePool.length)];
          gate = degree === 'R8' ? 25 : 50;
          accent = degree === 'R8' || Math.random() < boost * 0.45;
          slide = effT >= 2.5 && Math.random() < 0.3;
        }
      }

      // 2. Octave Pop / Syncopated Accent upgrade on existing active steps at high tension (+3..+5)
      if (play && !isDownbeat && effT >= 2.8 && Math.random() < boost * 0.35) {
        if (degree === 'R' && !isQuarterPulse) {
          degree = 'R8';
          accent = true;
          gate = 25;
        } else if (Math.random() < 0.4) {
          accent = true;
        }
      }

      // 3. Predictive Chromatic / Dominant Approach on the final beat of the bar
      if (isLastBeatOfBar && (effT >= 1.5 || deltaT >= 1.5)) {
        if (isVeryLastStep || (stepInBar === stepsPerBar - 2 && Math.random() < 0.65)) {
          play = true;
          slide = true;
          accent = true;
          gate = 85;
          // Target 1 semitone below or above nextRootMidi for an authentic jazz/funk chromatic lead-in!
          if (!isStrict && nextRootMidi) {
            const halfStepBelow = nextRootMidi - 1;
            const halfStepAbove = nextRootMidi + 1;
            const fifthApproach = nextRootMidi + 7;
            const pick = Math.random();
            semitoneOverride = pick < 0.5 ? halfStepBelow : (pick < 0.8 ? halfStepAbove : fifthApproach);
          } else {
            degree = Math.random() < 0.5 ? '-7' : 'b2';
          }
        }
      }
    }

    if (!play) return { play: false };

    let rawPitch;
    if (semitoneOverride !== null && !isStrict) {
      rawPitch = semitoneOverride;
    } else if (isStrict) {
      rawPitch = (pitchToMidi[baseStep.pitch] ?? 33) + (degree === 'R8' && baseStep.degree !== 'R8' ? 12 : 0);
    } else {
      rawPitch = rootMidi + (degreeToOffset[degree] ?? 0);
    }

    const midiPitch = Math.max(12, Math.min(108, rawPitch + octShift));
    const baseVel = accent ? 120 : 92;
    const scaledVel = Math.max(40, Math.min(127, Math.round(baseVel + effT * 3.5)));
    const slideBoost = slide ? 1.15 : 1.0;
    const durationSec = Math.max(0.05, stepDurSec * ((gate || 50) / 100) * slideBoost);

    return {
      play: true,
      midiPitch,
      velocity: scaledVel,
      durationSec
    };
  }
}

export default TensionEngine;
