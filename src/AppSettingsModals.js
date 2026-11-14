/**
 * src/AppSettingsModals.js - System Settings, MIDI Routing, 10-Slot Drum Mapper & Modals Mixin
 */
import {
  DEFAULT_GM_PRESETS,
  DEFAULT_DRUM_VELOCITIES,
  DEFAULT_DRUM_SLOTS,
  GM_DRUM_CATALOG
} from './defaults.js';

export const AppSettingsModalsMixin = {
  // --- 6. View 3: System Settings Controls (MIDI/SF2 Chooser + 10-Slot Drum Mapper) ---
  bindSettingsControls() {
    const sfFileInput = document.getElementById('sf-file-input');
    const btnLoadSf = document.getElementById('btn-load-sf');
    const btnClearSf = document.getElementById('btn-clear-sf');
    const sliderLimiterThresh = document.getElementById('slider-limiter-thresh');
    const valLimiterThresh = document.getElementById('val-limiter-thresh');
    const prefHighContrast = document.getElementById('pref-high-contrast');
    const btnResetDrumMap = document.getElementById('btn-reset-drum-map');

    const inpVelAccent = document.getElementById('vel-drum-accent');
    const inpVelNormal = document.getElementById('vel-drum-normal');
    const inpVelGhost = document.getElementById('vel-drum-ghost');
    const btnResetDrumVel = document.getElementById('btn-reset-drum-velocities');

    this.updateDrumVelocityLegend();

    const bindVelInput = (inpEl, key, label) => {
      if (!inpEl) return;
      inpEl.addEventListener('change', (e) => {
        const clamped = Math.max(1, Math.min(127, parseInt(e.target.value, 10) || DEFAULT_DRUM_VELOCITIES[key]));
        this.drumVelocities[key] = clamped;
        this.updateDrumVelocityLegend();
        this.saveWorkspaceToLocalStorage();
        this.log(`[SETTINGS] Drum ${label} Velocity -> ${clamped}`);
      });
    };

    bindVelInput(inpVelAccent, 'accent', 'Hi / Accent');
    bindVelInput(inpVelNormal, 'normal', 'Normal Hit');
    bindVelInput(inpVelGhost, 'ghost', 'Ghost Hit');

    const btnSettingsExport = document.getElementById('btn-settings-export-json');
    const btnSettingsImport = document.getElementById('btn-settings-import-json');
    const workspaceFileInput = document.getElementById('workspace-file-input');

    if (btnSettingsExport) {
      btnSettingsExport.addEventListener('click', () => this.exportWorkspaceJson());
    }
    if (btnSettingsImport && workspaceFileInput) {
      btnSettingsImport.addEventListener('click', () => workspaceFileInput.click());
    }

    document.querySelectorAll('.btn-test-drum-vel').forEach(btn => {
      btn.addEventListener('click', async () => {
        await this.ensureSystemInitialized();
        const key = btn.getAttribute('data-vel-type');
        const vel = this.drumVelocities[key] || 90;
        const snarePitch = (this.drumSlots[1] && this.drumSlots[1].pitch) || 38;
        this.midiBridge.sendNoteOn('rhythm', snarePitch, vel, this.engine.audioCtx.currentTime, 0.16);
        this.log(`[SETTINGS] Auditioned Drum ${key.toUpperCase()} velocity (${vel}) on Note ${snarePitch}`);
      });
    });

    if (btnResetDrumVel) {
      btnResetDrumVel.addEventListener('click', () => {
        this.drumVelocities = { ...DEFAULT_DRUM_VELOCITIES };
        this.updateDrumVelocityLegend();
        this.saveWorkspaceToLocalStorage();
        this.log(`[SETTINGS] Reset Drum Velocities to defaults (Accent=${this.drumVelocities.accent}, Normal=${this.drumVelocities.normal}, Ghost=${this.drumVelocities.ghost})`);
      });
    }

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

    if (btnResetDrumMap) {
      btnResetDrumMap.addEventListener('click', () => {
        this.drumSlots = DEFAULT_DRUM_SLOTS.map(s => ({ ...s }));
        this.renderDrumSlotMapper();
        this.saveWorkspaceToLocalStorage();
        if (this.editingPatternId) {
          const edPat = this.getPatternById(this.editingPatternId);
          if (edPat && edPat.type === 'drums') {
            this.renderDrumMatrix(edPat);
          }
        }
        this.log('[SETTINGS] Reset 10-slot Drum Editor instruments to GM defaults');
      });
    }
  },

  // Render MIDI Routing & Internal .sf2 Fallback Chooser (macOS IAC Driver Override)
  renderSystemMidiRouting(diag) {
    const container = document.getElementById('sys-content');
    if (!container) return;

    const colorMap = {
      rhythm: 'var(--color-drums)',
      bass: 'var(--color-bass)',
      chords: 'var(--color-chords)'
    };

    const allPorts = (diag && diag.allPorts && diag.allPorts.length)
      ? diag.allPorts
      : [{ id: 'internal', name: '🔊 Internal .sf2 / Web Audio Synth' }];

    let html = `
      <div class="routing-row" style="background: rgba(0, 255, 136, 0.05); padding: 0.55rem 0.65rem; border-radius: 5px; margin-bottom: 0.4rem;">
        <div>
          <strong style="color: var(--color-drums);">macOS / Virtual MIDI Override</strong>
          <div style="font-size: 0.75rem; color: var(--color-text-dim);">Force Internal .sf2 Synth even if IAC Driver or loopMIDI is active</div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label class="checkbox-pill">
            <input type="checkbox" id="toggle-force-sf2" ${diag.forceInternalSf2 ? 'checked' : ''}>
            <span>Force .sf2 Synth</span>
          </label>
          <button id="btn-rescan-midi" class="btn" style="padding: 0.28rem 0.55rem; font-size: 0.72rem;" title="Re-run hardware/virtual auto-detection">Auto-Detect</button>
        </div>
      </div>
    `;

    ['rhythm', 'bass', 'chords'].forEach(mod => {
      const d = diag[mod];
      const badgeClass = d.isFallback ? 'fallback' : 'bound';
      const badgeText = d.isFallback ? 'Internal .sf2' : 'External MIDI';

      const optionsHtml = allPorts.map(port =>
        `<option value="${port.id}" ${d.portId === port.id ? 'selected' : ''}>${port.name}</option>`
      ).join('');

      html += `
        <div class="routing-row">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <strong style="color: ${colorMap[mod]}; text-transform: uppercase; min-width: 70px;">${mod}</strong>
            <span class="badge-mono">Ch ${d.channel}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; justify-content: flex-end;">
            <select class="midi-route-select" data-mod="${mod}" style="max-width: 245px; width: 100%;">
              ${optionsHtml}
            </select>
            <span class="route-badge ${badgeClass}">${badgeText}</span>
          </div>
        </div>
      `;
    });

    html += `
      <div style="margin-top: 0.7rem; font-size: 0.76rem; color: var(--color-text-dim);">
        <strong>Detected Ports:</strong> ${allPorts.map(p => p.name).join(' • ')}
      </div>
    `;

    container.innerHTML = html;

    const forceToggle = container.querySelector('#toggle-force-sf2');
    if (forceToggle) {
      forceToggle.addEventListener('change', (e) => {
        const forced = e.target.checked;
        this.midiBridge.setForceInternal(forced);
        this.log(`[MIDI] ${forced ? 'Forced all tracks to Internal .sf2 Synth (ignoring IAC/Virtual MIDI)' : 'Restored Auto / Hardware MIDI routing'}`);
      });
    }

    const rescanBtn = container.querySelector('#btn-rescan-midi');
    if (rescanBtn) {
      rescanBtn.addEventListener('click', () => {
        this.midiBridge.rescanAutoRoute();
        this.log('[MIDI] Re-scanned MIDI ports with automatic routing rules');
      });
    }

    container.querySelectorAll('.midi-route-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const mod = sel.getAttribute('data-mod');
        const portId = e.target.value;
        const portName = sel.options[sel.selectedIndex].text;
        this.midiBridge.setRoute(mod, portId);
        this.log(`[MIDI] Routed ${mod.toUpperCase()} -> ${portName}`);
      });
    });
  },

  // Render 10-Slot Rhythm Instrument Mapper in System Settings
  renderDrumSlotMapper() {
    const grid = document.getElementById('drum-slot-mapper-grid');
    if (!grid) return;
    grid.innerHTML = '';

    this.drumSlots.forEach((slotObj, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'drum-slot-mapper-item';

      const optGroupsHtml = GM_DRUM_CATALOG.map(grp => {
        const opts = grp.items.map(item =>
          `<option value="${item.pitch}" ${slotObj.pitch === item.pitch ? 'selected' : ''}>${item.label} (Note ${item.pitch})</option>`
        ).join('');
        return `<optgroup label="${grp.group}">${opts}</optgroup>`;
      }).join('');

      itemEl.innerHTML = `
        <span class="drum-slot-tag">${idx + 1}. ${slotObj.code}</span>
        <select class="drum-slot-select" data-slot-idx="${idx}">
          ${optGroupsHtml}
        </select>
        <button class="btn drum-slot-audition-btn" data-slot-idx="${idx}" style="padding: 0.25rem 0.5rem; font-size: 0.72rem;" title="Audition this GM drum sound">▶</button>
      `;

      const selectEl = itemEl.querySelector('.drum-slot-select');
      selectEl.addEventListener('change', async (e) => {
        const newPitch = parseInt(e.target.value, 10);
        const newLabel = this.getGMDrumLabelByPitch(newPitch);
        this.drumSlots[idx].pitch = newPitch;
        this.drumSlots[idx].label = newLabel;
        this.saveWorkspaceToLocalStorage();

        if (this.editingPatternId) {
          const edPat = this.getPatternById(this.editingPatternId);
          if (edPat && edPat.type === 'drums') {
            this.renderDrumMatrix(edPat);
          }
        }

        await this.ensureSystemInitialized();
        this.midiBridge.sendNoteOn('rhythm', newPitch, 110, this.engine.audioCtx.currentTime, 0.18);
        this.log(`[DRUM MAP] Slot ${idx + 1} (${slotObj.code}) -> ${newLabel} (MIDI ${newPitch})`);
      });

      const auditionBtn = itemEl.querySelector('.drum-slot-audition-btn');
      auditionBtn.addEventListener('click', async () => {
        await this.ensureSystemInitialized();
        const pitch = this.drumSlots[idx].pitch;
        this.midiBridge.sendNoteOn('rhythm', pitch, 112, this.engine.audioCtx.currentTime, 0.18);
      });

      grid.appendChild(itemEl);
    });
  },

  // --- 7. Modals (Chords Dictionary, New Pattern, Delete Confirm, Overwrite Snapshot) ---
  bindModals() {
    const dictModal = document.getElementById('modal-chords-dict');
    const newPatModal = document.getElementById('modal-new-pattern');
    const delModal = document.getElementById('modal-delete-confirm');
    const overwriteModal = document.getElementById('modal-overwrite-snapshot');

    document.querySelectorAll('.btn-open-chords-dict').forEach(btn => {
      btn.addEventListener('click', () => {
        dictModal.classList.add('open');
        this.log('[UI] Opened Chords Dictionary Modal');
      });
    });

    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.getAttribute('data-close-modal'));
        if (target) target.classList.remove('open');
      });
    });

    const btnNewPattern = document.getElementById('btn-new-pattern');
    if (btnNewPattern) {
      btnNewPattern.addEventListener('click', () => {
        newPatModal.classList.add('open');
      });
    }

    document.querySelectorAll('.btn-create-pattern-type').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        newPatModal.classList.remove('open');
        this.createNewPattern(type);
      });
    });

    const btnConfirmDelete = document.getElementById('btn-confirm-delete-pattern');
    if (btnConfirmDelete) {
      btnConfirmDelete.addEventListener('click', () => {
        if (this.pendingDeletePatternId) {
          const id = this.pendingDeletePatternId;
          this.patterns = this.patterns.filter(p => p.id !== id);
          this.pendingDeletePatternId = null;
          delModal.classList.remove('open');
          this.saveWorkspaceToLocalStorage();
          this.renderPatternLibrary();
          this.renderPalette();
          this.renderStageTracks();
          this.log(`[PATTERNS] Deleted pattern ${id}`);
        }
      });
    }

    const btnConfirmOverwriteSnapshot = document.getElementById('btn-confirm-overwrite-snapshot');
    if (btnConfirmOverwriteSnapshot) {
      btnConfirmOverwriteSnapshot.addEventListener('click', () => {
        if (this.pendingSnapshotName) {
          const name = this.pendingSnapshotName;
          this.pendingSnapshotName = null;
          overwriteModal.classList.remove('open');
          this.commitSaveSnapshot(name, true);
        }
      });
    }
  },

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
        preset: DEFAULT_GM_PRESETS.rhythm.program,
        preview: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        rowMutes: new Array(10).fill(false),
        rowSolos: new Array(10).fill(false),
        drumGrid: this.drumSlots.map((_, r) =>
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
        preset: DEFAULT_GM_PRESETS.bass.program,
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
        octave: 0,
        preset: DEFAULT_GM_PRESETS.chords.program,
        preview: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        measures: [['Cmaj7'], ['Am7'], ['Dm7'], ['G7']]
      };
    }

    this.patterns.push(newPat);
    this.saveWorkspaceToLocalStorage();
    this.renderPatternLibrary();
    this.renderPalette();
    this.log(`[PATTERNS] Created new ${type.toUpperCase()} pattern ${newId}`);
    this.openEditorForPattern(newId);
  },

  openDeleteConfirmModal(patternId) {
    const pat = this.getPatternById(patternId);
    if (!pat) return;
    this.pendingDeletePatternId = pat.id;
    const msgEl = document.getElementById('delete-modal-message');
    if (msgEl) {
      msgEl.textContent = `Are you sure you want to delete pattern ${pat.id} (${pat.name})?`;
    }
    document.getElementById('modal-delete-confirm').classList.add('open');
  },

  getPatternById(id) {
    return this.patterns.find(p => p.id === id) || null;
  },
};

