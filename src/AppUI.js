import { AppEditorsMixin } from './AppEditors.js';
import { AppSettingsModalsMixin } from './AppSettingsModals.js';
import { chordDictionary } from './theory/ChordDictionary.js';
import { ChordDictionaryModal } from './ui/ChordDictionaryModal.js';
/**
 * src/AppUI.js - AutoBand Front-End UI/UX Controller
 * Manages tab navigation, Main Stage loops/palette/snapshots, Unified Pattern Library,
 * Drum/Bass/Chord specialized editors, 10-slot GM Drum Mapper, MIDI/SF2 routing chooser,
 * modals, and real-time TimingEngine/MidiBridge/SoundFont wiring.
 */

import {
  DEFAULT_GM_PRESETS,
  GM_PRESET_OPTIONS,
  DEFAULT_DRUM_VELOCITIES,
  DEFAULT_DRUM_SLOTS,
  GM_DRUM_CATALOG,
  STEP_RESOLUTIONS,
  getDefaultBeatSeparator,
  createDefaultPatterns,
  DEFAULT_TRACK_SLOTS,
  createDefaultSnapshots
} from './defaults.js';

const STRICT_PITCHES = [
  'C1', 'C#1', 'D1', 'Eb1', 'E1', 'F1', 'F#1', 'G1', 'Ab1', 'A1', 'Bb1', 'B1',
  'C2', 'C#2', 'D2', 'Eb2', 'E2', 'F2', 'F#2', 'G2', 'Ab2', 'A2', 'Bb2', 'B2',
  'C3', 'C#3', 'D3', 'Eb3', 'E3', 'F3', 'F#3', 'G3'
];
const HARMONIC_DEGREES = [
  '-5', '-b6', '-6', '-b7', '-7',
  'R', 'b2', '2', 'b3', '3', '4', 'b5', '5', 'b6', '6', 'b7', '7', 'R8'
];
const PITCH_TO_MIDI = {
  C1: 24, 'C#1': 25, Db1: 25, D1: 26, 'D#1': 27, Eb1: 27, E1: 28, F1: 29, 'F#1': 30, Gb1: 30, G1: 31, 'G#1': 32, Ab1: 32, A1: 33, 'A#1': 34, Bb1: 34, B1: 35,
  C2: 36, 'C#2': 37, Db2: 37, D2: 38, 'D#2': 39, Eb2: 39, E2: 40, F2: 41, 'F#2': 42, Gb2: 42, G2: 43, 'G#2': 44, Ab2: 44, A2: 45, 'A#2': 46, Bb2: 46, B2: 47,
  C3: 48, 'C#3': 49, Db3: 49, D3: 50, 'D#3': 51, Eb3: 51, E3: 52, F3: 53, 'F#3': 54, Gb3: 54, G3: 55
};
const DEGREE_TO_OFFSET = {
  '-5': -5, '-b6': -4, '-6': -3, '-b7': -2, '-7': -1,
  R: 0, b2: 1, '2': 2, b3: 3, '3': 4, '4': 5, b5: 6, '5': 7, b6: 8, '6': 9, b7: 10, '7': 11, R8: 12
};

const ROOT_TO_MIDI = {
  C: 60, 'C#': 61, Db: 61, D: 62, 'D#': 63, Eb: 63, E: 64, F: 65,
  'F#': 66, Gb: 66, G: 67, 'G#': 68, Ab: 68, A: 69, 'A#': 70, Bb: 70, B: 71
};

export class AppUI {
  constructor({ engine, midiBridge, soundFontManager, ensureSystemInitialized }) {
    this.engine = engine;
    this.midiBridge = midiBridge;
    this.soundFontManager = soundFontManager;
    this.ensureSystemInitialized = ensureSystemInitialized;

    // 10-Slot Rhythm Instrument Assignment (Initialized from src/defaults.js & Saved in Snapshots)
    this.drumSlots = DEFAULT_DRUM_SLOTS.map(s => ({ ...s }));

    // Drum Pattern Step Velocities (MIDI 1-127, configurable in System Settings)
    this.drumVelocities = { ...DEFAULT_DRUM_VELOCITIES };

    // Pattern Library State (Initialized from src/defaults.js)
    this.patterns = createDefaultPatterns();
    this.paletteFilter = 'all';
    this.paletteSearch = '';
    this.libraryFilter = 'all';
    this.librarySearch = '';

    // Track Chains & Mixer State on Main Stage
    this.tracks = {
      drums: {
        id: 'drums',
        label: 'DRUMS',
        letter: 'A',
        level: 100,
        muted: false,
        solo: false,
        selectedSlot: 0,
        slots: DEFAULT_TRACK_SLOTS.drums.map(s => ({ ...s }))
      },
      bass: {
        id: 'bass',
        label: 'BASS',
        letter: 'B',
        level: 100,
        muted: false,
        solo: false,
        selectedSlot: 0,
        slots: DEFAULT_TRACK_SLOTS.bass.map(s => ({ ...s }))
      },
      chords: {
        id: 'chords',
        label: 'CHORDS',
        letter: 'C',
        level: 100,
        muted: false,
        solo: false,
        selectedSlot: 0,
        slots: DEFAULT_TRACK_SLOTS.chords.map(s => ({ ...s }))
      }
    };

    // Pre-populated Snapshots (Initialized from src/defaults.js)
    this.snapshots = createDefaultSnapshots();

    // Active Editor & Modal State
    this.editingPatternId = null;
    this.pendingDeletePatternId = null;
    this.pendingSnapshotName = null;
    this.soloTimer = null;

    // Active Playback Cursor & Multi-Signature Sync Mode ('bar-fit' | 'independent' | 'master-reset')
    this.timeSigSyncMode = 'independent';
    this.activeBarIndex = 0;
    this.activeBeatInBar = 0;
    this.masterClock = null;
    this.trackClocks = null;
  }

  getGMDrumLabelByPitch(pitch) {
    const num = parseInt(pitch, 10);
    for (const grp of GM_DRUM_CATALOG) {
      for (const item of grp.items) {
        if (item.pitch === num) return item.label;
      }
    }
    return `GM Note ${num}`;
  }

  /**
   * Resolve MIDI velocity (1-127) for a Drum Pattern step state:
   * - state === 2: Hi / Accent (default 127)
   * - state === 1: Normal Hit (default 90)
   * - state === 3: Ghost Hit (default 25)
   */
  getDrumStepVelocity(state) {
    if (state === 2) return this.drumVelocities.accent;
    if (state === 1) return this.drumVelocities.normal;
    if (state === 3) return this.drumVelocities.ghost;
    return 0;
  }

  updateDrumVelocityLegend() {
    const elAccent = document.getElementById('lbl-vel-accent');
    const elNormal = document.getElementById('lbl-vel-normal');
    const elGhost = document.getElementById('lbl-vel-ghost');
    if (elAccent) elAccent.textContent = String(this.drumVelocities.accent);
    if (elNormal) elNormal.textContent = String(this.drumVelocities.normal);
    if (elGhost) elGhost.textContent = String(this.drumVelocities.ghost);

    const inpAccent = document.getElementById('vel-drum-accent');
    const inpNormal = document.getElementById('vel-drum-normal');
    const inpGhost = document.getElementById('vel-drum-ghost');
    if (inpAccent) inpAccent.value = String(this.drumVelocities.accent);
    if (inpNormal) inpNormal.value = String(this.drumVelocities.normal);
    if (inpGhost) inpGhost.value = String(this.drumVelocities.ghost);
  }

  /**
   * Parse "upper/lower" time signature into { upper: 1..21, lower: 4|8 }
   */
  parseTimeSig(timeSig = '4/4') {
    const parts = (timeSig || '4/4').split('/');
    const upper = Math.max(1, Math.min(21, parseInt(parts[0], 10) || 4));
    const lower = parseInt(parts[1], 10) === 8 ? 8 : 4;
    return { upper, lower };
  }

  /**
   * Slots per Time-Signature beat unit (per /4 when lower=4, or per /8 when lower=8):
   * - If lower = 4: 1/8 -> 2, 1/8T -> 3, 1/16 -> 4, 1/32 -> 8
   * - If lower = 8: 1/8 -> 1, 1/8T -> 3, 1/16 -> 2, 1/32 -> 4
   */
  getStepsPerUnit(timeSig = '4/4', resolution = '1/16') {
    const { lower } = this.parseTimeSig(timeSig);
    const res = STEP_RESOLUTIONS[resolution] || STEP_RESOLUTIONS['1/16'];
    return lower === 8 ? res.stepsPerEighth : res.stepsPerQuarter;
  }

  /**
   * Slots per Quarter-Note pulse (TimingEngine pulse = 1/4 note):
   * - 1/8  = 2 slots per quarter note (whether 4/4 or 7/8!)
   * - 1/8T = 3 slots per quarter note in /4 (or 6 in /8)
   * - 1/16 = 4 slots per quarter note
   * - 1/32 = 8 slots per quarter note
   */
  getSlotsPerQuarter(timeSig = '4/4', resolution = '1/16') {
    const { lower } = this.parseTimeSig(timeSig);
    const res = STEP_RESOLUTIONS[resolution] || STEP_RESOLUTIONS['1/16'];
    return lower === 8 ? (res.stepsPerEighth * 2) : res.stepsPerQuarter;
  }

  /**
   * Exact number of slots in 1 Bar for any (upper/lower, resolution):
   * Examples:
   * - 7/8 @ 1/8  -> 7 * 1 = 7 slots/bar  (14 slots only if 2 bars or @ 1/16)
   * - 6/8 @ 1/8  -> 6 * 1 = 6 slots/bar
   * - 6/8 @ 1/16 -> 6 * 2 = 12 slots/bar
   * - 4/4 @ 1/8T -> 4 * 3 = 12 slots/bar
   * - 4/4 @ 1/16 -> 4 * 4 = 16 slots/bar
   */
  getStepsPerBar(timeSig = '4/4', resolution = '1/16') {
    const { upper } = this.parseTimeSig(timeSig);
    return upper * this.getStepsPerUnit(timeSig, resolution);
  }

  getTotalSteps(pat) {
    if (!pat) return 16;
    return this.getStepsPerBar(pat.timeSig || '4/4', pat.resolution || '1/16') * (pat.bars || 1);
  }

  getBeatSepForPattern(pat) {
    if (!pat) return 4;
    const val = parseInt(pat.beatSep, 10);
    if (val >= 1 && val <= 9) return val;
    return getDefaultBeatSeparator(pat.timeSig || '4/4', pat.resolution || '1/16');
  }

  /**
   * Returns true if a chord slot string represents silence / rest / N.C.
   * Empty string "", "O", "0", "-", "NC", "N.C.", "REST", "Ø" are all treated as silence.
   */
  isSilentChordSymbol(symbol) {
    if (symbol === undefined || symbol === null) return true;
    const clean = String(symbol).trim();
    if (!clean) return true;
    return /^(o|0|-|—|nc|n\.c\.|rest|silence|ø)$/i.test(clean);
  }

  captureSnapshotState(tempo = 120) {
    return {
      tempo,
      drumSlots: this.drumSlots.map(s => ({ ...s })),
      tracks: {
        drums: this.tracks.drums.slots.map(s => ({ ...s })),
        bass: this.tracks.bass.slots.map(s => ({ ...s })),
        chords: this.tracks.chords.slots.map(s => ({ ...s }))
      }
    };
  }

  // --- Workspace Persistence (LocalStorage + Portable .json Export/Import) ---
  getWorkspaceStorageKey() {
    return 'AutoBand_Workspace_v1';
  }

  serializeWorkspace() {
    return {
      version: 1,
      savedAt: new Date().toISOString(),
      tempo: this.engine ? this.engine.tempo : 120,
      timeSigSyncMode: this.timeSigSyncMode || 'independent',
      drumVelocities: { ...this.drumVelocities },
      drumSlots: this.drumSlots.map(s => ({ ...s })),
      tracks: {
        drums: {
          muted: !!this.tracks.drums.muted,
          solo: !!this.tracks.drums.solo,
          selectedSlot: this.tracks.drums.selectedSlot || 0,
          slots: this.tracks.drums.slots.map(s => ({ ...s }))
        },
        bass: {
          muted: !!this.tracks.bass.muted,
          solo: !!this.tracks.bass.solo,
          selectedSlot: this.tracks.bass.selectedSlot || 0,
          slots: this.tracks.bass.slots.map(s => ({ ...s }))
        },
        chords: {
          muted: !!this.tracks.chords.muted,
          solo: !!this.tracks.chords.solo,
          selectedSlot: this.tracks.chords.selectedSlot || 0,
          slots: this.tracks.chords.slots.map(s => ({ ...s }))
        }
      },
      patterns: JSON.parse(JSON.stringify(this.patterns)),
      snapshots: JSON.parse(JSON.stringify(this.snapshots))
    };
  }

  applyWorkspaceData(data) {
    if (!data || typeof data !== 'object') return false;

    if (typeof data.tempo === 'number' && data.tempo >= 40 && data.tempo <= 300) {
      if (this.engine && typeof this.engine.setTempo === 'function') {
        this.engine.setTempo(data.tempo);
      }
      const bpmVal = document.getElementById('bpm-value');
      const bpmSlider = document.getElementById('bpm-slider');
      if (bpmVal) bpmVal.textContent = String(data.tempo);
      if (bpmSlider) bpmSlider.value = String(data.tempo);
    }

    if (typeof data.timeSigSyncMode === 'string' && ['bar-fit', 'independent', 'master-reset'].includes(data.timeSigSyncMode)) {
      this.timeSigSyncMode = data.timeSigSyncMode;
      if (typeof this.updateSyncModeUI === 'function') this.updateSyncModeUI();
    }

    if (data.drumVelocities && typeof data.drumVelocities === 'object') {
      this.drumVelocities = {
        ...this.drumVelocities,
        ...data.drumVelocities
      };
      this.updateDrumVelocityLegend();
    }

    if (Array.isArray(data.drumSlots) && data.drumSlots.length >= 8) {
      this.drumSlots = data.drumSlots.map(s => ({ ...s }));
    }

    if (Array.isArray(data.patterns) && data.patterns.length > 0) {
      this.patterns = JSON.parse(JSON.stringify(data.patterns));
    }

    if (data.tracks && typeof data.tracks === 'object') {
      ['drums', 'bass', 'chords'].forEach(tk => {
        const src = data.tracks[tk];
        if (!src) return;
        if (Array.isArray(src)) {
          this.tracks[tk].slots = src.map(s => ({ ...s }));
        } else if (Array.isArray(src.slots)) {
          this.tracks[tk].slots = src.slots.map(s => ({ ...s }));
          if (typeof src.muted === 'boolean') this.tracks[tk].muted = src.muted;
          if (typeof src.solo === 'boolean') this.tracks[tk].solo = src.solo;
          if (typeof src.selectedSlot === 'number') this.tracks[tk].selectedSlot = src.selectedSlot;
        }
      });
    }

    if (data.snapshots && typeof data.snapshots === 'object') {
      this.snapshots = JSON.parse(JSON.stringify(data.snapshots));
      this.syncSnapshotDropdown();
    }

    return true;
  }

  syncSnapshotDropdown() {
    const snapSelect = document.getElementById('snapshot-select');
    if (!snapSelect || !this.snapshots) return;
    const currentVal = snapSelect.value;
    snapSelect.innerHTML = '';
    Object.keys(this.snapshots).forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      snapSelect.appendChild(opt);
    });
    if (this.snapshots[currentVal]) {
      snapSelect.value = currentVal;
    }
  }

  saveWorkspaceToLocalStorage() {
    try {
      const payload = this.serializeWorkspace();
      localStorage.setItem(this.getWorkspaceStorageKey(), JSON.stringify(payload));
    } catch (err) {
      console.warn('[Workspace] LocalStorage auto-save failed:', err);
    }
  }

  loadWorkspaceFromLocalStorage() {
    try {
      const raw = localStorage.getItem(this.getWorkspaceStorageKey());
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      return this.applyWorkspaceData(parsed);
    } catch (err) {
      console.warn('[Workspace] LocalStorage restore failed:', err);
      return false;
    }
  }

  exportWorkspaceJson() {
    const payload = this.serializeWorkspace();
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autoband-project-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.log(`[Project] ⬇ Exported workspace (${this.patterns.length} patterns, ${Object.keys(this.snapshots).length} snapshots) to autoband-project-${dateStamp}.json`);
  }

  importWorkspaceJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || !Array.isArray(data.patterns)) {
          this.log('[Project] ⚠️ Invalid project .json file (missing patterns array).');
          return;
        }
        this.applyWorkspaceData(data);
        this.saveWorkspaceToLocalStorage();
        this.renderStageTracks();
        this.renderPalette();
        this.renderPatternLibrary();
        this.renderDrumSlotMapper();
        this.updateChordDisplay(0, 0);
        if (this.editingPatternId && this.getPatternById(this.editingPatternId)) {
          this.openEditorForPattern(this.editingPatternId);
        }
        this.log(`[Project] ⬆ Imported project "${file.name}" (${this.patterns.length} patterns, ${Object.keys(this.snapshots).length} snapshots).`);
      } catch (err) {
        this.log(`[Project] ⚠️ Failed to parse project JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  init() {
    const restored = this.loadWorkspaceFromLocalStorage();

    // Initialize interactive Chord Dictionary & Voicing Explorer Modal
    this.chordDictModal = new ChordDictionaryModal({
      dictionary: chordDictionary,
      appUI: this
    });
    chordDictionary.init();
    chordDictionary.subscribe(() => {
      const currentPat = this.getPatternById(this.editingPatternId);
      if (currentPat && currentPat.type === 'chords') {
        this.renderChordMeasuresGrid(currentPat);
      }
      this.updateChordDisplay(this.activeBarIndex || 0, 0);
    });

    this.bindGlobalNavigation();
    this.bindLoggerFooter();
    this.bindTransportControls();
    this.bindChordsDisplayer();
    this.bindStageTracksAndPalette();
    this.bindPatternLibraryAndEditors();
    this.bindSettingsControls();
    this.bindModals();

    this.syncSnapshotDropdown();
    this.renderStageTracks();
    this.renderPalette();
    this.renderPatternLibrary();
    this.renderDrumSlotMapper();
    this.renderSystemMidiRouting({
      rhythm: this.midiBridge.getRouteInfo('rhythm'),
      bass: this.midiBridge.getRouteInfo('bass'),
      chords: this.midiBridge.getRouteInfo('chords'),
      forceInternalSf2: this.midiBridge.forceInternalSf2,
      allPorts: [
        { id: 'internal', name: '🔊 Internal .sf2 / Web Audio Synth' }
      ]
    });
    this.updateChordDisplay(0, 0);

    if (restored) {
      this.log('[UI] AutoBand Workspace Restored from LocalStorage. Click PLAY or press Spacebar.');
    } else {
      this.log('[UI] AutoBand Front-End Workspace Ready. Click PLAY or press Spacebar.');
    }
  }

  // --- Logger HUD ---
  log(message) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 2 });
    const latestElem = document.getElementById('logger-latest-text');
    const historyElem = document.getElementById('message-box');

    if (latestElem) {
      latestElem.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
    }
    if (historyElem) {
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
      historyElem.appendChild(entry);
      historyElem.scrollTop = historyElem.scrollHeight;
    }
  }

  bindLoggerFooter() {
    const loggerFooter = document.getElementById('system-logger');
    const loggerBar = document.getElementById('logger-toggle-bar');
    const toggleIndicator = document.getElementById('logger-expand-icon');

    if (loggerBar && loggerFooter) {
      loggerBar.addEventListener('click', () => {
        const expanded = loggerFooter.classList.toggle('expanded');
        if (toggleIndicator) {
          toggleIndicator.textContent = expanded ? '[▼ Collapse Console]' : '[▲ Expand Console]';
        }
      });
    }
  }

  // --- 1. Top Global Navigation ---
  bindGlobalNavigation() {
    const navButtons = document.querySelectorAll('.nav-tab-btn');
    const views = document.querySelectorAll('.view-container');

    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        navButtons.forEach(b => b.classList.remove('active'));
        views.forEach(v => v.classList.remove('active'));

        btn.classList.add('active');
        const targetView = document.getElementById(targetId);
        if (targetView) targetView.classList.add('active');

        const tabLabel = btn.textContent.trim();
        this.log(`[UI] Switched to ${tabLabel} tab`);
      });
    });
  }

  // --- 2. Transport, Precount, Master Volume & Snapshot Controls ---
  bindTransportControls() {
    const btnPlay = document.getElementById('btn-play');
    const bpmSlider = document.getElementById('bpm-slider');
    const bpmInput = document.getElementById('bpm-input');
    const pillBpm = document.getElementById('clock-pill-bpm');

    const precountDec = document.getElementById('precount-dec');
    const precountInc = document.getElementById('precount-inc');
    const precountVal = document.getElementById('precount-val');
    const precountTick = document.getElementById('precount-tick');
    const playbackTick = document.getElementById('playback-tick');

    const syncMetronome = () => {
      const amount = parseInt(precountVal.textContent, 10) || 0;
      this.engine.setPrecountSettings(amount, precountTick.checked, playbackTick.checked);
    };

    precountDec.addEventListener('click', () => {
      const current = parseInt(precountVal.textContent, 10) || 0;
      precountVal.textContent = Math.max(0, current - 1);
      syncMetronome();
    });

    precountInc.addEventListener('click', () => {
      const current = parseInt(precountVal.textContent, 10) || 0;
      precountVal.textContent = Math.min(16, current + 1);
      syncMetronome();
    });

    precountTick.addEventListener('change', syncMetronome);
    playbackTick.addEventListener('change', syncMetronome);

    const setTempo = (val) => {
      const clamped = Math.max(40, Math.min(280, parseFloat(val) || 120));
      this.engine.setTempo(clamped);
      bpmSlider.value = clamped;
      bpmInput.value = clamped.toFixed(1);
      if (pillBpm) pillBpm.textContent = `${clamped.toFixed(1)} BPM`;
    };
    this.setTempo = setTempo;

    bpmSlider.addEventListener('input', (e) => setTempo(e.target.value));
    bpmInput.addEventListener('change', (e) => setTempo(e.target.value));

    const togglePlay = async () => {
      await this.ensureSystemInitialized();
      if (!this.engine.isPlaying) {
        syncMetronome();
        this.activeBarIndex = 0;
        this.activeBeatInBar = 0;
        this.engine.start();
        btnPlay.textContent = '■ STOP';
        btnPlay.classList.add('is-playing');
        this.log(`[TRANSPORT] Sequencer STARTED at ${parseFloat(this.engine.tempo).toFixed(1)} BPM`);
      } else {
        this.engine.stop();
        btnPlay.textContent = '▶ PLAY';
        btnPlay.classList.remove('is-playing');
        this.clearPlayingSlotHighlights();
        const pulseLed = document.getElementById('pulse-indicator');
        if (pulseLed) {
          pulseLed.className = 'beat-pulse-led';
          pulseLed.textContent = 'IDLE';
        }
        this.log('[TRANSPORT] Sequencer STOPPED');
      }
    };

    btnPlay.addEventListener('click', togglePlay);

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    });

    // Master Output Volume & Limiter LED
    const sliderMasterVol = document.getElementById('slider-master-vol');
    const valMasterVol = document.getElementById('val-master-vol');
    const limiterLed = document.getElementById('limiter-led');

    sliderMasterVol.addEventListener('input', (e) => {
      const pct = parseInt(e.target.value, 10);
      valMasterVol.textContent = `${pct}%`;
      this.soundFontManager.setMasterVolume(pct / 100);
      if (limiterLed) {
        limiterLed.className = pct > 92 ? 'limiter-led clipping' : 'limiter-led ok';
      }
    });

    // Snapshot Manager (Save / Overwrite with confirmation modal / Recall on change)
    const snapshotInput = document.getElementById('snapshot-name-input');
    const btnSaveSnapshot = document.getElementById('btn-save-snapshot');
    const snapshotSelect = document.getElementById('snapshot-select');

    if (snapshotInput && snapshotSelect) {
      snapshotInput.value = snapshotSelect.value;
    }

    btnSaveSnapshot.addEventListener('click', () => {
      const targetName = snapshotInput.value.trim() || snapshotSelect.value || 'Snapshot 1 (Default)';
      if (this.snapshots[targetName]) {
        // Existing snapshot name -> open Overwrite Confirmation Modal
        this.pendingSnapshotName = targetName;
        const msgEl = document.getElementById('overwrite-snapshot-message');
        if (msgEl) {
          msgEl.textContent = `Snapshot "${targetName}" already exists. Do you want to overwrite it with the current stage & drum-kit settings?`;
        }
        document.getElementById('modal-overwrite-snapshot').classList.add('open');
      } else {
        this.commitSaveSnapshot(targetName, false);
      }
    });

    snapshotSelect.addEventListener('change', (e) => {
      const snapName = e.target.value;
      if (snapshotInput) snapshotInput.value = snapName;
      const snap = this.snapshots[snapName];
      if (!snap) return;

      setTempo(snap.tempo || 120);
      if (snap.drumSlots && snap.drumSlots.length === 10) {
        this.drumSlots = snap.drumSlots.map(s => ({ ...s }));
        this.renderDrumSlotMapper();
        if (this.editingPatternId) {
          const edPat = this.getPatternById(this.editingPatternId);
          if (edPat && edPat.type === 'drums') {
            this.renderDrumMatrix(edPat);
          }
        }
      }
      ['drums', 'bass', 'chords'].forEach(trackKey => {
        if (snap.tracks[trackKey]) {
          this.tracks[trackKey].slots = snap.tracks[trackKey].map(s => ({ ...s }));
          this.tracks[trackKey].selectedSlot = 0;
        }
      });
      this.renderStageTracks();
      this.updateChordDisplay(0, 0);
      this.log(`[SNAPSHOT] Recalled "${snapName}" (including 10-slot drum mapping)`);
    });

    // Pre-count & Metronome Tick Callback: Play SF2 Rimshot (GM Note 37) when SoundFont is loaded,
    // or return false to keep the locally generated oscillator beep as fallback.
    this.engine.onTickCallback = (isPrecount, scheduledTime) => {
      if (this.soundFontManager && this.soundFontManager.isLoaded) {
        const vel = isPrecount ? 118 : 96;
        return this.soundFontManager.playRimshotTick(scheduledTime, vel);
      }
      return false;
    };

    // Pulse Callback from TimingEngine
    this.engine.onPulseCallback = (pulseNumber, scheduledTime) => {
      const timeUntilPulse = this.engine.audioCtx
        ? Math.max(0, (scheduledTime - this.engine.audioCtx.currentTime) * 1000)
        : 0;

      // Schedule musical pattern notes on playback beats
      if (pulseNumber >= 0) {
        this.schedulePlaybackBeat(pulseNumber, scheduledTime);
      } else {
        setTimeout(() => {
          const pulseLed = document.getElementById('pulse-indicator');
          if (!this.engine.isPlaying || !pulseLed) return;
          pulseLed.className = 'beat-pulse-led pulse-precount';
          pulseLed.textContent = `${pulseNumber}`;
          setTimeout(() => {
            if (this.engine.isPlaying) pulseLed.className = 'beat-pulse-led';
          }, 110);
        }, timeUntilPulse);
      }
    };

    // High-resolution Master Time Animation Loop
    const updateClockLoop = () => {
      const pillTime = document.getElementById('clock-pill-time');
      if (this.engine.isPlaying && pillTime) {
        const elapsedSecs = this.engine.getElapsedTime();
        const isNeg = elapsedSecs < 0;
        const abs = Math.abs(elapsedSecs);
        const mins = Math.floor(abs / 60).toString().padStart(2, '0');
        const secs = Math.floor(abs % 60).toString().padStart(2, '0');
        const tenths = Math.floor((abs % 1) * 10);
        pillTime.textContent = `${isNeg ? '-' : ''}${mins}:${secs}.${tenths}`;
        pillTime.classList.toggle('precount-active', isNeg);
      } else if (pillTime) {
        pillTime.textContent = '00:00.0';
        pillTime.classList.remove('precount-active');
      }
      requestAnimationFrame(updateClockLoop);
    };
    requestAnimationFrame(updateClockLoop);
  }

  commitSaveSnapshot(name, isOverwrite = false) {
    const snapshotSelect = document.getElementById('snapshot-select');
    const snapshotInput = document.getElementById('snapshot-name-input');
    this.snapshots[name] = this.captureSnapshotState(parseFloat(this.engine.tempo));
    this.saveWorkspaceToLocalStorage();

    if (snapshotSelect) {
      let exists = false;
      for (const opt of snapshotSelect.options) {
        if (opt.value === name) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        snapshotSelect.appendChild(opt);
      }
      snapshotSelect.value = name;
    }
    if (snapshotInput) {
      snapshotInput.value = name;
    }
    this.log(`[SNAPSHOT] ${isOverwrite ? 'Overwrote' : 'Saved new'} snapshot "${name}"`);
  }

  // Schedule Drum, Bass, and Chord notes for a quarter-note lookahead window using MidiBridge,
  // with full support for all 3 Time-Signature Sync Modes ('bar-fit', 'independent', 'master-reset'),
  // sequential time-signature changes (e.g. 4/4 -> 7/8), and per-pattern Tempo Ratios.
  schedulePlaybackBeat(pulseNumber, beatTime) {
    this.scheduleMultiSigBeat(pulseNumber, beatTime);
  }

  // --- 3. Block B: Chords Displayer ("Now & Next") ---
  bindChordsDisplayer() {
    const foldBtn = document.getElementById('btn-fold-chords');
    const card = document.getElementById('chords-displayer-card');
    const prefToggle = document.getElementById('pref-show-chords');

    const setCollapsed = (collapsed) => {
      if (!card || !foldBtn) return;
      card.classList.toggle('collapsed', collapsed);
      foldBtn.textContent = collapsed ? '[+]' : '[-]';
      if (prefToggle) prefToggle.checked = !collapsed;
    };

    if (foldBtn && card) {
      foldBtn.addEventListener('click', () => {
        const willCollapse = !card.classList.contains('collapsed');
        setCollapsed(willCollapse);
        this.log(`[UI] Chords Displayer ${willCollapse ? 'collapsed' : 'expanded'}`);
      });
    }

    if (prefToggle) {
      prefToggle.addEventListener('change', (e) => {
        setCollapsed(!e.target.checked);
      });
    }
  }

  updateChordDisplay(barIndex = 0, beatIndex = 0, totalBeatsInBar = 4) {
    const nowMeta = document.getElementById('chord-now-meta');
    const nowSymbol = document.getElementById('chord-now-symbol');
    const nextMeta = document.getElementById('chord-next-meta');
    const nextSymbol = document.getElementById('chord-next-symbol');

    const chordSlots = this.tracks.chords.slots;
    if (!chordSlots || chordSlots.length === 0) return;

    const currentSlot = chordSlots[barIndex % chordSlots.length];
    const nextSlot = chordSlots[(barIndex + 1) % chordSlots.length];
    const currentPat = this.getPatternById(currentSlot.patternId);
    const nextPat = this.getPatternById(nextSlot.patternId);

    let nowMeasure = ['Am7'];
    let nextMeasure = ['D7'];
    let activeIdxInBar = 0;

    if (currentPat && currentPat.measures && currentPat.measures.length > 0) {
      const m = currentPat.measures[barIndex % currentPat.measures.length];
      if (m && m.length > 0) {
        nowMeasure = m;
        activeIdxInBar = Math.min(m.length - 1, Math.floor((beatIndex / Math.max(1, totalBeatsInBar)) * m.length));
      }
    }
    if (nextPat && nextPat.measures && nextPat.measures.length > 0) {
      const nextM = nextPat.measures[(barIndex + 1) % nextPat.measures.length];
      if (nextM && nextM.length > 0) {
        nextMeasure = nextM;
      }
    }

    const isLastChordOfCurrentBar = activeIdxInBar >= nowMeasure.length - 1;

    if (nowMeta) {
      nowMeta.textContent = `NOW • BAR ${barIndex + 1} • BEAT ${beatIndex + 1} / ${totalBeatsInBar}`;
    }
    if (nowSymbol) {
      const countClass = `count-${Math.min(4, Math.max(1, nowMeasure.length))}`;
      nowSymbol.className = `chord-stage-symbol chord-stage-bar-row ${countClass}`;
      nowSymbol.innerHTML = nowMeasure.map((sym, i) => {
        const silent = this.isSilentChordSymbol(sym);
        const label = silent ? 'Ø' : sym;
        const activeClass = i === activeIdxInBar ? ' is-active' : '';
        const silentClass = silent ? ' is-silent-chord' : '';
        const sep = i < nowMeasure.length - 1 ? '<span class="chord-bar-sep">·</span>' : '';
        return `<span class="chord-bar-item${activeClass}${silentClass}" title="${silent ? 'Silent / N.C.' : label}">${label}</span>${sep}`;
      }).join('');
    }

    if (nextMeta) {
      nextMeta.textContent = `NEXT BAR • BAR ${barIndex + 2}`;
    }
    if (nextSymbol) {
      const nextCountClass = `count-${Math.min(4, Math.max(1, nextMeasure.length))}`;
      nextSymbol.className = `chord-stage-symbol chord-stage-bar-row ${nextCountClass}`;
      nextSymbol.innerHTML = nextMeasure.map((sym, i) => {
        const silent = this.isSilentChordSymbol(sym);
        const label = silent ? 'Ø' : sym;
        const immediateClass = (isLastChordOfCurrentBar && i === 0) ? ' is-next-immediate' : '';
        const silentClass = silent ? ' is-silent-chord' : '';
        const sep = i < nextMeasure.length - 1 ? '<span class="chord-bar-sep">·</span>' : '';
        return `<span class="chord-bar-item${immediateClass}${silentClass}" title="${silent ? 'Silent / N.C.' : label}">${label}</span>${sep}`;
      }).join('');
    }
  }

  // --- 4. Block C: The Loops & Pattern Palette ---
  bindStageTracksAndPalette() {
    const paletteChips = document.querySelectorAll('#palette-filter-chips .filter-chip');
    paletteChips.forEach(chip => {
      chip.addEventListener('click', () => {
        paletteChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.paletteFilter = chip.getAttribute('data-filter');
        this.renderPalette();
      });
    });

    const paletteSearchInput = document.getElementById('palette-search-input');
    if (paletteSearchInput) {
      paletteSearchInput.addEventListener('input', (e) => {
        this.paletteSearch = e.target.value.trim().toLowerCase();
        this.renderPalette();
      });
    }
  }

  updateEffectiveTrackGains() {
    const anySolo = Object.values(this.tracks).some(t => t.solo);
    const mapMod = { drums: 'rhythm', bass: 'bass', chords: 'chords' };

    ['drums', 'bass', 'chords'].forEach(key => {
      const t = this.tracks[key];
      const audible = !t.muted && (!anySolo || t.solo);
      const gainVal = audible ? (t.level / 100) : 0;
      this.soundFontManager.setModuleVolume(mapMod[key], gainVal);
    });
  }

  renderStageTracks() {
    const container = document.getElementById('stage-tracks-container');
    if (!container) return;
    container.innerHTML = '';

    ['drums', 'bass', 'chords'].forEach(trackKey => {
      const track = this.tracks[trackKey];
      const row = document.createElement('div');
      row.className = `loop-track-row track-${trackKey}`;

      const presetOptionsHtml = this.getPresetOptionsHtml(trackKey);

      row.innerHTML = `
        <div class="track-header-bar">
          <div class="track-title-cluster">
            <span class="track-letter-badge">${track.letter}</span>
            <span class="track-title-text">${track.label}</span>
          </div>

          <div class="track-controls-cluster">
            <select class="track-preset-select" data-track="${trackKey}" title="${track.label} SoundFont Preset">
              ${presetOptionsHtml}
            </select>

            <div class="track-level-wrap">
              <span>LVL</span>
              <input type="range" class="track-level-slider" data-track="${trackKey}" min="0" max="100" value="${track.level}">
              <span class="track-level-val" id="track-lvl-val-${trackKey}">${track.level}%</span>
            </div>

            <div class="track-ms-cluster">
              <button class="btn-ms mute-btn ${track.muted ? 'active' : ''}" data-track="${trackKey}" title="Mute ${track.label}">M</button>
              <button class="btn-ms solo-btn ${track.solo ? 'active' : ''}" data-track="${trackKey}" title="Solo ${track.label}">S</button>
            </div>

            <button class="btn track-test-btn" data-track="${trackKey}" style="padding: 0.25rem 0.55rem; font-size: 0.74rem;">Test</button>

            <div class="track-level-wrap">
              <span>Loop Size</span>
              <div class="stepper">
                <button class="stepper-btn loop-size-dec" data-track="${trackKey}">−</button>
                <span class="stepper-val">${track.slots.length}</span>
                <button class="stepper-btn loop-size-inc" data-track="${trackKey}">+</button>
              </div>
            </div>
          </div>
        </div>

        <div class="track-slots-chain" id="slots-chain-${trackKey}"></div>
      `;

      container.appendChild(row);

      const chainEl = row.querySelector(`#slots-chain-${trackKey}`);
      track.slots.forEach((slotObj, slotIdx) => {
        const pat = this.getPatternById(slotObj.patternId) || {
          id: slotObj.patternId,
          name: 'Empty',
          timeSig: '4/4'
        };

        const unit = document.createElement('div');
        unit.className = 'slot-unit';

        const tensionSign = slotObj.tension > 0 ? `+${slotObj.tension}` : `${slotObj.tension}`;
        const isSelected = track.selectedSlot === slotIdx;

        const ratioTag = (pat.tempoRatio && pat.tempoRatio !== '1:1') ? ` • ${pat.tempoRatio}` : '';
        unit.innerHTML = `
          <div class="pattern-slot-box ${isSelected ? 'selected-slot' : ''}"
               draggable="true"
               data-track="${trackKey}"
               data-slot-index="${slotIdx}"
               title="Click to select, Drag to reorder or drop from Palette, Double-click to Edit">
            <div class="slot-top-meta">
              <span class="slot-index-tag">#${slotIdx + 1}</span>
              <span class="slot-timesig-badge">${pat.timeSig}${ratioTag}</span>
            </div>
            <div class="slot-pattern-code">${pat.id}</div>
            <div class="slot-pattern-name">${pat.name}</div>
          </div>

          <div class="slot-tension-stepper" title="Macro Tension Offset (-5 to +5)">
            <button class="slot-tension-btn tension-dec" data-track="${trackKey}" data-slot="${slotIdx}">−</button>
            <span class="slot-tension-val ${slotObj.tension !== 0 ? 'non-zero' : ''}">${tensionSign}</span>
            <button class="slot-tension-btn tension-inc" data-track="${trackKey}" data-slot="${slotIdx}">+</button>
          </div>
        `;

        const slotBox = unit.querySelector('.pattern-slot-box');

        slotBox.addEventListener('click', () => {
          this.tracks[trackKey].selectedSlot = slotIdx;
          this.renderStageTracks();
        });

        slotBox.addEventListener('dblclick', () => {
          this.openEditorForPattern(pat.id);
        });

        slotBox.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', JSON.stringify({
            source: 'slot',
            trackKey,
            slotIdx,
            patternId: slotObj.patternId
          }));
        });

        slotBox.addEventListener('dragover', (e) => {
          e.preventDefault();
          slotBox.classList.add('drag-over');
        });

        slotBox.addEventListener('dragleave', () => {
          slotBox.classList.remove('drag-over');
        });

        slotBox.addEventListener('drop', (e) => {
          e.preventDefault();
          slotBox.classList.remove('drag-over');
          try {
            const payload = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (payload.source === 'palette') {
              const droppedPat = this.getPatternById(payload.patternId);
              if (droppedPat && droppedPat.type === trackKey) {
                this.tracks[trackKey].slots[slotIdx].patternId = droppedPat.id;
                this.renderStageTracks();
                this.updateChordDisplay(this.activeBarIndex, 0);
                this.log(`[STAGE] Assigned ${droppedPat.id} (${droppedPat.name}) to ${track.label} Slot #${slotIdx + 1}`);
              } else {
                this.log(`[STAGE] Cannot assign ${payload.patternId} to ${track.label} track`);
              }
            } else if (payload.source === 'slot' && payload.trackKey === trackKey) {
              const fromIdx = payload.slotIdx;
              const temp = this.tracks[trackKey].slots[fromIdx];
              this.tracks[trackKey].slots[fromIdx] = this.tracks[trackKey].slots[slotIdx];
              this.tracks[trackKey].slots[slotIdx] = temp;
              this.renderStageTracks();
              this.log(`[STAGE] Swapped ${track.label} Slot #${fromIdx + 1} and #${slotIdx + 1}`);
            }
          } catch (_) {}
        });

        chainEl.appendChild(unit);
      });
    });

    container.querySelectorAll('.track-preset-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const trackKey = sel.getAttribute('data-track');
        const prog = parseInt(e.target.value, 10);
        const optText = sel.options[sel.selectedIndex].text;
        const ch = trackKey === 'drums' ? 10 : (trackKey === 'bass' ? 2 : 3);
        const bank = trackKey === 'drums' ? 128 : 0;
        this.soundFontManager.setPreset(ch, bank, prog, optText);
        this.log(`[SF2] ${trackKey.toUpperCase()} preset -> ${optText}`);
      });
    });

    container.querySelectorAll('.track-level-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const trackKey = slider.getAttribute('data-track');
        const val = parseInt(e.target.value, 10);
        this.tracks[trackKey].level = val;
        const lbl = document.getElementById(`track-lvl-val-${trackKey}`);
        if (lbl) lbl.textContent = `${val}%`;
        this.updateEffectiveTrackGains();
      });
    });

    container.querySelectorAll('.mute-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const trackKey = btn.getAttribute('data-track');
        this.tracks[trackKey].muted = !this.tracks[trackKey].muted;
        const rehearsalBtn = document.getElementById('btn-rehearsal-mute-bass');
        if (trackKey === 'bass' && rehearsalBtn) {
          rehearsalBtn.classList.toggle('active', this.tracks.bass.muted);
        }
        this.updateEffectiveTrackGains();
        this.renderStageTracks();
        this.log(`[MIXER] ${trackKey.toUpperCase()} ${this.tracks[trackKey].muted ? 'MUTED' : 'UNMUTED'}`);
      });
    });

    container.querySelectorAll('.solo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const trackKey = btn.getAttribute('data-track');
        this.tracks[trackKey].solo = !this.tracks[trackKey].solo;
        this.updateEffectiveTrackGains();
        this.renderStageTracks();
        this.log(`[MIXER] ${trackKey.toUpperCase()} Solo ${this.tracks[trackKey].solo ? 'ON' : 'OFF'}`);
      });
    });

    container.querySelectorAll('.track-test-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const trackKey = btn.getAttribute('data-track');
        this.triggerQuickAudition(trackKey);
      });
    });

    container.querySelectorAll('.loop-size-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        const trackKey = btn.getAttribute('data-track');
        const slots = this.tracks[trackKey].slots;
        if (slots.length > 1) {
          slots.pop();
          this.tracks[trackKey].selectedSlot = Math.min(this.tracks[trackKey].selectedSlot, slots.length - 1);
          this.renderStageTracks();
          this.log(`[STAGE] ${trackKey.toUpperCase()} Loop Size -> ${slots.length}`);
        }
      });
    });

    container.querySelectorAll('.loop-size-inc').forEach(btn => {
      btn.addEventListener('click', () => {
        const trackKey = btn.getAttribute('data-track');
        const slots = this.tracks[trackKey].slots;
        if (slots.length < 12) {
          const fallbackId = slots[slots.length - 1]?.patternId || (trackKey === 'drums' ? 'D-01' : (trackKey === 'bass' ? 'B-01' : 'C-01'));
          slots.push({ patternId: fallbackId, tension: 0 });
          this.renderStageTracks();
          this.log(`[STAGE] ${trackKey.toUpperCase()} Loop Size -> ${slots.length}`);
        }
      });
    });

    container.querySelectorAll('.tension-dec').forEach(btn => {
      btn.addEventListener('click', () => {
        const trackKey = btn.getAttribute('data-track');
        const slotIdx = parseInt(btn.getAttribute('data-slot'), 10);
        const slot = this.tracks[trackKey].slots[slotIdx];
        slot.tension = Math.max(-5, slot.tension - 1);
        this.renderStageTracks();
      });
    });

    container.querySelectorAll('.tension-inc').forEach(btn => {
      btn.addEventListener('click', () => {
        const trackKey = btn.getAttribute('data-track');
        const slotIdx = parseInt(btn.getAttribute('data-slot'), 10);
        const slot = this.tracks[trackKey].slots[slotIdx];
        slot.tension = Math.min(5, slot.tension + 1);
        this.renderStageTracks();
      });
    });

    if (typeof this.evaluateAndRenderSyncStatus === 'function') {
      this.evaluateAndRenderSyncStatus(false);
    }
  }

  getPresetOptionsHtml(trackKey) {
    const modKey = trackKey === 'drums' ? 'rhythm' : trackKey;
    const current = this.soundFontManager.activePresets[modKey].program;
    const list = GM_PRESET_OPTIONS[trackKey] || [];
    return list
      .map(opt => `<option value="${opt.value}" ${current === opt.value ? 'selected' : ''}>${opt.label}</option>`)
      .join('');
  }

  async triggerQuickAudition(trackKey) {
    await this.ensureSystemInitialized();
    const now = this.engine.audioCtx.currentTime;
    if (trackKey === 'drums') {
      this.midiBridge.sendNoteOn('rhythm', this.drumSlots[0].pitch, 115, now, 0.2);
      this.midiBridge.sendNoteOn('rhythm', this.drumSlots[2].pitch, 95,  now + 0.14, 0.15);
      this.midiBridge.sendNoteOn('rhythm', this.drumSlots[1].pitch, 112, now + 0.28, 0.2);
    } else if (trackKey === 'bass') {
      this.midiBridge.sendNoteOn('bass', 33, 110, now, 0.3);
      this.midiBridge.sendNoteOn('bass', 40, 102, now + 0.22, 0.35);
    } else {
      [60, 64, 67, 71].forEach(n => this.midiBridge.sendNoteOn('chords', n, 92, now, 0.55));
    }
    this.log(`[AUDIO] Auditioned ${trackKey.toUpperCase()} channel`);
  }

  highlightPlayingSlots(barIndex) {
    this.clearPlayingSlotHighlights();
    ['drums', 'bass', 'chords'].forEach(trackKey => {
      const slots = this.tracks[trackKey].slots;
      if (!slots.length) return;
      const activeIdx = barIndex % slots.length;
      const box = document.querySelector(`.pattern-slot-box[data-track="${trackKey}"][data-slot-index="${activeIdx}"]`);
      if (box) box.classList.add('is-playing');
    });
  }

  clearPlayingSlotHighlights() {
    document.querySelectorAll('.pattern-slot-box.is-playing').forEach(el => {
      el.classList.remove('is-playing');
    });
  }

  renderPalette() {
    const grid = document.getElementById('palette-tiles-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const filtered = this.patterns.filter(p => {
      if (this.paletteFilter !== 'all' && p.type !== this.paletteFilter) return false;
      if (this.paletteSearch && !(`${p.id} ${p.name}`).toLowerCase().includes(this.paletteSearch)) return false;
      return true;
    });

    filtered.forEach(p => {
      const tile = document.createElement('div');
      tile.className = `palette-tile type-${p.type}`;
      tile.draggable = true;
      tile.title = 'Drag onto a track slot, Click to assign to selected slot, Double-click to open Editor';
      const pRatio = (p.tempoRatio && p.tempoRatio !== '1:1') ? `•${p.tempoRatio}` : '';
      tile.innerHTML = `
        <div class="palette-tile-top">
          <span>${p.id}</span>
          <span>${p.timeSig}${pRatio}</span>
        </div>
        <div class="palette-tile-name">${p.name}</div>
      `;

      tile.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({
          source: 'palette',
          patternId: p.id
        }));
      });

      tile.addEventListener('click', () => {
        const track = this.tracks[p.type];
        if (!track || !track.slots.length) return;
        const targetIdx = Math.min(track.selectedSlot || 0, track.slots.length - 1);
        track.slots[targetIdx].patternId = p.id;
        this.saveWorkspaceToLocalStorage();
        this.renderStageTracks();
        this.updateChordDisplay(this.activeBarIndex, 0);
        this.log(`[PALETTE] Assigned ${p.id} (${p.name}) to ${track.label} Slot #${targetIdx + 1}`);
      });

      tile.addEventListener('dblclick', () => {
        this.openEditorForPattern(p.id);
      });

      grid.appendChild(tile);
    });
  }
}
Object.assign(AppUI.prototype, AppEditorsMixin, AppSettingsModalsMixin);

