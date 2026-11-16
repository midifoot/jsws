/**
 * src/engine/PatternGenerator.js
 * Algorithmic Random Pattern Generator ("Get Inspired") for Drums, Bass, and Chords.
 *
 * Respects any active Time Signature (1-21 / 4|8), Step Resolution (1/8, 1/8T, 1/16, 1/32),
 * Bar count, Muted Drum Rows (locked/protected), and Per-Bar Chord Slot Resolutions (1/1..1/4).
 */

import { chordDictionary } from '../theory/ChordDictionary.js';

export const DRUM_GEN_STYLES = [
  { value: 'funk',       label: 'Funk / Groove' },
  { value: 'jazz',       label: 'Jazz / Swing' },
  { value: 'rock',       label: 'Rock / Straight' },
  { value: 'electronic', label: 'Electronic / 808' },
  { value: 'latin',      label: 'Latin / Odd-Pocket' }
];

export const BASS_GEN_STYLES = [
  { value: 'walking',   label: 'Walking Bass' },
  { value: 'slap',      label: 'Slap / Funk' },
  { value: 'synth',     label: 'Synth / Arp' },
  { value: 'rootfifth', label: 'Root-Fifth Pocket' }
];

export const CHORD_GEN_STYLES = [
  { value: 'jazz',  label: 'Jazz ii-V-I & Turnarounds' },
  { value: 'pop',   label: 'Pop / Neo-Soul Changes' },
  { value: 'modal', label: 'Modal Vamp (Dorian/Lydian)' },
  { value: 'blues', label: 'Blues / Gospel Changes' }
];

export const CHORD_GEN_KEYS = [
  { value: 'auto', label: 'Auto / Any Key' },
  { value: 'C',    label: 'Key of C' },
  { value: 'Db',   label: 'Key of Db' },
  { value: 'D',    label: 'Key of D' },
  { value: 'Eb',   label: 'Key of Eb' },
  { value: 'E',    label: 'Key of E' },
  { value: 'F',    label: 'Key of F' },
  { value: 'F#',   label: 'Key of F#' },
  { value: 'G',    label: 'Key of G' },
  { value: 'Ab',   label: 'Key of Ab' },
  { value: 'A',    label: 'Key of A' },
  { value: 'Bb',   label: 'Key of Bb' },
  { value: 'B',    label: 'Key of B' }
];

const PITCH_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const PITCH_NAMES_SHARP = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const DEGREE_TO_SEMITONES = {
  '-5': -5, '-b6': -4, '-6': -3, '-b7': -2, '-7': -1,
  R: 0, b2: 1, '2': 2, b3: 3, '3': 4, '4': 5, b5: 6, '5': 7, b6: 8, '6': 9, b7: 10, '7': 11, R8: 12
};

const STRICT_BASS_PITCHES = [
  'C1', 'C#1', 'D1', 'Eb1', 'E1', 'F1', 'F#1', 'G1', 'Ab1', 'A1', 'Bb1', 'B1',
  'C2', 'C#2', 'D2', 'Eb2', 'E2', 'F2', 'F#2', 'G2', 'Ab2', 'A2', 'Bb2', 'B2',
  'C3', 'C#3', 'D3', 'Eb3', 'E3', 'F3', 'F#3', 'G3'
];

export class PatternGenerator {
  static _pick(arr) {
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  static _chance(prob) {
    return Math.random() < prob;
  }

  static parseTimeSig(timeSig = '4/4') {
    const parts = String(timeSig || '4/4').split('/');
    const upper = Math.max(1, Math.min(21, parseInt(parts[0], 10) || 4));
    const lower = parseInt(parts[1], 10) === 8 ? 8 : 4;
    return { upper, lower };
  }

  static getStepsPerUnit(timeSig = '4/4', resolution = '1/16') {
    const { lower } = this.parseTimeSig(timeSig);
    const map = {
      '1/8':  { q: 2, e: 1 },
      '1/8T': { q: 3, e: 3 },
      '1/16': { q: 4, e: 2 },
      '1/32': { q: 8, e: 4 }
    };
    const res = map[resolution] || map['1/16'];
    return lower === 8 ? res.e : res.q;
  }

  static getStepsPerBar(timeSig = '4/4', resolution = '1/16') {
    const { upper } = this.parseTimeSig(timeSig);
    return upper * this.getStepsPerUnit(timeSig, resolution);
  }

  /**
   * Builds a metric weight & pulse profile for 1 bar of any (timeSig, resolution).
   * Handles standard /4 meters (4/4, 3/4, 5/4, 7/4) and compound/odd /8 meters (5/8, 6/8, 7/8, 9/8, 12/8).
   */
  static buildBarMetricProfile(timeSig = '4/4', resolution = '1/16', randomness = 35) {
    const { upper, lower } = this.parseTimeSig(timeSig);
    const stepsPerUnit = this.getStepsPerUnit(timeSig, resolution);
    const stepsPerBar = upper * stepsPerUnit;

    const downbeatStep = 0;
    const pulseUnits = [];      // Unit indices (0..upper-1) that start a main rhythmic group
    const backbeatUnits = [];   // Unit indices that act as snare/backbeat anchors

    if (lower === 8) {
      // Decompose /8 meters into natural 2- and 3-eighth groupings
      if (upper === 5) {
        const group32 = randomness < 50 || this._chance(0.6);
        pulseUnits.push(0, group32 ? 3 : 2);
        backbeatUnits.push(group32 ? 3 : 2);
      } else if (upper === 6) {
        pulseUnits.push(0, 3);
        backbeatUnits.push(3);
      } else if (upper === 7) {
        // 2+2+3 (0, 2, 4) or 3+2+2 (0, 3, 5)
        const group223 = randomness < 45 || this._chance(0.55);
        if (group223) {
          pulseUnits.push(0, 2, 4);
          backbeatUnits.push(2, 4);
        } else {
          pulseUnits.push(0, 3, 5);
          backbeatUnits.push(3, 5);
        }
      } else if (upper === 9) {
        pulseUnits.push(0, 3, 6);
        backbeatUnits.push(3, 6);
      } else if (upper === 12) {
        pulseUnits.push(0, 3, 6, 9);
        backbeatUnits.push(3, 9);
      } else {
        // Generic /8 decomposition into groups of 3 then 2
        let u = 0;
        let idx = 0;
        while (u < upper) {
          pulseUnits.push(u);
          if (idx % 2 === 1) backbeatUnits.push(u);
          u += (upper - u === 4 || upper - u === 2) ? 2 : 3;
          idx++;
        }
      }
    } else {
      // /4 meters: every quarter-note unit is a beat
      for (let u = 0; u < upper; u++) {
        pulseUnits.push(u);
      }
      if (upper === 1) {
        backbeatUnits.push(0);
      } else if (upper === 2) {
        backbeatUnits.push(1);
      } else if (upper === 3) {
        backbeatUnits.push(2);
      } else if (upper === 4) {
        backbeatUnits.push(1, 3);
      } else if (upper === 5) {
        backbeatUnits.push(1, 3);
      } else if (upper === 7) {
        backbeatUnits.push(1, 3, 5);
      } else {
        for (let u = 1; u < upper; u += 2) {
          backbeatUnits.push(u);
        }
      }
    }

    const pulseSteps = new Set(pulseUnits.map((u) => u * stepsPerUnit));
    const backbeatSteps = new Set(backbeatUnits.map((u) => u * stepsPerUnit));
    const unitStartSteps = new Set();
    for (let u = 0; u < upper; u++) {
      unitStartSteps.add(u * stepsPerUnit);
    }

    return {
      upper,
      lower,
      stepsPerUnit,
      stepsPerBar,
      downbeatStep,
      pulseSteps,
      backbeatSteps,
      unitStartSteps
    };
  }

  /**
   * 1. DRUM PATTERN GENERATOR
   * Generates a 10-row drum matrix respecting Time Sig, Resolution, Bars, Style, and Randomness %.
   * Muted rows (pat.rowMutes[rowIdx] === true) are locked and never overwritten.
   */
  static generateDrumPattern(pat, { style = 'funk', randomness = 35 } = {}) {
    if (!pat || pat.type !== 'drums') return pat;

    const rand = Math.max(0, Math.min(100, Number(randomness) || 0));
    const norm = rand / 100; // 0.0 .. 1.0
    const bars = Math.max(1, Math.min(4, parseInt(pat.bars, 10) || 1));
    const timeSig = pat.timeSig || '4/4';
    const resolution = pat.resolution || '1/16';
    const profile = this.buildBarMetricProfile(timeSig, resolution, rand);
    const { stepsPerBar, stepsPerUnit, pulseSteps, backbeatSteps, unitStartSteps } = profile;
    const totalSteps = stepsPerBar * bars;

    if (!Array.isArray(pat.drumGrid)) pat.drumGrid = [];
    if (!Array.isArray(pat.rowMutes)) pat.rowMutes = new Array(10).fill(false);

    // Ensure all 10 rows exist; clear only UNMUTED rows
    for (let r = 0; r < 10; r++) {
      if (!Array.isArray(pat.drumGrid[r])) {
        pat.drumGrid[r] = new Array(totalSteps).fill(0);
      }
      if (pat.rowMutes[r]) {
        // Row is Muted -> Protected! Ensure length fits totalSteps without overwriting existing steps
        while (pat.drumGrid[r].length < totalSteps) pat.drumGrid[r].push(0);
      } else {
        pat.drumGrid[r] = new Array(totalSteps).fill(0);
      }
    }

    const setStep = (row, stepIdx, state) => {
      if (row < 0 || row >= 10) return;
      if (pat.rowMutes && pat.rowMutes[row]) return; // Never overwrite muted row
      if (stepIdx >= 0 && stepIdx < totalSteps) {
        pat.drumGrid[row][stepIdx] = state;
      }
    };

    // Row indices:
    // 0: BD, 1: SD, 2: CH, 3: OH, 4: LT, 5: HT, 6: CYM, 7: PERC 1 (Clap), 8: PERC 2 (Shaker), 9: MISC (Cowbell)
    for (let bar = 0; bar < bars; bar++) {
      const barOffset = bar * stepsPerBar;
      const isLastBar = bar === bars - 1;

      for (let s = 0; s < stepsPerBar; s++) {
        const gStep = barOffset + s;
        const isDownbeat = s === 0;
        const isBackbeat = backbeatSteps.has(s);
        const isPulse = pulseSteps.has(s);
        const isUnitStart = unitStartSteps.has(s);
        const subPos = s % stepsPerUnit;
        const isHalfUnit = stepsPerUnit >= 2 && subPos === Math.floor(stepsPerUnit / 2);
        const isOffSub = !isUnitStart && !isHalfUnit;

        if (style === 'funk') {
          // Kick (Row 0): Downbeat accented + syncopated pre-backbeat / offbeat pocket
          if (isDownbeat) {
            setStep(0, gStep, 2);
          } else if (isPulse && !isBackbeat && this._chance(0.55 - norm * 0.15)) {
            setStep(0, gStep, 1);
          } else if (isHalfUnit && !isBackbeat && this._chance(0.25 + norm * 0.45)) {
            setStep(0, gStep, this._chance(0.35) ? 2 : 1);
          } else if (isOffSub && norm > 0.35 && this._chance(norm * 0.28)) {
            setStep(0, gStep, 1);
          }

          // Snare (Row 1): Crisp backbeat + ghost notes (State 3) on off-subdivisions
          if (isBackbeat) {
            if (norm > 0.78 && this._chance(0.25) && s + 1 < stepsPerBar) {
              // Displaced funk backbeat at high randomness
              setStep(1, gStep + 1, 2);
            } else {
              setStep(1, gStep, 2);
            }
          } else if ((isOffSub || isHalfUnit) && !isDownbeat && norm > 0.2) {
            if (this._chance(0.15 + norm * 0.42)) {
              setStep(1, gStep, 3); // Ghost snare
            }
          }

          // Hi-Hat (Row 2 CH / Row 3 OH)
          if (isUnitStart || isHalfUnit || (stepsPerUnit >= 4 && this._chance(0.65 + norm * 0.25))) {
            const openBark = !isDownbeat && isHalfUnit && this._chance(0.12 + norm * 0.22);
            if (openBark) {
              setStep(3, gStep, 1);
            } else {
              setStep(2, gStep, isPulse ? 2 : (isUnitStart ? 1 : 3));
            }
          }

          // Percussion layers (Clap / Shaker / Cowbell) at moderate-to-high randomness
          if (isBackbeat && norm > 0.35 && this._chance(0.45)) {
            setStep(7, gStep, 1);
          }
          if (norm > 0.45 && isOffSub && this._chance(norm * 0.35)) {
            setStep(8, gStep, 3);
          }
        } else if (style === 'jazz') {
          // Ride Cymbal (Row 6): Swing spang-a-lang pattern
          const swingSkipPos = stepsPerUnit >= 3 ? stepsPerUnit - 1 : (stepsPerUnit >= 2 ? 1 : 0);
          if (isUnitStart) {
            setStep(6, gStep, isPulse ? 2 : 1);
          } else if (subPos === swingSkipPos && !isBackbeat && this._chance(0.65 + norm * 0.2)) {
            setStep(6, gStep, 1);
          }

          // Hi-Hat (Row 2): Foot chick on backbeats
          if (isBackbeat) {
            setStep(2, gStep, 2);
          }

          // Kick (Row 0): Feathered downbeat + conversational jazz bombs at higher randomness
          if (isDownbeat && this._chance(0.85 - norm * 0.2)) {
            setStep(0, gStep, 3);
          } else if (norm > 0.3 && !isUnitStart && this._chance(norm * 0.22)) {
            setStep(0, gStep, this._chance(0.3) ? 2 : 1);
          }

          // Snare (Row 1): Comping ghost notes & rim/snare accents
          if (!isDownbeat && this._chance(0.14 + norm * 0.38)) {
            setStep(1, gStep, (norm > 0.55 && this._chance(0.35)) ? 2 : 3);
          }
        } else if (style === 'rock') {
          // Kick (Row 0): Strong pulses + eighth-note drive
          if (isDownbeat) {
            setStep(0, gStep, 2);
          } else if (isPulse && !isBackbeat) {
            setStep(0, gStep, 2);
          } else if (isHalfUnit && this._chance(0.3 + norm * 0.35)) {
            setStep(0, gStep, 1);
          }

          // Snare (Row 1): Heavy backbeat
          if (isBackbeat) {
            setStep(1, gStep, 2);
          } else if (norm > 0.5 && isOffSub && this._chance(norm * 0.2)) {
            setStep(1, gStep, 3);
          }

          // Closed Hi-Hat (Row 2) or Ride (Row 6)
          if (isUnitStart || (isHalfUnit && this._chance(0.85))) {
            setStep(2, gStep, isUnitStart ? 2 : 1);
          }
          if (isDownbeat && bar === 0 && norm > 0.25) {
            setStep(6, gStep, 2);
          }
        } else if (style === 'electronic') {
          // 808 / Four-on-the-floor or Electro breakbeat
          if (isDownbeat || (isPulse && this._chance(0.85 - norm * 0.25))) {
            setStep(0, gStep, 2);
          } else if ((isHalfUnit || isOffSub) && norm > 0.3 && this._chance(norm * 0.32)) {
            setStep(0, gStep, 1);
          }

          // Snare + Hand Clap on backbeats
          if (isBackbeat) {
            setStep(1, gStep, 2);
            setStep(7, gStep, 2);
          }

          // Off-beat Open Hi-Hat (Row 3) + 16th Closed Hat (Row 2)
          if (isHalfUnit && this._chance(0.75)) {
            setStep(3, gStep, 1);
          } else if (this._chance(0.65 + norm * 0.3)) {
            setStep(2, gStep, isUnitStart ? 1 : 3);
          }

          // Shaker (Row 8) & Cowbell (Row 9)
          if (this._chance(0.35 + norm * 0.4)) {
            setStep(8, gStep, isUnitStart ? 1 : 3);
          }
          if (norm > 0.4 && (s % 3 === 0) && this._chance(0.35)) {
            setStep(9, gStep, 1);
          }
        } else if (style === 'latin') {
          // Latin / Afro-Cuban / Odd-Meter Pocket
          // Tumbao-style kick on anticipation before beat & downbeat
          if (isDownbeat && this._chance(0.7)) {
            setStep(0, gStep, 2);
          } else if (isHalfUnit && !isBackbeat && this._chance(0.65)) {
            setStep(0, gStep, 2);
          }

          // Cowbell (Row 9) & Shaker (Row 8) clave/ostinato
          if (isPulse || (s % 3 === 0 && this._chance(0.65))) {
            setStep(9, gStep, isDownbeat ? 2 : 1);
          }
          if (isUnitStart || isHalfUnit) {
            setStep(8, gStep, isUnitStart ? 1 : 3);
          }

          // Rim/Snare & Toms conversation
          if (isBackbeat || (isOffSub && this._chance(0.25 + norm * 0.3))) {
            setStep(1, gStep, isBackbeat ? 1 : 3);
          }
          if (this._chance(0.22 + norm * 0.35)) {
            setStep(this._chance(0.5) ? 4 : 5, gStep, 1);
          }
        }

        // Polyrhythmic cross-accents at high randomness (80-100%)
        if (norm >= 0.75 && (gStep % 3 === 0) && this._chance((norm - 0.65) * 0.85)) {
          const polyRow = this._pick([4, 5, 7, 9]);
          setStep(polyRow, gStep, this._chance(0.5) ? 2 : 1);
        }
      }

      // End-of-bar / turnaround tom fill on final beat(s)
      if ((isLastBar || norm > 0.6) && stepsPerBar >= 4 && this._chance(0.35 + norm * 0.55)) {
        const fillLen = Math.min(stepsPerBar, Math.max(2, Math.round(stepsPerUnit * (1 + norm))));
        const fillStart = barOffset + stepsPerBar - fillLen;
        for (let f = 0; f < fillLen; f++) {
          const stepPos = fillStart + f;
          const progress = f / Math.max(1, fillLen - 1);
          // High Tom (Row 5) -> Low Tom (Row 4) -> Snare (Row 1) turnaround
          if (progress < 0.45) {
            setStep(5, stepPos, f === 0 ? 2 : 1);
          } else if (progress < 0.85) {
            setStep(4, stepPos, 2);
          } else {
            setStep(1, stepPos, 2);
          }
        }
      }
    }

    // Update 24-step pattern preview
    pat.preview = pat.drumGrid[0].slice(0, Math.min(24, totalSteps)).map((v, i) =>
      (v > 0 || (pat.drumGrid[1] && pat.drumGrid[1][i] > 0) || (pat.drumGrid[2] && pat.drumGrid[2][i] > 0) ? 1 : 0)
    );

    return pat;
  }

  /**
   * 2. BASSLINE PATTERN GENERATOR
   * Generates scale-degree & strict-pitch bass steps respecting Time Sig, Resolution, Bars, Style, and Randomness %.
   */
  static generateBassPattern(pat, { style = 'walking', randomness = 35 } = {}) {
    if (!pat || pat.type !== 'bass') return pat;

    const rand = Math.max(0, Math.min(100, Number(randomness) || 0));
    const norm = rand / 100;
    const bars = Math.max(1, Math.min(4, parseInt(pat.bars, 10) || 1));
    const timeSig = pat.timeSig || '4/4';
    const resolution = pat.resolution || '1/16';
    const profile = this.buildBarMetricProfile(timeSig, resolution, rand);
    const { stepsPerBar, stepsPerUnit, pulseSteps, backbeatSteps, unitStartSteps } = profile;
    const totalSteps = stepsPerBar * bars;

    // Pick a base strict root index around A1 (index 9) or C2 (index 12) so Strict Mode sounds great too
    const baseStrictIndex = 9; // A1
    const degreeToStrictPitch = (deg) => {
      const semi = DEGREE_TO_SEMITONES[deg] ?? 0;
      const idx = Math.max(0, Math.min(STRICT_BASS_PITCHES.length - 1, baseStrictIndex + semi));
      return STRICT_BASS_PITCHES[idx];
    };

    const chordTones = ['R', '3', '5', 'b7', 'R8', '-5'];
    const mediumTones = ['R', '2', 'b3', '3', '4', '5', '6', 'b7', 'R8', '-5'];
    const chromaticApproaches = ['-7', '-b7', 'b2', 'b5', '7'];

    const newSteps = [];

    for (let bar = 0; bar < bars; bar++) {
      for (let s = 0; s < stepsPerBar; s++) {
        const isDownbeat = s === 0;
        const isPulse = pulseSteps.has(s);
        const isBackbeat = backbeatSteps.has(s);
        const isUnitStart = unitStartSteps.has(s);
        const subPos = s % stepsPerUnit;
        const isHalfUnit = stepsPerUnit >= 2 && subPos === Math.floor(stepsPerUnit / 2);
        const isLastUnitOfBar = s >= stepsPerBar - stepsPerUnit;

        let degree = 'R';
        let gate = 50;
        let accent = false;
        let slide = false;
        let rest = false;

        if (style === 'walking') {
          // Walking Bass: Quarter-note pulse backbone + occasional 8th pickup
          if (isDownbeat) {
            degree = (norm > 0.7 && bar > 0 && this._chance(0.3)) ? '5' : 'R';
            gate = 100;
            accent = true;
          } else if (isUnitStart) {
            if (isLastUnitOfBar) {
              // Approach tone leading into next bar's root
              const pool = norm < 0.35
                ? ['5', '-5', '-7', 'b7']
                : norm < 0.75
                ? ['-7', 'b2', '5', 'b7', '-b7']
                : chromaticApproaches;
              degree = this._pick(pool);
              gate = 100;
              slide = norm > 0.4 && this._chance(0.35);
            } else {
              const pool = norm < 0.35 ? ['3', '5', 'b3', 'R8'] : mediumTones;
              degree = this._pick(pool);
              gate = 100;
            }
          } else if (isHalfUnit && isLastUnitOfBar && this._chance(0.25 + norm * 0.5)) {
            // Classic jazz walking 8th-note skip before barline
            degree = this._pick(norm > 0.4 ? chromaticApproaches : ['5', '-7', 'b7']);
            gate = 50;
            accent = this._chance(0.4);
          } else if (norm > 0.65 && isHalfUnit && this._chance((norm - 0.5) * 0.5)) {
            degree = this._pick(mediumTones);
            gate = 50;
          } else {
            rest = true;
          }
        } else if (style === 'slap') {
          // Slap / Funk: Syncopated 16ths, Root thumb + Octave R8 pop, staccato pockets, slides
          if (isDownbeat) {
            degree = 'R';
            gate = 50;
            accent = true;
          } else if (isBackbeat && this._chance(0.65)) {
            degree = 'R8'; // Octave pop!
            gate = 25;
            accent = true;
          } else if (isHalfUnit && this._chance(0.55 + norm * 0.25)) {
            degree = this._pick(['R', 'R8', 'b7', '5', 'b3', '3']);
            gate = 25;
            accent = degree === 'R8' || this._chance(0.4);
            slide = norm > 0.3 && this._chance(0.25);
          } else if (!isUnitStart && this._chance(0.25 + norm * 0.45)) {
            const pool = norm > 0.6 ? [...mediumTones, ...chromaticApproaches] : ['R', 'b7', '5', 'R8', 'b3'];
            degree = this._pick(pool);
            gate = 25;
            slide = this._chance(0.22);
          } else {
            rest = true;
          }
        } else if (style === 'synth') {
          // Synth / Arp: Driving ostinato across grid steps
          const restProb = Math.max(0.05, 0.22 - norm * 0.12);
          if (!isDownbeat && this._chance(restProb)) {
            rest = true;
          } else {
            const arpCycle = ['R', '5', 'b7', 'R8', '3', '5', 'b3', 'R8'];
            if (norm < 0.35) {
              degree = arpCycle[s % 4];
            } else if (norm < 0.75) {
              degree = isDownbeat ? 'R' : this._pick(['R', '5', 'b7', 'R8', 'b3', '4']);
            } else {
              degree = isDownbeat ? 'R' : this._pick([...mediumTones, ...chromaticApproaches]);
            }
            gate = (s % 2 === 0) ? 50 : 25;
            accent = isPulse || (norm > 0.4 && s % 3 === 0);
            slide = norm > 0.45 && !isUnitStart && this._chance(0.25);
          }
        } else if (style === 'rootfifth') {
          // Root-Fifth Groove
          if (isDownbeat) {
            degree = 'R';
            gate = 100;
            accent = true;
          } else if (isPulse) {
            degree = this._pick(['5', '-5', 'R']);
            gate = 50;
          } else if (isHalfUnit && (isLastUnitOfBar || this._chance(0.25 + norm * 0.4))) {
            degree = norm < 0.4 ? this._pick(['5', '-5', 'b7']) : this._pick(chordTones);
            gate = 50;
            slide = norm > 0.4 && this._chance(0.25);
          } else if (norm > 0.65 && this._chance(0.25)) {
            degree = this._pick(chromaticApproaches);
            gate = 25;
          } else {
            rest = true;
          }
        }

        newSteps.push({
          pitch: degreeToStrictPitch(degree),
          degree,
          gate,
          accent,
          slide,
          rest
        });
      }
    }

    pat.bassSteps = newSteps;
    pat.preview = pat.bassSteps.slice(0, Math.min(24, totalSteps)).map((st) => (st.rest ? 0 : 1));
    return pat;
  }

  /**
   * 3. CHORD PROGRESSION GENERATOR
   * Preserves pat.measures.length AND preserves each bar's existing slot count (pat.measures[barIdx].length).
   * Generates harmonically coherent progressions in the chosen Key, Style, and Randomness %.
   */
  static generateChordPattern(pat, { style = 'jazz', randomness = 35, key = 'auto' } = {}) {
    if (!pat || pat.type !== 'chords') return pat;

    const rand = Math.max(0, Math.min(100, Number(randomness) || 0));
    const norm = rand / 100;

    if (!Array.isArray(pat.measures) || pat.measures.length === 0) {
      const defaultBars = Math.max(1, Math.min(8, parseInt(pat.bars, 10) || 4));
      pat.measures = Array.from({ length: defaultBars }, () => ['Cmaj7']);
    }

    // Determine tonic key center (0..11 semitones from C)
    const preferredKeys = ['C', 'F', 'Bb', 'Eb', 'G', 'D', 'A', 'Ab'];
    const chosenKeyName = (!key || key === 'auto') ? this._pick(preferredKeys) : key;
    const useFlats = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'C'].includes(chosenKeyName);
    const noteNames = useFlats ? PITCH_NAMES_FLAT : PITCH_NAMES_SHARP;

    const keySemitoneMap = {
      C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
      'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
    };
    const rootSemi = keySemitoneMap[chosenKeyName] ?? 0;
    const noteAt = (offsetSemis) => noteNames[((rootSemi + offsetSemis) % 12 + 12) % 12];

    // Helper that validates candidate symbol against ChordDictionary (falls back to safe quality if needed)
    const makeChord = (semiOffset, qualityCandidates) => {
      const rName = noteAt(semiOffset);
      const qList = Array.isArray(qualityCandidates) ? qualityCandidates : [qualityCandidates];
      for (const q of qList) {
        const sym = `${rName}${q}`;
        const parsed = chordDictionary.parseChordSymbol(sym);
        if (parsed && parsed.valid) return sym;
      }
      return `${rName}maj7`;
    };

    // Quality palettes scaled by Randomness % (0-30% Basic, 31-70% Extended, 71-100% Altered/Experimental)
    const getMajQual = () => (norm < 0.32 ? ['maj7', '6', ''] : norm < 0.72 ? ['maj9', 'maj7', '6/9', 'add9'] : ['maj7#11', 'maj9', 'maj13', '6/9']);
    const getMinQual = () => (norm < 0.32 ? ['m7', 'm'] : norm < 0.72 ? ['m9', 'm7', 'm11', 'm6'] : ['m11', 'm9', 'mMaj7', 'm6']);
    const getDomQual = () => (norm < 0.32 ? ['7', '9'] : norm < 0.72 ? ['9', '13', '7sus4', '7'] : ['7b9', '7#9', '7#5', '13', '9', '7b5']);
    const getHalfDimQual = () => (norm < 0.4 ? ['m7b5'] : ['m7b5', 'dim7']);

    // Degree templates (each item is { semi, type: 'maj' | 'min' | 'dom' | 'hdim' })
    const styleTemplates = {
      jazz: [
        // Classic ii - V - I - VI7
        [
          { semi: 2, type: 'min' },
          { semi: 7, type: 'dom' },
          { semi: 0, type: 'maj' },
          { semi: 9, type: norm > 0.3 ? 'dom' : 'min' }
        ],
        // I - vi - ii - V
        [
          { semi: 0, type: 'maj' },
          { semi: 9, type: norm > 0.45 ? 'dom' : 'min' },
          { semi: 2, type: 'min' },
          { semi: 7, type: 'dom' }
        ],
        // iii - VI7 - ii - V
        [
          { semi: 4, type: 'min' },
          { semi: 9, type: 'dom' },
          { semi: 2, type: 'min' },
          { semi: 7, type: 'dom' }
        ],
        // Minor iiø - V7b9 - im7 - bVI7
        [
          { semi: 11, type: 'hdim' },
          { semi: 4, type: 'dom' },
          { semi: 9, type: 'min' },
          { semi: 5, type: 'dom' }
        ],
        // IVmaj7 - ivm7 - iii7 - VI7 - ii7 - V7
        [
          { semi: 5, type: 'maj' },
          { semi: 5, type: 'min' },
          { semi: 4, type: 'min' },
          { semi: 9, type: 'dom' },
          { semi: 2, type: 'min' },
          { semi: 7, type: 'dom' }
        ]
      ],
      pop: [
        // I - V - vi - IV
        [
          { semi: 0, type: 'maj' },
          { semi: 7, type: norm > 0.35 ? 'dom' : 'maj' },
          { semi: 9, type: 'min' },
          { semi: 5, type: 'maj' }
        ],
        // vi - IV - I - V
        [
          { semi: 9, type: 'min' },
          { semi: 5, type: 'maj' },
          { semi: 0, type: 'maj' },
          { semi: 7, type: 'dom' }
        ],
        // IVmaj7 - iii7 - vi7 - I (Neo-Soul / R&B)
        [
          { semi: 5, type: 'maj' },
          { semi: 4, type: norm > 0.5 ? 'dom' : 'min' },
          { semi: 9, type: 'min' },
          { semi: 0, type: 'maj' }
        ],
        // ii - IV - I - V
        [
          { semi: 2, type: 'min' },
          { semi: 5, type: 'maj' },
          { semi: 0, type: 'maj' },
          { semi: 7, type: 'dom' }
        ]
      ],
      modal: [
        // Dorian Vamp: im7 <-> IV7 (or iim7 in relative major: Dm7 <-> G7)
        [
          { semi: 2, type: 'min' },
          { semi: 7, type: 'dom' },
          { semi: 2, type: 'min' },
          { semi: 5, type: 'maj' }
        ],
        // Lydian Float: Imaj7 <-> II7
        [
          { semi: 0, type: 'maj' },
          { semi: 2, type: 'dom' },
          { semi: 0, type: 'maj' },
          { semi: 4, type: 'min' }
        ],
        // Mixolydian Groove: I7 <-> bVIIadd9 <-> IVmaj7
        [
          { semi: 0, type: 'dom' },
          { semi: 10, type: 'maj' },
          { semi: 5, type: 'maj' },
          { semi: 0, type: 'dom' }
        ]
      ],
      blues: [
        // Jazz-Blues / Gospel 4-bar / 8-bar cell
        [
          { semi: 0, type: 'dom' },
          { semi: 5, type: 'dom' },
          { semi: 0, type: 'dom' },
          { semi: 7, type: 'dom' }
        ],
        // Gospel Climb: I7 - IV7 - #ivdim7 - I7/V7
        [
          { semi: 0, type: 'dom' },
          { semi: 5, type: 'dom' },
          { semi: 6, type: 'hdim' },
          { semi: 7, type: 'dom' }
        ]
      ]
    };

    const templates = styleTemplates[style] || styleTemplates.jazz;
    const baseTemplate = this._pick(templates);

    const resolveNodeToSymbol = (node) => {
      let semi = node.semi;
      let type = node.type;

      // At high randomness, allow tritone substitution on dominant chords (e.g. G7 -> Db7#9)
      if (type === 'dom' && norm > 0.62 && this._chance((norm - 0.5) * 0.75)) {
        semi = (semi + 6) % 12;
      }

      const qualPool =
        type === 'maj'
          ? getMajQual()
          : type === 'min'
          ? getMinQual()
          : type === 'hdim'
          ? getHalfDimQual()
          : getDomQual();

      const pickedQual = this._pick(qualPool);
      return makeChord(semi, [pickedQual, 'maj7', 'm7', '7']);
    };

    const numBars = pat.measures.length;
    for (let barIdx = 0; barIdx < numBars; barIdx++) {
      // Strictly preserve the user's current chord count in this bar!
      const currentBar = pat.measures[barIdx];
      const slotCount = Math.max(1, Math.min(4, (Array.isArray(currentBar) && currentBar.length) || 1));
      const newBarSlots = [];

      const primaryNode = baseTemplate[barIdx % baseTemplate.length];
      const nextBarNode = baseTemplate[(barIdx + 1) % baseTemplate.length];

      for (let s = 0; s < slotCount; s++) {
        if (s === 0) {
          newBarSlots.push(resolveNodeToSymbol(primaryNode));
        } else if (s === slotCount - 1 && slotCount >= 2) {
          // Final slot of a multi-chord bar: create a smooth approach or V7 / ii-V into nextBarNode
          const approachSemi = norm > 0.65 && this._chance(0.45)
            ? (nextBarNode.semi + 1) % 12 // Tritone / chromatic approach
            : (nextBarNode.semi + 7) % 12; // Secondary dominant V7 of next bar
          const approachType = this._chance(0.75) ? 'dom' : 'min';
          newBarSlots.push(resolveNodeToSymbol({ semi: approachSemi, type: approachType }));
        } else {
          // Middle slot(s) in a 3- or 4-chord bar: passing diatonic or ii chord
          const passingSemi = (primaryNode.semi + (s * 5)) % 12;
          const passingType = this._pick(['min', 'maj', 'dom']);
          newBarSlots.push(resolveNodeToSymbol({ semi: passingSemi, type: passingType }));
        }
      }

      pat.measures[barIdx] = newBarSlots;
    }

    pat.bars = pat.measures.length;
    return pat;
  }
}

export default PatternGenerator;
