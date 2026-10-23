export class MidiBridge {
    constructor(audioCtx, soundFontManager = null) {
        this.audioCtx = audioCtx;
        this.soundFontManager = soundFontManager;
        this.midiAccess = null;
        this.outputs = new Map();

        this.routing = {
            rhythm: { portId: 'internal', channel: 10 },
            bass:   { portId: 'internal', channel: 2 },
            chords: { portId: 'internal', channel: 3 }
        };

        this.onPortsChanged = null;
    }

    setSoundFontManager(soundFontManager) {
        this.soundFontManager = soundFontManager;
    }

    async init() {
        try {
            this.midiAccess = await navigator.requestMIDIAccess();
            this.updateOutputs();

            // Listen for hot-plugging MIDI devices
            this.midiAccess.onstatechange = (e) => {
                if (e.port.type === 'output') {
                    this.updateOutputs();
                }
            };
            return true;
        } catch (err) {
            console.warn("Web MIDI API access denied or unsupported.", err);
            this.updateOutputs();
            return false;
        }
    }

    updateOutputs() {
        this.outputs.clear();
        this.outputs.set('internal', { name: '🔊 Internal Web Audio / SoundFont Synth', id: 'internal' });

        const portList = [];
        if (this.midiAccess) {
            for (let output of this.midiAccess.outputs.values()) {
                this.outputs.set(output.id, { name: output.name, id: output.id, port: output });
                portList.push(output);
            }
        }

        this.autoRoute(portList);

        if (this.onPortsChanged) {
            const diagnostics = {
                rhythm: this.getRouteInfo('rhythm'),
                bass: this.getRouteInfo('bass'),
                chords: this.getRouteInfo('chords'),
                allPorts: Array.from(this.outputs.values())
            };
            this.onPortsChanged(diagnostics);
        }
    }

    autoRoute(ports) {
        // Helper to find the first port matching an array of Regex patterns
        const findPort = (regexps) => {
            for (let regex of regexps) {
                for (let port of ports) {
                    if (regex.test(port.name)) return port.id;
                }
            }
            return 'internal';
        };

        const virtualRegex = /iac|fluidsynth|virtual|loopmidi/i;

        // Rhythm: MPX8/MP8X -> Virtual -> Internal
        this.routing.rhythm.portId = findPort([/mpx8/i, /mp8x/i, virtualRegex]);

        // Bass: TB3/TB-3 -> Virtual -> Internal
        this.routing.bass.portId = findPort([/tb-?3/i, virtualRegex]);

        // Chords: Virtual -> Internal
        this.routing.chords.portId = findPort([virtualRegex]);
    }

    getRouteInfo(moduleName) {
        const route = this.routing[moduleName];
        const portInfo = this.outputs.get(route.portId);
        return {
            module: moduleName,
            portName: portInfo ? portInfo.name : 'Unknown Port',
            channel: route.channel,
            isFallback: route.portId === 'internal'
        };
    }

    setRoute(moduleName, portId, channel) {
        if (this.routing[moduleName]) {
            this.routing[moduleName].portId = portId;
            this.routing[moduleName].channel = parseInt(channel, 10);
            this.updateOutputs(); // Re-trigger UI updates
        }
    }

    sendNoteOn(moduleName, pitch, velocity, timeInSeconds, durationInSeconds = 0.1) {
        const route = this.routing[moduleName];
        if (!route) return;

        const now = this.audioCtx ? this.audioCtx.currentTime : 0;
        const targetTime = typeof timeInSeconds === 'number' ? timeInSeconds : now;
        const msOffset = Math.max(0, (targetTime - now) * 1000);
        const durationMs = Math.max(10, durationInSeconds * 1000);

        // Route 1: Local Browser Audio (SoundFont Engine -> Oscillator Fallback)
        if (route.portId === 'internal') {
            if (this.soundFontManager && this.soundFontManager.isLoaded) {
                if (msOffset <= 4) {
                    this.soundFontManager.noteOn(route.channel, pitch, velocity);
                } else {
                    setTimeout(() => {
                        this.soundFontManager.noteOn(route.channel, pitch, velocity);
                    }, msOffset);
                }

                setTimeout(() => {
                    this.soundFontManager.noteOff(route.channel, pitch);
                }, msOffset + durationMs);
            } else {
                this.playInternalSynth(route.channel, pitch, velocity, targetTime, durationInSeconds);
            }
            return;
        }

        // Route 2: External MIDI
        const outputPortInfo = this.outputs.get(route.portId);
        if (outputPortInfo && outputPortInfo.port && this.audioCtx) {
            const timeStamp = performance.now() + msOffset;

            const statusByte = 0x90 + (route.channel - 1);
            const noteOnMsg = new Uint8Array([statusByte, pitch, velocity]);
            const noteOffMsg = new Uint8Array([0x80 + (route.channel - 1), pitch, 0]);

            outputPortInfo.port.send(noteOnMsg, timeStamp);
            outputPortInfo.port.send(noteOffMsg, timeStamp + durationMs);
        }
    }

    playInternalSynth(channel, pitch, velocity, time, duration = 0.1) {
        if (!this.audioCtx) return;

        const startTime = Math.max(this.audioCtx.currentTime, time || this.audioCtx.currentTime);
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        const destination = (this.soundFontManager && this.soundFontManager.limiterNode)
            ? this.soundFontManager.limiterNode
            : this.audioCtx.destination;

        osc.connect(gainNode);
        gainNode.connect(destination);

        const maxGain = (velocity / 127) * 0.35;
        const freq = channel === 10
            ? 120 * Math.pow(2, (pitch - 36) / 24)
            : 440 * Math.pow(2, (pitch - 69) / 12);

        osc.type = channel === 2 ? 'sawtooth' : (channel === 3 ? 'triangle' : 'sine');
        osc.frequency.setValueAtTime(freq, startTime);

        // ZERO-CLICK ENVELOPE
        const stopTime = startTime + Math.max(0.05, duration);
        gainNode.gain.setValueAtTime(0.0001, startTime);
        gainNode.gain.linearRampToValueAtTime(maxGain, startTime + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, stopTime);

        osc.start(startTime);
        osc.stop(stopTime + 0.02);
    }
}
