/**
 * src/AppSettingsModals.js - System Settings, MIDI Routing, 10-Slot Drum Mapper & Modals Mixin
 */
import {
  DEFAULT_GM_PRESETS,
  DEFAULT_DRUM_VELOCITIES,
  DEFAULT_DRUM_SLOTS,
  GM_DRUM_CATALOG,
  DEFAULT_TIME_SIG_SYNC_MODE,
  TIME_SIG_SYNC_MODES,
  parseTempoRatio
} from './defaults.js';
import { TensionEngine, DEFAULT_TENSION_CONFIG } from './engine/TensionEngine.js';

const PITCH_TO_MIDI = {
  C1: 24, 'C#1': 25, Db1: 25, D1: 26, 'D#1': 27, Eb1: 27, E1: 28, F1: 29, 'F#1': 30, Gb1: 30, G1: 31, 'G#1': 32, Ab1: 32, A1: 33, 'A#1': 34, Bb1: 34, B1: 35,
  C2: 36, 'C#2': 37, Db2: 37, D2: 38, 'D#2': 39, Eb2: 39, E2: 40, F2: 41, 'F#2': 42, Gb2: 42, G2: 43, 'G#2': 44, Ab2: 44, A2: 45, 'A#2': 46, Bb2: 46, B2: 47,
  C3: 48, 'C#3': 49, Db3: 49, D3: 50, 'D#3': 51, Eb3: 51, E3: 52, F3: 53, 'F#3': 54, Gb3: 54, G3: 55
};
const DEGREE_TO_OFFSET = {
  '-5': -5, '-b6': -4, '-6': -3, '-b7': -2, '-7': -1,
  R: 0, b2: 1, '2': 2, b3: 3, '3': 4, '4': 5, b5: 6, '5': 7, b6: 8, '6': 9, b7: 10, '7': 11, R8: 12
};

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
    this.updateSyncModeUI();
    this.evaluateAndRenderSyncStatus(false);

    // Bind Time Signature & Polyrhythm Sync Mode radio cards in System Settings
    document.querySelectorAll('input[name="timesig-sync-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (TIME_SIG_SYNC_MODES[mode]) {
          this.timeSigSyncMode = mode;
          this.updateSyncModeUI();
          this.evaluateAndRenderSyncStatus(true);
          this.saveWorkspaceToLocalStorage();
          if (this.engine && this.engine.isPlaying && this.engine.audioCtx) {
            this.resetTrackClocks(this.engine.audioCtx.currentTime);
          }
          this.log(`[SETTINGS] Time Signature Sync Mode -> ${TIME_SIG_SYNC_MODES[mode].title}`);
        }
      });
    });

    // Clicking the Sync Mode pill on the Main Stage jumps to System Settings
    const stageSyncPill = document.getElementById('stage-sync-mode-pill');
    if (stageSyncPill) {
      stageSyncPill.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-target') === 'view-settings');
        });
        document.querySelectorAll('.view-container').forEach(v => {
          v.classList.toggle('active', v.id === 'view-settings');
        });
        this.log('[UI] Switched to System Settings (Time Signature & Polyrhythm Sync)');
      });
    }

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

    // Humanize Engine Global Impact & Sensitivity (System Settings)
    const humTimingSlider = document.getElementById('hum-cfg-timing-slider');
    const humTimingNum = document.getElementById('hum-cfg-timing-num');
    const humTimingLbl = document.getElementById('lbl-hum-timing-plusminus');
    const humVelSlider = document.getElementById('hum-cfg-vel-slider');
    const humVelNum = document.getElementById('hum-cfg-vel-num');
    const humVelLbl = document.getElementById('lbl-hum-vel-plusminus');
    const btnResetHumCfg = document.getElementById('btn-reset-humanize-config');

    const applyHumanizeConfigUI = (timingMs, velSpan, save = true) => {
      const clampedMs = Math.max(4, Math.min(80, parseInt(timingMs, 10) || 24));
      const clampedVel = Math.max(4, Math.min(80, parseInt(velSpan, 10) || 30));
      this.humanizeConfig = { timingWindowMs: clampedMs, velocitySpan: clampedVel };
      if (this.midiBridge && typeof this.midiBridge.setHumanizeConfig === 'function') {
        this.midiBridge.setHumanizeConfig(this.humanizeConfig);
      }
      if (humTimingSlider) humTimingSlider.value = String(clampedMs);
      if (humTimingNum) humTimingNum.value = String(clampedMs);
      if (humTimingLbl) humTimingLbl.textContent = `±${(clampedMs / 2).toFixed(1)} ms`;
      if (humVelSlider) humVelSlider.value = String(clampedVel);
      if (humVelNum) humVelNum.value = String(clampedVel);
      if (humVelLbl) humVelLbl.textContent = `±${Math.round(clampedVel / 2)} vel`;
      if (save) this.saveWorkspaceToLocalStorage();
    };

    const initCfg = this.humanizeConfig || { timingWindowMs: 24, velocitySpan: 30 };
    applyHumanizeConfigUI(initCfg.timingWindowMs, initCfg.velocitySpan, false);

    if (humTimingSlider) {
      humTimingSlider.addEventListener('input', (e) => {
        applyHumanizeConfigUI(e.target.value, this.humanizeConfig?.velocitySpan || 30, true);
      });
    }
    if (humTimingNum) {
      humTimingNum.addEventListener('input', (e) => {
        applyHumanizeConfigUI(e.target.value, this.humanizeConfig?.velocitySpan || 30, true);
      });
    }
    if (humVelSlider) {
      humVelSlider.addEventListener('input', (e) => {
        applyHumanizeConfigUI(this.humanizeConfig?.timingWindowMs || 24, e.target.value, true);
      });
    }
    if (humVelNum) {
      humVelNum.addEventListener('input', (e) => {
        applyHumanizeConfigUI(this.humanizeConfig?.timingWindowMs || 24, e.target.value, true);
      });
    }
    if (btnResetHumCfg) {
      btnResetHumCfg.addEventListener('click', () => {
        applyHumanizeConfigUI(24, 30, true);
        this.log('[SETTINGS] Reset Humanize Engine Global Impact to defaults (24 ms / ±12 ms timing, 30 / ±15 velocity)');
      });
    }

    // Predictive Tension Engine Global Sensitivity & Rules Controls
    const tensionScaleSlider = document.getElementById('tension-cfg-scale-slider');
    const tensionScaleNum = document.getElementById('tension-cfg-scale-num');
    const tensionScaleLbl = document.getElementById('lbl-tension-intensity');
    const tensionPredCheck = document.getElementById('tension-cfg-predictive');
    const tensionChordModeSel = document.getElementById('tension-cfg-chord-mode');
    const voyageCfgMethodSel = document.getElementById('voyage-cfg-method');
    const voyageCfgHomeCheck = document.getElementById('voyage-cfg-return-home');
    const btnResetTensionCfg = document.getElementById('btn-reset-tension-config');

    const applyTensionConfigUI = (cfgObj, save = true) => {
      const clampedScale = Math.max(25, Math.min(200, parseInt(cfgObj.intensityScale, 10) || 100));
      const pred = cfgObj.predictiveTransitions !== false;
      const mode = ['subs', 'extensions', 'comping'].includes(cfgObj.chordSubMode) ? cfgObj.chordSubMode : 'subs';

      this.tensionConfig = {
        intensityScale: clampedScale,
        predictiveTransitions: pred,
        chordSubMode: mode
      };

      if (tensionScaleSlider) tensionScaleSlider.value = String(clampedScale);
      if (tensionScaleNum) tensionScaleNum.value = String(clampedScale);
      if (tensionScaleLbl) tensionScaleLbl.textContent = `${clampedScale}%`;
      if (tensionPredCheck) tensionPredCheck.checked = pred;
      if (tensionChordModeSel) tensionChordModeSel.value = mode;

      if (voyageCfgMethodSel && this.voyageConfig) {
        voyageCfgMethodSel.value = this.voyageConfig.method || 'hybrid';
      }
      if (voyageCfgHomeCheck && this.voyageConfig) {
        voyageCfgHomeCheck.checked = this.voyageConfig.returnHome !== false;
      }

      this.updateChordDisplay(this.activeBarIndex || 0, Math.max(0, (this.activeBeatInBar || 1) - 1));
      if (save) this.saveWorkspaceToLocalStorage();
    };

    applyTensionConfigUI(this.tensionConfig || DEFAULT_TENSION_CONFIG, false);

    if (tensionScaleSlider) {
      tensionScaleSlider.addEventListener('input', (e) => {
        applyTensionConfigUI({ ...this.tensionConfig, intensityScale: e.target.value }, true);
      });
    }
    if (tensionScaleNum) {
      tensionScaleNum.addEventListener('input', (e) => {
        applyTensionConfigUI({ ...this.tensionConfig, intensityScale: e.target.value }, true);
      });
    }
    if (tensionPredCheck) {
      tensionPredCheck.addEventListener('change', (e) => {
        applyTensionConfigUI({ ...this.tensionConfig, predictiveTransitions: e.target.checked }, true);
      });
    }
    if (tensionChordModeSel) {
      tensionChordModeSel.addEventListener('change', (e) => {
        applyTensionConfigUI({ ...this.tensionConfig, chordSubMode: e.target.value }, true);
      });
    }
    if (voyageCfgMethodSel) {
      voyageCfgMethodSel.addEventListener('change', (e) => {
        if (!this.voyageConfig) this.voyageConfig = { orbit: 'off', method: 'hybrid', returnHome: true };
        this.voyageConfig.method = e.target.value || 'hybrid';
        this.renderStageTracks();
        this.updateChordDisplay(this.activeBarIndex || 0, Math.max(0, (this.activeBeatInBar || 1) - 1));
        this.saveWorkspaceToLocalStorage();
      });
    }
    if (voyageCfgHomeCheck) {
      voyageCfgHomeCheck.addEventListener('change', (e) => {
        if (!this.voyageConfig) this.voyageConfig = { orbit: 'off', method: 'hybrid', returnHome: true };
        this.voyageConfig.returnHome = e.target.checked;
        this.renderStageTracks();
        this.updateChordDisplay(this.activeBarIndex || 0, Math.max(0, (this.activeBeatInBar || 1) - 1));
        this.saveWorkspaceToLocalStorage();
      });
    }
    if (btnResetTensionCfg) {
      btnResetTensionCfg.addEventListener('click', () => {
        if (this.voyageConfig) {
          this.voyageConfig.method = 'hybrid';
          this.voyageConfig.returnHome = true;
        }
        applyTensionConfigUI({ ...DEFAULT_TENSION_CONFIG }, true);
        this.renderStageTracks();
        this.log('[SETTINGS] Reset Predictive Tension & Modal Voyager to defaults');
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
        if (this.chordDictModal) {
          this.chordDictModal.open();
        } else if (dictModal) {
          dictModal.classList.add('open');
        }
        this.log('[UI] Opened Chords Dictionary & Voicing Explorer Modal');
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

    // Audio Export Buttons (Main Stage Full Bounce + Drum / Bass / Chord Stem Bounce)
    const btnExportStage = document.getElementById('btn-export-stage-audio');
    if (btnExportStage) {
      btnExportStage.addEventListener('click', () => {
        this.openAudioExportModal('stage', null);
      });
    }

    ['btn-drum-export', 'btn-bass-export', 'btn-chord-export'].forEach((btnId) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', () => {
          const pat = this.getPatternById(this.editingPatternId);
          if (pat) {
            this.openAudioExportModal('stem', pat);
          }
        });
      }
    });

    const btnStartBounce = document.getElementById('btn-start-audio-bounce');
    if (btnStartBounce) {
      btnStartBounce.addEventListener('click', async () => {
        if (!this.audioExporter || this._isExportingAudio) return;
        this._isExportingAudio = true;
        btnStartBounce.disabled = true;

        const fmtEl = document.getElementById('export-audio-format');
        const barsEl = document.getElementById('export-audio-bars');
        const progWrap = document.getElementById('export-progress-wrap');
        const progStatus = document.getElementById('export-progress-status');
        const progPct = document.getElementById('export-progress-pct');
        const progBar = document.getElementById('export-progress-bar');

        const format = (fmtEl && fmtEl.value) || 'wav';
        const barsVal = parseInt((barsEl && barsEl.value) || '4', 10) || 4;

        if (progWrap) progWrap.style.display = 'flex';
        const updateProgress = (pct, msg) => {
          if (progStatus) progStatus.textContent = msg || `Rendering audio... ${pct}%`;
          if (progPct) progPct.textContent = `${pct}%`;
          if (progBar) progBar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        };

        try {
          updateProgress(2, 'Initializing OfflineAudioContext...');
          let result;
          if (this._exportTargetType === 'stem' && this._exportTargetPattern) {
            result = await this.audioExporter.bouncePatternStem(this._exportTargetPattern, {
              loops: barsVal,
              format,
              onProgress: updateProgress
            });
          } else {
            result = await this.audioExporter.bounceMainStage({
              bars: barsVal,
              format,
              onProgress: updateProgress
            });
          }
          const kb = (result.sizeBytes / 1024).toFixed(1);
          this.log(`[AUDIO EXPORT] 💾 Bounced ${result.filename} (${kb} KB)`);
        } catch (err) {
          updateProgress(0, `Export error: ${err.message}`);
          this.log(`[AUDIO EXPORT] ⚠️ Failed: ${err.message}`);
        } finally {
          this._isExportingAudio = false;
          btnStartBounce.disabled = false;
        }
      });
    }
  },

  openAudioExportModal(targetType = 'stage', pattern = null) {
    const modal = document.getElementById('modal-audio-export');
    if (!modal) return;

    this._exportTargetType = targetType;
    this._exportTargetPattern = pattern;

    const titleEl = document.getElementById('export-modal-title');
    const descEl = document.getElementById('export-modal-target-desc');
    const lenLabelEl = document.getElementById('export-length-label');
    const hwNoticeEl = document.getElementById('export-midi-hw-notice');
    const progWrap = document.getElementById('export-progress-wrap');

    if (progWrap) progWrap.style.display = 'none';

    if (targetType === 'stem' && pattern) {
      if (titleEl) titleEl.textContent = `EXPORT STEM AUDIO 💾 (${pattern.id})`;
      if (descEl) {
        descEl.textContent = `Target: Pattern Stem "${pattern.id} ${pattern.name}" (${pattern.timeSig} @ ${this.engine.tempo} BPM)`;
      }
      if (lenLabelEl) lenLabelEl.textContent = 'Loop Repetitions';
    } else {
      const snapSelect = document.getElementById('snapshot-select');
      const snapName = (snapSelect && snapSelect.value) || 'Main Stage';
      if (titleEl) titleEl.textContent = 'EXPORT MAIN STAGE AUDIO 💾';
      if (descEl) {
        descEl.textContent = `Target: Full Trio Arrangement — "${snapName}" (${this.engine.tempo} BPM)`;
      }
      if (lenLabelEl) lenLabelEl.textContent = 'Duration (Master Bars)';
    }

    if (hwNoticeEl && this.audioExporter) {
      const hasExternal = this.audioExporter.hasExternalMidiRoutes();
      hwNoticeEl.style.display = hasExternal ? 'block' : 'none';
      if (hasExternal) {
        this.log('[AUDIO EXPORT] Notice: External MIDI hardware ports cannot be captured in offline bounce. Outputting internal SoundFont audio.');
      }
    }

    modal.classList.add('open');
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
        humanize: 0,
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
        octave: 0,
        humanize: 0,
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
        humanize: 0,
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

  // --- 8. Time Signature, Polyrhythm & Tempo Ratio Sync Engine ---
  updateSyncModeUI() {
    const mode = this.timeSigSyncMode || DEFAULT_TIME_SIG_SYNC_MODE;
    const modeObj = TIME_SIG_SYNC_MODES[mode] || TIME_SIG_SYNC_MODES[DEFAULT_TIME_SIG_SYNC_MODE];

    document.querySelectorAll('.sync-mode-card').forEach(card => {
      const cardMode = card.getAttribute('data-sync-mode');
      const isSelected = cardMode === mode;
      card.classList.toggle('active', isSelected);
      const radio = card.querySelector('input[type="radio"]');
      if (radio) radio.checked = isSelected;
    });

    const settingsBadge = document.getElementById('settings-sync-mode-badge');
    if (settingsBadge) {
      settingsBadge.textContent = modeObj.shortLabel;
    }

    const stagePill = document.getElementById('stage-sync-mode-pill');
    if (stagePill) {
      stagePill.textContent = `Sync: ${modeObj.shortLabel}`;
    }
  },

  evaluateAndRenderSyncStatus(logWarnings = false) {
    const banner = document.getElementById('stage-sync-banner');
    if (!banner) return;

    const mode = this.timeSigSyncMode || DEFAULT_TIME_SIG_SYNC_MODE;
    const modeObj = TIME_SIG_SYNC_MODES[mode] || TIME_SIG_SYNC_MODES[DEFAULT_TIME_SIG_SYNC_MODE];
    const maxSlots = Math.max(
      this.tracks.drums.slots.length,
      this.tracks.bass.slots.length,
      this.tracks.chords.slots.length,
      1
    );

    const mixedSlotDetails = [];
    const customTempoPats = [];
    const ratioPats = [];
    const seqMeters = [];

    for (let i = 0; i < maxSlots; i++) {
      const dPat = this.getPatternById(this.tracks.drums.slots[i % Math.max(1, this.tracks.drums.slots.length)]?.patternId);
      const bPat = this.getPatternById(this.tracks.bass.slots[i % Math.max(1, this.tracks.bass.slots.length)]?.patternId);
      const cPat = this.getPatternById(this.tracks.chords.slots[i % Math.max(1, this.tracks.chords.slots.length)]?.patternId);

      const dTs = dPat?.timeSig || '4/4';
      const bTs = bPat?.timeSig || '4/4';
      const cTs = cPat?.timeSig || '4/4';

      if (dTs !== bTs || dTs !== cTs) {
        mixedSlotDetails.push(`Slot #${i + 1} (Drums ${dTs}, Bass ${bTs}, Chords ${cTs})`);
      } else if (i === 0 || seqMeters[seqMeters.length - 1] !== dTs) {
        seqMeters.push(dTs);
      }
    }

    ['drums', 'bass', 'chords'].forEach(tk => {
      this.tracks[tk].slots.forEach((s, idx) => {
        const p = this.getPatternById(s.patternId);
        if (!p) return;
        if (p.syncMaster === false) {
          customTempoPats.push(`${p.id} (${p.bpm || 120} BPM in ${tk.toUpperCase()} #${idx + 1})`);
        }
        if (p.tempoRatio && p.tempoRatio !== '1:1') {
          ratioPats.push(`${p.id} (Ratio ${p.tempoRatio} in ${tk.toUpperCase()} #${idx + 1})`);
        }
      });
    });

    const messages = [];
    let isWarning = false;

    if (mixedSlotDetails.length > 0) {
      isWarning = true;
      if (mode === 'bar-fit') {
        messages.push(`⚡ <strong>POLYRHYTHM BAR-FIT ACTIVE:</strong> Mixed time signatures detected in ${mixedSlotDetails.join(' • ')}. Bass &amp; Chords bars are time-stretched to fit the Master (Drum) bar duration.`);
      } else if (mode === 'independent') {
        messages.push(`⚠ <strong>POLYMETRIC PHASING ACTIVE:</strong> Mixed time signatures detected in ${mixedSlotDetails.join(' • ')}. Tracks advance on their own clocks (${modeObj.shortLabel}). Set a Tempo Ratio (e.g. <code>3:2</code> or <code>3:4</code>) or switch to <em>Auto Bar-Fit</em> in System Settings to lock barlines.`);
      } else {
        messages.push(`⚠ <strong>MASTER BAR RESET ACTIVE:</strong> Mixed time signatures detected in ${mixedSlotDetails.join(' • ')}. Bass &amp; Chords will hard-reset/truncate on every Master (Drum) bar boundary.`);
      }
    } else if (seqMeters.length > 1) {
      messages.push(`✓ <strong>SEQUENTIAL METER CHANGE:</strong> All tracks transition together across slots (${seqMeters.join(' → ')}) with locked bar boundaries.`);
    }

    if (ratioPats.length > 0) {
      messages.push(`🎵 <strong>TEMPO RATIO ACTIVE:</strong> ${[...new Set(ratioPats)].join(', ')} (locked proportionally to Master BPM).`);
    }

    if (customTempoPats.length > 0) {
      isWarning = true;
      messages.push(`⚠ <strong>UN-SYNCED PATTERN BPM:</strong> ${[...new Set(customTempoPats)].join(', ')} unlocked from Master Tempo. Moving the Master BPM slider will shift relative sync.`);
    }

    if (messages.length === 0) {
      banner.style.display = 'none';
      banner.innerHTML = '';
      return;
    }

    banner.style.display = 'block';
    banner.className = `stage-sync-banner ${isWarning ? '' : 'is-info'}`;
    banner.innerHTML = messages.join('<br>');

    if (logWarnings && isWarning) {
      this.log(`[SYNC NOTICE] ${messages[0].replace(/<[^>]+>/g, '')}`);
    }
  },

  getPatternQuarterSec(pat, masterTempo = 120) {
    const baseBpm = (pat && pat.syncMaster === false && pat.bpm)
      ? Math.max(40, Math.min(280, parseFloat(pat.bpm) || masterTempo))
      : masterTempo;
    const ratio = parseTempoRatio(pat?.tempoRatio || '1:1');
    const effBpm = Math.max(20, Math.min(600, baseBpm * ratio));
    return 60.0 / effBpm;
  },

  getPatternBarDurationSec(pat, masterTempo = 120) {
    const { upper, lower } = this.parseTimeSig(pat?.timeSig || '4/4');
    const quartersInBar = lower === 8 ? (upper * 0.5) : upper;
    return quartersInBar * this.getPatternQuarterSec(pat, masterTempo);
  },

  resetTrackClocks(startTime = 0) {
    const masterTempo = parseFloat(this.engine?.tempo) || 120;
    const dPat0 = this.getPatternById(this.tracks.drums.slots[0]?.patternId);
    const initialMasterBarSec = this.getPatternBarDurationSec(dPat0, masterTempo);

    this.masterClock = {
      barIndex: 0,
      beatInBar: 0,
      nextBeatTime: startTime,
      barStartTime: startTime,
      barDurationSecs: initialMasterBarSec
    };

    this.trackClocks = {
      drums:  { barIndex: 0, stepInBar: 0, nextStepTime: startTime },
      bass:   { barIndex: 0, stepInBar: 0, nextStepTime: startTime },
      chords: { barIndex: 0, stepInBar: 0, nextStepTime: startTime }
    };

    this.activeChordSymbolLive = 'Am7';
  },

  scheduleMultiSigBeat(pulseNumber, beatTime) {
    if (pulseNumber === 0 || !this.masterClock || !this.trackClocks) {
      this.resetTrackClocks(beatTime);
    }

    const masterTempo = parseFloat(this.engine.tempo) || 120;
    const secPerQuarter = 60.0 / masterTempo;
    const windowEnd = beatTime + secPerQuarter;
    const nowCtx = this.engine.audioCtx ? this.engine.audioCtx.currentTime : 0;
    const syncMode = this.timeSigSyncMode || DEFAULT_TIME_SIG_SYNC_MODE;

    const anySolo = Object.values(this.tracks).some(t => t.solo);
    const isTrackAudible = (trackKey) => {
      const t = this.tracks[trackKey];
      if (t.muted) return false;
      if (anySolo && !t.solo) return false;
      return true;
    };

    // 1. Advance Master (Drum) Bar & Beat Clock through [beatTime, windowEnd]
    let guardMaster = 0;
    while (this.masterClock.nextBeatTime < windowEnd - 1e-5 && guardMaster++ < 64) {
      const tBeat = this.masterClock.nextBeatTime;
      const mBarIdx = this.masterClock.barIndex;
      const dSlots = this.tracks.drums.slots;
      const dPat = dSlots.length > 0
        ? this.getPatternById(dSlots[mBarIdx % dSlots.length]?.patternId)
        : null;

      const stageTimeSig = dPat?.timeSig || '4/4';
      const { upper: stageUpper, lower: stageLower } = this.parseTimeSig(stageTimeSig);
      const dQuarterSec = this.getPatternQuarterSec(dPat, masterTempo);
      const beatUnitSec = stageLower === 8 ? (dQuarterSec * 0.5) : dQuarterSec;

      if (this.masterClock.beatInBar === 0) {
        this.masterClock.barStartTime = tBeat;
        this.masterClock.barDurationSecs = stageUpper * beatUnitSec;

        // In Mode 1 ('bar-fit') and Mode 3 ('master-reset'), lock Bass & Chords to the Master Bar start
        if (syncMode === 'bar-fit' || syncMode === 'master-reset') {
          ['bass', 'chords'].forEach(tk => {
            const tc = this.trackClocks[tk];
            tc.barIndex = mBarIdx;
            tc.stepInBar = 0;
            tc.nextStepTime = tBeat;
          });
        }
      }

      const beatNum = this.masterClock.beatInBar + 1;
      const delayMs = Math.max(0, (tBeat - nowCtx) * 1000);
      const capturedBarIdx = mBarIdx;
      const capturedUpper = stageUpper;

      setTimeout(() => {
        if (!this.engine.isPlaying) return;
        this.activeBeatInBar = beatNum;
        this.activeBarIndex = capturedBarIdx;

        const pulseLed = document.getElementById('pulse-indicator');
        if (pulseLed) {
          pulseLed.className = 'beat-pulse-led pulse-beat';
          pulseLed.textContent = `${beatNum}/${capturedUpper}`;
          setTimeout(() => {
            if (this.engine.isPlaying) pulseLed.className = 'beat-pulse-led';
          }, 95);
        }

        if (syncMode !== 'independent') {
          this.highlightPlayingSlots(capturedBarIdx);
          this.updateChordDisplay(capturedBarIdx, beatNum - 1, capturedUpper);
        }
      }, delayMs);

      this.masterClock.nextBeatTime += beatUnitSec;
      this.masterClock.beatInBar++;
      if (this.masterClock.beatInBar >= stageUpper) {
        this.masterClock.beatInBar = 0;
        this.masterClock.barIndex++;
      }
    }

    // Helper to highlight a single track's active Loop Slot when running in Independent Polymetric mode
    const scheduleTrackSlotHighlight = (trackKey, trackBarIdx, tEvent) => {
      if (syncMode !== 'independent') return;
      const slots = this.tracks[trackKey].slots;
      if (!slots.length) return;
      const activeIdx = trackBarIdx % slots.length;
      const delayMs = Math.max(0, (tEvent - nowCtx) * 1000);
      setTimeout(() => {
        if (!this.engine.isPlaying) return;
        document.querySelectorAll(`.pattern-slot-box[data-track="${trackKey}"].is-playing`).forEach(el => {
          el.classList.remove('is-playing');
        });
        const box = document.querySelector(`.pattern-slot-box[data-track="${trackKey}"][data-slot-index="${activeIdx}"]`);
        if (box) box.classList.add('is-playing');
      }, delayMs);
    };

    // 2. Schedule Chords Track Steps in [beatTime, windowEnd]
    const chordSlots = this.tracks.chords.slots;
    if (chordSlots.length > 0) {
      const cc = this.trackClocks.chords;
      let guardChords = 0;
      while (cc.nextStepTime < windowEnd - 1e-5 && guardChords++ < 64) {
        const tStep = cc.nextStepTime;
        const cBarIdx = cc.barIndex;
        const cSlot = chordSlots[cBarIdx % chordSlots.length];
        const nextCSlot = chordSlots[(cBarIdx + 1) % chordSlots.length];
        const cPat = this.getPatternById(cSlot?.patternId);
        const nextCPat = this.getPatternById(nextCSlot?.patternId);

        if (!cPat || !cPat.measures || cPat.measures.length === 0) {
          cc.nextStepTime += secPerQuarter;
          break;
        }

        const nowChordTension = cSlot?.tension || 0;
        const nextChordTension = nextCSlot?.tension || 0;
        const barInPat = cBarIdx % cPat.measures.length;
        const rawM = cPat.measures[barInPat] || ['Am7'];
        const m = TensionEngine.transformBarMeasure(rawM, nowChordTension, cBarIdx, this.tensionConfig, this.voyageConfig, cPat.measures);
        const chordsInBar = Math.max(1, m.length);
        const chordSlotIdx = Math.min(chordsInBar - 1, cc.stepInBar);

        const barDurSec = syncMode === 'bar-fit'
          ? this.masterClock.barDurationSecs
          : this.getPatternBarDurationSec(cPat, masterTempo);
        const slotDurSec = Math.max(0.05, barDurSec / chordsInBar);

        const sym = m[chordSlotIdx] !== undefined ? m[chordSlotIdx] : 'Am7';
        this.activeChordSymbolLive = sym;

        // Compute upcoming chord symbol for Bass Predictive Chromatic Approach
        if (chordSlotIdx + 1 < chordsInBar) {
          this.nextChordSymbolLive = m[chordSlotIdx + 1];
        } else if (nextCPat && nextCPat.measures && nextCPat.measures.length > 0) {
          const rawNextM = nextCPat.measures[(cBarIdx + 1) % nextCPat.measures.length] || ['Am7'];
          const nextM = TensionEngine.transformBarMeasure(rawNextM, nextChordTension, cBarIdx + 1, this.tensionConfig, this.voyageConfig, nextCPat.measures);
          this.nextChordSymbolLive = nextM[0] || 'Am7';
        } else {
          this.nextChordSymbolLive = m[0] || 'Am7';
        }

        const isSilent = this.isSilentChordSymbol(sym);

        if (cc.stepInBar === 0) {
          scheduleTrackSlotHighlight('chords', cBarIdx, tStep);
        }

        if (isTrackAudible('chords') && !isSilent) {
          const midiNotes = this.chordSymbolToMidiNotes(
            sym,
            cPat.voicing || 'Jazz Drop-2',
            cPat.octave || 0
          );
          const isLastSlotOfBar = chordSlotIdx === chordsInBar - 1;
          const strikes = TensionEngine.getChordExecutionPlan(
            slotDurSec,
            nowChordTension,
            nextChordTension,
            isLastSlotOfBar,
            this.tensionConfig
          );
          const chordHum = (this.tracks.chords.humanize || 0) > 0
            ? this.tracks.chords.humanize
            : (cPat.humanize || 0);
          strikes.forEach((st) => {
            midiNotes.forEach((note) => {
              this.midiBridge.sendNoteOn('chords', note, st.velocity, tStep + st.offsetSec, st.durationSec, chordHum);
            });
          });
        }

        const stepDelay = Math.max(0, (tStep - nowCtx) * 1000);
        const capturedBarIdx = cBarIdx;
        const capturedSlotIdx = chordSlotIdx;
        const capturedTotalSlots = chordsInBar;
        const capturedBarInPat = barInPat;
        const capturedPatId = cPat.id;

        setTimeout(() => {
          if (!this.engine.isPlaying) return;
          if (syncMode === 'independent') {
            this.updateChordDisplay(capturedBarIdx, capturedSlotIdx, capturedTotalSlots);
          }
          if (this.editingPatternId === capturedPatId) {
            this.highlightChordEditorSlot(capturedBarInPat, capturedSlotIdx);
          }
        }, stepDelay);

        cc.nextStepTime += slotDurSec;
        cc.stepInBar++;
        if (cc.stepInBar >= chordsInBar) {
          cc.stepInBar = 0;
          cc.barIndex++;
        }
      }
    }

    // 3. Schedule Drums Track Steps in [beatTime, windowEnd]
    const drumSlots = this.tracks.drums.slots;
    if (drumSlots.length > 0) {
      const dc = this.trackClocks.drums;
      let guardDrums = 0;
      while (dc.nextStepTime < windowEnd - 1e-5 && guardDrums++ < 128) {
        const tStep = dc.nextStepTime;
        const dBarIdx = dc.barIndex;
        const dSlot = drumSlots[dBarIdx % drumSlots.length];
        const nextDSlot = drumSlots[(dBarIdx + 1) % drumSlots.length];
        const dPat = this.getPatternById(dSlot?.patternId);

        if (!dPat || !dPat.drumGrid) {
          dc.nextStepTime += secPerQuarter;
          break;
        }

        const stepsPerBar = Math.max(1, this.getStepsPerBar(dPat.timeSig || '4/4', dPat.resolution || '1/16'));
        const totalSteps = Math.max(1, this.getTotalSteps(dPat));
        const barInPat = dBarIdx % Math.max(1, dPat.bars || 1);
        const stepIndex = ((barInPat * stepsPerBar) + dc.stepInBar) % totalSteps;

        const barDurSec = this.getPatternBarDurationSec(dPat, masterTempo);
        const dStepDur = Math.max(0.02, barDurSec / stepsPerBar);
        const nowDrumTension = dSlot?.tension || 0;
        const nextDrumTension = nextDSlot?.tension || 0;

        if (dc.stepInBar === 0) {
          scheduleTrackSlotHighlight('drums', dBarIdx, tStep);
        }

        if (isTrackAudible('drums')) {
          const drumHum = (this.tracks.drums.humanize || 0) > 0
            ? this.tracks.drums.humanize
            : (dPat.humanize || 0);

          const hits = TensionEngine.evaluateDrumStep({
            pat: dPat,
            drumSlots: this.drumSlots,
            stepIndex,
            stepInBar: dc.stepInBar,
            stepsPerBar,
            barIndex: dBarIdx,
            tension: nowDrumTension,
            nextTension: nextDrumTension,
            getStepVelocity: (st) => this.getDrumStepVelocity(st),
            config: this.tensionConfig
          });

          hits.forEach((h) => {
            this.midiBridge.sendNoteOn('rhythm', h.pitch, h.velocity, tStep, h.duration, drumHum);
          });
        }

        if (this.editingPatternId === dPat.id) {
          const stepDelay = Math.max(0, (tStep - nowCtx) * 1000);
          const capturedStepIdx = stepIndex;
          setTimeout(() => {
            if (this.engine.isPlaying) this.highlightEditorStep('drums', capturedStepIdx);
          }, stepDelay);
        }

        dc.nextStepTime += dStepDur;
        dc.stepInBar++;
        if (dc.stepInBar >= stepsPerBar) {
          dc.stepInBar = 0;
          dc.barIndex++;
        }
      }
    }

    // 4. Schedule Bass Track Steps in [beatTime, windowEnd]
    const bassSlots = this.tracks.bass.slots;
    if (bassSlots.length > 0) {
      const bc = this.trackClocks.bass;
      let guardBass = 0;
      while (bc.nextStepTime < windowEnd - 1e-5 && guardBass++ < 128) {
        const tStep = bc.nextStepTime;
        const bBarIdx = bc.barIndex;
        const bSlot = bassSlots[bBarIdx % bassSlots.length];
        const nextBSlot = bassSlots[(bBarIdx + 1) % bassSlots.length];
        const bPat = this.getPatternById(bSlot?.patternId);

        if (!bPat || !bPat.bassSteps) {
          bc.nextStepTime += secPerQuarter;
          break;
        }

        const stepsPerBar = Math.max(1, this.getStepsPerBar(bPat.timeSig || '4/4', bPat.resolution || '1/16'));
        const totalSteps = Math.max(1, this.getTotalSteps(bPat));
        const barInPat = bBarIdx % Math.max(1, bPat.bars || 1);
        const stepIndex = ((barInPat * stepsPerBar) + bc.stepInBar) % totalSteps;
        const stepObj = bPat.bassSteps[stepIndex];

        const barDurSec = syncMode === 'bar-fit'
          ? this.masterClock.barDurationSecs
          : this.getPatternBarDurationSec(bPat, masterTempo);
        const bStepDur = Math.max(0.02, barDurSec / stepsPerBar);

        const activeChordSym = this.activeChordSymbolLive !== undefined ? this.activeChordSymbolLive : 'Am7';
        const nextChordSym = this.nextChordSymbolLive !== undefined ? this.nextChordSymbolLive : activeChordSym;
        const isActiveChordSilent = this.isSilentChordSymbol(activeChordSym);
        const isBassSilencedByChord = isActiveChordSilent && bPat.mode !== 'strict';
        const rootMidi = isActiveChordSilent ? 45 : (this.getChordRootMidi(activeChordSym) - 24);
        const nextRootMidi = this.isSilentChordSymbol(nextChordSym) ? rootMidi : (this.getChordRootMidi(nextChordSym) - 24);
        const nowBassTension = bSlot?.tension || 0;
        const nextBassTension = nextBSlot?.tension || 0;

        if (bc.stepInBar === 0) {
          scheduleTrackSlotHighlight('bass', bBarIdx, tStep);
        }

        if (isTrackAudible('bass') && !isBassSilencedByChord) {
          const bassResult = TensionEngine.evaluateBassStep({
            pat: bPat,
            stepObj,
            stepInBar: bc.stepInBar,
            stepsPerBar,
            stepDurSec: bStepDur,
            tension: nowBassTension,
            nextTension: nextBassTension,
            rootMidi,
            nextRootMidi,
            pitchToMidi: PITCH_TO_MIDI,
            degreeToOffset: DEGREE_TO_OFFSET,
            config: this.tensionConfig
          });

          if (bassResult.play) {
            const bassHum = (this.tracks.bass.humanize || 0) > 0
              ? this.tracks.bass.humanize
              : (bPat.humanize || 0);
            this.midiBridge.sendNoteOn('bass', bassResult.midiPitch, bassResult.velocity, tStep, bassResult.durationSec, bassHum);
          }
        }

        if (this.editingPatternId === bPat.id) {
          const stepDelay = Math.max(0, (tStep - nowCtx) * 1000);
          const capturedStepIdx = stepIndex;
          setTimeout(() => {
            if (this.engine.isPlaying) this.highlightEditorStep('bass', capturedStepIdx);
          }, stepDelay);
        }

        bc.nextStepTime += bStepDur;
        bc.stepInBar++;
        if (bc.stepInBar >= stepsPerBar) {
          bc.stepInBar = 0;
          bc.barIndex++;
        }
      }
    }
  }
};

