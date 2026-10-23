/**
 * SoundFontManager.js - AutoBand Offline SoundFont Engine
 * Handles IndexedDB binary caching, spessasynth_lib / native SF2 instantiation,
 * preset routing, and master brickwall limiting.
 */

/**
 * Built-in zero-dependency SoundFont2 (RIFF sfbk) Parser & Web Audio Synthesizer.
 * Ensures 100% offline operation when external CDN libraries are unavailable.
 */
class InternalSF2Synth {
  constructor(audioCtx, arrayBuffer, submixNodes = {}) {
    this.audioCtx = audioCtx;
    this.submixNodes = submixNodes;
    this.channelPrograms = new Map([
      [10, { bank: 128, program: 0 }],
      [9,  { bank: 128, program: 0 }],
      [2,  { bank: 0,   program: 33 }],
      [1,  { bank: 0,   program: 33 }],
      [3,  { bank: 0,   program: 0 }],
      [2,  { bank: 0,   program: 33 }]
    ]);
    // Key: `${channel}:${pitch}` -> Array of active voice controllers
    this.activeVoices = new Map();
    // Cached AudioBuffers for individual sample slices
    this.sampleBufferCache = new Map();

    this.presets = new Map(); // Key: `${bank}:${program}` -> preset object
    this.instruments = [];
    this.samples = [];
    this.pcmInt16 = null;

    this.parseSF2(arrayBuffer);
  }

  readFourCC(view, offset) {
    return String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
  }

  readASCII(view, offset, length) {
    let str = '';
    for (let i = 0; i < length; i++) {
      const code = view.getUint8(offset + i);
      if (code === 0) break;
      str += String.fromCharCode(code);
    }
    return str.trim();
  }

  parseSF2(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    if (view.byteLength < 12) {
      throw new Error('File is too small to be a valid SoundFont (.sf2).');
    }

    const riff = this.readFourCC(view, 0);
    const sfbk = this.readFourCC(view, 8);
    if (riff !== 'RIFF' || sfbk !== 'sfbk') {
      throw new Error('Invalid SoundFont header (expected RIFF sfbk).');
    }

    let offset = 12;
    const chunks = {};

    while (offset + 8 <= view.byteLength) {
      const id = this.readFourCC(view, offset);
      const size = view.getUint32(offset + 4, true);
      const dataStart = offset + 8;

      if (id === 'LIST' && dataStart + 4 <= view.byteLength) {
        const listType = this.readFourCC(view, dataStart);
        let subOffset = dataStart + 4;
        const listEnd = Math.min(view.byteLength, dataStart + size);

        while (subOffset + 8 <= listEnd) {
          const subId = this.readFourCC(view, subOffset);
          const subSize = view.getUint32(subOffset + 4, true);
          const subDataStart = subOffset + 8;

          if (listType === 'sdta' && subId === 'smpl') {
            this.pcmInt16 = new Int16Array(arrayBuffer, subDataStart, Math.floor(subSize / 2));
          } else if (listType === 'pdta') {
            chunks[subId] = { start: subDataStart, size: subSize };
          }
          subOffset = subDataStart + subSize + (subSize % 2);
        }
      }
      offset = dataStart + size + (size % 2);
    }

    if (!this.pcmInt16 || !chunks.phdr || !chunks.shdr) {
      throw new Error('Incomplete SoundFont structure (missing sdta/pdta chunks).');
    }

    // 1. Parse shdr (46 bytes per record)
    const shdrCount = Math.floor(chunks.shdr.size / 46);
    for (let i = 0; i < shdrCount; i++) {
      const p = chunks.shdr.start + i * 46;
      this.samples.push({
        name: this.readASCII(view, p, 20),
        start: view.getUint32(p + 20, true),
        end: view.getUint32(p + 24, true),
        startLoop: view.getUint32(p + 28, true),
        endLoop: view.getUint32(p + 32, true),
        sampleRate: view.getUint32(p + 36, true),
        originalPitch: view.getUint8(p + 40),
        pitchCorrection: view.getInt8(p + 41),
        sampleType: view.getUint16(p + 44, true)
      });
    }

    // 2. Parse igen (4 bytes per record)
    const igen = [];
    if (chunks.igen) {
      const count = Math.floor(chunks.igen.size / 4);
      for (let i = 0; i < count; i++) {
        const p = chunks.igen.start + i * 4;
        igen.push({
          oper: view.getUint16(p, true),
          uAmount: view.getUint16(p + 2, true),
          sAmount: view.getInt16(p + 2, true),
          lo: view.getUint8(p + 2),
          hi: view.getUint8(p + 3)
        });
      }
    }

    // 3. Parse ibag (4 bytes per record)
    const ibag = [];
    if (chunks.ibag) {
      const count = Math.floor(chunks.ibag.size / 4);
      for (let i = 0; i < count; i++) {
        const p = chunks.ibag.start + i * 4;
        ibag.push({
          genNdx: view.getUint16(p, true),
          modNdx: view.getUint16(p + 2, true)
        });
      }
    }

    // 4. Parse inst (22 bytes per record)
    if (chunks.inst) {
      const instCount = Math.floor(chunks.inst.size / 22);
      const rawInst = [];
      for (let i = 0; i < instCount; i++) {
        const p = chunks.inst.start + i * 22;
        rawInst.push({
          name: this.readASCII(view, p, 20),
          bagNdx: view.getUint16(p + 20, true)
        });
      }

      for (let i = 0; i < instCount - 1; i++) {
        const bagStart = rawInst[i].bagNdx;
        const bagEnd = rawInst[i + 1].bagNdx;
        const zones = [];
        let globalGen = {};

        for (let b = bagStart; b < bagEnd; b++) {
          const gStart = ibag[b].genNdx;
          const gEnd = b + 1 < ibag.length ? ibag[b + 1].genNdx : igen.length;
          const genMap = {};
          for (let g = gStart; g < gEnd; g++) {
            genMap[igen[g].oper] = igen[g];
          }
          // Global zone if first bag has no sampleID (oper 53)
          if (b === bagStart && genMap[53] === undefined) {
            globalGen = genMap;
          } else if (genMap[53] !== undefined) {
            zones.push({ ...globalGen, ...genMap });
          }
        }
        this.instruments.push({ name: rawInst[i].name, zones });
      }
    }

    // 5. Parse pgen (4 bytes per record) & pbag (4 bytes per record)
    const pgen = [];
    if (chunks.pgen) {
      const count = Math.floor(chunks.pgen.size / 4);
      for (let i = 0; i < count; i++) {
        const p = chunks.pgen.start + i * 4;
        pgen.push({
          oper: view.getUint16(p, true),
          uAmount: view.getUint16(p + 2, true),
          sAmount: view.getInt16(p + 2, true),
          lo: view.getUint8(p + 2),
          hi: view.getUint8(p + 3)
        });
      }
    }

    const pbag = [];
    if (chunks.pbag) {
      const count = Math.floor(chunks.pbag.size / 4);
      for (let i = 0; i < count; i++) {
        const p = chunks.pbag.start + i * 4;
        pbag.push({
          genNdx: view.getUint16(p, true),
          modNdx: view.getUint16(p + 2, true)
        });
      }
    }

    // 6. Parse phdr (38 bytes per record)
    const phdrCount = Math.floor(chunks.phdr.size / 38);
    const rawPhdr = [];
    for (let i = 0; i < phdrCount; i++) {
      const p = chunks.phdr.start + i * 38;
      rawPhdr.push({
        name: this.readASCII(view, p, 20),
        program: view.getUint16(p + 20, true),
        bank: view.getUint16(p + 22, true),
        bagNdx: view.getUint16(p + 24, true)
      });
    }

    for (let i = 0; i < phdrCount - 1; i++) {
      const bagStart = rawPhdr[i].bagNdx;
      const bagEnd = rawPhdr[i + 1].bagNdx;
      const pZones = [];
      let globalPGen = {};

      for (let b = bagStart; b < bagEnd; b++) {
        const gStart = pbag[b].genNdx;
        const gEnd = b + 1 < pbag.length ? pbag[b + 1].genNdx : pgen.length;
        const genMap = {};
        for (let g = gStart; g < gEnd; g++) {
          genMap[pgen[g].oper] = pgen[g];
        }
        if (b === bagStart && genMap[41] === undefined) {
          globalPGen = genMap;
        } else if (genMap[41] !== undefined) {
          pZones.push({ ...globalPGen, ...genMap });
        }
      }

      const key = `${rawPhdr[i].bank}:${rawPhdr[i].program}`;
      this.presets.set(key, {
        name: rawPhdr[i].name,
        bank: rawPhdr[i].bank,
        program: rawPhdr[i].program,
        zones: pZones
      });
    }
  }

  getDestinationForChannel(channel) {
    if (channel === 10 || channel === 9) {
      return this.submixNodes.rhythm || this.audioCtx.destination;
    }
    if (channel === 2 || channel === 1) {
      return this.submixNodes.bass || this.audioCtx.destination;
    }
    if (channel === 3) {
      return this.submixNodes.chords || this.audioCtx.destination;
    }
    return this.submixNodes.chords || this.audioCtx.destination;
  }

  programChange(channel, program, bank = null) {
    const isDrum = channel === 10 || channel === 9;
    const resolvedBank = bank !== null ? bank : (isDrum ? 128 : 0);
    this.channelPrograms.set(channel, { bank: resolvedBank, program: parseInt(program, 10) || 0 });
  }

  timecentsToSeconds(tc) {
    if (tc <= -32768) return 0.001;
    return Math.pow(2, tc / 1200);
  }

  getSampleAudioBuffer(sampleIndex, startOffset, endOffset) {
    const sample = this.samples[sampleIndex];
    if (!sample) return null;

    const start = Math.max(0, sample.start + startOffset);
    const end = Math.min(this.pcmInt16.length, sample.end + endOffset);
    const length = end - start;
    if (length <= 0) return null;

    const cacheKey = `${sampleIndex}:${start}:${end}`;
    if (this.sampleBufferCache.has(cacheKey)) {
      return this.sampleBufferCache.get(cacheKey);
    }

    const sampleRate = Math.max(8000, Math.min(96000, sample.sampleRate || 44100));
    const audioBuf = this.audioCtx.createBuffer(1, length, sampleRate);
    const channelData = audioBuf.getChannelData(0);

    for (let i = 0; i < length; i++) {
      channelData[i] = this.pcmInt16[start + i] / 32768.0;
    }

    // Keep cache bounded
    if (this.sampleBufferCache.size > 512) {
      const firstKey = this.sampleBufferCache.keys().next().value;
      this.sampleBufferCache.delete(firstKey);
    }
    this.sampleBufferCache.set(cacheKey, audioBuf);
    return audioBuf;
  }

  noteOn(channel, pitch, velocity) {
    if (!this.audioCtx || velocity <= 0) {
      this.noteOff(channel, pitch);
      return;
    }

    const isDrum = channel === 10 || channel === 9;
    const chProg = this.channelPrograms.get(channel) || {
      bank: isDrum ? 128 : 0,
      program: 0
    };

    let preset = this.presets.get(`${chProg.bank}:${chProg.program}`);
    if (!preset && isDrum) {
      preset = this.presets.get('128:0');
    } else if (!preset) {
      preset = this.presets.get('0:0');
    }
    if (!preset) return;

    // Stop any existing voice on the same channel + pitch
    this.noteOff(channel, pitch);

    const matchingVoices = [];
    const now = this.audioCtx.currentTime;

    for (const pZone of preset.zones) {
      if (pZone[43] && (pitch < pZone[43].lo || pitch > pZone[43].hi)) continue;
      if (pZone[44] && (velocity < pZone[44].lo || velocity > pZone[44].hi)) continue;

      const instIdx = pZone[41] ? pZone[41].uAmount : -1;
      const inst = this.instruments[instIdx];
      if (!inst) continue;

      for (const iZone of inst.zones) {
        if (iZone[43] && (pitch < iZone[43].lo || pitch > iZone[43].hi)) continue;
        if (iZone[44] && (velocity < iZone[44].lo || velocity > iZone[44].hi)) continue;

        const sampleIdx = iZone[53] ? iZone[53].uAmount : -1;
        const sample = this.samples[sampleIdx];
        if (!sample || (sample.sampleType & 0x8000)) continue; // Skip ROM samples

        const startOffset = (iZone[0] ? iZone[0].sAmount : 0) + (iZone[4] ? iZone[4].sAmount * 32768 : 0);
        const endOffset = (iZone[1] ? iZone[1].sAmount : 0) + (iZone[12] ? iZone[12].sAmount * 32768 : 0);
        const audioBuf = this.getSampleAudioBuffer(sampleIdx, startOffset, endOffset);
        if (!audioBuf) continue;

        const rootKey = (iZone[58] && iZone[58].sAmount >= 0 && iZone[58].sAmount <= 127)
          ? iZone[58].sAmount
          : (sample.originalPitch <= 127 ? sample.originalPitch : 60);

        const scaleTuning = iZone[56] ? iZone[56].sAmount : 100;
        const coarseTune = (iZone[51] ? iZone[51].sAmount : 0) + (pZone[51] ? pZone[51].sAmount : 0);
        const fineTune = (iZone[52] ? iZone[52].sAmount : 0) + (pZone[52] ? pZone[52].sAmount : 0) + (sample.pitchCorrection || 0);

        const totalCents = (pitch - rootKey) * scaleTuning + (coarseTune * 100) + fineTune;
        const playbackRate = Math.pow(2, totalCents / 1200);

        const sampleModes = iZone[54] ? (iZone[54].uAmount & 3) : 0;
        const isLooped = sampleModes === 1 || sampleModes === 3;

        const src = this.audioCtx.createBufferSource();
        src.buffer = audioBuf;
        src.playbackRate.setValueAtTime(playbackRate, now);

        if (isLooped) {
          const loopStartOffset = (iZone[2] ? iZone[2].sAmount : 0) + (iZone[45] ? iZone[45].sAmount * 32768 : 0);
          const loopEndOffset = (iZone[3] ? iZone[3].sAmount : 0) + (iZone[50] ? iZone[50].sAmount * 32768 : 0);
          const relLoopStart = Math.max(0, (sample.startLoop + loopStartOffset) - (sample.start + startOffset));
          const relLoopEnd = Math.max(relLoopStart, (sample.endLoop + loopEndOffset) - (sample.start + startOffset));

          if (relLoopEnd > relLoopStart && relLoopEnd <= audioBuf.length) {
            src.loop = true;
            src.loopStart = relLoopStart / audioBuf.sampleRate;
            src.loopEnd = relLoopEnd / audioBuf.sampleRate;
          }
        }

        // Volume Envelope & Attenuation
        const attenCb = (iZone[48] ? iZone[48].sAmount : 0) + (pZone[48] ? pZone[48].sAmount : 0);
        const attenLinear = Math.pow(10, -Math.max(0, attenCb) / 200);
        const velGain = Math.pow(velocity / 127, 1.5);
        const peakGain = Math.min(1.0, velGain * attenLinear);

        const attackSecs = Math.max(0.002, iZone[34] ? this.timecentsToSeconds(iZone[34].sAmount) : 0.003);
        const decaySecs = Math.max(0.01, iZone[36] ? this.timecentsToSeconds(iZone[36].sAmount) : 0.5);
        const sustainCb = Math.max(0, iZone[37] ? iZone[37].sAmount : 0);
        const sustainLevel = Math.max(0.001, peakGain * Math.pow(10, -sustainCb / 200));
        const releaseSecs = Math.min(3.0, Math.max(0.02, iZone[38] ? this.timecentsToSeconds(iZone[38].sAmount) : (isDrum ? 0.25 : 0.15)));

        const envGain = this.audioCtx.createGain();
        envGain.gain.setValueAtTime(0.0001, now);
        envGain.gain.linearRampToValueAtTime(peakGain, now + attackSecs);
        envGain.gain.exponentialRampToValueAtTime(sustainLevel, now + attackSecs + decaySecs);

        src.connect(envGain);
        envGain.connect(this.getDestinationForChannel(channel));
        src.start(now);

        matchingVoices.push({ src, envGain, releaseSecs, isDrum });
        if (matchingVoices.length >= 4) break; // Cap layers per note for CPU efficiency
      }
    }

    if (matchingVoices.length > 0) {
      this.activeVoices.set(`${channel}:${pitch}`, matchingVoices);
    }
  }

  noteOff(channel, pitch) {
    const key = `${channel}:${pitch}`;
    const voices = this.activeVoices.get(key);
    if (!voices) return;
    this.activeVoices.delete(key);

    const now = this.audioCtx.currentTime;
    for (const v of voices) {
      try {
        // Drum one-shots decay naturally unless explicitly long
        const rel = v.isDrum ? Math.max(v.releaseSecs, 0.25) : v.releaseSecs;
        v.envGain.gain.cancelScheduledValues(now);
        v.envGain.gain.setValueAtTime(Math.max(0.0001, v.envGain.gain.value || 0.001), now);
        v.envGain.gain.exponentialRampToValueAtTime(0.0001, now + rel);
        v.src.stop(now + rel + 0.02);
      } catch (_) {
        // Ignore already-stopped nodes
      }
    }
  }
}

export class SoundFontManager {
  constructor(audioCtx) {
    this.audioCtx = audioCtx;
    this.synth = null;
    this.isLoaded = false;
    this.dbName = 'AutoBand_Audio_DB';
    this.storeName = 'soundfonts';
    this.sfKey = 'fluidr3_gm_binary';

    // Master Dynamics & Submix Staging
    this.masterGain = null;
    this.limiterNode = null;
    this.submix = {
      rhythm: null,
      bass: null,
      chords: null
    };

    // Active preset cache
    this.activePresets = {
      rhythm: { bank: 128, program: 0, name: 'Standard Kit' },
      bass:   { bank: 0,   program: 33, name: 'Electric Bass (Finger)' },
      chords: { bank: 0,   program: 0,  name: 'Acoustic Grand Piano' }
    };

    this.onStatusChange = null; // UI callback: (statusText, isReady) => {}
  }

  // --- IndexedDB Storage Helper (Zero-dependency vanilla implementation) ---
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveToCache(arrayBuffer) {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put(arrayBuffer, this.sfKey);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async loadFromCache() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(this.sfKey);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async clearCache() {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      tx.objectStore(this.storeName).delete(this.sfKey);
      tx.oncomplete = () => {
        this.isLoaded = false;
        this.synth = null;
        if (this.onStatusChange) this.onStatusChange('Cache cleared. Please load a SoundFont.', false);
        resolve(true);
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  // --- Master Limiter & Audio Graph Setup ---
  initAudioGraph() {
    if (!this.audioCtx || this.limiterNode) return;

    // Master Dynamics Limiter Node to prevent digital clipping
    this.limiterNode = this.audioCtx.createDynamicsCompressor();
    this.limiterNode.threshold.setValueAtTime(-3.0, this.audioCtx.currentTime);
    this.limiterNode.ratio.setValueAtTime(12.0, this.audioCtx.currentTime);
    this.limiterNode.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
    this.limiterNode.release.setValueAtTime(0.15, this.audioCtx.currentTime);

    // Master volume gain
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.audioCtx.currentTime);

    // Submix gain nodes for independent balancing and muting
    this.submix.rhythm = this.audioCtx.createGain();
    this.submix.bass = this.audioCtx.createGain();
    this.submix.chords = this.audioCtx.createGain();

    this.submix.rhythm.connect(this.limiterNode);
    this.submix.bass.connect(this.limiterNode);
    this.submix.chords.connect(this.limiterNode);

    this.limiterNode.connect(this.masterGain);
    this.masterGain.connect(this.audioCtx.destination);
  }

  // --- Boot Sequence & SoundFont Parsing ---
  async init() {
    this.initAudioGraph();
    if (this.onStatusChange) this.onStatusChange('Checking IndexedDB for cached SoundFont...', false);

    try {
      const cachedBuffer = await this.loadFromCache();
      if (cachedBuffer) {
        if (this.onStatusChange) this.onStatusChange('Loading cached SoundFont from IndexedDB...', false);
        await this.parseAndMountSoundFont(cachedBuffer);
        return true;
      } else {
        if (this.onStatusChange) this.onStatusChange('No SoundFont in cache. Load FluidR3_GM.sf2 via file picker.', false);
        return false;
      }
    } catch (err) {
      console.warn('[SoundFontManager] Cache check failed:', err);
      if (this.onStatusChange) this.onStatusChange('Storage access error. Ready for file upload.', false);
      return false;
    }
  }

  async loadFromFile(file) {
    this.initAudioGraph();
    if (this.onStatusChange) this.onStatusChange(`Reading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`, false);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target.result;
          if (this.onStatusChange) this.onStatusChange('Writing SoundFont to IndexedDB...', false);
          await this.saveToCache(buffer);
          await this.parseAndMountSoundFont(buffer);
          resolve(true);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  async parseAndMountSoundFont(arrayBuffer) {
    this.initAudioGraph();
    if (this.onStatusChange) this.onStatusChange('Parsing SoundFont binary into Web Audio synth...', false);

    try {
      let SpessaSynth = window.SpessaSynth || window.Synthesizer || null;
      if (!SpessaSynth) {
        const module = await import('https://cdn.jsdelivr.net/npm/spessasynth_lib@3.0.0/dist/spessasynth_lib.min.js').catch(() => null);
        if (module) {
          SpessaSynth = module.Synthesizer || module.Synthetizer || module.default;
        }
      }

      if (SpessaSynth) {
        this.synth = new SpessaSynth(this.limiterNode || this.audioCtx.destination, arrayBuffer);
      } else {
        // Offline-first built-in SF2 parser & Web Audio sample synthesizer routed through submix bus
        this.synth = new InternalSF2Synth(this.audioCtx, arrayBuffer, this.submix);
      }

      // Apply initial channel presets
      this.applyActivePresets();

      this.isLoaded = true;
      if (this.onStatusChange) this.onStatusChange('SoundFont Ready (FluidR3_GM.sf2)', true);
      console.log('[SoundFontManager] Engine ready.');
    } catch (err) {
      console.error('[SoundFontManager] Failed to parse SoundFont:', err);
      if (this.onStatusChange) this.onStatusChange(`Parse error: ${err.message}`, false);
      throw err;
    }
  }

  // --- Preset Switching ---
  setPreset(channel, bank, program, name = '') {
    const progNum = parseInt(program, 10);
    const bankNum = parseInt(bank, 10);

    if (channel === 10) {
      this.activePresets.rhythm = { bank: bankNum || 128, program: progNum, name };
    } else if (channel === 2) {
      this.activePresets.bass = { bank: bankNum || 0, program: progNum, name };
    } else if (channel === 3) {
      this.activePresets.chords = { bank: bankNum || 0, program: progNum, name };
    }

    if (!this.synth) return;
    try {
      this.synth.programChange(channel, progNum, bankNum);
      console.log(`[SoundFont] Channel ${channel} set to Program ${progNum} (${name})`);
    } catch (e) {
      console.warn(`[SoundFont] Error changing preset on channel ${channel}:`, e);
    }
  }

  applyActivePresets() {
    if (!this.synth) return;
    this.synth.programChange(10, this.activePresets.rhythm.program, 128);
    this.synth.programChange(2, this.activePresets.bass.program, 0);
    this.synth.programChange(3, this.activePresets.chords.program, 0);
  }

  // --- Real-Time Triggering ---
  noteOn(channel, pitch, velocity) {
    if (!this.synth || !this.isLoaded) return;
    this.synth.noteOn(channel, pitch, velocity);
  }

  noteOff(channel, pitch) {
    if (!this.synth || !this.isLoaded) return;
    this.synth.noteOff(channel, pitch);
  }

  // --- Volume & Limiter Controls ---
  setMasterVolume(val) {
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(parseFloat(val), this.audioCtx.currentTime);
    }
  }

  setModuleVolume(moduleName, val) {
    if (this.submix[moduleName] && this.audioCtx) {
      this.submix[moduleName].gain.setValueAtTime(parseFloat(val), this.audioCtx.currentTime);
    }
  }

  setLimiterThreshold(dbVal) {
    if (this.limiterNode && this.audioCtx) {
      this.limiterNode.threshold.setValueAtTime(parseFloat(dbVal), this.audioCtx.currentTime);
    }
  }
}

