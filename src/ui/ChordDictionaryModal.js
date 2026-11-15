/**
 * ChordDictionaryModal.js
 * Interactive Chord Dictionary & Voicing Explorer Modal for AutoBand.
 * Renders inside #modal-chords-dict and provides full CRUD, Interval Ruler (-24..+24),
 * 2-Octave Virtual Piano Monitor (C3..C5), MIDI Auditioning, and JSON Import/Export.
 */

import {
  chordDictionary,
  CHORD_CATEGORIES,
  ROOT_NAMES_SHARP,
  ROOT_SEMITONE_MAP
} from '../theory/ChordDictionary.js';

const DEGREE_LABELS = {
  '-24': '-2 Oct',
  '-12': '-1 Oct',
  '-10': '-b7',
  '-9': '-6',
  '-8': '-b6',
  '-7': '-5',
  '-5': '-4',
  '-4': '-3',
  '-3': '-b3',
  '-2': '-2',
  '-1': '-b2',
  '0': 'Root',
  '1': 'b2/b9',
  '2': '2/9',
  '3': 'b3/#9',
  '4': '3',
  '5': '4/11',
  '6': 'b5/#11',
  '7': '5',
  '8': '#5/b13',
  '9': '6/13',
  '10': 'b7',
  '11': '7',
  '12': '8 (Oct)',
  '13': 'b9',
  '14': '9',
  '15': '#9',
  '16': '10',
  '17': '11',
  '18': '#11',
  '19': '12',
  '20': 'b13',
  '21': '13',
  '22': 'b14',
  '23': '14',
  '24': '+2 Oct'
};

export class ChordDictionaryModal {
  constructor({ dictionary = chordDictionary, appUI = null } = {}) {
    this.dictionary = dictionary;
    this.appUI = appUI;
    this.modalEl = null;

    // UI State
    this.searchQuery = '';
    this.selectedCategory = 'all';
    this.selectedRoot = 'C';
    this.rulerMode = 'semitones'; // 'semitones' | 'notes'
    this.auditionOctave = 3; // C3 = MIDI 48

    // Active Chord in Inspector
    this.activeChordId = 'm9';
    this.draft = null;
    this.statusMessage = '';

    this._init();
  }

  _init() {
    this.modalEl = document.getElementById('modal-chords-dict');
    if (!this.modalEl) return;

    const initial =
      this.dictionary.getById(this.activeChordId) ||
      this.dictionary.getAll()[0];
    if (initial) {
      this._loadChordIntoDraft(initial);
    }

    this._buildModalDOM();

    this.dictionary.subscribe(() => {
      if (this.modalEl && this.modalEl.classList.contains('open')) {
        this.renderAll();
      }
    });
  }

  _loadChordIntoDraft(chord) {
    if (!chord) return;
    this.activeChordId = chord.id;
    this.draft = {
      id: chord.id,
      name: chord.name || '',
      symbol: chord.symbol ?? '',
      aliases: Array.isArray(chord.aliases) ? [...chord.aliases] : [],
      category: chord.category || 'custom',
      intervals: Array.isArray(chord.intervals) ? [...chord.intervals] : [0, 4, 7],
      bassOffset: chord.bassOffset || 0,
      description: chord.description || '',
      isCustom: Boolean(chord.isCustom || chord.category === 'custom')
    };
  }

  open(initialChordSymbol = null) {
    if (!this.modalEl) {
      this.modalEl = document.getElementById('modal-chords-dict');
      if (!this.modalEl) return;
      this._buildModalDOM();
    }

    if (initialChordSymbol && typeof initialChordSymbol === 'string') {
      const parsed = this.dictionary.parseChordSymbol(initialChordSymbol);
      if (parsed.valid && parsed.definition) {
        this.selectedRoot = parsed.root;
        this._loadChordIntoDraft(parsed.definition);
      }
    }

    this.modalEl.classList.remove('hidden');
    this.modalEl.classList.add('open');
    this.renderAll();

    // Center the Interval Ruler around 0 on open
    requestAnimationFrame(() => {
      const zeroCell = this.modalEl.querySelector('.cd-ruler-cell.is-root-zero');
      const strip = this.modalEl.querySelector('.chord-dict-ruler-strip');
      if (zeroCell && strip) {
        strip.scrollLeft =
          zeroCell.offsetLeft - strip.clientWidth / 2 + zeroCell.clientWidth / 2;
      }
    });
  }

  close() {
    if (this.modalEl) {
      this.modalEl.classList.remove('open');
    }
  }

  _buildModalDOM() {
    const categoryOptionsHtml = CHORD_CATEGORIES.map(
      (cat) => `<option value="${cat.id}">${cat.label}</option>`
    ).join('');

    const inspectorCatOptionsHtml = CHORD_CATEGORIES.filter((c) => c.id !== 'all')
      .map((cat) => `<option value="${cat.id}">${cat.label}</option>`)
      .join('');

    const rootOptionsHtml = ROOT_NAMES_SHARP.map(
      (r) => `<option value="${r}">${r}</option>`
    ).join('');

    this.modalEl.innerHTML = `
      <div class="modal-box chord-dict-modal-box">
        <header class="chord-dict-header">
          <div class="chord-dict-title-wrap">
            <h3>🎹 Chord Dictionary & Voicing Explorer</h3>
            <span class="chord-dict-count-badge" id="cd-total-count">0 Chords</span>
            <span id="cd-status-toast" style="font-size:0.75rem; color:#00ff88; font-family:monospace;"></span>
          </div>
          <button class="btn-close-modal" id="cd-btn-close" title="Close Dictionary">✕</button>
        </header>

        <div class="chord-dict-body">
          <!-- 1. Search, Filter & Action Toolbar -->
          <div class="chord-dict-toolbar">
            <div class="chord-dict-search-group">
              <input type="text" id="cd-search-input" class="chord-dict-search-input"
                     placeholder="🔍 Search symbol (m9, 7alt, 6/9), name, or notes (C-Eb-G)..." />
              <select id="cd-category-filter" class="chord-dict-cat-select">
                ${categoryOptionsHtml}
              </select>
            </div>
            <div class="chord-dict-actions-group">
              <button type="button" class="cd-btn cd-btn-primary" id="cd-btn-new">+ NEW CHORD</button>
              <button type="button" class="cd-btn" id="cd-btn-import" title="Import Chord Dictionary JSON">⬇ IMPORT</button>
              <button type="button" class="cd-btn" id="cd-btn-export" title="Export Chord Dictionary JSON">⬆ EXPORT</button>
              <button type="button" class="cd-btn cd-btn-danger" id="cd-btn-reset" title="Reset Dictionary to Factory Defaults">↺ RESET</button>
              <input type="file" id="cd-import-file-input" accept=".json,application/json" style="display:none;" />
            </div>
          </div>

          <!-- 2. Interactive Interval Reference Ruler (-24 to +24) -->
          <div class="chord-dict-ruler-panel">
            <div class="chord-dict-ruler-header">
              <div class="chord-dict-ruler-title">
                <span>📏 Interval Reference Ruler (-24 to +24 Semitones)</span>
                <span style="font-weight:400; color:#64748b; font-size:0.7rem;">Click any cell to toggle interval in active chord</span>
              </div>
              <div class="chord-dict-ruler-controls">
                <label style="font-size:0.72rem; color:#cbd5e1;">Root Key:</label>
                <select id="cd-root-select" class="chord-dict-root-select">
                  ${rootOptionsHtml}
                </select>
                <button type="button" class="cd-btn" id="cd-btn-ruler-mode">Mode: Semitones (±24)</button>
              </div>
            </div>
            <div class="chord-dict-ruler-strip" id="cd-ruler-strip"></div>
          </div>

          <!-- 3. Chord Inspector / Editor & 2-Octave Virtual Piano Monitor -->
          <div class="chord-dict-inspector-grid">
            <div class="cd-inspector-form">
              <div class="cd-inspector-row">
                <div class="cd-field">
                  <label>Chord Name</label>
                  <input type="text" id="cd-insp-name" placeholder="e.g. Minor 9th" />
                </div>
                <div class="cd-field">
                  <label>Symbol Suffix (after Root)</label>
                  <input type="text" id="cd-insp-symbol" placeholder="e.g. m9, 7#11 (blank = Major)" style="font-family:monospace; color:#00ff88; font-weight:700;" />
                </div>
                <div class="cd-field">
                  <label>Category</label>
                  <select id="cd-insp-category">
                    ${inspectorCatOptionsHtml}
                  </select>
                </div>
              </div>

              <div class="cd-inspector-row">
                <div class="cd-field" style="grid-column: span 2;">
                  <label>Description & Harmonic Role</label>
                  <input type="text" id="cd-insp-desc" placeholder="Describe character, scale source, or voicing..." />
                </div>
                <div class="cd-field">
                  <label>Bass Offset (Semitones)</label>
                  <input type="number" id="cd-insp-bass" min="-24" max="24" step="1" value="0" style="font-family:monospace;" />
                </div>
                <div class="cd-field">
                  <label>Aliases (comma-sep)</label>
                  <input type="text" id="cd-insp-aliases" placeholder="min9, -9" style="font-family:monospace;" />
                </div>
              </div>

              <div class="cd-field">
                <label style="display:flex; justify-content:space-between; align-items:center;">
                  <span>Active Semitone Slots (Click / Wheel / Edit or click Ruler & Piano)</span>
                  <button type="button" class="cd-btn cd-btn-amber" id="cd-btn-add-slot" style="padding:2px 8px; font-size:0.68rem;">+ Add Slot</button>
                </label>
                <div class="cd-slots-container" id="cd-slots-container"></div>
              </div>

              <div class="cd-inspector-footer">
                <div style="display:flex; align-items:center; gap:8px;">
                  <label style="font-size:0.72rem; color:#94a3b8; font-weight:700;">Audition Oct:</label>
                  <select id="cd-audition-octave" class="chord-dict-root-select">
                    <option value="2">Oct 2 (Deep)</option>
                    <option value="3" selected>Oct 3 (Warm)</option>
                    <option value="4">Oct 4 (Mid)</option>
                    <option value="5">Oct 5 (Bright)</option>
                  </select>
                  <button type="button" class="cd-btn cd-btn-amber" id="cd-btn-audition">▶ AUDITION CHORD</button>
                </div>
                <div style="display:flex; align-items:center; gap:6px;">
                  <button type="button" class="cd-btn" id="cd-btn-clone">❐ CLONE AS NEW</button>
                  <button type="button" class="cd-btn cd-btn-primary" id="cd-btn-save">💾 SAVE CHANGES</button>
                </div>
              </div>
            </div>

            <!-- 2-Octave Virtual Piano Monitor (C3 - C5) -->
            <div class="cd-piano-panel">
              <div>
                <div class="cd-piano-header">
                  <span>🎹 2-Octave Voicing Monitor (Click key to toggle & audition)</span>
                  <span class="cd-piano-resolved-notes" id="cd-piano-resolved-label">C - E - G</span>
                </div>
                <div class="cd-piano-keyboard" id="cd-piano-keyboard"></div>
              </div>
              <div class="cd-piano-legend">
                <span><i class="cd-legend-dot" style="background:#00ff88;"></i>Root Pitch (0)</span>
                <span><i class="cd-legend-dot" style="background:#ffaa00;"></i>Chord Intervals</span>
                <span id="cd-piano-preview-symbol" style="margin-left:auto; font-family:monospace; color:#00ff88; font-weight:700;">Cm9</span>
              </div>
            </div>
          </div>

          <!-- 4. Chord Library Table -->
          <div class="chord-dict-table-wrap">
            <table class="chord-dict-table">
              <thead>
                <tr>
                  <th style="width:14%;">Symbol (in <span id="cd-th-root">C</span>)</th>
                  <th style="width:24%;">Chord Name</th>
                  <th style="width:13%;">Category</th>
                  <th style="width:18%;">Intervals (Semitones)</th>
                  <th style="width:17%;">Notes</th>
                  <th style="width:14%;">Actions</th>
                </tr>
              </thead>
              <tbody id="cd-table-body"></tbody>
            </table>
          </div>

          <!-- 5. Collapsible Notation & Syntax Cheatsheet -->
          <details class="chord-dict-cheatsheet">
            <summary>📖 Notation & Syntax Cheatsheet (Click to expand)</summary>
            <div class="cd-cheatsheet-grid">
              <div>
                <strong style="color:#00ff88;">Roots & Accidentals:</strong><br/>
                Use <code>C, D, E, F, G, A, B</code> followed by <code>#</code> (sharp) or <code>b</code> (flat).<br/>
                Examples: <code>F#m7</code>, <code>Bb13</code>, <code>Eb6/9</code>.
              </div>
              <div>
                <strong style="color:#00ff88;">Case-Sensitive Major vs Minor:</strong><br/>
                <code>M7</code>, <code>maj7</code>, <code>Δ7</code> = Major 7th.<br/>
                <code>m7</code>, <code>min7</code>, <code>-7</code> = Minor 7th.<br/>
                <code>7</code> alone = Dominant 7th (<code>[0, 4, 7, 10]</code>).
              </div>
              <div>
                <strong style="color:#00ff88;">Slash Bass & Inversions:</strong><br/>
                Use explicit bass notes (<code>C/E</code>, <code>F/G</code>, <code>Am7/D</code>) or dictionary inversion suffixes (<code>C/3</code>, <code>G7/b7</code>, <code>Cm/b3</code>).
              </div>
              <div>
                <strong style="color:#00ff88;">Semitone Math Reference:</strong><br/>
                <code>0</code>=Root, <code>3</code>=b3, <code>4</code>=3, <code>7</code>=5, <code>10</code>=b7, <code>11</code>=M7, <code>14</code>=9, <code>17</code>=11, <code>18</code>=#11, <code>21</code>=13.
              </div>
            </div>
          </details>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    if (!this.modalEl) return;

    // Close Modal
    const closeBtn = this.modalEl.querySelector('#cd-btn-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) this.close();
    });

    // Search & Category filter
    const searchInput = this.modalEl.querySelector('#cd-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value || '';
        this.renderTable();
      });
    }

    const catSelect = this.modalEl.querySelector('#cd-category-filter');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.selectedCategory = e.target.value;
        this.renderTable();
      });
    }

    // Root selector & Ruler mode
    const rootSelect = this.modalEl.querySelector('#cd-root-select');
    if (rootSelect) {
      rootSelect.addEventListener('change', (e) => {
        this.selectedRoot = e.target.value;
        this.renderAll();
      });
    }

    const rulerModeBtn = this.modalEl.querySelector('#cd-btn-ruler-mode');
    if (rulerModeBtn) {
      rulerModeBtn.addEventListener('click', () => {
        this.rulerMode = this.rulerMode === 'semitones' ? 'notes' : 'semitones';
        rulerModeBtn.textContent =
          this.rulerMode === 'semitones' ? 'Mode: Semitones (±24)' : 'Mode: Note Names';
        this.renderRuler();
      });
    }

    // Inspector inputs
    const nameInput = this.modalEl.querySelector('#cd-insp-name');
    const symInput = this.modalEl.querySelector('#cd-insp-symbol');
    const catInput = this.modalEl.querySelector('#cd-insp-category');
    const descInput = this.modalEl.querySelector('#cd-insp-desc');
    const bassInput = this.modalEl.querySelector('#cd-insp-bass');
    const aliasesInput = this.modalEl.querySelector('#cd-insp-aliases');

    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        if (this.draft) this.draft.name = e.target.value;
      });
    }
    if (symInput) {
      symInput.addEventListener('input', (e) => {
        if (this.draft) {
          this.draft.symbol = e.target.value;
          this.renderPiano();
        }
      });
    }
    if (catInput) {
      catInput.addEventListener('change', (e) => {
        if (this.draft) this.draft.category = e.target.value;
      });
    }
    if (descInput) {
      descInput.addEventListener('input', (e) => {
        if (this.draft) this.draft.description = e.target.value;
      });
    }
    if (bassInput) {
      bassInput.addEventListener('input', (e) => {
        if (this.draft) {
          this.draft.bassOffset = Math.max(-24, Math.min(24, parseInt(e.target.value, 10) || 0));
          this.renderRuler();
          this.renderPiano();
        }
      });
    }
    if (aliasesInput) {
      aliasesInput.addEventListener('input', (e) => {
        if (this.draft) {
          this.draft.aliases = e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      });
    }

    // Add Slot button
    const addSlotBtn = this.modalEl.querySelector('#cd-btn-add-slot');
    if (addSlotBtn) {
      addSlotBtn.addEventListener('click', () => {
        if (!this.draft) return;
        const maxIv = this.draft.intervals.length > 0 ? Math.max(...this.draft.intervals) : 0;
        const nextIv = Math.min(24, maxIv + 3);
        if (!this.draft.intervals.includes(nextIv)) {
          this.draft.intervals.push(nextIv);
          this.draft.intervals.sort((a, b) => a - b);
          this.renderRuler();
          this.renderInspectorSlots();
          this.renderPiano();
        }
      });
    }

    // Audition Octave & Audition Button
    const octSelect = this.modalEl.querySelector('#cd-audition-octave');
    if (octSelect) {
      octSelect.addEventListener('change', (e) => {
        this.auditionOctave = parseInt(e.target.value, 10) || 3;
      });
    }

    const auditionBtn = this.modalEl.querySelector('#cd-btn-audition');
    if (auditionBtn) {
      auditionBtn.addEventListener('click', () => {
        this.auditionDraftChord();
      });
    }

    // Clone & Save
    const cloneBtn = this.modalEl.querySelector('#cd-btn-clone');
    if (cloneBtn) {
      cloneBtn.addEventListener('click', () => {
        if (!this.draft) return;
        const cloned = this.dictionary.cloneChord(this.draft.id);
        if (cloned) {
          this._loadChordIntoDraft(cloned);
          this.renderAll();
          this._flashToast(`Cloned as "${cloned.name}" (${this.selectedRoot}${cloned.symbol})`);
        }
      });
    }

    const saveBtn = this.modalEl.querySelector('#cd-btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this._saveDraftChord();
      });
    }

    // Toolbar: + NEW CHORD, IMPORT, EXPORT, RESET
    const newBtn = this.modalEl.querySelector('#cd-btn-new');
    if (newBtn) {
      newBtn.addEventListener('click', () => {
        const created = this.dictionary.addChord({
          name: 'New Custom Chord',
          symbol: `cust${Math.floor(Math.random() * 90 + 10)}`,
          category: 'custom',
          intervals: [0, 4, 7, 11, 14],
          bassOffset: 0,
          description: 'User-defined custom chord voicing'
        });
        this._loadChordIntoDraft(created);
        this.renderAll();
        this._flashToast(`Created "${created.name}"`);
      });
    }

    const exportBtn = this.modalEl.querySelector('#cd-btn-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json = this.dictionary.exportJSON();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'autoband-chord-dictionary.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this._flashToast('Exported autoband-chord-dictionary.json');
      });
    }

    const importBtn = this.modalEl.querySelector('#cd-btn-import');
    const fileInput = this.modalEl.querySelector('#cd-import-file-input');
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            this.dictionary.importJSON(ev.target.result);
            const first = this.dictionary.getAll()[0];
            if (first) this._loadChordIntoDraft(first);
            this.renderAll();
            this._flashToast(`Imported ${this.dictionary.getAll().length} chords!`);
          } catch (err) {
            alert('Import failed: ' + err.message);
          }
        };
        reader.readAsText(file);
        fileInput.value = '';
      });
    }

    const resetBtn = this.modalEl.querySelector('#cd-btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('Reset Chord Dictionary to factory default 60+ chords? Custom changes will be replaced.')) {
          this.dictionary.resetToDefaults();
          const first = this.dictionary.getById('m9') || this.dictionary.getAll()[0];
          if (first) this._loadChordIntoDraft(first);
          this.renderAll();
          this._flashToast('Dictionary reset to factory defaults');
        }
      });
    }
  }

  _flashToast(msg) {
    const el = this.modalEl && this.modalEl.querySelector('#cd-status-toast');
    if (!el) return;
    el.textContent = `✓ ${msg}`;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.textContent = '';
    }, 3200);
  }

  _saveDraftChord() {
    if (!this.draft) return;
    const existing = this.dictionary.getById(this.draft.id);
    if (existing) {
      const updated = this.dictionary.updateChord(this.draft.id, this.draft);
      if (updated) {
        this._loadChordIntoDraft(updated);
        this.renderAll();
        this._flashToast(`Saved "${updated.name}" (${this.selectedRoot}${updated.symbol})`);
      }
    } else {
      const added = this.dictionary.addChord(this.draft);
      this._loadChordIntoDraft(added);
      this.renderAll();
      this._flashToast(`Added "${added.name}"`);
    }
  }

  auditionDraftChord(customIntervals = null, customBassOffset = null) {
    const intervals = customIntervals || (this.draft ? this.draft.intervals : [0, 4, 7]);
    const bassOffset =
      customBassOffset !== null
        ? customBassOffset
        : this.draft
        ? this.draft.bassOffset || 0
        : 0;

    const rootSemi = ROOT_SEMITONE_MAP[this.selectedRoot] || 0;
    const baseMidi = (this.auditionOctave + 1) * 12 + rootSemi;

    const midiNotes = intervals.map((iv) => Math.max(24, Math.min(96, baseMidi + iv)));
    if (bassOffset !== 0) {
      const bassMidi = Math.max(24, Math.min(96, baseMidi - 12 + bassOffset));
      if (!midiNotes.includes(bassMidi)) {
        midiNotes.unshift(bassMidi);
      }
    }

    this._playMidiChord(midiNotes, 650);
  }

  async _playMidiChord(midiNotes, durationMs = 600) {
    if (this.appUI && typeof this.appUI.ensureSystemInitialized === 'function') {
      await this.appUI.ensureSystemInitialized();
    }
    const bridge = this.appUI && this.appUI.midiBridge;
    if (!bridge) return;

    const now =
      this.appUI && this.appUI.engine && this.appUI.engine.audioCtx
        ? this.appUI.engine.audioCtx.currentTime
        : 0;
    const durSec = Math.max(0.15, durationMs / 1000);

    midiNotes.forEach((note, idx) => {
      const vel = idx === 0 ? 96 : 84;
      bridge.sendNoteOn('chords', note, vel, now, durSec);
    });
  }

  _toggleIntervalInDraft(semitone) {
    if (!this.draft) return;
    const idx = this.draft.intervals.indexOf(semitone);
    if (idx >= 0) {
      if (this.draft.intervals.length > 1) {
        this.draft.intervals.splice(idx, 1);
      }
    } else {
      this.draft.intervals.push(semitone);
      this.draft.intervals.sort((a, b) => a - b);
    }

    const rootSemi = ROOT_SEMITONE_MAP[this.selectedRoot] || 0;
    const baseMidi = (this.auditionOctave + 1) * 12 + rootSemi;
    this._playMidiChord([Math.max(24, Math.min(96, baseMidi + semitone))], 350);

    this.renderRuler();
    this.renderInspectorSlots();
    this.renderPiano();
  }

  renderAll() {
    if (!this.modalEl) return;
    const countBadge = this.modalEl.querySelector('#cd-total-count');
    if (countBadge) {
      countBadge.textContent = `${this.dictionary.getAll().length} Chords`;
    }
    const thRoot = this.modalEl.querySelector('#cd-th-root');
    if (thRoot) thRoot.textContent = this.selectedRoot;

    this.renderRuler();
    this.renderInspectorForm();
    this.renderInspectorSlots();
    this.renderPiano();
    this.renderTable();
  }

  renderRuler() {
    const strip = this.modalEl && this.modalEl.querySelector('#cd-ruler-strip');
    if (!strip || !this.draft) return;

    const rootSemi = ROOT_SEMITONE_MAP[this.selectedRoot] || 0;
    const baseMidi = (this.auditionOctave + 1) * 12 + rootSemi;
    const activeSet = new Set(this.draft.intervals);

    let html = '';
    for (let s = -24; s <= 24; s++) {
      const isZero = s === 0;
      const isOctave = s % 12 === 0;
      const isActive = activeSet.has(s);
      const isBass = this.draft.bassOffset !== 0 && s === this.draft.bassOffset - 12;

      const noteName = this.dictionary.midiToNoteName(baseMidi + s, false, true);
      const signStr = s > 0 ? `+${s}` : `${s}`;
      const degLabel = DEGREE_LABELS[String(s)] || noteName;

      const topText = this.rulerMode === 'semitones' ? signStr : noteName;
      const subText = this.rulerMode === 'semitones' ? degLabel : signStr;

      const classes = [
        'cd-ruler-cell',
        isZero ? 'is-root-zero' : '',
        isOctave ? 'is-octave-mark' : '',
        isActive ? 'is-active-interval' : '',
        isBass ? 'is-bass-offset' : ''
      ]
        .filter(Boolean)
        .join(' ');

      html += `
        <div class="${classes}" data-semitone="${s}" title="Semitone ${signStr} (${noteName}) - Click to toggle">
          <span class="cd-ruler-top">${topText}</span>
          <span class="cd-ruler-sub">${subText}</span>
        </div>
      `;
    }

    strip.innerHTML = html;

    strip.querySelectorAll('.cd-ruler-cell').forEach((cell) => {
      cell.addEventListener('click', () => {
        const semi = parseInt(cell.dataset.semitone, 10);
        this._toggleIntervalInDraft(semi);
      });
    });
  }

  renderInspectorForm() {
    if (!this.modalEl || !this.draft) return;
    const nameInput = this.modalEl.querySelector('#cd-insp-name');
    const symInput = this.modalEl.querySelector('#cd-insp-symbol');
    const catInput = this.modalEl.querySelector('#cd-insp-category');
    const descInput = this.modalEl.querySelector('#cd-insp-desc');
    const bassInput = this.modalEl.querySelector('#cd-insp-bass');
    const aliasesInput = this.modalEl.querySelector('#cd-insp-aliases');

    if (nameInput) nameInput.value = this.draft.name;
    if (symInput) symInput.value = this.draft.symbol;
    if (catInput) catInput.value = this.draft.category || 'custom';
    if (descInput) descInput.value = this.draft.description || '';
    if (bassInput) bassInput.value = this.draft.bassOffset || 0;
    if (aliasesInput) aliasesInput.value = (this.draft.aliases || []).join(', ');
  }

  renderInspectorSlots() {
    const container = this.modalEl && this.modalEl.querySelector('#cd-slots-container');
    if (!container || !this.draft) return;

    const rootSemi = ROOT_SEMITONE_MAP[this.selectedRoot] || 0;
    const baseMidi = (this.auditionOctave + 1) * 12 + rootSemi;

    container.innerHTML = this.draft.intervals
      .map((iv, idx) => {
        const noteName = this.dictionary.midiToNoteName(baseMidi + iv, false, false);
        const isRoot = iv === 0;
        return `
          <div class="cd-slot-pill ${isRoot ? 'is-root-pill' : ''}" data-slot-idx="${idx}">
            <input type="number" class="cd-slot-input" min="-24" max="24" step="1"
                   value="${iv}" data-slot-idx="${idx}" title="Scroll or type semitone (-24..+24)" />
            <span class="cd-slot-note-tag">(${noteName})</span>
            ${
              this.draft.intervals.length > 1
                ? `<button type="button" class="cd-slot-remove" data-remove-idx="${idx}" title="Remove slot">×</button>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    container.querySelectorAll('.cd-slot-input').forEach((inp) => {
      inp.addEventListener('change', (e) => {
        const idx = parseInt(inp.dataset.slotIdx, 10);
        const val = Math.max(-24, Math.min(24, parseInt(e.target.value, 10) || 0));
        this.draft.intervals[idx] = val;
        this.draft.intervals = Array.from(new Set(this.draft.intervals)).sort((a, b) => a - b);
        this.renderRuler();
        this.renderInspectorSlots();
        this.renderPiano();
      });
    });

    container.querySelectorAll('.cd-slot-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.removeIdx, 10);
        if (this.draft.intervals.length > 1) {
          this.draft.intervals.splice(idx, 1);
          this.renderRuler();
          this.renderInspectorSlots();
          this.renderPiano();
        }
      });
    });
  }

  /**
   * Renders a 2-Octave Interactive Virtual Piano (25 keys from Root..Root+24)
   */
  renderPiano() {
    const kb = this.modalEl && this.modalEl.querySelector('#cd-piano-keyboard');
    if (!kb || !this.draft) return;

    const rootSemi = ROOT_SEMITONE_MAP[this.selectedRoot] || 0;
    const startMidi = 48; // C3 = 48 to C5 = 72 (25 keys)
    const rootMidi = 48 + rootSemi;

    // Resolve chord MIDI notes inside the 2-octave window
    const activeMidiSet = new Set();
    this.draft.intervals.forEach((iv) => {
      let m = rootMidi + iv;
      while (m > 72) m -= 12;
      while (m < 48) m += 12;
      activeMidiSet.add(m);
    });

    const whiteSemitones = new Set([0, 2, 4, 5, 7, 9, 11]);
    const whiteKeys = [];
    const blackKeys = [];

    for (let m = startMidi; m <= startMidi + 24; m++) {
      const pc = m % 12;
      const noteLabel = this.dictionary.midiToNoteName(m, false, true);
      const isRoot = pc === rootSemi && m === rootMidi;
      const isChordTone = activeMidiSet.has(m);
      const relSemitone = m - rootMidi;

      if (whiteSemitones.has(pc)) {
        whiteKeys.push({ m, noteLabel, isRoot, isChordTone, relSemitone });
      } else {
        blackKeys.push({
          m,
          noteLabel,
          isRoot,
          isChordTone,
          relSemitone,
          whiteIndexBefore: whiteKeys.length - 1
        });
      }
    }

    const totalWhites = whiteKeys.length; // 15 white keys across C3..C5
    let html = whiteKeys
      .map(
        (wk) => `
        <div class="cd-piano-key-white ${wk.isChordTone ? 'is-chord-tone' : ''} ${
          wk.isRoot ? 'is-root-tone' : ''
        }" data-semitone="${wk.relSemitone}" title="${wk.noteLabel} (Interval ${
          wk.relSemitone >= 0 ? '+' + wk.relSemitone : wk.relSemitone
        })">
          <span class="cd-key-label">${wk.noteLabel}</span>
        </div>
      `
      )
      .join('');

    html += blackKeys
      .map((bk) => {
        const leftPct = ((bk.whiteIndexBefore + 1) / totalWhites) * 100;
        return `
          <div class="cd-piano-key-black ${bk.isChordTone ? 'is-chord-tone' : ''} ${
            bk.isRoot ? 'is-root-tone' : ''
          }" style="left:${leftPct.toFixed(2)}%;" data-semitone="${bk.relSemitone}" title="${
            bk.noteLabel
          } (Interval ${bk.relSemitone >= 0 ? '+' + bk.relSemitone : bk.relSemitone})">
            <span class="cd-key-label">${bk.noteLabel.replace(/\d+$/, '')}</span>
          </div>
        `;
      })
      .join('');

    kb.innerHTML = html;

    kb.querySelectorAll('[data-semitone]').forEach((keyEl) => {
      keyEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const semi = parseInt(keyEl.dataset.semitone, 10);
        this._toggleIntervalInDraft(semi);
      });
    });

    // Update resolved notes & preview symbol
    const resolvedNotes = this.draft.intervals.map((iv) =>
      this.dictionary.midiToNoteName(rootMidi + iv, false, false)
    );
    const notesLabel = this.modalEl.querySelector('#cd-piano-resolved-label');
    if (notesLabel) {
      notesLabel.textContent = resolvedNotes.join(' - ');
    }
    const symPreview = this.modalEl.querySelector('#cd-piano-preview-symbol');
    if (symPreview) {
      symPreview.textContent = `${this.selectedRoot}${this.draft.symbol}`;
    }
  }

  renderTable() {
    const tbody = this.modalEl && this.modalEl.querySelector('#cd-table-body');
    if (!tbody) return;

    const rootSemi = ROOT_SEMITONE_MAP[this.selectedRoot] || 0;
    const baseMidi = 60 + rootSemi;
    const query = this.searchQuery.trim().toLowerCase();

    const filtered = this.dictionary.getAll().filter((chord) => {
      if (this.selectedCategory !== 'all' && chord.category !== this.selectedCategory) {
        return false;
      }
      if (!query) return true;

      const fullSymbol = `${this.selectedRoot}${chord.symbol}`.toLowerCase();
      const noteNames = chord.intervals
        .map((iv) => this.dictionary.midiToNoteName(baseMidi + iv, false, false))
        .join('-')
        .toLowerCase();

      return (
        chord.symbol.toLowerCase().includes(query) ||
        fullSymbol.includes(query) ||
        chord.name.toLowerCase().includes(query) ||
        (chord.description && chord.description.toLowerCase().includes(query)) ||
        noteNames.includes(query) ||
        (Array.isArray(chord.aliases) &&
          chord.aliases.some((a) => a.toLowerCase().includes(query)))
      );
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align:center; padding:18px; color:#64748b;">
            No chords match "${this.searchQuery}". Click <strong>+ NEW CHORD</strong> to create it!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered
      .map((chord) => {
        const isSelected = this.draft && this.draft.id === chord.id;
        const displaySymbol = `${this.selectedRoot}${chord.symbol}`;
        const noteNames = chord.intervals
          .map((iv) => this.dictionary.midiToNoteName(baseMidi + iv, false, false))
          .join(' - ');
        const ivText = `[${chord.intervals.join(', ')}]${
          chord.bassOffset ? ` (Bass ${chord.bassOffset > 0 ? '+' : ''}${chord.bassOffset})` : ''
        }`;

        return `
          <tr class="${isSelected ? 'is-selected-row' : ''}" data-chord-id="${chord.id}">
            <td class="cd-col-symbol">${displaySymbol}</td>
            <td>
              <div style="font-weight:600;">${chord.name}</div>
              <div style="font-size:0.68rem; color:#64748b;">${chord.description || ''}</div>
            </td>
            <td><span class="cd-cat-pill ${chord.category === 'custom' ? 'cat-custom' : ''}">${chord.category}</span></td>
            <td style="font-family:monospace; color:#94a3b8;">${ivText}</td>
            <td style="font-family:monospace; color:#ffaa00; font-weight:600;">${noteNames}</td>
            <td>
              <div class="cd-row-actions">
                <button type="button" class="cd-icon-btn" data-act="play" data-id="${chord.id}" title="Audition Chord">▶</button>
                <button type="button" class="cd-icon-btn" data-act="edit" data-id="${chord.id}" title="Inspect / Edit">✏</button>
                <button type="button" class="cd-icon-btn" data-act="clone" data-id="${chord.id}" title="Clone as Custom">❐</button>
                <button type="button" class="cd-icon-btn cd-del-btn" data-act="delete" data-id="${chord.id}" title="Delete Chord">🗑</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.querySelectorAll('tr[data-chord-id]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const chord = this.dictionary.getById(row.dataset.chordId);
        if (chord) {
          this._loadChordIntoDraft(chord);
          this.renderAll();
          this.auditionDraftChord();
        }
      });
    });

    tbody.querySelectorAll('button[data-act]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = btn.dataset.act;
        const id = btn.dataset.id;
        const chord = this.dictionary.getById(id);
        if (!chord) return;

        if (act === 'play') {
          this._loadChordIntoDraft(chord);
          this.renderAll();
          this.auditionDraftChord();
        } else if (act === 'edit') {
          this._loadChordIntoDraft(chord);
          this.renderAll();
        } else if (act === 'clone') {
          const cloned = this.dictionary.cloneChord(id);
          if (cloned) {
            this._loadChordIntoDraft(cloned);
            this.renderAll();
            this._flashToast(`Cloned "${cloned.name}"`);
          }
        } else if (act === 'delete') {
          if (confirm(`Delete chord "${chord.name}" (${this.selectedRoot}${chord.symbol}) from dictionary?`)) {
            this.dictionary.deleteChord(id);
            const fallback = this.dictionary.getAll()[0];
            if (fallback) this._loadChordIntoDraft(fallback);
            this.renderAll();
            this._flashToast(`Deleted "${chord.name}"`);
          }
        }
      });
    });
  }
}

export default ChordDictionaryModal;
