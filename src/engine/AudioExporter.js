/**
 * src/engine/AudioExporter.js
 * Offline Audio Bounce Engine (.WAV 16-bit PCM & Web Worker .MP3 via lamejs).
 * Renders either a single Pattern Stem or a full Main Stage Trio performance
 * using Web Audio's OfflineAudioContext + cached SoundFont2 (FluidR3_GM.sf2) from IndexedDB.
 */

import { InternalSF2Synth } from '../SoundFontManager.js';
import { TensionEngine } from './TensionEngine.js';

const PITCH_TO_MIDI = {
  C1: 24, 'C#1': 25, Db1: 25, D1: 26, 'D#1': 27, Eb1: 27, E1: 28, F1: 29, 'F#1': 30, Gb1: 30, G1: 31, 'G#1': 32, Ab1: 32, A1: 33, 'A#1': 34, Bb1: 34, B1: 35,
  C2: 36, 'C#2': 37, Db2: 37, D2: 38, 'D#2': 39, Eb2: 39, E2: 40, F2: 41, 'F#2': 42, Gb2: 42, G2: 43, 'G#2': 44, Ab2: 44, A2: 45, 'A#2': 46, Bb2: 46, B2: 47,
  C3: 48, 'C#3': 49, Db3: 49, D3: 50, 'D#3': 51, Eb3: 51, E3: 52, F3: 53, 'F#3': 54, Gb3: 54, G3: 55
};

const DEGREE_TO_OFFSET = {
  '-5': -5, '-b6': -4, '-6': -3, '-b7': -2, '-7': -1,
  R: 0, b2: 1, '2': 2, b3: 3, '3': 4, '4': 5, b5: 6, '5': 7, b6: 8, '6': 9, b7: 10, '7': 11, R8: 12
};

export class AudioExporter {
  constructor(appUI) {
    this.appUI = appUI;
    this.sampleRate = 44100;
    this._lameScriptText = null;
    this._lameCacheKey = 'lamejs_v121_bundle';
    // Automatically prime local IndexedDB cache for offline PWA MP3 export
    setTimeout(() => {
      this.ensureLameJsCached().catch(() => {});
    }, 1500);
  }

  /**
   * Loads the local ./src/vendor/lame.min.js bundle into memory (and IndexedDB backup)
   * so the MP3 Web Worker runs 100% locally offline inside the PWA.
   */
  async ensureLameJsCached() {
    if (this._lameScriptText) return this._lameScriptText;

    const sfm = this.appUI && this.appUI.soundFontManager;
    const localUrl = new URL('./src/vendor/lame.min.js', window.location.href).href;

    // 1. Load directly from local project bundle ./src/vendor/lame.min.js
    try {
      const res = await fetch(localUrl);
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes('Mp3Encoder')) {
          this._lameScriptText = text;
          if (sfm && typeof sfm.openDB === 'function') {
            try {
              const db = await sfm.openDB();
              const tx = db.transaction(sfm.storeName, 'readwrite');
              tx.objectStore(sfm.storeName).put(text, this._lameCacheKey);
            } catch (dbErr) {
              // Ignore IndexedDB backup write error
            }
          }
          return text;
        }
      }
    } catch (localErr) {
      // Fall through to IndexedDB backup if offline & SW not yet active
    }

    // 2. Fallback to IndexedDB persistent backup
    if (sfm && typeof sfm.openDB === 'function') {
      try {
        const db = await sfm.openDB();
        const cached = await new Promise((resolve) => {
          const tx = db.transaction(sfm.storeName, 'readonly');
          const req = tx.objectStore(sfm.storeName).get(this._lameCacheKey);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });
        if (typeof cached === 'string' && cached.length > 10000) {
          this._lameScriptText = cached;
          return cached;
        }
      } catch (e) {
        // Ignore IndexedDB read error
      }
    }

    return null;
  }

  /**
   * Returns true if any track is currently routed to an external hardware MIDI port.
   */
  hasExternalMidiRoutes() {
    const bridge = this.appUI && this.appUI.midiBridge;
    if (!bridge || bridge.forceInternalSf2) return false;
    return ['rhythm', 'bass', 'chords'].some(
      (mod) => bridge.routing[mod] && bridge.routing[mod].portId !== 'internal'
    );
  }

  /**
   * Compute micro-timing shift and velocity jitter for offline scheduling.
   */
  _applyHumanize(baseTime, baseVel, humanizePct = 0) {
    const hum = Math.max(0, Math.min(100, Number(humanizePct) || 0));
    const vel = Math.round(Number(baseVel) || 90);
    if (hum <= 0) {
      return {
        time: Math.max(0, baseTime),
        velocity: Math.max(1, Math.min(127, vel))
      };
    }
    const cfg = (this.appUI && this.appUI.humanizeConfig) || {
      timingWindowMs: 24,
      velocitySpan: 30
    };
    const maxWindowSec = (cfg.timingWindowMs || 24) / 1000;
    const maxVelSpan = cfg.velocitySpan || 30;
    const deltaT = (Math.random() - 0.5) * maxWindowSec * (hum / 100);
    const deltaV = Math.round((Math.random() - 0.5) * maxVelSpan * (hum / 100));
    return {
      time: Math.max(0, baseTime + deltaT),
      velocity: Math.max(1, Math.min(127, vel + deltaV))
    };
  }

  /**
   * Schedule a note in the OfflineAudioContext using either the loaded SF2 synth
   * or a clean zero-click Web Audio oscillator/percussion fallback.
   */
  _scheduleOfflineNote(offlineSynth, offlineCtx, submix, channel, pitch, velocity, startTime, durationSec) {
    if (offlineSynth) {
      offlineSynth.scheduleNote(channel, pitch, velocity, startTime, durationSec);
      return;
    }

    // Fallback synthesizer when FluidR3_GM.sf2 is not loaded in IndexedDB
    const t0 = Math.max(0, startTime);
    const dur = Math.max(0.05, durationSec);
    const dest =
      channel === 10
        ? submix.rhythm
        : channel === 2
        ? submix.bass
        : submix.chords;

    const osc = offlineCtx.createOscillator();
    const gain = offlineCtx.createGain();
    const maxGain = (velocity / 127) * (channel === 10 ? 0.42 : 0.28);

    if (channel === 10) {
      // Percussive pitch-drop synthesis for drums
      const baseFreq = pitch <= 36 ? 115 : pitch <= 40 ? 220 : 680;
      osc.type = pitch <= 40 ? 'triangle' : 'square';
      osc.frequency.setValueAtTime(baseFreq, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(35, baseFreq * 0.35), t0 + 0.09);
    } else {
      const freq = 440 * Math.pow(2, (pitch - 69) / 12);
      osc.type = channel === 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t0);
    }

    const stopTime = t0 + dur;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(maxGain, t0 + 0.006);
    if (channel === 3) {
      // Hold warm sustain plateau across chord duration, then smooth release tail
      const sustainGain = Math.max(0.001, maxGain * 0.58);
      gain.gain.exponentialRampToValueAtTime(sustainGain, stopTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.42);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t0);
      osc.stop(stopTime + 0.44);
    } else {
      gain.gain.exponentialRampToValueAtTime(0.0001, stopTime + 0.02);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t0);
      osc.stop(stopTime + 0.03);
    }
  }

  /**
   * Build the OfflineAudioContext graph + mount cached SoundFont2 binary.
   */
  async _createOfflineGraph(totalDurationSec, trackGains = { rhythm: 1, bass: 1, chords: 1 }) {
    const totalFrames = Math.ceil(Math.max(1, totalDurationSec) * this.sampleRate);
    const offlineCtx = new OfflineAudioContext(2, totalFrames, this.sampleRate);

    const limiter = offlineCtx.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-2.5, 0);
    limiter.ratio.setValueAtTime(12.0, 0);
    limiter.attack.setValueAtTime(0.003, 0);
    limiter.release.setValueAtTime(0.15, 0);

    const masterGain = offlineCtx.createGain();
    masterGain.gain.setValueAtTime(0.88, 0);
    // Smooth 40ms fade-out at the very end of the bounce to guarantee zero clicks
    const fadeStart = Math.max(0, totalDurationSec - 0.045);
    masterGain.gain.setValueAtTime(0.88, fadeStart);
    masterGain.gain.linearRampToValueAtTime(0.0001, totalDurationSec);

    const submix = {
      rhythm: offlineCtx.createGain(),
      bass: offlineCtx.createGain(),
      chords: offlineCtx.createGain()
    };

    submix.rhythm.gain.setValueAtTime(trackGains.rhythm ?? 1.0, 0);
    submix.bass.gain.setValueAtTime(trackGains.bass ?? 1.0, 0);
    submix.chords.gain.setValueAtTime(trackGains.chords ?? 1.0, 0);

    submix.rhythm.connect(limiter);
    submix.bass.connect(limiter);
    submix.chords.connect(limiter);
    limiter.connect(masterGain);
    masterGain.connect(offlineCtx.destination);

    // Load SoundFont binary from memory or IndexedDB cache
    let sfBuffer = null;
    const sfm = this.appUI && this.appUI.soundFontManager;
    if (sfm) {
      sfBuffer = sfm.rawSf2Buffer || (await sfm.loadFromCache().catch(() => null));
    }

    let offlineSynth = null;
    if (sfBuffer) {
      try {
        offlineSynth = new InternalSF2Synth(offlineCtx, sfBuffer, submix);
        if (sfm && sfm.activePresets) {
          offlineSynth.programChange(10, sfm.activePresets.rhythm.program, 128);
          offlineSynth.programChange(2, sfm.activePresets.bass.program, 0);
          offlineSynth.programChange(3, sfm.activePresets.chords.program, 0);
        }
      } catch (err) {
        console.warn('[AudioExporter] Falling back to offline oscillator synth:', err);
      }
    }

    return { offlineCtx, offlineSynth, submix };
  }

  /**
   * Bounce a single Pattern Stem (Drum, Bass, or Chord pattern) to .wav or .mp3.
   */
  async bouncePatternStem(pat, { loops = 2, format = 'wav', onProgress = () => {} } = {}) {
    if (!pat) throw new Error('No pattern selected for stem export.');
    onProgress(8, `Preparing ${pat.id} (${pat.name}) stem events...`);

    const masterBpm = parseFloat(this.appUI.engine.tempo) || 120;
    const activeBpm = pat.syncMaster === false && pat.bpm ? parseFloat(pat.bpm) : masterBpm;
    const barDurSec = this.appUI.getPatternBarDurationSec(pat, activeBpm);
    const patBars = pat.type === 'chords'
      ? Math.max(1, (pat.measures && pat.measures.length) || 4)
      : Math.max(1, pat.bars || 1);
    const totalBarsToRender = patBars * Math.max(1, parseInt(loops, 10) || 1);
    const tailSec = pat.type === 'chords' ? 1.25 : 0.75;
    const totalDurationSec = totalBarsToRender * barDurSec + tailSec;

    const { offlineCtx, offlineSynth, submix } = await this._createOfflineGraph(totalDurationSec, {
      rhythm: 1.0,
      bass: 1.0,
      chords: 1.0
    });

    if (offlineSynth && pat.preset !== undefined) {
      const ch = pat.type === 'drums' ? 10 : pat.type === 'bass' ? 2 : 3;
      const bank = pat.type === 'drums' ? 128 : 0;
      offlineSynth.programChange(ch, pat.preset, bank);
    }

    const hum = pat.humanize || 0;

    if (pat.type === 'drums' && pat.drumGrid) {
      const stepsPerBar = Math.max(1, this.appUI.getStepsPerBar(pat.timeSig || '4/4', pat.resolution || '1/16'));
      const totalSteps = Math.max(1, this.appUI.getTotalSteps(pat));
      const stepDur = barDurSec / stepsPerBar;
      const anyRowSolo = pat.rowSolos && pat.rowSolos.some(Boolean);

      for (let bar = 0; bar < totalBarsToRender; bar++) {
        const barInPat = bar % patBars;
        for (let s = 0; s < stepsPerBar; s++) {
          const stepIndex = (barInPat * stepsPerBar + s) % totalSteps;
          const tStep = bar * barDurSec + s * stepDur;

          this.appUI.drumSlots.forEach((inst, rowIdx) => {
            if (pat.rowMutes && pat.rowMutes[rowIdx]) return;
            if (anyRowSolo && (!pat.rowSolos || !pat.rowSolos[rowIdx])) return;
            const state = pat.drumGrid[rowIdx] && pat.drumGrid[rowIdx][stepIndex];
            if (state > 0) {
              const baseVel = this.appUI.getDrumStepVelocity(state);
              const dur = state === 2 ? 0.22 : state === 1 ? 0.18 : 0.14;
              const { time, velocity } = this._applyHumanize(tStep, baseVel, hum);
              this._scheduleOfflineNote(offlineSynth, offlineCtx, submix, 10, inst.pitch, velocity, time, dur);
            }
          });
        }
      }
    } else if (pat.type === 'bass' && pat.bassSteps) {
      const stepsPerBar = Math.max(1, this.appUI.getStepsPerBar(pat.timeSig || '4/4', pat.resolution || '1/16'));
      const totalSteps = Math.max(1, this.appUI.getTotalSteps(pat));
      const stepDur = barDurSec / stepsPerBar;

      for (let bar = 0; bar < totalBarsToRender; bar++) {
        const barInPat = bar % patBars;
        for (let s = 0; s < stepsPerBar; s++) {
          const stepIndex = (barInPat * stepsPerBar + s) % totalSteps;
          const stepObj = pat.bassSteps[stepIndex];
          if (stepObj && !stepObj.rest) {
            const tStep = bar * barDurSec + s * stepDur;
            const basePitch = pat.mode === 'strict'
              ? (PITCH_TO_MIDI[stepObj.pitch] || 33)
              : (33 + (DEGREE_TO_OFFSET[stepObj.degree] || 0));
            const pitch = Math.max(12, Math.min(108, basePitch + (pat.octave || 0) * 12));
            const baseVel = stepObj.accent ? 120 : 95;
            const dur = Math.max(0.06, stepDur * ((stepObj.gate || 50) / 100));
            const { time, velocity } = this._applyHumanize(tStep, baseVel, hum);
            this._scheduleOfflineNote(offlineSynth, offlineCtx, submix, 2, pitch, velocity, time, dur);
          }
        }
      }
    } else if (pat.type === 'chords' && pat.measures) {
      for (let bar = 0; bar < totalBarsToRender; bar++) {
        const m = pat.measures[bar % pat.measures.length] || ['Am7'];
        const chordsInBar = Math.max(1, m.length);
        const slotDur = barDurSec / chordsInBar;

        for (let c = 0; c < chordsInBar; c++) {
          const sym = m[c];
          if (!this.appUI.isSilentChordSymbol(sym)) {
            const tStep = bar * barDurSec + c * slotDur;
            const notes = this.appUI.chordSymbolToMidiNotes(sym, pat.voicing || 'Jazz Drop-2', pat.octave || 0);
            notes.forEach((n) => {
              const { time, velocity } = this._applyHumanize(tStep, 88, hum);
              this._scheduleOfflineNote(offlineSynth, offlineCtx, submix, 3, n, velocity, time, slotDur * 0.98);
            });
          }
        }
      }
    }

    onProgress(35, 'Rendering OfflineAudioContext stem...');
    const renderedBuffer = await this._renderWithProgress(offlineCtx, totalDurationSec, onProgress);

    const safeName = `${pat.id}_${pat.name}`.replace(/[^a-zA-Z0-9_-]/g, '');
    const bpmInt = Math.round(activeBpm);
    return this._encodeAndDownload(renderedBuffer, `AutoBand_${safeName}_${bpmInt}bpm`, format, onProgress);
  }

  /**
   * Bounce the full Main Stage Trio performance across N master bars to .wav or .mp3.
   */
  async bounceMainStage({ bars = 4, format = 'wav', onProgress = () => {} } = {}) {
    const masterBpm = parseFloat(this.appUI.engine.tempo) || 120;
    const numMasterBars = Math.max(1, Math.min(64, parseInt(bars, 10) || 4));
    const syncMode = this.appUI.timeSigSyncMode || 'independent';

    onProgress(8, `Calculating ${numMasterBars}-bar Main Stage timeline (${masterBpm} BPM)...`);

    // 1. Calculate total duration from the Master (Drums) track chain over numMasterBars
    const drumSlots = this.appUI.tracks.drums.slots;
    const masterBarBoundaries = [];
    let cursorTime = 0;
    for (let b = 0; b < numMasterBars; b++) {
      const dSlot = drumSlots[b % Math.max(1, drumSlots.length)];
      const dPat = this.appUI.getPatternById(dSlot?.patternId);
      const bDur = dPat ? this.appUI.getPatternBarDurationSec(dPat, masterBpm) : (60 / masterBpm) * 4;
      masterBarBoundaries.push({ start: cursorTime, duration: bDur, end: cursorTime + bDur });
      cursorTime += bDur;
    }

    const activeArrangementEnd = cursorTime;
    const tailSec = 1.25;
    const totalDurationSec = activeArrangementEnd + tailSec;

    // 2. Compute effective track submix gains (respecting Mute / Solo / LVL sliders)
    const anySolo = Object.values(this.appUI.tracks).some((t) => t.solo);
    const getGain = (key) => {
      const t = this.appUI.tracks[key];
      if (!t) return 1.0;
      const audible = !t.muted && (!anySolo || t.solo);
      return audible ? (t.level / 100) : 0;
    };

    const { offlineCtx, offlineSynth, submix } = await this._createOfflineGraph(totalDurationSec, {
      rhythm: getGain('drums'),
      bass: getGain('bass'),
      chords: getGain('chords')
    });

    // 3. Schedule Chords Timeline (and record active chord symbol timeline for Harmonic Follower Bass)
    const chordTimeline = [];
    const chordSlots = this.appUI.tracks.chords.slots;
    const tensionCfg = this.appUI.tensionConfig;
    if (chordSlots.length > 0) {
      let cTime = 0;
      let cBarIdx = 0;
      while (cTime < activeArrangementEnd - 1e-4 && cBarIdx < 512) {
        const cSlot = chordSlots[cBarIdx % chordSlots.length];
        const nextCSlot = chordSlots[(cBarIdx + 1) % chordSlots.length];
        const cPat = this.appUI.getPatternById(cSlot?.patternId);
        if (!cPat || !cPat.measures || cPat.measures.length === 0) break;

        const nowChordTension = cSlot?.tension || 0;
        const nextChordTension = nextCSlot?.tension || 0;
        const rawM = cPat.measures[cBarIdx % cPat.measures.length] || ['Am7'];
        const m = TensionEngine.transformBarMeasure(rawM, nowChordTension, cBarIdx, tensionCfg);
        const chordsInBar = Math.max(1, m.length);
        const masterBoundary = masterBarBoundaries[Math.min(cBarIdx, masterBarBoundaries.length - 1)];
        const barDur = syncMode === 'bar-fit' && masterBoundary
          ? masterBoundary.duration
          : this.appUI.getPatternBarDurationSec(cPat, masterBpm);
        const slotDur = Math.max(0.05, barDur / chordsInBar);
        const barCutoff = syncMode === 'master-reset' && masterBoundary
          ? masterBoundary.end
          : activeArrangementEnd;

        const chordHum = (this.appUI.tracks.chords.humanize || 0) > 0
          ? this.appUI.tracks.chords.humanize
          : (cPat.humanize || 0);

        for (let s = 0; s < chordsInBar; s++) {
          const tStep = cTime + s * slotDur;
          if (tStep >= activeArrangementEnd - 1e-4 || tStep >= barCutoff - 1e-4) break;
          const sym = m[s] !== undefined ? m[s] : 'Am7';
          const effectiveDur = Math.min(slotDur, barCutoff - tStep, activeArrangementEnd - tStep);
          chordTimeline.push({ start: tStep, end: tStep + effectiveDur, symbol: sym });

          if (!this.appUI.isSilentChordSymbol(sym)) {
            const midiNotes = this.appUI.chordSymbolToMidiNotes(
              sym,
              cPat.voicing || 'Jazz Drop-2',
              cPat.octave || 0
            );
            const isLastSlotOfBar = s === chordsInBar - 1;
            const strikes = TensionEngine.getChordExecutionPlan(
              effectiveDur,
              nowChordTension,
              nextChordTension,
              isLastSlotOfBar,
              tensionCfg
            );
            strikes.forEach((st) => {
              midiNotes.forEach((note) => {
                const { time, velocity } = this._applyHumanize(tStep + st.offsetSec, st.velocity, chordHum);
                this._scheduleOfflineNote(offlineSynth, offlineCtx, submix, 3, note, velocity, time, st.durationSec);
              });
            });
          }
        }

        cTime = syncMode === 'master-reset' && masterBoundary ? masterBoundary.end : (cTime + barDur);
        cBarIdx++;
      }
    }

    const getChordAtTime = (t) => {
      for (let i = chordTimeline.length - 1; i >= 0; i--) {
        if (t >= chordTimeline[i].start - 1e-3) return chordTimeline[i].symbol;
      }
      return chordTimeline[0]?.symbol || 'Am7';
    };

    // 4. Schedule Drums Timeline
    if (drumSlots.length > 0) {
      for (let dBarIdx = 0; dBarIdx < numMasterBars; dBarIdx++) {
        const boundary = masterBarBoundaries[dBarIdx];
        const dSlot = drumSlots[dBarIdx % drumSlots.length];
        const nextDSlot = drumSlots[(dBarIdx + 1) % drumSlots.length];
        const dPat = this.appUI.getPatternById(dSlot?.patternId);
        if (!dPat || !dPat.drumGrid) continue;

        const stepsPerBar = Math.max(1, this.appUI.getStepsPerBar(dPat.timeSig || '4/4', dPat.resolution || '1/16'));
        const totalSteps = Math.max(1, this.appUI.getTotalSteps(dPat));
        const barInPat = dBarIdx % Math.max(1, dPat.bars || 1);
        const stepDur = boundary.duration / stepsPerBar;
        const nowDrumTension = dSlot?.tension || 0;
        const nextDrumTension = nextDSlot?.tension || 0;
        const drumHum = (this.appUI.tracks.drums.humanize || 0) > 0
          ? this.appUI.tracks.drums.humanize
          : (dPat.humanize || 0);

        for (let s = 0; s < stepsPerBar; s++) {
          const stepIndex = (barInPat * stepsPerBar + s) % totalSteps;
          const tStep = boundary.start + s * stepDur;
          const hits = TensionEngine.evaluateDrumStep({
            pat: dPat,
            drumSlots: this.appUI.drumSlots,
            stepIndex,
            stepInBar: s,
            stepsPerBar,
            barIndex: dBarIdx,
            tension: nowDrumTension,
            nextTension: nextDrumTension,
            getStepVelocity: (st) => this.appUI.getDrumStepVelocity(st),
            config: tensionCfg
          });

          hits.forEach((h) => {
            const { time, velocity } = this._applyHumanize(tStep, h.velocity, drumHum);
            this._scheduleOfflineNote(offlineSynth, offlineCtx, submix, 10, h.pitch, velocity, time, h.duration);
          });
        }
      }
    }

    // 5. Schedule Bass Timeline
    const bassSlots = this.appUI.tracks.bass.slots;
    if (bassSlots.length > 0) {
      let bTime = 0;
      let bBarIdx = 0;
      while (bTime < activeArrangementEnd - 1e-4 && bBarIdx < 512) {
        const bSlot = bassSlots[bBarIdx % bassSlots.length];
        const nextBSlot = bassSlots[(bBarIdx + 1) % bassSlots.length];
        const bPat = this.appUI.getPatternById(bSlot?.patternId);
        if (!bPat || !bPat.bassSteps) break;

        const stepsPerBar = Math.max(1, this.appUI.getStepsPerBar(bPat.timeSig || '4/4', bPat.resolution || '1/16'));
        const totalSteps = Math.max(1, this.appUI.getTotalSteps(bPat));
        const barInPat = bBarIdx % Math.max(1, bPat.bars || 1);
        const masterBoundary = masterBarBoundaries[Math.min(bBarIdx, masterBarBoundaries.length - 1)];
        const barDur = syncMode === 'bar-fit' && masterBoundary
          ? masterBoundary.duration
          : this.appUI.getPatternBarDurationSec(bPat, masterBpm);
        const stepDur = Math.max(0.02, barDur / stepsPerBar);
        const barCutoff = syncMode === 'master-reset' && masterBoundary
          ? masterBoundary.end
          : activeArrangementEnd;

        const nowBassTension = bSlot?.tension || 0;
        const nextBassTension = nextBSlot?.tension || 0;
        const bassHum = (this.appUI.tracks.bass.humanize || 0) > 0
          ? this.appUI.tracks.bass.humanize
          : (bPat.humanize || 0);

        for (let s = 0; s < stepsPerBar; s++) {
          const tStep = bTime + s * stepDur;
          if (tStep >= activeArrangementEnd - 1e-4 || tStep >= barCutoff - 1e-4) break;
          const stepIndex = (barInPat * stepsPerBar + s) % totalSteps;
          const stepObj = bPat.bassSteps[stepIndex];

          const activeChordSym = getChordAtTime(tStep);
          const nextChordSym = getChordAtTime(tStep + stepDur);
          const isChordSilent = this.appUI.isSilentChordSymbol(activeChordSym);
          if (isChordSilent && bPat.mode !== 'strict') continue;

          const rootMidi = isChordSilent ? 45 : (this.appUI.getChordRootMidi(activeChordSym) - 24);
          const nextRootMidi = this.appUI.isSilentChordSymbol(nextChordSym) ? rootMidi : (this.appUI.getChordRootMidi(nextChordSym) - 24);

          const bassResult = TensionEngine.evaluateBassStep({
            pat: bPat,
            stepObj,
            stepInBar: s,
            stepsPerBar,
            stepDurSec: stepDur,
            tension: nowBassTension,
            nextTension: nextBassTension,
            rootMidi,
            nextRootMidi,
            pitchToMidi: PITCH_TO_MIDI,
            degreeToOffset: DEGREE_TO_OFFSET,
            config: tensionCfg
          });

          if (bassResult.play) {
            const { time, velocity } = this._applyHumanize(tStep, bassResult.velocity, bassHum);
            this._scheduleOfflineNote(offlineSynth, offlineCtx, submix, 2, bassResult.midiPitch, velocity, time, bassResult.durationSec);
          }
        }

        bTime = syncMode === 'master-reset' && masterBoundary ? masterBoundary.end : (bTime + barDur);
        bBarIdx++;
      }
    }

    onProgress(35, 'Rendering Main Stage audio buffer...');
    const renderedBuffer = await this._renderWithProgress(offlineCtx, totalDurationSec, onProgress);

    const snapSelect = document.getElementById('snapshot-select');
    const rawName = (snapSelect && snapSelect.value) || 'MainStage';
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '');
    const bpmInt = Math.round(masterBpm);
    return this._encodeAndDownload(renderedBuffer, `AutoBand_${safeName}_${bpmInt}bpm`, format, onProgress);
  }

  async _renderWithProgress(offlineCtx, totalDurationSec, onProgress) {
    let timer = null;
    try {
      timer = setInterval(() => {
        const ratio = Math.min(0.99, (offlineCtx.currentTime || 0) / Math.max(0.1, totalDurationSec));
        const pct = Math.round(35 + ratio * 45);
        onProgress(pct, `Rendering audio... ${pct}%`);
      }, 60);
      const renderedBuffer = await offlineCtx.startRendering();
      clearInterval(timer);
      onProgress(82, 'Encoding audio file...');
      return renderedBuffer;
    } catch (err) {
      if (timer) clearInterval(timer);
      throw err;
    }
  }

  async _encodeAndDownload(audioBuffer, baseFilename, format, onProgress) {
    let blob;
    let ext = format === 'mp3' ? 'mp3' : 'wav';

    if (format === 'mp3') {
      try {
        blob = await this.encodeAudioBufferToMp3(audioBuffer, (pct) => {
          const mapped = Math.round(82 + pct * 0.16);
          onProgress(mapped, `Encoding MP3 (Web Worker)... ${mapped}%`);
        });
      } catch (err) {
        console.warn('[AudioExporter] MP3 Web Worker fallback to WAV:', err);
        onProgress(90, 'MP3 encoder unavailable offline — encoding 16-bit WAV...');
        blob = this.encodeAudioBufferToWav(audioBuffer);
        ext = 'wav';
      }
    } else {
      onProgress(92, 'Encoding 16-bit PCM WAV...');
      blob = this.encodeAudioBufferToWav(audioBuffer);
    }

    const fullFilename = `${baseFilename}.${ext}`;
    this._triggerDownload(blob, fullFilename);
    onProgress(100, `Complete! Downloaded ${fullFilename}`);
    return { filename: fullFilename, sizeBytes: blob.size };
  }

  /**
   * 16-Bit Stereo PCM RIFF WAVE Encoder
   */
  encodeAudioBufferToWav(audioBuffer) {
    const numChannels = Math.min(2, audioBuffer.numberOfChannels || 2);
    const sampleRate = audioBuffer.sampleRate || 44100;
    const numFrames = audioBuffer.length;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataByteLength = numFrames * blockAlign;
    const totalByteLength = 44 + dataByteLength;

    const arrayBuffer = new ArrayBuffer(totalByteLength);
    const view = new DataView(arrayBuffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // RIFF WAVE Header
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataByteLength, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);           // PCM chunk size
    view.setUint16(20, 1, true);            // AudioFormat = 1 (Linear PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);           // 16 bits per sample
    writeStr(36, 'data');
    view.setUint32(40, dataByteLength, true);

    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = numChannels > 1 ? audioBuffer.getChannelData(1) : ch0;

    let offset = 44;
    for (let i = 0; i < numFrames; i++) {
      const sL = Math.max(-1, Math.min(1, ch0[i]));
      const sR = Math.max(-1, Math.min(1, ch1[i]));
      view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7fff, true);
      offset += 2;
      if (numChannels > 1) {
        view.setInt16(offset, sR < 0 ? sR * 0x8000 : sR * 0x7fff, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Client-Side Web Worker MP3 Encoder using lamejs (192 kbps Stereo).
   * Inlines the cached lame.min.js bundle (from IndexedDB or ./src/vendor/lame.min.js)
   * directly into the Worker Blob so offline PWA installs work with zero network dependency.
   */
  async encodeAudioBufferToMp3(audioBuffer, onProgress = () => {}) {
    const cachedLameSource = await this.ensureLameJsCached().catch(() => null);

    return new Promise((resolve, reject) => {
      const sampleRate = audioBuffer.sampleRate || 44100;
      const leftF32 = audioBuffer.getChannelData(0);
      const rightF32 = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftF32;
      const localLameUrl = new URL('./src/vendor/lame.min.js', window.location.href).href;

      const workerCode = `
        self.onmessage = function(e) {
          const { left, right, sampleRate, kbps, localLameUrl } = e.data;
          if (!self.lamejs) {
            try {
              importScripts(localLameUrl);
            } catch (localErr) {
              self.postMessage({
                type: 'error',
                message: 'Failed to load ./src/vendor/lame.min.js in Worker: ' + localErr.message
              });
              return;
            }
          }
          if (!self.lamejs) {
            self.postMessage({ type: 'error', message: 'lamejs unavailable' });
            return;
          }
          const mp3encoder = new self.lamejs.Mp3Encoder(2, sampleRate, kbps || 192);
          const len = left.length;
          const leftInt16 = new Int16Array(len);
          const rightInt16 = new Int16Array(len);
          for (let i = 0; i < len; i++) {
            const sL = Math.max(-1, Math.min(1, left[i]));
            const sR = Math.max(-1, Math.min(1, right[i]));
            leftInt16[i] = sL < 0 ? sL * 0x8000 : sL * 0x7fff;
            rightInt16[i] = sR < 0 ? sR * 0x8000 : sR * 0x7fff;
          }

          const mp3Data = [];
          const blockSize = 1152;
          for (let i = 0; i < len; i += blockSize) {
            const lChunk = leftInt16.subarray(i, i + blockSize);
            const rChunk = rightInt16.subarray(i, i + blockSize);
            const mp3buf = mp3encoder.encodeBuffer(lChunk, rChunk);
            if (mp3buf.length > 0) mp3Data.push(new Int8Array(mp3buf));
            if (i % (blockSize * 40) === 0) {
              self.postMessage({ type: 'progress', pct: Math.round((i / len) * 100) });
            }
          }
          const endBuf = mp3encoder.flush();
          if (endBuf.length > 0) mp3Data.push(new Int8Array(endBuf));
          self.postMessage({ type: 'done', mp3Data });
        };
      `;

      const blobParts = cachedLameSource ? [cachedLameSource, '\n;\n', workerCode] : [workerCode];
      const workerBlob = new Blob(blobParts, { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(workerBlob);
      const worker = new Worker(workerUrl);

      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          onProgress(msg.pct);
        } else if (msg.type === 'done') {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          const mp3Blob = new Blob(msg.mp3Data, { type: 'audio/mpeg' });
          resolve(mp3Blob);
        } else if (msg.type === 'error') {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          reject(new Error(msg.message));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(new Error(err.message || 'MP3 Worker Error'));
      };

      worker.postMessage({
        left: leftF32,
        right: rightF32,
        sampleRate,
        kbps: 192,
        localLameUrl
      });
    });
  }

  _triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

export default AudioExporter;
