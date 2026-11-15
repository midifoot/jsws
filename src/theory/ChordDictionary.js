/**
 * ChordDictionary.js
 * Singleton music-theory & chord voicing dictionary for AutoBand.
 * Supports 60+ foundational chords from defaultChords.json, localStorage persistence,
 * custom chord CRUD, slash-bass parsing, interval-to-MIDI resolution, and voicing styles.
 */

export const STORAGE_KEY_CHORD_DICT = 'autoband_chord_dictionary';

export const CHORD_CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'basic', label: 'Basic Triads & Power' },
  { id: '7th', label: '7th & 6th Chords' },
  { id: 'extended', label: 'Extended (9th / 11th / 13th)' },
  { id: 'altered', label: 'Altered Jazz Dominants' },
  { id: 'slash_bass', label: 'Slash Bass & Inversions' },
  { id: 'custom', label: 'Custom User Chords' }
];

export const ROOT_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const ROOT_NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

export const ROOT_SEMITONE_MAP = {
  'C': 0,  'B#': 0,
  'C#': 1, 'Db': 1,
  'D': 2,
  'D#': 3, 'Eb': 3,
  'E': 4,  'Fb': 4,
  'F': 5,  'E#': 5,
  'F#': 6, 'Gb': 6,
  'G': 7,
  'G#': 8, 'Ab': 8,
  'A': 9,
  'A#': 10, 'Bb': 10,
  'B': 11, 'Cb': 11
};

// Embedded synchronous seed so parseChordSymbol() works immediately before async fetch completes
const FALLBACK_DEFAULT_CHORDS = [
  { id: 'maj', name: 'Major Triad', symbol: '', aliases: ['M', 'maj', 'Δ'], category: 'basic', intervals: [0, 4, 7], bassOffset: 0, description: 'Bright, stable foundational triad (1 - 3 - 5)' },
  { id: 'min', name: 'Minor Triad', symbol: 'm', aliases: ['min', '-'], category: 'basic', intervals: [0, 3, 7], bassOffset: 0, description: 'Warm, melancholic minor triad (1 - b3 - 5)' },
  { id: 'dim', name: 'Diminished Triad', symbol: 'dim', aliases: ['°', 'o', 'mb5'], category: 'basic', intervals: [0, 3, 6], bassOffset: 0, description: 'Tense symmetrical triad with flat fifth (1 - b3 - b5)' },
  { id: 'aug', name: 'Augmented Triad', symbol: 'aug', aliases: ['+', '+5', '#5'], category: 'basic', intervals: [0, 4, 8], bassOffset: 0, description: 'Dreamy symmetrical triad with raised fifth (1 - 3 - #5)' },
  { id: 'sus2', name: 'Suspended 2nd', symbol: 'sus2', aliases: ['2'], category: 'basic', intervals: [0, 2, 7], bassOffset: 0, description: 'Open modern triad replacing 3rd with 2nd (1 - 2 - 5)' },
  { id: 'sus4', name: 'Suspended 4th', symbol: 'sus4', aliases: ['sus', '4'], category: 'basic', intervals: [0, 5, 7], bassOffset: 0, description: 'Suspended triad resolving to major/minor (1 - 4 - 5)' },
  { id: '5', name: 'Power Chord (Fifth)', symbol: '5', aliases: ['no3'], category: 'basic', intervals: [0, 7, 12], bassOffset: 0, description: 'Punchy root-fifth-octave power voicing (1 - 5 - 8)' },
  { id: 'add9', name: 'Major Add 9', symbol: 'add9', aliases: ['add2', 'Madd9'], category: 'basic', intervals: [0, 4, 7, 14], bassOffset: 0, description: 'Major triad with an added 9th (1 - 3 - 5 - 9)' },
  { id: 'madd9', name: 'Minor Add 9', symbol: 'madd9', aliases: ['m(add9)', 'madd2', '-add9'], category: 'basic', intervals: [0, 3, 7, 14], bassOffset: 0, description: 'Expressive minor triad with added 9th (1 - b3 - 5 - 9)' },
  { id: 'add11', name: 'Major Add 11', symbol: 'add11', aliases: ['add4'], category: 'basic', intervals: [0, 4, 7, 17], bassOffset: 0, description: 'Major triad with luminous 11th color (1 - 3 - 5 - 11)' },
  { id: '7', name: 'Dominant 7th', symbol: '7', aliases: ['dom7'], category: '7th', intervals: [0, 4, 7, 10], bassOffset: 0, description: 'Classic blues, funk & jazz V7 chord (1 - 3 - 5 - b7)' },
  { id: 'maj7', name: 'Major 7th', symbol: 'maj7', aliases: ['M7', 'Δ7', 'ma7', 'Maj7'], category: '7th', intervals: [0, 4, 7, 11], bassOffset: 0, description: 'Lush, sophisticated major 7th (1 - 3 - 5 - 7)' },
  { id: 'm7', name: 'Minor 7th', symbol: 'm7', aliases: ['min7', '-7', 'mi7'], category: '7th', intervals: [0, 3, 7, 10], bassOffset: 0, description: 'Smooth soul, funk, and jazz ii7 chord (1 - b3 - 5 - b7)' },
  { id: 'm7b5', name: 'Half-Diminished 7th', symbol: 'm7b5', aliases: ['ø', 'ø7', '-7b5', 'min7b5'], category: '7th', intervals: [0, 3, 6, 10], bassOffset: 0, description: 'Minor iiø7 in jazz minor progressions (1 - b3 - b5 - b7)' },
  { id: 'dim7', name: 'Diminished 7th', symbol: 'dim7', aliases: ['°7', 'o7'], category: '7th', intervals: [0, 3, 6, 9], bassOffset: 0, description: 'Symmetrical passing/leading-tone 7th chord (1 - b3 - b5 - bb7)' },
  { id: 'mMaj7', name: 'Minor-Major 7th', symbol: 'mMaj7', aliases: ['mM7', 'm(maj7)', '-Δ7', 'minMaj7'], category: '7th', intervals: [0, 3, 7, 11], bassOffset: 0, description: 'Cinematic noir/detective tonic minor chord (1 - b3 - 5 - 7)' },
  { id: '7sus4', name: 'Dominant 7th Suspended 4th', symbol: '7sus4', aliases: ['7sus', 'sus7'], category: '7th', intervals: [0, 5, 7, 10], bassOffset: 0, description: 'Herbie Hancock / modal soul-jazz suspended dominant (1 - 4 - 5 - b7)' },
  { id: '6', name: 'Major 6th', symbol: '6', aliases: ['M6', 'maj6', 'add6'], category: '7th', intervals: [0, 4, 7, 9], bassOffset: 0, description: 'Warm swing and bossa tonic major 6th (1 - 3 - 5 - 6)' },
  { id: 'm6', name: 'Minor 6th', symbol: 'm6', aliases: ['min6', '-6'], category: '7th', intervals: [0, 3, 7, 9], bassOffset: 0, description: 'Dorian & gypsy-jazz minor 6th tonic (1 - b3 - 5 - 6)' },
  { id: 'aug7', name: 'Augmented Dominant 7th', symbol: 'aug7', aliases: ['+7', '7+'], category: '7th', intervals: [0, 4, 8, 10], bassOffset: 0, description: 'Whole-tone dominant 7th with raised 5th (1 - 3 - #5 - b7)' },
  { id: 'maj7#5', name: 'Major 7th Sharp 5', symbol: 'maj7#5', aliases: ['M7#5', 'Δ7#5', 'maj7+5'], category: '7th', intervals: [0, 4, 8, 11], bassOffset: 0, description: 'Lydian Augmented major 7th voicing (1 - 3 - #5 - 7)' },
  { id: 'maj7b5', name: 'Major 7th Flat 5', symbol: 'maj7b5', aliases: ['M7b5', 'Δ7b5'], category: '7th', intervals: [0, 4, 6, 11], bassOffset: 0, description: 'Modern angular major 7th with lowered 5th (1 - 3 - b5 - 7)' },
  { id: '9', name: 'Dominant 9th', symbol: '9', aliases: ['dom9', '7(9)'], category: 'extended', intervals: [0, 4, 7, 10, 14], bassOffset: 0, description: 'Rich funk, R&B, and jazz dominant 9th (1 - 3 - 5 - b7 - 9)' },
  { id: 'maj9', name: 'Major 9th', symbol: 'maj9', aliases: ['M9', 'Δ9', 'Maj9'], category: 'extended', intervals: [0, 4, 7, 11, 14], bassOffset: 0, description: 'Velvety neo-soul and jazz major 9th (1 - 3 - 5 - 7 - 9)' },
  { id: 'm9', name: 'Minor 9th', symbol: 'm9', aliases: ['min9', '-9', 'mi9'], category: 'extended', intervals: [0, 3, 7, 10, 14], bassOffset: 0, description: 'Silky minor 9th staple of fusion & Rhodes grooves (1 - b3 - 5 - b7 - 9)' },
  { id: '6/9', name: 'Major 6/9', symbol: '6/9', aliases: ['69', 'M6/9', 'maj6/9'], category: 'extended', intervals: [0, 4, 7, 9, 14], bassOffset: 0, description: 'Bossa nova & modern jazz tonic chord (1 - 3 - 5 - 6 - 9)' },
  { id: 'm6/9', name: 'Minor 6/9', symbol: 'm6/9', aliases: ['m69', 'min6/9', '-6/9'], category: 'extended', intervals: [0, 3, 7, 9, 14], bassOffset: 0, description: 'Lush Dorian minor tonic voicing (1 - b3 - 5 - 6 - 9)' },
  { id: '9sus4', name: 'Dominant 9th Suspended 4th', symbol: '9sus4', aliases: ['9sus', '11', '7sus9'], category: 'extended', intervals: [0, 5, 7, 10, 14], bassOffset: 0, description: 'Expansive soul/gospel/fusion suspended 9th (1 - 4 - 5 - b7 - 9)' },
  { id: 'm11', name: 'Minor 11th', symbol: 'm11', aliases: ['min11', '-11', 'mi11'], category: 'extended', intervals: [0, 3, 7, 10, 14, 17], bassOffset: 0, description: 'Modal jazz & modern R&B minor 11th (1 - b3 - 5 - b7 - 9 - 11)' },
  { id: 'maj7#11', name: 'Major 7th Sharp 11 (Lydian)', symbol: 'maj7#11', aliases: ['M7#11', 'Δ7#11', 'maj9#11', 'M9#11'], category: 'extended', intervals: [0, 4, 7, 11, 14, 18], bassOffset: 0, description: 'Bright floating Lydian major voicing (1 - 3 - 5 - 7 - 9 - #11)' },
  { id: '13', name: 'Dominant 13th', symbol: '13', aliases: ['dom13', '9(13)'], category: 'extended', intervals: [0, 4, 7, 10, 14, 21], bassOffset: 0, description: 'Full-bodied jazz & gospel dominant 13th (1 - 3 - 5 - b7 - 9 - 13)' },
  { id: 'maj13', name: 'Major 13th', symbol: 'maj13', aliases: ['M13', 'Δ13', 'Maj13'], category: 'extended', intervals: [0, 4, 7, 11, 14, 21], bassOffset: 0, description: 'Radiant extended major 13th chord (1 - 3 - 5 - 7 - 9 - 13)' },
  { id: 'm13', name: 'Minor 13th', symbol: 'm13', aliases: ['min13', '-13'], category: 'extended', intervals: [0, 3, 7, 10, 14, 21], bassOffset: 0, description: 'Deep Dorian minor 13th voicing (1 - b3 - 5 - b7 - 9 - 13)' },
  { id: '13sus4', name: 'Dominant 13th Suspended 4th', symbol: '13sus4', aliases: ['13sus', '9sus13'], category: 'extended', intervals: [0, 5, 7, 10, 14, 21], bassOffset: 0, description: 'Soaring fusion & Contemporary Jazz 13sus4 (1 - 4 - 5 - b7 - 9 - 13)' },
  { id: 'mMaj9', name: 'Minor-Major 9th', symbol: 'mMaj9', aliases: ['mM9', '-Δ9', 'minMaj9'], category: 'extended', intervals: [0, 3, 7, 11, 14], bassOffset: 0, description: 'Sophisticated melodic-minor tonic 9th (1 - b3 - 5 - 7 - 9)' },
  { id: 'm9b5', name: 'Half-Diminished 9th', symbol: 'm9b5', aliases: ['ø9', '-9b5'], category: 'extended', intervals: [0, 3, 6, 10, 14], bassOffset: 0, description: 'Modern jazz half-diminished with natural 9th (1 - b3 - b5 - b7 - 9)' },
  { id: '7b9', name: 'Dominant 7th Flat 9', symbol: '7b9', aliases: ['dom7b9', '7(b9)'], category: 'altered', intervals: [0, 4, 7, 10, 13], bassOffset: 0, description: 'Classic V7b9 resolving to minor or major (1 - 3 - 5 - b7 - b9)' },
  { id: '7#9', name: 'Dominant 7th Sharp 9 (Hendrix)', symbol: '7#9', aliases: ['dom7#9', '7(#9)'], category: 'altered', intervals: [0, 4, 7, 10, 15], bassOffset: 0, description: 'Gritty blues-rock & jazz V7#9 chord (1 - 3 - 5 - b7 - #9)' },
  { id: '7b5', name: 'Dominant 7th Flat 5', symbol: '7b5', aliases: ['7(b5)'], category: 'altered', intervals: [0, 4, 6, 10], bassOffset: 0, description: 'Tritone-rich bebop dominant 7b5 (1 - 3 - b5 - b7)' },
  { id: '7#5', name: 'Dominant 7th Sharp 5', symbol: '7#5', aliases: ['7(#5)', '7+5'], category: 'altered', intervals: [0, 4, 8, 10], bassOffset: 0, description: 'Augmented dominant 7th resolving warmly (1 - 3 - #5 - b7)' },
  { id: '7#11', name: 'Lydian Dominant 7#11', symbol: '7#11', aliases: ['9#11', '7(#11)', 'lyd7'], category: 'altered', intervals: [0, 4, 7, 10, 14, 18], bassOffset: 0, description: 'Acoustic/Lydian dominant with raised 11th (1 - 3 - 5 - b7 - 9 - #11)' },
  { id: '7b13', name: 'Dominant 7th Flat 13', symbol: '7b13', aliases: ['7(b13)', '9b13'], category: 'altered', intervals: [0, 4, 7, 10, 14, 20], bassOffset: 0, description: 'Mixolydian b6 / harmonic minor dominant (1 - 3 - 5 - b7 - 9 - b13)' },
  { id: '7alt', name: 'Altered Dominant 7th', symbol: '7alt', aliases: ['alt', '7#5#9', '7b9b13'], category: 'altered', intervals: [0, 4, 6, 10, 15, 20], bassOffset: 0, description: 'Super-Locrian altered dominant with altered 5ths & 9ths (1 - 3 - b5 - b7 - #9 - b13)' },
  { id: '7#9b13', name: 'Dominant 7th #9 b13', symbol: '7#9b13', aliases: ['7(#9b13)', '7#5#9'], category: 'altered', intervals: [0, 4, 8, 10, 15], bassOffset: 0, description: 'High-tension jazz V7 resolving to minor tonic (1 - 3 - #5 - b7 - #9)' },
  { id: '7b9b13', name: 'Dominant 7th b9 b13', symbol: '7b9b13', aliases: ['7(b9b13)', '7b9#5'], category: 'altered', intervals: [0, 4, 8, 10, 13], bassOffset: 0, description: 'Dark Phrygian-dominant / harmonic minor V7 (1 - 3 - #5 - b7 - b9)' },
  { id: '7b9#11', name: 'Dominant 7th b9 #11', symbol: '7b9#11', aliases: ['7(b9#11)', '13b9#11'], category: 'altered', intervals: [0, 4, 7, 10, 13, 18], bassOffset: 0, description: 'Half-whole diminished scale dominant voicing (1 - 3 - 5 - b7 - b9 - #11)' },
  { id: '13b9', name: 'Dominant 13th Flat 9', symbol: '13b9', aliases: ['7b9(13)', '13(b9)'], category: 'altered', intervals: [0, 4, 7, 10, 13, 21], bassOffset: 0, description: 'Sparkling diminished-scale 13b9 dominant (1 - 3 - 5 - b7 - b9 - 13)' },
  { id: '13#9', name: 'Dominant 13th Sharp 9', symbol: '13#9', aliases: ['13(#9)'], category: 'altered', intervals: [0, 4, 7, 10, 15, 21], bassOffset: 0, description: 'Vibrant half-whole diminished 13#9 dominant (1 - 3 - 5 - b7 - #9 - 13)' },
  { id: '9b5', name: 'Dominant 9th Flat 5', symbol: '9b5', aliases: ['9(b5)'], category: 'altered', intervals: [0, 4, 6, 10, 14], bassOffset: 0, description: 'Whole-tone / bebop 9th with lowered fifth (1 - 3 - b5 - b7 - 9)' },
  { id: '9#5', name: 'Dominant 9th Sharp 5', symbol: '9#5', aliases: ['9(#5)', '9+'], category: 'altered', intervals: [0, 4, 8, 10, 14], bassOffset: 0, description: 'Whole-tone dominant 9th with raised fifth (1 - 3 - #5 - b7 - 9)' },
  { id: 'maj_3', name: 'Major 1st Inversion (/3)', symbol: '/3', aliases: ['maj/3', 'M/3'], category: 'slash_bass', intervals: [0, 4, 7], bassOffset: 4, description: 'Major triad with the Major 3rd in the bass (+4 semitones)' },
  { id: 'maj_5', name: 'Major 2nd Inversion (/5)', symbol: '/5', aliases: ['maj/5', 'M/5'], category: 'slash_bass', intervals: [0, 4, 7], bassOffset: 7, description: 'Major triad with the Perfect 5th in the bass (+7 semitones)' },
  { id: 'min_b3', name: 'Minor 1st Inversion (m/b3)', symbol: 'm/b3', aliases: ['min/b3', '-/b3'], category: 'slash_bass', intervals: [0, 3, 7], bassOffset: 3, description: 'Minor triad with the Minor 3rd in the bass (+3 semitones)' },
  { id: 'min_5', name: 'Minor 2nd Inversion (m/5)', symbol: 'm/5', aliases: ['min/5', '-/5'], category: 'slash_bass', intervals: [0, 3, 7], bassOffset: 7, description: 'Minor triad with the Perfect 5th in the bass (+7 semitones)' },
  { id: '7_3', name: 'Dominant 7th 1st Inversion (7/3)', symbol: '7/3', aliases: ['dom7/3'], category: 'slash_bass', intervals: [0, 4, 7, 10], bassOffset: 4, description: 'Dominant 7th with the 3rd in the bass for smooth basslines' },
  { id: '7_b7', name: 'Dominant 7th 3rd Inversion (7/b7)', symbol: '7/b7', aliases: ['7/7', 'dom7/b7'], category: 'slash_bass', intervals: [0, 4, 7, 10], bassOffset: 10, description: 'Dominant 7th with the flat 7th in the bass resolving down a step' },
  { id: 'maj7_3', name: 'Major 7th 1st Inversion (maj7/3)', symbol: 'maj7/3', aliases: ['M7/3', 'Δ7/3'], category: 'slash_bass', intervals: [0, 4, 7, 11], bassOffset: 4, description: 'Major 7th chord with the 3rd in the bass' },
  { id: 'm7_b3', name: 'Minor 7th 1st Inversion (m7/b3)', symbol: 'm7/b3', aliases: ['-7/b3', 'min7/b3'], category: 'slash_bass', intervals: [0, 3, 7, 10], bassOffset: 3, description: 'Minor 7th chord with the flat 3rd in the bass' },
  { id: 'm7_b7', name: 'Minor 7th 3rd Inversion (m7/b7)', symbol: 'm7/b7', aliases: ['m7/7', '-7/b7'], category: 'slash_bass', intervals: [0, 3, 7, 10], bassOffset: 10, description: 'Minor 7th with the flat 7th in the bass (classic descending line)' },
  { id: 'slash_b2', name: 'Phrygian / Neapolitan Slash (/b2)', symbol: '/b2', aliases: ['maj/b2'], category: 'slash_bass', intervals: [0, 4, 7], bassOffset: 1, description: 'Major triad over a flat-2nd bass pedal (+1 semitone)' },
  { id: 'slash_2', name: 'Major Triad Over 2nd (/2)', symbol: '/2', aliases: ['maj/2', '/9'], category: 'slash_bass', intervals: [0, 4, 7], bassOffset: 2, description: 'Lydian / pop upper-structure triad over a 2nd bass note (+2 semitones)' },
  { id: 'slash_4', name: 'Major Triad Over 4th (/4)', symbol: '/4', aliases: ['maj/4', '/11'], category: 'slash_bass', intervals: [0, 4, 7], bassOffset: 5, description: 'Gospel / pop IV-over-I or V-over-I slash chord (+5 semitones)' },
  { id: 'slash_b7', name: 'Major Triad Over Flat 7th (/b7)', symbol: '/b7', aliases: ['maj/b7'], category: 'slash_bass', intervals: [0, 4, 7], bassOffset: 10, description: 'Mixolydian rock & soul triad over flat-7th bass (+10 semitones)' }
];

export class ChordDictionary {
  constructor() {
    this.chords = [];
    this.defaultChords = JSON.parse(JSON.stringify(FALLBACK_DEFAULT_CHORDS));
    this.initialized = false;
    this.listeners = new Set();

    // Synchronous bootstrap from localStorage or embedded fallback
    this._loadSync();
  }

  _loadSync() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CHORD_DICT);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.chords = parsed.map((c) => this._sanitizeChord(c));
          return;
        }
      }
    } catch (err) {
      console.warn('[ChordDictionary] Failed to read localStorage:', err);
    }
    this.chords = JSON.parse(JSON.stringify(this.defaultChords));
  }

  /**
   * Async initialization that fetches ./src/theory/defaultChords.json
   * and seeds localStorage if no user dictionary was stored yet.
   */
  async init() {
    if (this.initialized) return this.chords;
    try {
      const res = await fetch('./src/theory/defaultChords.json');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json.length > 0) {
          this.defaultChords = json.map((c) => this._sanitizeChord(c));
          const hasStored = localStorage.getItem(STORAGE_KEY_CHORD_DICT);
          if (!hasStored) {
            this.chords = JSON.parse(JSON.stringify(this.defaultChords));
            this.save();
          }
        }
      }
    } catch (err) {
      console.warn('[ChordDictionary] Using embedded defaultChords seed:', err);
    }
    this.initialized = true;
    this._notify();
    return this.chords;
  }

  _sanitizeChord(chord) {
    const intervals = Array.isArray(chord.intervals)
      ? chord.intervals
          .map((n) => Math.max(-24, Math.min(24, parseInt(n, 10) || 0)))
          .filter((n, idx, arr) => arr.indexOf(n) === idx)
          .sort((a, b) => a - b)
      : [0, 4, 7];

    return {
      id: String(chord.id || `custom_${Date.now()}`),
      name: String(chord.name || 'Custom Chord').trim(),
      symbol: chord.symbol !== undefined && chord.symbol !== null ? String(chord.symbol).trim() : '',
      aliases: Array.isArray(chord.aliases)
        ? chord.aliases.map((a) => String(a).trim()).filter(Boolean)
        : [],
      category: String(chord.category || 'custom'),
      intervals: intervals.length > 0 ? intervals : [0],
      bassOffset: Math.max(-24, Math.min(24, parseInt(chord.bassOffset, 10) || 0)),
      description: String(chord.description || '').trim(),
      isCustom: Boolean(chord.isCustom || chord.category === 'custom')
    };
  }

  subscribe(fn) {
    if (typeof fn === 'function') {
      this.listeners.add(fn);
    }
    return () => this.listeners.delete(fn);
  }

  _notify() {
    this.listeners.forEach((fn) => {
      try {
        fn(this.chords);
      } catch (e) {
        console.error('[ChordDictionary] Listener error:', e);
      }
    });
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY_CHORD_DICT, JSON.stringify(this.chords));
    } catch (err) {
      console.error('[ChordDictionary] Failed to save dictionary to localStorage:', err);
    }
    this._notify();
  }

  getAll() {
    return this.chords;
  }

  getCategories() {
    return CHORD_CATEGORIES;
  }

  getById(id) {
    return this.chords.find((c) => c.id === id) || null;
  }

  /**
   * Finds a chord definition by quality symbol or alias.
   * Performs exact case-sensitive matching first (so 'M7' -> Major 7th and 'm7' -> Minor 7th),
   * then falls back to case-insensitive matching for multi-character symbols.
   */
  getBySymbol(symbol) {
    const q = (symbol ?? '').trim();

    // 1. Exact case-sensitive match on primary symbol
    let found = this.chords.find((c) => c.symbol === q);
    if (found) return found;

    // 2. Exact case-sensitive match on aliases
    found = this.chords.find((c) => Array.isArray(c.aliases) && c.aliases.includes(q));
    if (found) return found;

    // 3. Case-insensitive fallback (avoid colliding single-char 'M' and 'm')
    if (q.length > 1 && !q.startsWith('M') && !q.startsWith('m')) {
      const lower = q.toLowerCase();
      found = this.chords.find(
        (c) =>
          c.symbol.toLowerCase() === lower ||
          (Array.isArray(c.aliases) && c.aliases.some((a) => a.toLowerCase() === lower))
      );
      if (found) return found;
    } else if (q.length > 1) {
      // Allow Maj7 / Min7 / dim7 / aug7 case-insensitively when unambiguous
      const lower = q.toLowerCase();
      if (lower.startsWith('maj') || lower.startsWith('min') || lower.startsWith('dim') || lower.startsWith('aug') || lower.startsWith('sus') || lower.startsWith('add') || lower.startsWith('dom')) {
        found = this.chords.find(
          (c) =>
            c.symbol.toLowerCase() === lower ||
            (Array.isArray(c.aliases) && c.aliases.some((a) => a.toLowerCase() === lower))
        );
        if (found) return found;
      }
    }

    return null;
  }

  /**
   * Formats a MIDI note or semitone offset into a musical note name.
   */
  midiToNoteName(midi, preferFlats = false, includeOctave = false) {
    const pc = ((midi % 12) + 12) % 12;
    const names = preferFlats ? ROOT_NAMES_FLAT : ROOT_NAMES_SHARP;
    const note = names[pc];
    if (!includeOctave) return note;
    const oct = Math.floor(midi / 12) - 1;
    return `${note}${oct}`;
  }

  /**
   * Parses a full chord string (e.g., "C#m7b5", "Fmaj7/A", "G7alt", "Bb6/9").
   * Returns a rich descriptor object with { valid, root, quality, slashBass, definition, midiNotes, noteNames, bassNote }.
   */
  parseChordSymbol(chordString, options = {}) {
    const raw = String(chordString || '').trim();
    if (!raw || raw === '-' || raw.toLowerCase() === 'nc' || raw.toLowerCase() === 'n.c.') {
      return { valid: false, isEmpty: true, error: 'Empty chord slot' };
    }

    // Match Root Note (A-G followed by optional # or b)
    const rootMatch = raw.match(/^([A-Ga-g])([#b♯♭]?)(.*)$/);
    if (!rootMatch) {
      return { valid: false, error: 'Chord not found in dictionary' };
    }

    const rootLetter = rootMatch[1].toUpperCase();
    const accidentalRaw = rootMatch[2] || '';
    const accidental = accidentalRaw === '♯' ? '#' : accidentalRaw === '♭' ? 'b' : accidentalRaw;
    const rootName = `${rootLetter}${accidental}`;
    const rootSemitone = ROOT_SEMITONE_MAP[rootName];

    if (rootSemitone === undefined) {
      return { valid: false, error: 'Invalid root note' };
    }

    const remainder = (rootMatch[3] || '').trim();
    const preferFlats = accidental === 'b' || ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'].includes(rootName);

    // Determine whether remainder matches a dictionary entry directly (including '6/9', 'm6/9', '/3', 'm7/b3', etc.)
    let definition = this.getBySymbol(remainder);
    let qualityPart = remainder;
    let explicitSlashNote = null;

    // If not directly matched and contains '/', check if the suffix after '/' is an explicit bass note (e.g. "C/E", "Am7/G", "F#m/C#")
    if (!definition && remainder.includes('/')) {
      const slashIdx = remainder.lastIndexOf('/');
      const beforeSlash = remainder.slice(0, slashIdx).trim();
      const afterSlash = remainder.slice(slashIdx + 1).trim();

      const bassMatch = afterSlash.match(/^([A-Ga-g])([#b♯♭]?)$/);
      if (bassMatch) {
        const bassLetter = bassMatch[1].toUpperCase();
        const bassAccRaw = bassMatch[2] || '';
        const bassAcc = bassAccRaw === '♯' ? '#' : bassAccRaw === '♭' ? 'b' : bassAccRaw;
        const candidateBass = `${bassLetter}${bassAcc}`;
        if (ROOT_SEMITONE_MAP[candidateBass] !== undefined) {
          const baseDef = this.getBySymbol(beforeSlash);
          if (baseDef) {
            definition = baseDef;
            qualityPart = beforeSlash;
            explicitSlashNote = candidateBass;
          }
        }
      }
    }

    if (!definition) {
      return {
        valid: false,
        root: rootName,
        quality: remainder,
        error: 'Chord not found in dictionary'
      };
    }

    const rootOctave = options.rootOctave !== undefined ? options.rootOctave : 4;
    const rootMidi = (rootOctave + 1) * 12 + rootSemitone; // C4 = 60 when rootOctave=4

    // Compute bass note MIDI
    let bassOffset = definition.bassOffset || 0;
    let bassMidi = rootMidi - 12 + bassOffset;
    if (explicitSlashNote) {
      const slashSemitone = ROOT_SEMITONE_MAP[explicitSlashNote];
      bassOffset = (slashSemitone - rootSemitone + 12) % 12;
      bassMidi = (rootOctave) * 12 + slashSemitone; // C3..B3 bass register
    }

    const midiNotes = definition.intervals.map((interval) => rootMidi + interval);
    const noteNames = definition.intervals.map((interval) =>
      this.midiToNoteName(rootMidi + interval, preferFlats, false)
    );
    const bassNoteName = explicitSlashNote || this.midiToNoteName(bassMidi, preferFlats, false);

    return {
      valid: true,
      symbol: `${rootName}${qualityPart}${explicitSlashNote ? '/' + explicitSlashNote : ''}`,
      root: rootName,
      rootSemitone,
      rootMidi,
      quality: definition.symbol,
      slashBass: explicitSlashNote,
      bassOffset,
      bassNote: bassMidi,
      bassNoteName,
      definition,
      intervals: [...definition.intervals],
      midiNotes,
      noteNames,
      analysisLabel: `${noteNames.join('-')} • ${definition.name}`
    };
  }

  /**
   * Computes voiced MIDI notes for playback in the Chord Editor and Main Stage.
   * Respects dictionary intervals, slash bass offsets, Voicing Style, and Octave shift.
   */
  getVoicedMidiNotes(chordString, voicing = 'Jazz Drop-2', octave = 0) {
    const parsed = this.parseChordSymbol(chordString, { rootOctave: 3 });
    if (!parsed.valid) {
      return [48, 52, 55, 59];
    }

    const octShift = (parseInt(octave, 10) || 0) * 12;
    const baseRoot = parsed.rootMidi + octShift; // C3 = 48 at octave 0
    const rawIntervals = [...parsed.intervals];

    let voicedOffsets = [...rawIntervals];

    if (voicing === 'Pop Triads') {
      // Compact 3-4 note close voicing + lower root/slash bass anchor
      voicedOffsets = rawIntervals.slice(0, 4);
    } else if (voicing === 'Jazz Drop-2') {
      // Drop the 2nd highest voice by an octave (or open up the 3rd/7th shell)
      if (voicedOffsets.length >= 4) {
        const sorted = [...voicedOffsets].sort((a, b) => a - b);
        const dropIdx = sorted.length - 2;
        sorted[dropIdx] = sorted[dropIdx] - 12;
        voicedOffsets = sorted.sort((a, b) => a - b);
      }
    } else if (voicing === 'Quartal Open') {
      // Spread inner voices outward for a modern McCoy Tyner / open voicing feel
      voicedOffsets = rawIntervals.map((iv, idx) => {
        if (idx === 1 && iv <= 4) return iv + 12;
        if (idx === 3 && iv <= 11) return iv + 12;
        return iv;
      });
    } else if (voicing === 'Lush Pad') {
      // Add warm low bass anchor (-12) and shimmer top extension (+12 on 3rd)
      const third = rawIntervals.find((iv) => iv === 3 || iv === 4 || iv === 5);
      voicedOffsets = [-12, ...rawIntervals];
      if (third !== undefined && !voicedOffsets.includes(third + 12)) {
        voicedOffsets.push(third + 12);
      }
    }

    // Apply slash bass or bassOffset when present
    if (parsed.bassOffset && parsed.bassOffset !== 0) {
      const bassInterval = parsed.bassOffset - 12;
      if (!voicedOffsets.includes(bassInterval)) {
        voicedOffsets.unshift(bassInterval);
      }
    } else if (voicing === 'Pop Triads' && !voicedOffsets.includes(-12)) {
      voicedOffsets.unshift(-12);
    }

    const uniqueMidi = Array.from(
      new Set(
        voicedOffsets
          .map((offset) => Math.max(24, Math.min(96, baseRoot + offset)))
          .sort((a, b) => a - b)
      )
    );

    return uniqueMidi;
  }

  /**
   * CRUD Operations
   */
  addChord(chordData) {
    const clean = this._sanitizeChord({
      ...chordData,
      id: chordData.id || `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      isCustom: true
    });
    this.chords.push(clean);
    this.save();
    return clean;
  }

  updateChord(id, chordData) {
    const idx = this.chords.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    const existing = this.chords[idx];
    const updated = this._sanitizeChord({
      ...existing,
      ...chordData,
      id: existing.id
    });
    this.chords[idx] = updated;
    this.save();
    return updated;
  }

  deleteChord(id) {
    const idx = this.chords.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.chords.splice(idx, 1);
    this.save();
    return true;
  }

  cloneChord(id) {
    const source = this.getById(id) || this.chords[0];
    if (!source) return null;

    let suffixNum = 1;
    let candidateSymbol = `${source.symbol || 'M'}c${suffixNum}`;
    while (this.getBySymbol(candidateSymbol)) {
      suffixNum += 1;
      candidateSymbol = `${source.symbol || 'M'}c${suffixNum}`;
    }

    const cloned = this._sanitizeChord({
      ...source,
      id: `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: `${source.name} (Custom)`,
      symbol: candidateSymbol,
      aliases: [],
      category: 'custom',
      isCustom: true
    });
    this.chords.unshift(cloned);
    this.save();
    return cloned;
  }

  exportJSON() {
    return JSON.stringify(this.chords, null, 2);
  }

  importJSON(jsonString) {
    const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid chord dictionary JSON: expected a non-empty array of chord objects.');
    }
    this.chords = parsed.map((c) => this._sanitizeChord(c));
    this.save();
    return this.chords;
  }

  resetToDefaults() {
    this.chords = JSON.parse(JSON.stringify(this.defaultChords));
    this.save();
    return this.chords;
  }
}

export const chordDictionary = new ChordDictionary();
export default chordDictionary;
