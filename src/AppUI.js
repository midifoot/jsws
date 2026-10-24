/**
 * src/AppUI.js - AutoBand Front-End UI/UX Controller
 * Manages tab navigation, Main Stage loops/palette/snapshots, Unified Pattern Library,
 * Drum/Bass/Chord specialized editors, modals, and real-time TimingEngine/MidiBridge/SoundFont wiring.
 */

const DRUM_INSTRUMENTS = [
  { code: 'BD',     label: 'Bass Drum',   pitch: 36 },
  { code: 'SD',     label: 'Snare',       pitch: 38 },
  { code: 'CH',     label: 'Closed Hat',  pitch: 42 },
  { code: 'OH',     label: 'Open Hat',    pitch: 46 },
  { code: 'LT',     label: 'Low Tom',     pitch: 45 },
  { code: 'HT',     label: 'High Tom',    pitch: 50 },
  { code: 'CYM',    label: 'Cymbal',      pitch: 49 },
  { code: 'PERC 1', label: 'Clap / Rim',  pitch: 39 },
  { code: 'PERC 2', label: 'Shaker',      pitch: 70 },
  { code: 'MISC',   label: 'Cowbell',     pitch: 56 }
];

const STRICT_PITCHES = ['E1', 'F1', 'G1', 'A1', 'B1', 'C2', 'D2', 'E2', 'G2'];
const HARMONIC_DEGREES = ['R', '2', 'b3', '3', '4', '5', '6', 'b7', 'R8'];
const PITCH_TO_MIDI = {
  E1: 28, F1: 29, G1: 31, A1: 33, B1: 35, C2: 36, D2: 38, E2: 40, G2: 43
};
const DEGREE_TO_OFFSET = {
  R: 0, '2': 2, b3: 3, '3': 4, '4': 5, '5': 7, '6': 9, b7: 10, R8: 12
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

    // Pattern Library State
    this.patterns = this.createInitialPatterns();
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
        slots: [
          { patternId: 'D-01', tension: 0 },
          { patternId: 'D-01', tension: 1 },
          { patternId: 'D-02', tension: 2 },
          { patternId: 'D-03', tension: 0 }
        ]
      },
      bass: {
        id: 'bass',
        label: 'BASS',
        letter: 'B',
        level: 100,
        muted: false,
        solo: false,
        selectedSlot: 0,
        slots: [
          { patternId: 'B-01', tension: 0 },
          { patternId: 'B-02', tension: 1 }
        ]
      },
      chords: {
        id: 'chords',
        label: 'CHORDS',
        letter: 'C',
        level: 100,
        muted: false,
        solo: false,
        selectedSlot: 0,
        slots: [
          { patternId: 'C-01', tension: 0 },
          { patternId: 'C-02', tension: 1 },
          { patternId: 'C-03', tension: 0 }
        ]
      }
    };

    // Pre-populated Snapshots
    this.snapshots = {
      'Snapshot 1 (Default)': this.captureSnapshotState(120),
      'Verse Groove': {
        tempo: 112,
        tracks: {
          drums: [{ patternId: 'D-01', tension: 0 }, { patternId: 'D-01', tension: 0 }],
          bass: [{ patternId: 'B-01', tension: 0 }, { patternId: 'B-01', tension: 1 }],
          chords: [{ patternId: 'C-01', tension: 0 }, { patternId: 'C-02', tension: 0 }]
        }
      },
      'Chorus Lift': {
        tempo: 126,
        tracks: {
          drums: [
            { patternId: 'D-02', tension: 2 },
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

    // Active Editor State
    this.editingPatternId = null;
    this.pendingDeletePatternId = null;
    this.soloTimer = null;

    // Active Playback Cursor
    this.activeBarIndex = 0;
    this.activeBeatInBar = 0;
  }

  createInitialPatterns() {
    // Default 16-step drum matrix (10 rows x 16 steps)
    const makeDrumGrid = (presetType = 'funk') => {
      const grid = DRUM_INSTRUMENTS.map(() => new Array(16).fill(0));
      if (presetType === 'funk') {
        [0, 6, 8, 10].forEach(s => { grid[0][s] = 1; }); // BD
        [4, 12].forEach(s => { grid[1][s] = 2; });       // SD Accent
        [7, 9, 15].forEach(s => { grid[1][s] = 3; });    // SD Ghost
        for (let s = 0; s < 16; s += 2) grid[2][s] = 1;  // CH
        grid[3][14] = 1;                                 // OH
      } else if (presetType === 'odd') {
        [0, 3, 8, 11].forEach(s => { grid[0][s] = 1; });
        [4, 12].forEach(s => { grid[1][s] = 2; });
        for (let s = 0; s < 16; s++) grid[2][s] = s % 4 === 0 ? 2 : 1;
        grid[7][6] = 3;
      } else {
        [0, 8].forEach(s => { grid[0][s] = 1; });
        [4, 12].forEach(s => { grid[1][s] = 1; });
        [0, 3, 4, 7, 8, 11, 12, 15].forEach(s => { grid[2][s] = 1; });
        grid[6][0] = 2;
      }
      return grid;
    };

    const makeBassSteps = (mode = 'strict') => {
      const notes = ['A1', 'A1', 'C2', 'D2', 'E2', 'E2', 'G2', 'E2', 'D2', 'D2', 'F1', 'G1', 'A1', 'C2', 'D2', 'E2'];
      const degrees = ['R', 'R', 'b3', '4', '5', '5', 'b7', '5', 'R', 'b3', '4', '5', 'R', '5', 'b7', 'R8'];
      return Array.from({ length: 16 }, (_, idx) => ({
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
        tension: 35,
        preset: 0,
        preview: [1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1],
        rowMutes: new Array(10).fill(false),
        rowSolos: new Array(10).fill(false),
        drumGrid: makeDrumGrid('funk')
      },
      {
        id: 'D-02',
        type: 'drums',
        name: 'OddPocket',
        timeSig: '7/8',
        syncMaster: true,
        bpm: 120,
        bars: 2,
        resolution: '1/16',
        tension: 50,
        preset: 16,
        preview: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
        rowMutes: new Array(10).fill(false),
        rowSolos: new Array(10).fill(false),
        drumGrid: makeDrumGrid('odd')
      },
      {
        id: 'D-03',
        type: 'drums',
        name: 'BrushSwing',
        timeSig: '4/4',
        syncMaster: true,
        bpm: 120,
        bars: 1,
        resolution: '1/16',
        tension: 20,
        preset: 40,
        preview: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1],
        rowMutes: new Array(10).fill(false),
        rowSolos: new Array(10).fill(false),
        drumGrid: makeDrumGrid('swing')
      },
      {
        id: 'B-01',
        type: 'bass',
        name: 'Walking',
        timeSig: '4/4',
        syncMaster: true,
        bpm: 120,
        bars: 1,
        resolution: '1/16',
        preset: 33,
        mode: 'follower',
        preview: [1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
        bassSteps: makeBassSteps('follower')
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
        preset: 36,
        mode: 'strict',
        preview: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0],
        bassSteps: makeBassSteps('strict')
      },
      {
        id: 'B-03',
        type: 'bass',
        name: 'SynthPulse',
        timeSig: '4/4',
        syncMaster: true,
        bpm: 120,
        bars: 2,
        resolution: '1/16',
        preset: 38,
        mode: 'follower',
        preview: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        bassSteps: makeBassSteps('follower')
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
        preset: 0,
        tension: 25,
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
        preset: 4,
        tension: 40,
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
        preset: 89,
        tension: 65,
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

  captureSnapshotState(tempo = 120) {
    return {
      tempo,
      tracks: {
        drums: this.tracks.drums.slots.map(s => ({ ...s })),
        bass: this.tracks.bass.slots.map(s => ({ ...s })),
        chords: this.tracks.chords.slots.map(s => ({ ...s }))
      }
    };
  }

  init() {
    this.bindGlobalNavigation();
    this.bindLoggerFooter();
    this.bindTransportControls();
    this.bindChordsDisplayer();
    this.bindStageTracksAndPalette();
    this.bindPatternLibraryAndEditors();
    this.bindSettingsControls();
    this.bindModals();

    this.renderStageTracks();
    this.renderPalette();
    this.renderPatternLibrary();
    this.updateChordDisplay(0, 0);

    this.log('[UI] AutoBand Front-End Workspace Ready. Click PLAY or press Spacebar.');
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
        this.log(`[TRANSPORT] Sequencer STARTED at ${ parseFloat(this.engine.tempo).toFixed(1) } BPM`);
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

    // Snapshot Manager
    const snapshotInput = document.getElementById('snapshot-name-input');
    const btnSaveSnapshot = document.getElementById('btn-save-snapshot');
    const snapshotSelect = document.getElementById('snapshot-select');

    btnSaveSnapshot.addEventListener('click', () => {
      const rawName = snapshotInput.value.trim() || `Snapshot ${Object.keys(this.snapshots).length + 1}`;
      this.snapshots[rawName] = this.captureSnapshotState(parseFloat(this.engine.tempo));

      let exists = false;
      for (const opt of snapshotSelect.options) {
        if (opt.value === rawName) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        const opt = document.createElement('option');
        opt.value = rawName;
        opt.textContent = rawName;
        snapshotSelect.appendChild(opt);
      }
      snapshotSelect.value = rawName;
      snapshotInput.value = '';
      this.log(`[SNAPSHOT] Saved "${rawName}"`);
    });

    snapshotSelect.addEventListener('change', (e) => {
      const snapName = e.target.value;
      const snap = this.snapshots[snapName];
      if (!snap) return;

      setTempo(snap.tempo || 120);
      ['drums', 'bass', 'chords'].forEach(trackKey => {
        if (snap.tracks[trackKey]) {
          this.tracks[trackKey].slots = snap.tracks[trackKey].map(s => ({ ...s }));
          this.tracks[trackKey].selectedSlot = 0;
        }
      });
      this.renderStageTracks();
      this.updateChordDisplay(0, 0);
      this.log(`[SNAPSHOT] Recalled "${snapName}"`);
    });

    // Pulse Callback from TimingEngine
    this.engine.onPulseCallback = (pulseNumber, scheduledTime) => {
      const timeUntilPulse = this.engine.audioCtx
        ? Math.max(0, (scheduledTime - this.engine.audioCtx.currentTime) * 1000)
        : 0;

      // Schedule musical pattern notes on playback beats
      if (pulseNumber >= 0) {
        this.schedulePlaybackBeat(pulseNumber, scheduledTime);
      }

      setTimeout(() => {
        const pulseLed = document.getElementById('pulse-indicator');
        if (!this.engine.isPlaying) return;

        if (pulseNumber < 0) {
          if (pulseLed) {
            pulseLed.className = 'beat-pulse-led pulse-precount';
            pulseLed.textContent = `${pulseNumber}`;
            setTimeout(() => {
              if (this.engine.isPlaying) pulseLed.className = 'beat-pulse-led';
            }, 110);
          }
        } else {
          const beatInBar = (pulseNumber % 4) + 1;
          const barIndex = Math.floor(pulseNumber / 4);
          this.activeBeatInBar = beatInBar;
          this.activeBarIndex = barIndex;

          if (pulseLed) {
            pulseLed.className = 'beat-pulse-led pulse-beat';
            pulseLed.textContent = `${beatInBar}/4`;
            setTimeout(() => {
              if (this.engine.isPlaying) pulseLed.className = 'beat-pulse-led';
            }, 110);
          }

          this.highlightPlayingSlots(barIndex);
          this.updateChordDisplay(barIndex, beatInBar - 1);
        }
      }, timeUntilPulse);
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

  // Schedule Drum, Bass, and Chord notes for a beat using MidiBridge
  schedulePlaybackBeat(pulseNumber, beatTime) {
    const beatInBar = pulseNumber % 4;
    const barIndex = Math.floor(pulseNumber / 4);
    const secPerBeat = 60.0 / (parseFloat(this.engine.tempo) || 120);
    const stepDur = secPerBeat / 4; // 16th note duration

    const anySolo = Object.values(this.tracks).some(t => t.solo);
    const isTrackAudible = (trackKey) => {
      const t = this.tracks[trackKey];
      if (t.muted) return false;
      if (anySolo && !t.solo) return false;
      return true;
    };

    // 1. Chords Track
    const chordSlots = this.tracks.chords.slots;
    let activeChordSymbol = 'Am7';
    if (chordSlots.length > 0) {
      const cSlot = chordSlots[barIndex % chordSlots.length];
      const cPat = this.getPatternById(cSlot.patternId);
      if (cPat && cPat.measures && cPat.measures.length > 0) {
        const m = cPat.measures[barIndex % cPat.measures.length];
        activeChordSymbol = m[Math.min(m.length - 1, Math.floor((beatInBar / 4) * m.length))] || 'Am7';
      }
      if (isTrackAudible('chords') && (beatInBar === 0 || (cPat && cPat.resolution !== '1/1' && beatInBar === 2))) {
        const midiNotes = this.chordSymbolToMidiNotes(activeChordSymbol);
        midiNotes.forEach(note => {
          this.midiBridge.sendNoteOn('chords', note, 85, beatTime, secPerBeat * 1.8);
        });
      }
    }

    // 2. Drums Track (4 sixteenth steps per beat)
    if (isTrackAudible('drums') && this.tracks.drums.slots.length > 0) {
      const dSlot = this.tracks.drums.slots[barIndex % this.tracks.drums.slots.length];
      const dPat = this.getPatternById(dSlot.patternId);
      if (dPat && dPat.drumGrid) {
        const anyRowSolo = dPat.rowSolos && dPat.rowSolos.some(Boolean);
        for (let sub = 0; sub < 4; sub++) {
          const stepIndex = (beatInBar * 4 + sub) % 16;
          const tStep = beatTime + sub * stepDur;
          DRUM_INSTRUMENTS.forEach((inst, rowIdx) => {
            if (dPat.rowMutes && dPat.rowMutes[rowIdx]) return;
            if (anyRowSolo && (!dPat.rowSolos || !dPat.rowSolos[rowIdx])) return;
            const state = dPat.drumGrid[rowIdx][stepIndex];
            if (state === 1) {
              this.midiBridge.sendNoteOn('rhythm', inst.pitch, 100, tStep, 0.15);
            } else if (state === 2) {
              this.midiBridge.sendNoteOn('rhythm', inst.pitch, 125, tStep, 0.18);
            } else if (state === 3) {
              this.midiBridge.sendNoteOn('rhythm', inst.pitch, 52, tStep, 0.12);
            }
          });
        }
      }
    }

    // 3. Bass Track (4 sixteenth steps per beat)
    if (isTrackAudible('bass') && this.tracks.bass.slots.length > 0) {
      const bSlot = this.tracks.bass.slots[barIndex % this.tracks.bass.slots.length];
      const bPat = this.getPatternById(bSlot.patternId);
      if (bPat && bPat.bassSteps) {
        const rootMidi = this.getChordRootMidi(activeChordSymbol) - 24;
        for (let sub = 0; sub < 4; sub++) {
          const stepIndex = (beatInBar * 4 + sub) % 16;
          const stepObj = bPat.bassSteps[stepIndex];
          if (!stepObj || stepObj.rest) continue;

          const tStep = beatTime + sub * stepDur;
          const midiPitch = bPat.mode === 'strict'
            ? (PITCH_TO_MIDI[stepObj.pitch] || 33)
            : (rootMidi + (DEGREE_TO_OFFSET[stepObj.degree] || 0));
          const vel = stepObj.accent ? 120 : 92;
          const dur = Math.max(0.06, stepDur * (stepObj.gate / 100));
          this.midiBridge.sendNoteOn('bass', midiPitch, vel, tStep, dur);
        }
      }
    }
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

  updateChordDisplay(barIndex = 0, beatIndex = 0) {
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

    let nowChord = 'Am7';
    let nextChord = 'D7';

    if (currentPat && currentPat.measures && currentPat.measures.length > 0) {
      const m = currentPat.measures[barIndex % currentPat.measures.length];
      const idx = Math.min(m.length - 1, Math.floor((beatIndex / 4) * m.length));
      nowChord = m[idx] || 'Am7';
    }
    if (nextPat && nextPat.measures && nextPat.measures.length > 0) {
      const nextM = nextPat.measures[(barIndex + 1) % nextPat.measures.length];
      nextChord = (nextM && nextM[0]) || 'D7';
    }

    if (nowMeta) nowMeta.textContent = `NOW • BEAT ${beatIndex + 1} / 4`;
    if (nowSymbol) nowSymbol.textContent = nowChord;
    if (nextMeta) nextMeta.textContent = `NEXT • BAR ${barIndex + 2}`;
    if (nextSymbol) nextSymbol.textContent = nextChord;
  }

  // --- 4. Block C: The Loops & Pattern Palette ---
  bindStageTracksAndPalette() {
    // Filter chips on Main Stage Palette
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

      // Populate slots inside this track row
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

        unit.innerHTML = `
          <div class="pattern-slot-box ${isSelected ? 'selected-slot' : ''}"
               draggable="true"
               data-track="${trackKey}"
               data-slot-index="${slotIdx}"
               title="Click to select, Drag to reorder or drop from Palette, Double-click to Edit">
            <div class="slot-top-meta">
              <span class="slot-index-tag">#${slotIdx + 1}</span>
              <span class="slot-timesig-badge">${pat.timeSig}</span>
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

        // Click to select slot
        slotBox.addEventListener('click', () => {
          this.tracks[trackKey].selectedSlot = slotIdx;
          this.renderStageTracks();
        });

        // Double click to jump directly to pattern editor
        slotBox.addEventListener('dblclick', () => {
          this.openEditorForPattern(pat.id);
        });

        // Drag & Drop support (both from Palette and slot-to-slot reordering)
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

    // Bind events for newly rendered controls
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
  }

  getPresetOptionsHtml(trackKey) {
    if (trackKey === 'drums') {
      const current = this.soundFontManager.activePresets.rhythm.program;
      return [
        [0, 'Standard Kit (0)'],
        [8, 'Room Kit (8)'],
        [16, 'Power Kit (16)'],
        [24, '808 / Electronic (24)'],
        [32, 'Jazz Kit (32)'],
        [40, 'Brush Kit (40)']
      ].map(([val, text]) => `<option value="${val}" ${current === val ? 'selected' : ''}>${text}</option>`).join('');
    }
    if (trackKey === 'bass') {
      const current = this.soundFontManager.activePresets.bass.program;
      return [
        [33, 'Fingered Bass (33)'],
        [34, 'Picked Bass (34)'],
        [35, 'Fretless Bass (35)'],
        [36, 'Slap Bass 1 (36)'],
        [37, 'Slap Bass 2 (37)'],
        [38, 'Synth Bass 1 (38)'],
        [39, 'Synth Bass 2 (39)']
      ].map(([val, text]) => `<option value="${val}" ${current === val ? 'selected' : ''}>${text}</option>`).join('');
    }
    const current = this.soundFontManager.activePresets.chords.program;
    return [
      [0, 'Grand Piano (0)'],
      [1, 'Bright Piano (1)'],
      [4, 'Rhodes EP 1 (4)'],
      [5, 'DX EP 2 (5)'],
      [7, 'Clavinet (7)'],
      [11, 'Vibraphone (11)'],
      [89, 'Warm Synth Pad (89)']
    ].map(([val, text]) => `<option value="${val}" ${current === val ? 'selected' : ''}>${text}</option>`).join('');
  }

  async triggerQuickAudition(trackKey) {
    await this.ensureSystemInitialized();
    const now = this.engine.audioCtx.currentTime;
    if (trackKey === 'drums') {
      this.midiBridge.sendNoteOn('rhythm', 36, 115, now, 0.2);
      this.midiBridge.sendNoteOn('rhythm', 42, 95,  now + 0.14, 0.15);
      this.midiBridge.sendNoteOn('rhythm', 38, 112, now + 0.28, 0.2);
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
      tile.title = 'Drag onto a track slot, or click to assign to the currently selected slot';
      tile.innerHTML = `
        <div class="palette-tile-top">
          <span>${p.id}</span>
          <span>${p.timeSig}</span>
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
        this.renderStageTracks();
        this.updateChordDisplay(this.activeBarIndex, 0);
        this.log(`[PALETTE] Assigned ${p.id} (${p.name}) to ${track.label} Slot #${targetIdx + 1}`);
      });

      grid.appendChild(tile);
    });
  }

  // --- 5. View 2: Unified Patterns Library & Specialized Editors ---
  bindPatternLibraryAndEditors() {
    const libChips = document.querySelectorAll('#library-filter-chips .filter-chip');
    libChips.forEach(chip => {
      chip.addEventListener('click', () => {
        libChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.libraryFilter = chip.getAttribute('data-filter');
        this.renderPatternLibrary();
      });
    });

    const libSearch = document.getElementById('library-search-input');
    if (libSearch) {
      libSearch.addEventListener('input', (e) => {
        this.librarySearch = e.target.value.trim().toLowerCase();
        this.renderPatternLibrary();
      });
    }

    // Back to Patterns buttons
    document.querySelectorAll('.btn-back-to-patterns').forEach(btn => {
      btn.addEventListener('click', () => {
        this.stopSoloAudition();
        this.closeEditorsToLibrary();
      });
    });

    // Save Changes buttons in Editors
    document.querySelectorAll('.btn-save-pattern').forEach(btn => {
      btn.addEventListener('click', () => {
        this.saveActiveEditorChanges();
      });
    });

    this.bindDrumEditorControls();
    this.bindBassEditorControls();
    this.bindChordEditorControls();
  }

  renderPatternLibrary() {
    const listEl = document.getElementById('pattern-table-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const filtered = this.patterns.filter(p => {
      if (this.libraryFilter !== 'all' && p.type !== this.libraryFilter) return false;
      if (this.librarySearch && !(`${p.id} ${p.name}`).toLowerCase().includes(this.librarySearch)) return false;
      return true;
    });

    filtered.forEach(p => {
      const row = document.createElement('div');
      row.className = 'pattern-row';

      const syncText = p.syncMaster ? 'Sync with Master' : `${p.bpm || 120} BPM`;
      const stepsCount = (p.bars || 1) * 16;
      const lengthText = `${p.bars || 1} Bar${(p.bars || 1) > 1 ? 's' : ''} (${stepsCount} Steps @ ${p.resolution || '1/16'})`;

      const dotsHtml = (p.preview || new Array(16).fill(0)).map(v =>
        `<span class="mini-step-dot ${v ? 'on' : ''} ${p.type}"></span>`
      ).join('');

      row.innerHTML = `
        <span class="pattern-id-pill ${p.type}">${p.id}</span>
        <input type="text" class="pattern-name-inline" maxlength="12" value="${p.name}" data-id="${p.id}" title="Click to rename (max 12 chars)">
        <span class="badge-mono">${p.timeSig}</span>
        <span class="badge-mono col-sync">${syncText}</span>
        <span class="badge-mono col-length">${lengthText}</span>
        <div class="mini-step-preview">${dotsHtml}</div>
        <div class="pattern-row-actions">
          <button class="btn btn-green btn-edit-pattern" data-id="${p.id}">EDIT</button>
          <button class="btn btn-danger btn-delete-pattern" data-id="${p.id}">DELETE</button>
        </div>
      `;

      const nameInput = row.querySelector('.pattern-name-inline');
      nameInput.addEventListener('change', (e) => {
        const clean = e.target.value.trim().slice(0, 12) || p.name;
        p.name = clean;
        e.target.value = clean;
        this.renderPalette();
        this.renderStageTracks();
        this.log(`[PATTERNS] Renamed ${p.id} to "${clean}"`);
      });

      row.querySelector('.btn-edit-pattern').addEventListener('click', () => {
        this.openEditorForPattern(p.id);
      });

      row.querySelector('.btn-delete-pattern').addEventListener('click', () => {
        this.openDeleteConfirmModal(p.id);
      });

      listEl.appendChild(row);
    });
  }

  openEditorForPattern(patternId) {
    const pat = this.getPatternById(patternId);
    if (!pat) return;

    this.editingPatternId = pat.id;

    // Ensure PATTERNS tab is active
    document.querySelectorAll('.nav-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-target') === 'view-patterns');
    });
    document.querySelectorAll('.view-container').forEach(v => {
      v.classList.toggle('active', v.id === 'view-patterns');
    });

    // Hide Library Table, show the corresponding Editor
    const libView = document.getElementById('pattern-library-view');
    if (libView) libView.style.display = 'none';

    document.querySelectorAll('.editor-panel').forEach(ed => ed.classList.remove('active'));

    if (pat.type === 'drums') {
      this.populateDrumEditor(pat);
      document.getElementById('editor-drums').classList.add('active');
    } else if (pat.type === 'bass') {
      this.populateBassEditor(pat);
      document.getElementById('editor-bass').classList.add('active');
    } else if (pat.type === 'chords') {
      this.populateChordEditor(pat);
      document.getElementById('editor-chords').classList.add('active');
    }

    this.log(`[EDITOR] Opened ${pat.type.toUpperCase()} Editor for ${pat.id} (${pat.name})`);
  }

  closeEditorsToLibrary() {
    document.querySelectorAll('.editor-panel').forEach(ed => ed.classList.remove('active'));
    const libView = document.getElementById('pattern-library-view');
    if (libView) libView.style.display = 'block';
    this.editingPatternId = null;
    this.log('[UI] Returned to Pattern Library');
  }

  saveActiveEditorChanges() {
    const pat = this.getPatternById(this.editingPatternId);
    if (!pat) return;

    if (pat.type === 'drums') {
      pat.name = (document.getElementById('drum-ed-name').value.trim() || pat.name).slice(0, 12);
      pat.timeSig = document.getElementById('drum-ed-timesig').value;
      pat.syncMaster = document.getElementById('drum-ed-sync').checked;
      pat.bars = parseInt(document.getElementById('drum-ed-bars').textContent, 10) || 1;
      pat.resolution = document.getElementById('drum-ed-res').value;
      pat.tension = parseInt(document.getElementById('drum-ed-tension').value, 10) || 0;
      pat.preview = pat.drumGrid[0].slice(0, 16).map((v, i) => (v > 0 || pat.drumGrid[1][i] > 0 || pat.drumGrid[2][i] > 0 ? 1 : 0));
    } else if (pat.type === 'bass') {
      pat.name = (document.getElementById('bass-ed-name').value.trim() || pat.name).slice(0, 12);
      pat.timeSig = document.getElementById('bass-ed-timesig').value;
      pat.syncMaster = document.getElementById('bass-ed-sync').checked;
      pat.resolution = document.getElementById('bass-ed-res').value;
      pat.preview = pat.bassSteps.slice(0, 16).map(s => (s.rest ? 0 : 1));
    } else if (pat.type === 'chords') {
      pat.name = (document.getElementById('chord-ed-name').value.trim() || pat.name).slice(0, 12);
      pat.timeSig = document.getElementById('chord-ed-timesig').value;
      pat.syncMaster = document.getElementById('chord-ed-sync').checked;
      pat.voicing = document.getElementById('chord-ed-voicing').value;
      pat.tension = parseInt(document.getElementById('chord-ed-tension').value, 10) || 0;
    }

    this.renderPatternLibrary();
    this.renderPalette();
    this.renderStageTracks();
    this.updateChordDisplay(this.activeBarIndex, 0);
    this.log(`[EDITOR] Saved changes to ${pat.id} (${pat.name})`);
    this.stopSoloAudition();
    this.closeEditorsToLibrary();
  }

  // --- 5.1 Drum Lab Editor (#editor-drums) ---
  bindDrumEditorControls() {
    const barsDec = document.getElementById('drum-bars-dec');
    const barsInc = document.getElementById('drum-bars-inc');
    const barsVal = document.getElementById('drum-ed-bars');
    const tensionSlider = document.getElementById('drum-ed-tension');
    const tensionVal = document.getElementById('drum-ed-tension-val');
    const soloBtn = document.getElementById('btn-drum-solo');

    barsDec.addEventListener('click', () => {
      const pat = this.getPatternById(this.editingPatternId);
      if (!pat) return;
      pat.bars = Math.max(1, (pat.bars || 1) - 1);
      barsVal.textContent = pat.bars;
      this.renderDrumMatrix(pat);
    });

    barsInc.addEventListener('click', () => {
      const pat = this.getPatternById(this.editingPatternId);
      if (!pat) return;
      pat.bars = Math.min(4, (pat.bars || 1) + 1);
      barsVal.textContent = pat.bars;
      this.renderDrumMatrix(pat);
    });

    tensionSlider.addEventListener('input', (e) => {
      tensionVal.textContent = `${e.target.value}%`;
    });

    soloBtn.addEventListener('click', () => {
      this.toggleSoloAudition('drums', soloBtn);
    });
  }

  populateDrumEditor(pat) {
    document.getElementById('drum-ed-title').textContent = `Editing: ${pat.id} ${pat.name}`;
    document.getElementById('drum-ed-name').value = pat.name;
    document.getElementById('drum-ed-timesig').value = pat.timeSig;
    document.getElementById('drum-ed-sync').checked = pat.syncMaster;
    document.getElementById('drum-ed-bars').textContent = pat.bars || 1;
    document.getElementById('drum-ed-res').value = pat.resolution || '1/16';
    document.getElementById('drum-ed-tension').value = pat.tension || 35;
    document.getElementById('drum-ed-tension-val').textContent = `${pat.tension || 35}%`;

    this.renderDrumMatrix(pat);
  }

  renderDrumMatrix(pat) {
    const container = document.getElementById('drum-matrix-container');
    if (!container) return;
    container.innerHTML = '';

    const stepCount = (pat.bars || 1) > 1 ? 32 : 16;

    DRUM_INSTRUMENTS.forEach((inst, rowIdx) => {
      while (pat.drumGrid[rowIdx].length < stepCount) {
        pat.drumGrid[rowIdx].push(0);
      }

      const rowEl = document.createElement('div');
      rowEl.className = 'drum-row';

      const isMuted = pat.rowMutes && pat.rowMutes[rowIdx];
      const isSolo = pat.rowSolos && pat.rowSolos[rowIdx];

      rowEl.innerHTML = `
        <div class="drum-row-header">
          <div>
            <div class="drum-inst-code">${inst.code}</div>
            <div class="drum-inst-sub">${inst.label}</div>
          </div>
          <div class="track-ms-cluster">
            <button class="btn-ms mute-btn ${isMuted ? 'active' : ''}" data-row="${rowIdx}">M</button>
            <button class="btn-ms solo-btn ${isSolo ? 'active' : ''}" data-row="${rowIdx}">S</button>
          </div>
        </div>
        <div class="drum-steps-grid"></div>
      `;

      rowEl.querySelector('.mute-btn').addEventListener('click', (e) => {
        pat.rowMutes[rowIdx] = !pat.rowMutes[rowIdx];
        e.currentTarget.classList.toggle('active', pat.rowMutes[rowIdx]);
      });

      rowEl.querySelector('.solo-btn').addEventListener('click', (e) => {
        pat.rowSolos[rowIdx] = !pat.rowSolos[rowIdx];
        e.currentTarget.classList.toggle('active', pat.rowSolos[rowIdx]);
      });

      const stepsGrid = rowEl.querySelector('.drum-steps-grid');
      for (let s = 0; s < stepCount; s++) {
        const state = pat.drumGrid[rowIdx][s] || 0;
        const btn = document.createElement('button');
        btn.className = 'drum-step-btn';
        btn.setAttribute('data-state', state);
        btn.title = `Step ${s + 1} (Click to cycle: Off -> Hit -> Accent -> Ghost)`;

        btn.addEventListener('click', async () => {
          const nextState = ((pat.drumGrid[rowIdx][s] || 0) + 1) % 4;
          pat.drumGrid[rowIdx][s] = nextState;
          btn.setAttribute('data-state', nextState);

          if (nextState > 0) {
            await this.ensureSystemInitialized();
            const vel = nextState === 2 ? 125 : (nextState === 1 ? 100 : 52);
            this.midiBridge.sendNoteOn('rhythm', inst.pitch, vel, this.engine.audioCtx.currentTime, 0.15);
          }
        });

        stepsGrid.appendChild(btn);
      }

      container.appendChild(rowEl);
    });
  }

  // --- 5.2 Bassline Editor (#editor-bass) ---
  bindBassEditorControls() {
    const modeStrictBtn = document.getElementById('bass-mode-strict');
    const modeFollowerBtn = document.getElementById('bass-mode-follower');
    const presetSelect = document.getElementById('bass-ed-preset');
    const rehearsalMuteBtn = document.getElementById('btn-rehearsal-mute-bass');
    const soloBtn = document.getElementById('btn-bass-solo');

    modeStrictBtn.addEventListener('click', () => {
      const pat = this.getPatternById(this.editingPatternId);
      if (!pat) return;
      pat.mode = 'strict';
      modeStrictBtn.classList.add('active');
      modeFollowerBtn.classList.remove('active');
      this.renderBassRibbon(pat);
      this.log('[BASS EDITOR] Switched to STRICT PITCH mode');
    });

    modeFollowerBtn.addEventListener('click', () => {
      const pat = this.getPatternById(this.editingPatternId);
      if (!pat) return;
      pat.mode = 'follower';
      modeFollowerBtn.classList.add('active');
      modeStrictBtn.classList.remove('active');
      this.renderBassRibbon(pat);
      this.log('[BASS EDITOR] Switched to HARMONIC FOLLOWER mode');
    });

    presetSelect.addEventListener('change', (e) => {
      const prog = parseInt(e.target.value, 10);
      const optText = presetSelect.options[presetSelect.selectedIndex].text;
      this.soundFontManager.setPreset(2, 0, prog, optText);
      this.renderStageTracks();
      this.log(`[SF2] Bass Preset -> ${optText}`);
    });

    rehearsalMuteBtn.addEventListener('click', () => {
      this.tracks.bass.muted = !this.tracks.bass.muted;
      rehearsalMuteBtn.classList.toggle('active', this.tracks.bass.muted);
      this.updateEffectiveTrackGains();
      this.renderStageTracks();
      this.log(`[REHEARSAL] Bass Rehearsal Mute ${this.tracks.bass.muted ? 'ENABLED' : 'DISABLED'}`);
    });

    soloBtn.addEventListener('click', () => {
      this.toggleSoloAudition('bass', soloBtn);
    });
  }

  populateBassEditor(pat) {
    document.getElementById('bass-ed-title').textContent = `Editing: ${pat.id} ${pat.name}`;
    document.getElementById('bass-ed-name').value = pat.name;
    document.getElementById('bass-ed-timesig').value = pat.timeSig;
    document.getElementById('bass-ed-sync').checked = pat.syncMaster;
    document.getElementById('bass-ed-res').value = pat.resolution || '1/16';
    document.getElementById('bass-ed-preset').value = pat.preset || 33;

    const isStrict = pat.mode === 'strict';
    document.getElementById('bass-mode-strict').classList.toggle('active', isStrict);
    document.getElementById('bass-mode-follower').classList.toggle('active', !isStrict);

    const rehearsalMuteBtn = document.getElementById('btn-rehearsal-mute-bass');
    rehearsalMuteBtn.classList.toggle('active', this.tracks.bass.muted);

    this.renderBassRibbon(pat);
  }

  renderBassRibbon(pat) {
    const ribbon = document.getElementById('bass-step-ribbon');
    if (!ribbon) return;
    ribbon.innerHTML = '';

    pat.bassSteps.forEach((step, idx) => {
      const card = document.createElement('div');
      card.className = `bass-step-card ${step.rest ? 'is-rest' : ''}`;

      const badgeText = pat.mode === 'strict' ? step.pitch : step.degree;
      const gateText = step.gate === 25 ? '25% Stac' : (step.gate === 50 ? '50% Std' : '100% Leg');

      card.innerHTML = `
        <span class="bass-step-num">#${idx + 1}</span>
        <button class="bass-pitch-pill" title="Click to cycle pitch / scale degree">${badgeText}</button>
        <div class="bass-gate-bar" title="Click to cycle Gate Length (25% / 50% / 100%)">
          <div class="bass-gate-fill" style="width: ${step.gate}%;"></div>
          <span class="bass-gate-label">${gateText}</span>
        </div>
        <div class="bass-articulations">
          <button class="bass-art-btn ${step.accent ? 'active' : ''}" data-art="accent" title="Accent">&gt;</button>
          <button class="bass-art-btn ${step.slide ? 'active' : ''}" data-art="slide" title="Slide / Glissando">/</button>
          <button class="bass-art-btn ${step.rest ? 'active' : ''}" data-art="rest" title="Rest (Silence step)">R</button>
        </div>
      `;

      // Cycle Pitch / Degree
      card.querySelector('.bass-pitch-pill').addEventListener('click', async () => {
        if (pat.mode === 'strict') {
          const curIdx = STRICT_PITCHES.indexOf(step.pitch);
          step.pitch = STRICT_PITCHES[(curIdx + 1) % STRICT_PITCHES.length];
        } else {
          const curIdx = HARMONIC_DEGREES.indexOf(step.degree);
          step.degree = HARMONIC_DEGREES[(curIdx + 1) % HARMONIC_DEGREES.length];
        }
        this.renderBassRibbon(pat);

        await this.ensureSystemInitialized();
        const midiNote = pat.mode === 'strict'
          ? (PITCH_TO_MIDI[step.pitch] || 33)
          : (33 + (DEGREE_TO_OFFSET[step.degree] || 0));
        this.midiBridge.sendNoteOn('bass', midiNote, step.accent ? 120 : 95, this.engine.audioCtx.currentTime, 0.25);
      });

      // Cycle Gate Length
      card.querySelector('.bass-gate-bar').addEventListener('click', () => {
        step.gate = step.gate === 25 ? 50 : (step.gate === 50 ? 100 : 25);
        this.renderBassRibbon(pat);
      });

      // Articulation toggles
      card.querySelectorAll('.bass-art-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const art = btn.getAttribute('data-art');
          step[art] = !step[art];
          this.renderBassRibbon(pat);
        });
      });

      ribbon.appendChild(card);
    });
  }

  // --- 5.3 Chord Editor (#editor-chords) ---
  bindChordEditorControls() {
    const resBtns = document.querySelectorAll('.chord-res-btn');
    const presetSelect = document.getElementById('chord-ed-preset');
    const tensionSlider = document.getElementById('chord-ed-tension');
    const tensionVal = document.getElementById('chord-ed-tension-val');
    const soloBtn = document.getElementById('btn-chord-solo');

    resBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat) return;
        const newRes = btn.getAttribute('data-res');
        pat.resolution = newRes;
        resBtns.forEach(b => b.classList.toggle('active', b === btn));

        const slotsPerBar = newRes === '1/1' ? 1 : (newRes === '1/2' ? 2 : 4);
        pat.measures = pat.measures.map(m => {
          const next = [];
          for (let i = 0; i < slotsPerBar; i++) {
            next.push(m[i] || m[m.length - 1] || 'Cmaj7');
          }
          return next;
        });
        this.renderChordMeasuresGrid(pat);
      });
    });

    presetSelect.addEventListener('change', (e) => {
      const prog = parseInt(e.target.value, 10);
      const optText = presetSelect.options[presetSelect.selectedIndex].text;
      this.soundFontManager.setPreset(3, 0, prog, optText);
      this.renderStageTracks();
      this.log(`[SF2] Chords Preset -> ${optText}`);
    });

    tensionSlider.addEventListener('input', (e) => {
      tensionVal.textContent = `${e.target.value}%`;
    });

    soloBtn.addEventListener('click', () => {
      this.toggleSoloAudition('chords', soloBtn);
    });
  }

  populateChordEditor(pat) {
    document.getElementById('chord-ed-title').textContent = `Editing: ${pat.id} ${pat.name}`;
    document.getElementById('chord-ed-name').value = pat.name;
    document.getElementById('chord-ed-timesig').value = pat.timeSig;
    document.getElementById('chord-ed-sync').checked = pat.syncMaster;
    document.getElementById('chord-ed-voicing').value = pat.voicing || 'Jazz Drop-2';
    document.getElementById('chord-ed-preset').value = pat.preset || 0;
    document.getElementById('chord-ed-tension').value = pat.tension || 25;
    document.getElementById('chord-ed-tension-val').textContent = `${pat.tension || 25}%`;

    document.querySelectorAll('.chord-res-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-res') === (pat.resolution || '1/2'));
    });

    this.renderChordMeasuresGrid(pat);
  }

  renderChordMeasuresGrid(pat) {
    const grid = document.getElementById('chord-measures-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const slotsPerBar = pat.resolution === '1/1' ? 1 : (pat.resolution === '1/2' ? 2 : 4);

    pat.measures.forEach((barChords, barIdx) => {
      const card = document.createElement('div');
      card.className = 'measure-card';

      card.innerHTML = `
        <div class="measure-card-header">
          <span>BAR ${barIdx + 1}</span>
          <span>${pat.timeSig} • ${pat.resolution}</span>
        </div>
        <div class="measure-slots-row" style="grid-template-columns: repeat(${slotsPerBar}, 1fr);"></div>
      `;

      const slotsRow = card.querySelector('.measure-slots-row');
      for (let s = 0; s < slotsPerBar; s++) {
        const symbol = barChords[s] || 'Am7';
        const analysis = this.analyzeChordModalFunction(symbol);

        const slotEl = document.createElement('div');
        slotEl.className = 'chord-beat-slot';
        slotEl.innerHTML = `
          <div class="chord-slot-top">
            <input type="text" class="chord-symbol-input" value="${symbol}" title="Enter chord symbol (e.g. Dm7, G7b9, Cmaj7)">
            <span class="chord-valid-check" title="Valid Chord Formula">✓</span>
          </div>
          <div class="chord-modal-badge">${analysis}</div>
        `;

        const inputEl = slotEl.querySelector('.chord-symbol-input');
        const badgeEl = slotEl.querySelector('.chord-modal-badge');
        const checkEl = slotEl.querySelector('.chord-valid-check');

        inputEl.addEventListener('input', (e) => {
          const val = e.target.value.trim();
          const valid = /^[A-G][b#]?(m|maj|min|dim|aug|sus|[0-9]|b|#|-|\+)*$/i.test(val) && val.length > 0;
          checkEl.textContent = valid ? '✓' : '!';
          checkEl.style.color = valid ? 'var(--color-drums)' : 'var(--color-playing-border)';
          if (valid) {
            barChords[s] = val;
            badgeEl.textContent = this.analyzeChordModalFunction(val);
          }
        });

        inputEl.addEventListener('click', async () => {
          await this.ensureSystemInitialized();
          const notes = this.chordSymbolToMidiNotes(inputEl.value.trim() || 'Am7');
          const now = this.engine.audioCtx.currentTime;
          notes.forEach(n => this.midiBridge.sendNoteOn('chords', n, 88, now, 0.5));
        });

        slotsRow.appendChild(slotEl);
      }

      grid.appendChild(card);
    });
  }

  analyzeChordModalFunction(symbol) {
    const s = symbol.trim();
    if (/m7b5|dim/i.test(s)) return 'vii° / iiø Locrian';
    if (/maj7#11|maj9#11/i.test(s)) return 'IVmaj7 Lydian';
    if (/maj7|M7/i.test(s)) return 'Imaj7 Ionian';
    if (/7b9|7#9|7#5|7alt/i.test(s)) return 'V7 Altered';
    if (/m7|-7/i.test(s)) return 'ii-7 Dorian / vi-7';
    if (/7/.test(s)) return 'V7 Mixolydian';
    return 'Modal Triad / Diatonic';
  }

  chordSymbolToMidiNotes(symbol) {
    const match = /^([A-G][b#]?)(.*)$/.exec(symbol.trim());
    if (!match) return [60, 64, 67, 71];
    const root = ROOT_TO_MIDI[match[1]] || 60;
    const qual = match[2];

    if (/m7b5/i.test(qual)) return [root, root + 3, root + 6, root + 10];
    if (/dim/i.test(qual))  return [root, root + 3, root + 6, root + 9];
    if (/maj7|M7/.test(qual)) return [root, root + 4, root + 7, root + 11];
    if (/m7|-7/.test(qual)) return [root, root + 3, root + 7, root + 10];
    if (/7b9/.test(qual))   return [root, root + 4, root + 7, root + 10, root + 13];
    if (/7#5/.test(qual))   return [root, root + 4, root + 8, root + 10];
    if (/7/.test(qual))     return [root, root + 4, root + 7, root + 10];
    if (/m/.test(qual))     return [root, root + 3, root + 7];
    return [root, root + 4, root + 7];
  }

  getChordRootMidi(symbol) {
    const match = /^([A-G][b#]?)/.exec(symbol.trim());
    return match ? (ROOT_TO_MIDI[match[1]] || 60) : 60;
  }

  // Solo audition helper inside Editors
  async toggleSoloAudition(type, buttonEl) {
    await this.ensureSystemInitialized();
    if (this.soloTimer) {
      this.stopSoloAudition();
      return;
    }

    const pat = this.getPatternById(this.editingPatternId);
    if (!pat) return;

    buttonEl.textContent = '■ STOP SOLO';
    buttonEl.classList.add('btn-danger');
    let step = 0;
    const stepMs = (60 / (parseFloat(this.engine.tempo) || 120) / 4) * 1000;

    this.soloTimer = setInterval(() => {
      const now = this.engine.audioCtx.currentTime;
      if (type === 'drums' && pat.drumGrid) {
        const sIdx = step % 16;
        DRUM_INSTRUMENTS.forEach((inst, rIdx) => {
          if (pat.rowMutes && pat.rowMutes[rIdx]) return;
          const st = pat.drumGrid[rIdx][sIdx];
          if (st > 0) {
            const vel = st === 2 ? 125 : (st === 1 ? 100 : 52);
            this.midiBridge.sendNoteOn('rhythm', inst.pitch, vel, now, 0.14);
          }
        });
      } else if (type === 'bass' && pat.bassSteps) {
        const stObj = pat.bassSteps[step % 16];
        if (stObj && !stObj.rest) {
          const pitch = pat.mode === 'strict'
            ? (PITCH_TO_MIDI[stObj.pitch] || 33)
            : (33 + (DEGREE_TO_OFFSET[stObj.degree] || 0));
          this.midiBridge.sendNoteOn('bass', pitch, stObj.accent ? 120 : 95, now, 0.2);
        }
      } else if (type === 'chords' && pat.measures) {
        if (step % 4 === 0) {
          const barIdx = Math.floor(step / 16) % pat.measures.length;
          const m = pat.measures[barIdx];
          const sym = m[Math.floor(((step % 16) / 16) * m.length)] || 'Am7';
          this.chordSymbolToMidiNotes(sym).forEach(n => {
            this.midiBridge.sendNoteOn('chords', n, 90, now, 0.45);
          });
        }
      }
      step++;
    }, stepMs);

    this.log(`[EDITOR] Playing solo preview for ${pat.id}`);
  }

  stopSoloAudition() {
    if (this.soloTimer) {
      clearInterval(this.soloTimer);
      this.soloTimer = null;
    }
    ['btn-drum-solo', 'btn-bass-solo', 'btn-chord-solo'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.textContent = '▶ PLAY SOLO';
        btn.classList.remove('btn-danger');
      }
    });
  }

  // --- 6. View 3: System Settings Controls ---
  bindSettingsControls() {
    const sfFileInput = document.getElementById('sf-file-input');
    const btnLoadSf = document.getElementById('btn-load-sf');
    const btnClearSf = document.getElementById('btn-clear-sf');
    const sliderLimiterThresh = document.getElementById('slider-limiter-thresh');
    const valLimiterThresh = document.getElementById('val-limiter-thresh');
    const prefHighContrast = document.getElementById('pref-high-contrast');

    if (btnLoadSf && sfFileInput) {
      btnLoadSf.addEventListener('click', () => sfFileInput.click());
      sfFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        await this.ensureSystemInitialized();
        try {
          await this.soundFontManager.loadFromFile(file);
        } catch (err) {
          this.log(`[SF2] ERROR loading ${file.name}: ${err.message}`);
        }
      });
    }

    if (btnClearSf) {
      btnClearSf.addEventListener('click', async () => {
        await this.ensureSystemInitialized();
        await this.soundFontManager.clearCache();
        if (sfFileInput) sfFileInput.value = '';
      });
    }

    if (sliderLimiterThresh && valLimiterThresh) {
      sliderLimiterThresh.addEventListener('input', (e) => {
        const db = parseFloat(e.target.value).toFixed(1);
        valLimiterThresh.textContent = `${db} dBFS`;
        this.soundFontManager.setLimiterThreshold(db);
      });
    }

    if (prefHighContrast) {
      prefHighContrast.addEventListener('change', (e) => {
        document.body.classList.toggle('high-contrast-stage', e.target.checked);
        this.log(`[SETTINGS] High Contrast Stage Mode ${e.target.checked ? 'ENABLED' : 'DISABLED'}`);
      });
    }
  }

  // --- 7. Modals (Chords Dictionary, New Pattern, Delete Confirm) ---
  bindModals() {
    const dictModal = document.getElementById('modal-chords-dict');
    const newPatModal = document.getElementById('modal-new-pattern');
    const delModal = document.getElementById('modal-delete-confirm');

    // Open Chords Dictionary
    document.querySelectorAll('.btn-open-chords-dict').forEach(btn => {
      btn.addEventListener('click', () => {
        dictModal.classList.add('open');
        this.log('[UI] Opened Chords Dictionary Modal');
      });
    });

    // Close modals
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.getAttribute('data-close-modal'));
        if (target) target.classList.remove('open');
      });
    });

    // Open New Pattern Modal
    const btnNewPattern = document.getElementById('btn-new-pattern');
    if (btnNewPattern) {
      btnNewPattern.addEventListener('click', () => {
        newPatModal.classList.add('open');
      });
    }

    // Create New Pattern of chosen type
    document.querySelectorAll('.btn-create-pattern-type').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        newPatModal.classList.remove('open');
        this.createNewPattern(type);
      });
    });

    // Confirm Delete Pattern
    const btnConfirmDelete = document.getElementById('btn-confirm-delete-pattern');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => {
        if (this.pendingDeletePatternId) {
          const id = this.pendingDeletePatternId;
          this.patterns = this.patterns.filter(p => p.id !== id);
          this.pendingDeletePatternId = null;
          delModal.classList.remove('open');
          this.renderPatternLibrary();
          this.renderPalette();
          this.renderStageTracks();
          this.log(`[PATTERNS] Deleted pattern ${id}`);
        }
      });
    }
  }

  createNewPattern(type) {
    const prefix = type === 'drums' ? 'D' : (type === 'bass' ? 'B' : 'C');
    const existingNums = this.patterns
      .filter(p => p.type === type)
      .map(p => parseInt(p.id.split('-')[1], 10) || 0);
    const nextNum = (Math.max(0, ...existingNums) + 1).toString().padStart(2, '0');
    const newId = `${prefix}-${nextNum}`;

    let newPat;
    if (type === 'drums') {
      newPat = {
        id: newId,
        type: 'drums',
        name: `DrumPat ${nextNum}`,
        timeSig: '4/4',
        syncMaster: true,
        bpm: 120,
        bars: 1,
        resolution: '1/16',
        tension: 25,
        preset: 0,
        preview: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        rowMutes: new Array(10).fill(false),
        rowSolos: new Array(10).fill(false),
        drumGrid: DRUM_INSTRUMENTS.map((_, r) =>
          Array.from({ length: 16 }, (__, s) => (r === 0 && s % 4 === 0 ? 1 : 0))
        )
      };
    } else if (type === 'bass') {
      newPat = {
        id: newId,
        type: 'bass',
        name: `BassLine ${nextNum}`,
        timeSig: '4/4',
        syncMaster: true,
        bpm: 120,
        bars: 1,
        resolution: '1/16',
        preset: 33,
        mode: 'follower',
        preview: new Array(16).fill(1),
        bassSteps: Array.from({ length: 16 }, () => ({
          pitch: 'E1',
          degree: 'R',
          gate: 50,
          accent: false,
          slide: false,
          rest: false
        }))
      };
    } else {
      newPat = {
        id: newId,
        type: 'chords',
        name: `Chords ${nextNum}`,
        timeSig: '4/4',
        syncMaster: true,
        bpm: 120,
        bars: 4,
        resolution: '1/1',
        voicing: 'Jazz Drop-2',
        preset: 0,
        tension: 20,
        preview: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        measures: [['Cmaj7'], ['Am7'], ['Dm7'], ['G7']]
      };
    }

    this.patterns.push(newPat);
    this.renderPatternLibrary();
    this.renderPalette();
    this.log(`[PATTERNS] Created new ${type.toUpperCase()} pattern ${newId}`);
    this.openEditorForPattern(newId);
  }

  openDeleteConfirmModal(patternId) {
    const pat = this.getPatternById(patternId);
    if (!pat) return;
    this.pendingDeletePatternId = pat.id;
    const msgEl = document.getElementById('delete-modal-message');
    if (msgEl) {
      msgEl.textContent = `Are you sure you want to delete pattern ${pat.id} (${pat.name})?`;
    }
    document.getElementById('modal-delete-confirm').classList.add('open');
  }

  getPatternById(id) {
    return this.patterns.find(p => p.id === id) || null;
  }
}

