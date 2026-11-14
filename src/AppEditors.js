/**
 * src/AppEditors.js - Pattern Library & Drum/Bass/Chord Editors Mixin
 */
import {
  DEFAULT_GM_PRESETS,
  getDefaultBeatSeparator
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

export const AppEditorsMixin = {
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

    const btnExportWorkspace = document.getElementById('btn-export-workspace');
    const btnImportWorkspace = document.getElementById('btn-import-workspace');
    const workspaceFileInput = document.getElementById('workspace-file-input');

    if (btnExportWorkspace) {
      btnExportWorkspace.addEventListener('click', () => this.exportWorkspaceJson());
    }
    if (btnImportWorkspace && workspaceFileInput) {
      btnImportWorkspace.addEventListener('click', () => workspaceFileInput.click());
      workspaceFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          this.importWorkspaceJson(file);
          workspaceFileInput.value = '';
        }
      });
    }

    document.querySelectorAll('.btn-back-to-patterns').forEach(btn => {
      btn.addEventListener('click', () => {
        this.stopSoloAudition();
        this.closeEditorsToLibrary();
      });
    });

    document.querySelectorAll('.btn-save-pattern').forEach(btn => {
      btn.addEventListener('click', () => {
        this.saveActiveEditorChanges();
      });
    });

    this.bindDrumEditorControls();
    this.bindBassEditorControls();
    this.bindChordEditorControls();
  },

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
      const stepsCount = p.type === 'chords'
        ? (p.measures ? p.measures.reduce((sum, m) => sum + (m ? m.length : 1), 0) : (p.bars || 4))
        : this.getTotalSteps(p);
      const lengthUnit = p.type === 'chords' ? 'Chords' : 'Steps';
      const resLabel = p.type === 'chords' ? this.getChordPatternResolutionSummary(p) : (p.resolution || '1/16');
      const lengthText = `${p.bars || 1} Bar${(p.bars || 1) > 1 ? 's' : ''} (${stepsCount} ${lengthUnit} @ ${resLabel})`;

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
        this.saveWorkspaceToLocalStorage();
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
  },

  openEditorForPattern(patternId) {
    const pat = this.getPatternById(patternId);
    if (!pat) return;

    this.editingPatternId = pat.id;

    document.querySelectorAll('.nav-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-target') === 'view-patterns');
    });
    document.querySelectorAll('.view-container').forEach(v => {
      v.classList.toggle('active', v.id === 'view-patterns');
    });

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
  },

  closeEditorsToLibrary() {
    document.querySelectorAll('.editor-panel').forEach(ed => ed.classList.remove('active'));
    const libView = document.getElementById('pattern-library-view');
    if (libView) libView.style.display = 'block';
    this.editingPatternId = null;
    this.log('[UI] Returned to Pattern Library');
  },

  saveActiveEditorChanges() {
    const pat = this.getPatternById(this.editingPatternId);
    if (!pat) return;

    if (pat.type === 'drums') {
      pat.name = (document.getElementById('drum-ed-name').value.trim() || pat.name).slice(0, 12);
      const num = parseInt(document.getElementById('drum-ed-ts-num').value, 10) || 4;
      const den = parseInt(document.getElementById('drum-ed-ts-den').value, 10) === 8 ? 8 : 4;
      pat.timeSig = `${num}/${den}`;
      pat.syncMaster = document.getElementById('drum-ed-sync').checked;
      pat.bpm = Math.max(40, Math.min(280, parseFloat(document.getElementById('drum-ed-bpm').value) || 120));
      pat.bars = parseInt(document.getElementById('drum-ed-bars').textContent, 10) || 1;
      pat.resolution = document.getElementById('drum-ed-res').value;
      pat.beatSep = Math.max(1, Math.min(9, parseInt(document.getElementById('drum-ed-beatsep').value, 10) || 4));
      const total = this.getTotalSteps(pat);
      pat.preview = pat.drumGrid[0].slice(0, Math.min(24, total)).map((v, i) =>
        (v > 0 || (pat.drumGrid[1] && pat.drumGrid[1][i] > 0) || (pat.drumGrid[2] && pat.drumGrid[2][i] > 0) ? 1 : 0)
      );
    } else if (pat.type === 'bass') {
      pat.name = (document.getElementById('bass-ed-name').value.trim() || pat.name).slice(0, 12);
      const num = parseInt(document.getElementById('bass-ed-ts-num').value, 10) || 4;
      const den = parseInt(document.getElementById('bass-ed-ts-den').value, 10) === 8 ? 8 : 4;
      pat.timeSig = `${num}/${den}`;
      pat.syncMaster = document.getElementById('bass-ed-sync').checked;
      pat.bpm = Math.max(40, Math.min(280, parseFloat(document.getElementById('bass-ed-bpm').value) || 120));
      pat.bars = parseInt(document.getElementById('bass-ed-bars').textContent, 10) || 1;
      pat.resolution = document.getElementById('bass-ed-res').value;
      pat.beatSep = Math.max(1, Math.min(9, parseInt(document.getElementById('bass-ed-beatsep').value, 10) || 4));
      const total = this.getTotalSteps(pat);
      pat.preview = pat.bassSteps.slice(0, Math.min(24, total)).map(s => (s.rest ? 0 : 1));
    } else if (pat.type === 'chords') {
      pat.name = (document.getElementById('chord-ed-name').value.trim() || pat.name).slice(0, 12);
      const num = parseInt(document.getElementById('chord-ed-ts-num').value, 10) || 4;
      const den = parseInt(document.getElementById('chord-ed-ts-den').value, 10) === 8 ? 8 : 4;
      pat.timeSig = `${num}/${den}`;
      pat.syncMaster = document.getElementById('chord-ed-sync').checked;
      pat.bpm = Math.max(40, Math.min(280, parseFloat(document.getElementById('chord-ed-bpm').value) || 120));
      pat.bars = pat.measures ? pat.measures.length : (pat.bars || 4);
      pat.resolution = this.getChordPatternResolutionSummary(pat);
      pat.voicing = document.getElementById('chord-ed-voicing').value;
      pat.octave = Math.max(-4, Math.min(4, parseInt(document.getElementById('chord-ed-octave').value, 10) || 0));
    }

    this.saveWorkspaceToLocalStorage();
    this.renderPatternLibrary();
    this.renderPalette();
    this.renderStageTracks();
    this.updateChordDisplay(this.activeBarIndex, 0);
    this.log(`[EDITOR] Saved changes to ${pat.id} (${pat.name})`);
    this.stopSoloAudition();
    this.closeEditorsToLibrary();
  },

  // --- 5.1 Drum Lab Editor (#editor-drums) ---
  bindDrumEditorControls() {
    const syncCheck = document.getElementById('drum-ed-sync');
    const bpmWrap = document.getElementById('drum-ed-bpm-wrap');
    const bpmInput = document.getElementById('drum-ed-bpm');
    const tsNumSelect = document.getElementById('drum-ed-ts-num');
    const tsDenSelect = document.getElementById('drum-ed-ts-den');
    const resSelect = document.getElementById('drum-ed-res');
    const beatSepSelect = document.getElementById('drum-ed-beatsep');
    const barsDec = document.getElementById('drum-bars-dec');
    const barsInc = document.getElementById('drum-bars-inc');
    const barsVal = document.getElementById('drum-ed-bars');
    const soloBtn = document.getElementById('btn-drum-solo');

    if (syncCheck && bpmWrap) {
      syncCheck.addEventListener('change', (e) => {
        const synced = e.target.checked;
        bpmWrap.style.display = synced ? 'none' : 'flex';
        const pat = this.getPatternById(this.editingPatternId);
        if (pat) pat.syncMaster = synced;
      });
    }

    if (bpmInput) {
      bpmInput.addEventListener('change', (e) => {
        const val = Math.max(40, Math.min(280, parseFloat(e.target.value) || 120));
        e.target.value = val;
        const pat = this.getPatternById(this.editingPatternId);
        if (pat) pat.bpm = val;
      });
    }

    const onDrumTimeSigChange = (changedDenominator = false) => {
      const pat = this.getPatternById(this.editingPatternId);
      if (!pat) return;
      const num = Math.max(1, Math.min(21, parseInt(tsNumSelect.value, 10) || 4));
      const den = parseInt(tsDenSelect.value, 10) === 8 ? 8 : 4;
      pat.timeSig = `${num}/${den}`;

      // When user switches denominator to /8, default to 1/8 resolution so e.g. 7/8 = 7 slots (unless user explicitly picks another resolution)
      if (changedDenominator && den === 8 && pat.resolution === '1/16') {
        pat.resolution = '1/8';
        if (resSelect) resSelect.value = '1/8';
      }

      pat.beatSep = getDefaultBeatSeparator(pat.timeSig, pat.resolution);
      if (beatSepSelect) beatSepSelect.value = String(pat.beatSep);

      this.renderDrumMatrix(pat);
      this.log(`[DRUM EDITOR] Time Sig -> ${pat.timeSig} @ ${pat.resolution} (${this.getStepsPerBar(pat.timeSig, pat.resolution)} slots/bar)`);
    };

    if (tsNumSelect) tsNumSelect.addEventListener('change', () => onDrumTimeSigChange(false));
    if (tsDenSelect) tsDenSelect.addEventListener('change', () => onDrumTimeSigChange(true));

    if (resSelect) {
      resSelect.addEventListener('change', (e) => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat) return;
        pat.resolution = e.target.value;
        pat.beatSep = getDefaultBeatSeparator(pat.timeSig, pat.resolution);
        if (beatSepSelect) beatSepSelect.value = String(pat.beatSep);
        this.renderDrumMatrix(pat);
        this.log(`[DRUM EDITOR] Resolution -> ${pat.resolution} (${this.getStepsPerBar(pat.timeSig, pat.resolution)} slots/bar)`);
      });
    }

    if (beatSepSelect) {
      beatSepSelect.addEventListener('change', (e) => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat) return;
        pat.beatSep = Math.max(1, Math.min(9, parseInt(e.target.value, 10) || 4));
        this.renderDrumMatrix(pat);
        this.log(`[DRUM EDITOR] Visual Beat Separator -> Every ${pat.beatSep} slot(s)`);
      });
    }

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

    soloBtn.addEventListener('click', () => {
      this.toggleSoloAudition('drums', soloBtn);
    });
  },

  populateDrumEditor(pat) {
    document.getElementById('drum-ed-title').textContent = `Editing: ${pat.id} ${pat.name}`;
    document.getElementById('drum-ed-name').value = pat.name;

    const { upper, lower } = this.parseTimeSig(pat.timeSig || '4/4');
    const tsNumEl = document.getElementById('drum-ed-ts-num');
    const tsDenEl = document.getElementById('drum-ed-ts-den');
    if (tsNumEl) tsNumEl.value = String(upper);
    if (tsDenEl) tsDenEl.value = String(lower);

    document.getElementById('drum-ed-sync').checked = pat.syncMaster !== false;
    document.getElementById('drum-ed-bpm').value = pat.bpm || 120;
    const bpmWrap = document.getElementById('drum-ed-bpm-wrap');
    if (bpmWrap) {
      bpmWrap.style.display = (pat.syncMaster !== false) ? 'none' : 'flex';
    }
    document.getElementById('drum-ed-bars').textContent = pat.bars || 1;
    document.getElementById('drum-ed-res').value = pat.resolution || '1/16';

    const beatSep = this.getBeatSepForPattern(pat);
    pat.beatSep = beatSep;
    const beatSepEl = document.getElementById('drum-ed-beatsep');
    if (beatSepEl) beatSepEl.value = String(beatSep);

    this.renderDrumMatrix(pat);
  },

  renderDrumMatrix(pat) {
    const container = document.getElementById('drum-matrix-container');
    if (!container) return;
    container.innerHTML = '';

    const stepsPerBar = this.getStepsPerBar(pat.timeSig || '4/4', pat.resolution || '1/16');
    const stepCount = this.getTotalSteps(pat);
    const beatSep = this.getBeatSepForPattern(pat);

    const summaryEl = document.getElementById('drum-ed-slot-summary');
    if (summaryEl) {
      summaryEl.textContent = `${stepsPerBar} / Bar • ${stepCount} Total`;
    }

    this.drumSlots.forEach((inst, rowIdx) => {
      if (!pat.drumGrid[rowIdx]) pat.drumGrid[rowIdx] = [];
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
        const barNum = Math.floor(s / stepsPerBar) + 1;
        const stepInBar = (s % stepsPerBar) + 1;
        const btn = document.createElement('button');
        btn.className = 'drum-step-btn';
        btn.setAttribute('data-state', state);
        btn.setAttribute('data-step-idx', s);
        btn.title = `Bar ${barNum} • Step ${stepInBar}/${stepsPerBar} (#${s + 1}) — ${inst.label} (Note ${inst.pitch})`;

        btn.addEventListener('click', async () => {
          const nextState = ((pat.drumGrid[rowIdx][s] || 0) + 1) % 4;
          pat.drumGrid[rowIdx][s] = nextState;
          btn.setAttribute('data-state', nextState);

          if (nextState > 0) {
            await this.ensureSystemInitialized();
            const vel = this.getDrumStepVelocity(nextState);
            this.midiBridge.sendNoteOn('rhythm', inst.pitch, vel, this.engine.audioCtx.currentTime, 0.15);
          }
        });

        stepsGrid.appendChild(btn);

        // Insert Vertical Amber Beat Separator every `beatSep` slots within each bar, or at bar boundary
        const isBarEnd = (s + 1) % stepsPerBar === 0;
        const isBeatSep = (stepInBar % beatSep === 0);
        if ((isBeatSep || isBarEnd) && s < stepCount - 1) {
          const sep = document.createElement('span');
          sep.className = `beat-sep-amber${isBarEnd ? ' bar-sep' : ''}`;
          sep.title = isBarEnd ? `End of Bar ${barNum}` : `Beat Separator (Every ${beatSep})`;
          stepsGrid.appendChild(sep);
        }
      }

      container.appendChild(rowEl);
    });
  },

  // --- 5.2 Bassline Editor (#editor-bass) ---
  bindBassEditorControls() {
    const syncCheck = document.getElementById('bass-ed-sync');
    const bpmWrap = document.getElementById('bass-ed-bpm-wrap');
    const bpmInput = document.getElementById('bass-ed-bpm');
    const tsNumSelect = document.getElementById('bass-ed-ts-num');
    const tsDenSelect = document.getElementById('bass-ed-ts-den');
    const resSelect = document.getElementById('bass-ed-res');
    const beatSepSelect = document.getElementById('bass-ed-beatsep');
    const barsDec = document.getElementById('bass-bars-dec');
    const barsInc = document.getElementById('bass-bars-inc');
    const barsVal = document.getElementById('bass-ed-bars');
    const modeStrictBtn = document.getElementById('bass-mode-strict');
    const modeFollowerBtn = document.getElementById('bass-mode-follower');
    const presetSelect = document.getElementById('bass-ed-preset');
    const rehearsalMuteBtn = document.getElementById('btn-rehearsal-mute-bass');
    const soloBtn = document.getElementById('btn-bass-solo');

    if (syncCheck && bpmWrap) {
      syncCheck.addEventListener('change', (e) => {
        const synced = e.target.checked;
        bpmWrap.style.display = synced ? 'none' : 'flex';
        const pat = this.getPatternById(this.editingPatternId);
        if (pat) pat.syncMaster = synced;
      });
    }

    if (bpmInput) {
      bpmInput.addEventListener('change', (e) => {
        const val = Math.max(40, Math.min(280, parseFloat(e.target.value) || 120));
        e.target.value = val;
        const pat = this.getPatternById(this.editingPatternId);
        if (pat) pat.bpm = val;
      });
    }

    const onBassTimeSigChange = (changedDenominator = false) => {
      const pat = this.getPatternById(this.editingPatternId);
      if (!pat) return;
      const num = Math.max(1, Math.min(21, parseInt(tsNumSelect.value, 10) || 4));
      const den = parseInt(tsDenSelect.value, 10) === 8 ? 8 : 4;
      pat.timeSig = `${num}/${den}`;

      if (changedDenominator && den === 8 && pat.resolution === '1/16') {
        pat.resolution = '1/8';
        if (resSelect) resSelect.value = '1/8';
      }

      pat.beatSep = getDefaultBeatSeparator(pat.timeSig, pat.resolution);
      if (beatSepSelect) beatSepSelect.value = String(pat.beatSep);

      this.renderBassRibbon(pat);
      this.log(`[BASS EDITOR] Time Sig -> ${pat.timeSig} @ ${pat.resolution} (${this.getStepsPerBar(pat.timeSig, pat.resolution)} slots/bar)`);
    };

    if (tsNumSelect) tsNumSelect.addEventListener('change', () => onBassTimeSigChange(false));
    if (tsDenSelect) tsDenSelect.addEventListener('change', () => onBassTimeSigChange(true));

    if (resSelect) {
      resSelect.addEventListener('change', (e) => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat) return;
        pat.resolution = e.target.value;
        pat.beatSep = getDefaultBeatSeparator(pat.timeSig, pat.resolution);
        if (beatSepSelect) beatSepSelect.value = String(pat.beatSep);
        this.renderBassRibbon(pat);
        this.log(`[BASS EDITOR] Resolution -> ${pat.resolution} (${this.getStepsPerBar(pat.timeSig, pat.resolution)} slots/bar)`);
      });
    }

    if (beatSepSelect) {
      beatSepSelect.addEventListener('change', (e) => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat) return;
        pat.beatSep = Math.max(1, Math.min(9, parseInt(e.target.value, 10) || 4));
        this.renderBassRibbon(pat);
        this.log(`[BASS EDITOR] Visual Beat Separator -> Every ${pat.beatSep} slot(s)`);
      });
    }

    if (barsDec && barsVal) {
      barsDec.addEventListener('click', () => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat) return;
        pat.bars = Math.max(1, (pat.bars || 1) - 1);
        barsVal.textContent = pat.bars;
        this.renderBassRibbon(pat);
      });
    }

    if (barsInc && barsVal) {
      barsInc.addEventListener('click', () => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat) return;
        pat.bars = Math.min(4, (pat.bars || 1) + 1);
        barsVal.textContent = pat.bars;
        this.renderBassRibbon(pat);
      });
    }

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
  },

  populateBassEditor(pat) {
    document.getElementById('bass-ed-title').textContent = `Editing: ${pat.id} ${pat.name}`;
    document.getElementById('bass-ed-name').value = pat.name;

    const { upper, lower } = this.parseTimeSig(pat.timeSig || '4/4');
    const tsNumEl = document.getElementById('bass-ed-ts-num');
    const tsDenEl = document.getElementById('bass-ed-ts-den');
    if (tsNumEl) tsNumEl.value = String(upper);
    if (tsDenEl) tsDenEl.value = String(lower);

    document.getElementById('bass-ed-sync').checked = pat.syncMaster !== false;
    document.getElementById('bass-ed-bpm').value = pat.bpm || 120;
    const bpmWrap = document.getElementById('bass-ed-bpm-wrap');
    if (bpmWrap) {
      bpmWrap.style.display = (pat.syncMaster !== false) ? 'none' : 'flex';
    }
    const barsEl = document.getElementById('bass-ed-bars');
    if (barsEl) barsEl.textContent = pat.bars || 1;
    document.getElementById('bass-ed-res').value = pat.resolution || '1/16';

    const beatSep = this.getBeatSepForPattern(pat);
    pat.beatSep = beatSep;
    const beatSepEl = document.getElementById('bass-ed-beatsep');
    if (beatSepEl) beatSepEl.value = String(beatSep);

    document.getElementById('bass-ed-preset').value = pat.preset || 33;

    const isStrict = pat.mode === 'strict';
    document.getElementById('bass-mode-strict').classList.toggle('active', isStrict);
    document.getElementById('bass-mode-follower').classList.toggle('active', !isStrict);

    const rehearsalMuteBtn = document.getElementById('btn-rehearsal-mute-bass');
    rehearsalMuteBtn.classList.toggle('active', this.tracks.bass.muted);

    this.renderBassRibbon(pat);
  },

  renderBassRibbon(pat) {
    const ribbon = document.getElementById('bass-step-ribbon');
    if (!ribbon) return;
    ribbon.innerHTML = '';

    const stepsPerBar = this.getStepsPerBar(pat.timeSig || '4/4', pat.resolution || '1/16');
    const stepCount = this.getTotalSteps(pat);
    const beatSep = this.getBeatSepForPattern(pat);

    const summaryEl = document.getElementById('bass-ed-slot-summary');
    if (summaryEl) {
      summaryEl.textContent = `${stepsPerBar} / Bar • ${stepCount} Total`;
    }

    if (!pat.bassSteps) pat.bassSteps = [];
    while (pat.bassSteps.length < stepCount) {
      pat.bassSteps.push({
        pitch: 'A1',
        degree: 'R',
        gate: 50,
        accent: false,
        slide: false,
        rest: false
      });
    }

    for (let idx = 0; idx < stepCount; idx++) {
      const step = pat.bassSteps[idx];
      const barNum = Math.floor(idx / stepsPerBar) + 1;
      const stepInBar = (idx % stepsPerBar) + 1;
      const card = document.createElement('div');
      card.className = `bass-step-card ${step.rest ? 'is-rest' : ''}`;
      card.setAttribute('data-step-idx', idx);

      const badgeText = pat.mode === 'strict' ? step.pitch : step.degree;
      const gateText = step.gate === 25 ? '25% Stac' : (step.gate === 50 ? '50% Std' : '100% Leg');

      card.innerHTML = `
        <span class="bass-step-num" title="Bar ${barNum} • Step ${stepInBar}/${stepsPerBar}">#${idx + 1}</span>
        <button class="bass-pitch-pill" title="Drag Up/Down or Scroll Wheel to slide pitch/degree chromatically (Click to audition)">↕ ${badgeText}</button>
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

      const pillBtn = card.querySelector('.bass-pitch-pill');
      const getStepList = () => (pat.mode === 'strict' ? STRICT_PITCHES : HARMONIC_DEGREES);
      const getCurrentIndex = () => {
        const list = getStepList();
        const val = pat.mode === 'strict' ? step.pitch : step.degree;
        const found = list.indexOf(val);
        if (found !== -1) return found;
        return pat.mode === 'strict' ? list.indexOf('A1') : list.indexOf('R');
      };
      const auditionBassStep = async () => {
        await this.ensureSystemInitialized();
        const midiNote = pat.mode === 'strict'
          ? (PITCH_TO_MIDI[step.pitch] ?? 33)
          : (33 + (DEGREE_TO_OFFSET[step.degree] ?? 0));
        this.midiBridge.sendNoteOn('bass', midiNote, step.accent ? 120 : 95, this.engine.audioCtx.currentTime, 0.22);
      };
      const applyStepIndex = (newIdx) => {
        const list = getStepList();
        const clamped = Math.max(0, Math.min(list.length - 1, newIdx));
        const newVal = list[clamped];
        if (pat.mode === 'strict') {
          step.pitch = newVal;
        } else {
          step.degree = newVal;
        }
        pillBtn.textContent = `↕ ${newVal}`;
        this.saveWorkspaceToStorage();
        auditionBassStep();
        return clamped;
      };

      let dragStartY = null;
      let dragStartIndex = 0;
      let lastAppliedIndex = 0;
      let didStepChange = false;

      pillBtn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        dragStartY = e.clientY;
        dragStartIndex = getCurrentIndex();
        lastAppliedIndex = dragStartIndex;
        didStepChange = false;
        pillBtn.classList.add('is-dragging');
        if (pillBtn.setPointerCapture) {
          try { pillBtn.setPointerCapture(e.pointerId); } catch (_) {}
        }
      });

      pillBtn.addEventListener('pointermove', (e) => {
        if (dragStartY === null) return;
        const deltaPx = dragStartY - e.clientY; // Sliding UP = positive delta = higher pitch/degree
        const deltaSemitones = Math.round(deltaPx / 10);
        const list = getStepList();
        const targetIndex = Math.max(0, Math.min(list.length - 1, dragStartIndex + deltaSemitones));
        if (targetIndex !== lastAppliedIndex) {
          lastAppliedIndex = applyStepIndex(targetIndex);
          didStepChange = true;
        }
      });

      const endDrag = (e) => {
        if (dragStartY === null) return;
        dragStartY = null;
        pillBtn.classList.remove('is-dragging');
        if (pillBtn.releasePointerCapture && e && e.pointerId !== undefined) {
          try { pillBtn.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        if (!didStepChange) {
          auditionBassStep();
        }
      };

      pillBtn.addEventListener('pointerup', endDrag);
      pillBtn.addEventListener('pointercancel', endDrag);

      pillBtn.addEventListener('wheel', (e) => {
        e.preventDefault();
        const dir = e.deltaY < 0 ? 1 : -1;
        const curIdx = getCurrentIndex();
        if (curIdx + dir >= 0 && curIdx + dir < getStepList().length) {
          applyStepIndex(curIdx + dir);
        }
      }, { passive: false });

      card.querySelector('.bass-gate-bar').addEventListener('click', () => {
        step.gate = step.gate === 25 ? 50 : (step.gate === 50 ? 100 : 25);
        this.saveWorkspaceToStorage();
        this.renderBassRibbon(pat);
      });

      card.querySelectorAll('.bass-art-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const art = btn.getAttribute('data-art');
          step[art] = !step[art];
          this.saveWorkspaceToStorage();
          this.renderBassRibbon(pat);
        });
      });

      ribbon.appendChild(card);

      // Insert Vertical Amber Beat Separator every `beatSep` slots within each bar, or at bar boundary
      const isBarEnd = (idx + 1) % stepsPerBar === 0;
      const isBeatSep = (stepInBar % beatSep === 0);
      if ((isBeatSep || isBarEnd) && idx < stepCount - 1) {
        const sep = document.createElement('span');
        sep.className = `beat-sep-amber${isBarEnd ? ' bar-sep' : ''}`;
        sep.title = isBarEnd ? `End of Bar ${barNum}` : `Beat Separator (Every ${beatSep})`;
        ribbon.appendChild(sep);
      }
    }
  },

  getChordPatternResolutionSummary(pat) {
    if (!pat || !pat.measures || pat.measures.length === 0) return pat?.resolution || '1/1';
    const counts = pat.measures.map(m => (m && m.length) || 1);
    const allSame = counts.every(c => c === counts[0]);
    if (allSame) {
      const c = counts[0];
      return c === 1 ? '1/1' : (c === 2 ? '1/2' : (c === 3 ? '1/3' : '1/4'));
    }
    return `Mixed (${Math.min(...counts)}–${Math.max(...counts)}/bar)`;
  },

  // --- 5.3 Chord Editor (#editor-chords) ---
  bindChordEditorControls() {
    const syncCheck = document.getElementById('chord-ed-sync');
    const bpmWrap = document.getElementById('chord-ed-bpm-wrap');
    const bpmInput = document.getElementById('chord-ed-bpm');
    const tsNumSelect = document.getElementById('chord-ed-ts-num');
    const tsDenSelect = document.getElementById('chord-ed-ts-den');
    const barsDec = document.getElementById('chord-bars-dec');
    const barsInc = document.getElementById('chord-bars-inc');
    const barsVal = document.getElementById('chord-ed-bars');
    const voicingSelect = document.getElementById('chord-ed-voicing');
    const octaveSelect = document.getElementById('chord-ed-octave');
    const presetSelect = document.getElementById('chord-ed-preset');
    const soloBtn = document.getElementById('btn-chord-solo');

    if (syncCheck && bpmWrap) {
      syncCheck.addEventListener('change', (e) => {
        const synced = e.target.checked;
        bpmWrap.style.display = synced ? 'none' : 'flex';
        const pat = this.getPatternById(this.editingPatternId);
        if (pat) pat.syncMaster = synced;
      });
    }

    if (bpmInput) {
      bpmInput.addEventListener('change', (e) => {
        const val = Math.max(40, Math.min(280, parseFloat(e.target.value) || 120));
        e.target.value = val;
        const pat = this.getPatternById(this.editingPatternId);
        if (pat) pat.bpm = val;
      });
    }

    const onChordTimeSigChange = () => {
      const pat = this.getPatternById(this.editingPatternId);
      if (!pat) return;
      const num = Math.max(1, Math.min(21, parseInt(tsNumSelect.value, 10) || 4));
      const den = parseInt(tsDenSelect.value, 10) === 8 ? 8 : 4;
      pat.timeSig = `${num}/${den}`;
      this.renderChordMeasuresGrid(pat);
    };

    if (tsNumSelect) tsNumSelect.addEventListener('change', onChordTimeSigChange);
    if (tsDenSelect) tsDenSelect.addEventListener('change', onChordTimeSigChange);

    if (barsDec && barsVal) {
      barsDec.addEventListener('click', () => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat || !pat.measures) return;
        if (pat.measures.length > 1) {
          pat.measures.pop();
          pat.bars = pat.measures.length;
          barsVal.textContent = String(pat.bars);
          this.renderChordMeasuresGrid(pat);
          this.updateChordDisplay(this.activeBarIndex, 0);
        }
      });
    }

    if (barsInc && barsVal) {
      barsInc.addEventListener('click', () => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat) return;
        if (!pat.measures) pat.measures = [['Cmaj7']];
        if (pat.measures.length < 8) {
          const lastBar = pat.measures[pat.measures.length - 1] || ['Cmaj7'];
          pat.measures.push([...lastBar]);
          pat.bars = pat.measures.length;
          barsVal.textContent = String(pat.bars);
          this.renderChordMeasuresGrid(pat);
          this.updateChordDisplay(this.activeBarIndex, 0);
        }
      });
    }

    const auditionChordEditorChange = async (pat) => {
      await this.ensureSystemInitialized();
      const firstSym = (pat.measures && pat.measures[0] && pat.measures[0][0]) || 'Am7';
      const notes = this.chordSymbolToMidiNotes(firstSym, pat.voicing || 'Jazz Drop-2', pat.octave || 0);
      const now = this.engine.audioCtx.currentTime;
      notes.forEach(n => this.midiBridge.sendNoteOn('chords', n, 88, now, 0.55));
    };

    if (voicingSelect) {
      voicingSelect.addEventListener('change', async (e) => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat) return;
        pat.voicing = e.target.value;
        this.log(`[CHORD EDITOR] Voicing Style -> ${pat.voicing}`);
        await auditionChordEditorChange(pat);
      });
    }

    if (octaveSelect) {
      octaveSelect.addEventListener('change', async (e) => {
        const pat = this.getPatternById(this.editingPatternId);
        if (!pat) return;
        pat.octave = Math.max(-4, Math.min(4, parseInt(e.target.value, 10) || 0));
        this.log(`[CHORD EDITOR] Chord Octave -> ${pat.octave > 0 ? `+${pat.octave}` : pat.octave}`);
        await auditionChordEditorChange(pat);
      });
    }

    presetSelect.addEventListener('change', (e) => {
      const prog = parseInt(e.target.value, 10);
      const optText = presetSelect.options[presetSelect.selectedIndex].text;
      this.soundFontManager.setPreset(3, 0, prog, optText);
      this.renderStageTracks();
      this.log(`[SF2] Chords Preset -> ${optText}`);
    });

    soloBtn.addEventListener('click', () => {
      this.toggleSoloAudition('chords', soloBtn);
    });
  },

  populateChordEditor(pat) {
    document.getElementById('chord-ed-title').textContent = `Editing: ${pat.id} ${pat.name}`;
    document.getElementById('chord-ed-name').value = pat.name;

    const { upper, lower } = this.parseTimeSig(pat.timeSig || '4/4');
    const tsNumEl = document.getElementById('chord-ed-ts-num');
    const tsDenEl = document.getElementById('chord-ed-ts-den');
    if (tsNumEl) tsNumEl.value = String(upper);
    if (tsDenEl) tsDenEl.value = String(lower);

    document.getElementById('chord-ed-sync').checked = pat.syncMaster !== false;
    document.getElementById('chord-ed-bpm').value = pat.bpm || 120;
    const bpmWrap = document.getElementById('chord-ed-bpm-wrap');
    if (bpmWrap) {
      bpmWrap.style.display = (pat.syncMaster !== false) ? 'none' : 'flex';
    }
    const barsEl = document.getElementById('chord-ed-bars');
    if (barsEl) {
      barsEl.textContent = String((pat.measures && pat.measures.length) || pat.bars || 4);
    }
    document.getElementById('chord-ed-voicing').value = pat.voicing || 'Jazz Drop-2';
    const octEl = document.getElementById('chord-ed-octave');
    if (octEl) octEl.value = String(pat.octave || 0);
    document.getElementById('chord-ed-preset').value = pat.preset !== undefined ? pat.preset : DEFAULT_GM_PRESETS.chords.program;

    this.renderChordMeasuresGrid(pat);
  },

  renderChordMeasuresGrid(pat) {
    const grid = document.getElementById('chord-measures-grid');
    if (!grid) return;
    grid.innerHTML = '';

    pat.measures.forEach((barChords, barIdx) => {
      const slotsInThisBar = Math.max(1, Math.min(4, (barChords && barChords.length) || 1));
      const resLabel = slotsInThisBar === 1 ? '1/1' : (slotsInThisBar === 2 ? '1/2' : (slotsInThisBar === 3 ? '1/3' : '1/4'));

      const card = document.createElement('div');
      card.className = 'measure-card';

      card.innerHTML = `
        <div class="measure-card-header">
          <span>BAR ${barIdx + 1} <span style="opacity: 0.65; font-weight: 600;">(${pat.timeSig} • ${resLabel})</span></span>
          <div class="measure-res-group" title="Harmonic Resolution (number of chords in Bar ${barIdx + 1})">
            <button class="measure-res-btn ${slotsInThisBar === 1 ? 'active' : ''}" data-slots="1">1/1 (1)</button>
            <button class="measure-res-btn ${slotsInThisBar === 2 ? 'active' : ''}" data-slots="2">1/2 (2)</button>
            <button class="measure-res-btn ${slotsInThisBar === 3 ? 'active' : ''}" data-slots="3">1/3 (3)</button>
            <button class="measure-res-btn ${slotsInThisBar === 4 ? 'active' : ''}" data-slots="4">1/4 (4)</button>
          </div>
        </div>
        <div class="measure-slots-row" style="grid-template-columns: repeat(${slotsInThisBar}, 1fr);"></div>
      `;

      // Per-bar Harmonic Resolution buttons
      card.querySelectorAll('.measure-res-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const targetSlots = parseInt(btn.getAttribute('data-slots'), 10) || 1;
          const nextBarChords = [];
          for (let i = 0; i < targetSlots; i++) {
            const existing = barChords[i] !== undefined
              ? barChords[i]
              : (barChords[barChords.length - 1] !== undefined ? barChords[barChords.length - 1] : 'Cmaj7');
            nextBarChords.push(existing);
          }
          pat.measures[barIdx] = nextBarChords;
          pat.resolution = this.getChordPatternResolutionSummary(pat);
          this.renderChordMeasuresGrid(pat);
          this.updateChordDisplay(this.activeBarIndex, 0);
          this.log(`[CHORD EDITOR] Bar ${barIdx + 1} Harmonic Resolution -> ${targetSlots} chord${targetSlots > 1 ? 's' : ''} in bar`);
        });
      });

      const slotsRow = card.querySelector('.measure-slots-row');
      for (let s = 0; s < slotsInThisBar; s++) {
        const symbol = barChords[s] !== undefined ? barChords[s] : 'Am7';
        const isSilent = this.isSilentChordSymbol(symbol);
        const analysis = this.analyzeChordModalFunction(symbol);

        const slotEl = document.createElement('div');
        slotEl.className = `chord-beat-slot${isSilent ? ' is-silent' : ''}`;
        slotEl.setAttribute('data-bar-idx', barIdx);
        slotEl.setAttribute('data-slot-idx', s);
        slotEl.innerHTML = `
          <div class="chord-slot-top">
            <input type="text" class="chord-symbol-input" value="${symbol}" placeholder="Ø (Silent)" title="Enter chord symbol (e.g. Dm7, G7b9, Cmaj7) or leave empty / type O for Silence">
            <button type="button" class="btn-chord-silence" title="Toggle Silence (O / Empty) on this slot">Ø</button>
            <span class="chord-valid-check" title="Valid Chord Formula or Silence">✓</span>
          </div>
          <div class="chord-modal-badge">${analysis}</div>
        `;

        const inputEl = slotEl.querySelector('.chord-symbol-input');
        const silenceBtn = slotEl.querySelector('.btn-chord-silence');
        const badgeEl = slotEl.querySelector('.chord-modal-badge');
        const checkEl = slotEl.querySelector('.chord-valid-check');

        const applyChordSlotValue = (rawVal) => {
          const val = rawVal.trim();
          const silent = this.isSilentChordSymbol(val);
          const validChord = /^[A-G][b#]?(m|maj|min|dim|aug|sus|[0-9]|b|#|-|\+)*$/i.test(val) && val.length > 0;
          const valid = silent || validChord;

          checkEl.textContent = silent ? 'Ø' : (valid ? '✓' : '!');
          checkEl.style.color = silent ? 'var(--color-text-dim)' : (valid ? 'var(--color-drums)' : 'var(--color-playing-border)');
          slotEl.classList.toggle('is-silent', silent);

          if (valid) {
            pat.measures[barIdx][s] = silent ? (val.toUpperCase() === 'O' ? 'O' : '') : val;
            badgeEl.textContent = this.analyzeChordModalFunction(pat.measures[barIdx][s]);
            this.updateChordDisplay(this.activeBarIndex, 0);
          }
        };

        inputEl.addEventListener('input', (e) => {
          applyChordSlotValue(e.target.value);
        });

        if (silenceBtn) {
          silenceBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const currentlySilent = this.isSilentChordSymbol(inputEl.value);
            if (currentlySilent) {
              inputEl.value = 'Am7';
              applyChordSlotValue('Am7');
            } else {
              inputEl.value = '';
              applyChordSlotValue('');
            }
          });
        }

        inputEl.addEventListener('click', async () => {
          const val = inputEl.value.trim();
          if (this.isSilentChordSymbol(val)) return;
          await this.ensureSystemInitialized();
          const notes = this.chordSymbolToMidiNotes(
            val,
            pat.voicing || 'Jazz Drop-2',
            pat.octave || 0
          );
          const now = this.engine.audioCtx.currentTime;
          notes.forEach(n => this.midiBridge.sendNoteOn('chords', n, 88, now, 0.5));
        });

        slotsRow.appendChild(slotEl);
      }

      grid.appendChild(card);
    });
  },

  analyzeChordModalFunction(symbol) {
    if (this.isSilentChordSymbol(symbol)) return 'SILENCE / N.C. (Rest)';
    const s = symbol.trim();
    if (/m7b5|dim/i.test(s)) return 'vii° / iiø Locrian';
    if (/maj7#11|maj9#11/i.test(s)) return 'IVmaj7 Lydian';
    if (/maj7|M7/i.test(s)) return 'Imaj7 Ionian';
    if (/7b9|7#9|7#5|7alt/i.test(s)) return 'V7 Altered';
    if (/m7|-7/i.test(s)) return 'ii-7 Dorian / vi-7';
    if (/7/.test(s)) return 'V7 Mixolydian';
    return 'Modal Triad / Diatonic';
  },

  /**
   * Convert a chord symbol into MIDI notes, applying both Voicing Style and Octave shift (-4 to +4):
   * - Pop Triads:   Closed root-position triad/tetrad in 1 octave
   * - Jazz Drop-2:  Drops the 2nd highest note down 1 octave (-12 semitones) for an open jazz spread
   * - Quartal Open: Stacks 4ths (Root, 4th/11th, b7/7th, 10th) in modal McCoy Tyner style
   * - Lush Pad:     2-hand wide spread (Root -12 in bass + 5th + 7th + 10th)
   */
  chordSymbolToMidiNotes(symbol, voicing = 'Jazz Drop-2', octave = 0) {
    if (this.isSilentChordSymbol(symbol)) return [];
    const match = /^([A-G][b#]?)(.*)$/.exec((symbol || 'Am7').trim());
    const octOffset = Math.max(-4, Math.min(4, parseInt(octave, 10) || 0)) * 12;
    const baseRoot = (match ? (ROOT_TO_MIDI[match[1]] || 60) : 60) + octOffset;
    const qual = match ? match[2] : 'm7';

    // 1. Build closed intervals [root=0, 3rd, 5th, 7th, (9th)]
    let intervals;
    if (/m7b5/i.test(qual))      intervals = [0, 3, 6, 10];
    else if (/dim/i.test(qual))  intervals = [0, 3, 6, 9];
    else if (/maj7|M7/.test(qual)) intervals = [0, 4, 7, 11];
    else if (/m7|-7/.test(qual)) intervals = [0, 3, 7, 10];
    else if (/7b9/.test(qual))   intervals = [0, 4, 7, 10, 13];
    else if (/7#5/.test(qual))   intervals = [0, 4, 8, 10];
    else if (/7/.test(qual))     intervals = [0, 4, 7, 10];
    else if (/m/.test(qual))     intervals = [0, 3, 7, 12];
    else                         intervals = [0, 4, 7, 12];

    // 2. Transform intervals according to Voicing Style
    let voicedIntervals;
    if (voicing === 'Pop Triads') {
      // Compact close-position triad/tetrad
      voicedIntervals = intervals;
    } else if (voicing === 'Jazz Drop-2') {
      // Drop the second-highest voice down 1 octave (-12 semitones)
      voicedIntervals = [...intervals];
      const dropIdx = Math.max(0, voicedIntervals.length - 2);
      voicedIntervals[dropIdx] -= 12;
      voicedIntervals.sort((a, b) => a - b);
    } else if (voicing === 'Quartal Open') {
      // Stacked 4ths: Root (0), 4th (5), 7th (intervals[3] || 10), 10th (intervals[1] + 12)
      const third = intervals[1] || 3;
      const seventh = intervals[3] !== undefined ? intervals[3] : 10;
      voicedIntervals = [0, 5, seventh, third + 12];
    } else if (voicing === 'Lush Pad') {
      // Wide two-handed pad: Bass Root (-12), Root (0), 5th (7), 7th, 10th (3rd + 12)
      const third = intervals[1] || 4;
      const fifth = intervals[2] || 7;
      const seventh = intervals[3] !== undefined ? intervals[3] : 11;
      voicedIntervals = [-12, 0, fifth, seventh, third + 12];
    } else {
      voicedIntervals = intervals;
    }

    // 3. Clamp to valid MIDI note range (12..115)
    return voicedIntervals.map(iv => Math.max(12, Math.min(115, baseRoot + iv)));
  },

  getChordRootMidi(symbol) {
    const match = /^([A-G][b#]?)/.exec(symbol.trim());
    return match ? (ROOT_TO_MIDI[match[1]] || 60) : 60;
  },

  highlightEditorStep(type, stepIdx) {
    if (type === 'drums') {
      document.querySelectorAll('#drum-matrix-container .drum-step-btn.is-playing-step').forEach(el => {
        el.classList.remove('is-playing-step');
      });
      document.querySelectorAll(`#drum-matrix-container .drum-step-btn[data-step-idx="${stepIdx}"]`).forEach(el => {
        el.classList.add('is-playing-step');
      });
    } else if (type === 'bass') {
      document.querySelectorAll('#bass-step-ribbon .bass-step-card.is-playing-step').forEach(el => {
        el.classList.remove('is-playing-step');
      });
      const card = document.querySelector(`#bass-step-ribbon .bass-step-card[data-step-idx="${stepIdx}"]`);
      if (card) card.classList.add('is-playing-step');
    }
  },

  highlightChordEditorSlot(barIdx, slotIdx) {
    document.querySelectorAll('#chord-measures-grid .chord-beat-slot.is-playing-step').forEach(el => {
      el.classList.remove('is-playing-step');
    });
    const el = document.querySelector(`#chord-measures-grid .chord-beat-slot[data-bar-idx="${barIdx}"][data-slot-idx="${slotIdx}"]`);
    if (el) el.classList.add('is-playing-step');
  },

  clearEditorStepHighlights() {
    document.querySelectorAll('.drum-step-btn.is-playing-step, .bass-step-card.is-playing-step, .chord-beat-slot.is-playing-step').forEach(el => {
      el.classList.remove('is-playing-step');
    });
  },

  // Solo audition helper inside Editors (uses pattern's own BPM when Sync with Master is off, and exact TimeSig + Step Resolution)
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
    const activeBpm = (pat.syncMaster === false && pat.bpm)
      ? parseFloat(pat.bpm)
      : (parseFloat(this.engine.tempo) || 120);
    const { upper: chordUpper } = this.parseTimeSig(pat.timeSig || '4/4');
    const slotsPerQuarter = type === 'chords' ? 4 : this.getSlotsPerQuarter(pat.timeSig || '4/4', pat.resolution || '1/16');
    const stepsPerChordBar = Math.max(4, chordUpper * 4);
    const totalSteps = type === 'chords'
      ? stepsPerChordBar * Math.max(1, (pat.measures && pat.measures.length) || 4)
      : Math.max(1, this.getTotalSteps(pat));
    const stepMs = (60 / activeBpm / slotsPerQuarter) * 1000;

    this.soloTimer = setInterval(() => {
      const now = this.engine.audioCtx.currentTime;
      const anyRowSolo = pat.rowSolos && pat.rowSolos.some(Boolean);
      const sIdx = step % totalSteps;

      if (type === 'drums' && pat.drumGrid) {
        this.highlightEditorStep('drums', sIdx);
        this.drumSlots.forEach((inst, rIdx) => {
          if (pat.rowMutes && pat.rowMutes[rIdx]) return;
          if (anyRowSolo && (!pat.rowSolos || !pat.rowSolos[rIdx])) return;
          const st = pat.drumGrid[rIdx] && pat.drumGrid[rIdx][sIdx];
          if (st > 0) {
            const vel = this.getDrumStepVelocity(st);
            this.midiBridge.sendNoteOn('rhythm', inst.pitch, vel, now, 0.14);
          }
        });
      } else if (type === 'bass' && pat.bassSteps) {
        this.highlightEditorStep('bass', sIdx);
        const stObj = pat.bassSteps[sIdx];
        if (stObj && !stObj.rest) {
          const pitch = pat.mode === 'strict'
            ? (PITCH_TO_MIDI[stObj.pitch] || 33)
            : (33 + (DEGREE_TO_OFFSET[stObj.degree] || 0));
          this.midiBridge.sendNoteOn('bass', pitch, stObj.accent ? 120 : 95, now, 0.2);
        }
      } else if (type === 'chords' && pat.measures && pat.measures.length > 0) {
        const barIdx = Math.floor(sIdx / stepsPerChordBar) % pat.measures.length;
        const stepInBar = sIdx % stepsPerChordBar;
        const m = pat.measures[barIdx] || ['Am7'];
        const chordsInBar = Math.max(1, m.length);
        const slotIdx = Math.min(chordsInBar - 1, Math.floor((stepInBar / stepsPerChordBar) * chordsInBar));
        const prevSlotIdx = stepInBar === 0
          ? -1
          : Math.min(chordsInBar - 1, Math.floor(((stepInBar - 1) / stepsPerChordBar) * chordsInBar));

        if (stepInBar === 0 || slotIdx !== prevSlotIdx) {
          const sym = m[slotIdx] !== undefined ? m[slotIdx] : 'Am7';
          this.highlightChordEditorSlot(barIdx, slotIdx);
          if (!this.isSilentChordSymbol(sym)) {
            const dur = Math.max(0.35, (60 / activeBpm) * (chordUpper / chordsInBar) * 0.9);
            this.chordSymbolToMidiNotes(sym, pat.voicing || 'Jazz Drop-2', pat.octave || 0).forEach(n => {
              this.midiBridge.sendNoteOn('chords', n, 90, now, dur);
            });
          }
        }
      }
      step++;
    }, stepMs);

    this.log(`[EDITOR] Playing solo preview for ${pat.id} (${pat.timeSig} @ ${pat.resolution || '1/16'}, ${totalSteps} slots) at ${activeBpm.toFixed(1)} BPM`);
  },

  stopSoloAudition() {
    if (this.soloTimer) {
      clearInterval(this.soloTimer);
      this.soloTimer = null;
    }
    this.clearEditorStepHighlights();
    ['btn-drum-solo', 'btn-bass-solo', 'btn-chord-solo'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.textContent = '▶ PLAY SOLO';
        btn.classList.remove('btn-danger');
      }
    });
  },

};

