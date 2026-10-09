export class MidiBridge {
    constructor(audioCtx) {
        this.audioCtx = audioCtx; 
        this.midiAccess = null;
        this.outputs = new Map();
        
        this.routing = {
            rhythm: { portId: 'internal', channel: 10 },
            bass:   { portId: 'internal', channel: 2 },
            chords: { portId: 'internal', channel: 3 }
        };

        this.onPortsChanged = null; 
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
            return false;
        }
    }

    updateOutputs() {
        this.outputs.clear();
        this.outputs.set('internal', { name: '🔊 Internal Web Audio Synth', id: 'internal' });
        
        const portList = [];
        for (let output of this.midiAccess.outputs.values()) {
            this.outputs.set(output.id, { name: output.name, id: output.id, port: output });
            portList.push(output);
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
            this.routing[moduleName].channel = parseInt(channel);
            this.updateOutputs(); // Re-trigger UI updates
        }
    }

    sendNoteOn(moduleName, pitch, velocity, timeInSeconds, durationInSeconds = 0.1) {
        const route = this.routing[moduleName];
        if (!route) return;

        // Route 1: Local Browser Audio
        if (route.portId === 'internal') {
            this.playInternalSynth(route.channel, pitch, velocity, timeInSeconds, durationInSeconds);
            return;
        }

        // Route 2: External MIDI
        const outputPortInfo = this.outputs.get(route.portId);
        if (outputPortInfo && outputPortInfo.port && this.audioCtx) {
            const msOffset = (timeInSeconds - this.audioCtx.currentTime) * 1000;
            const timeStamp = performance.now() + Math.max(0, msOffset);

            const statusByte = 0x90 + (route.channel - 1); 
            const noteOnMsg = new Uint8Array([statusByte, pitch, velocity]);
            const noteOffMsg = new Uint8Array([0x80 + (route.channel - 1), pitch, 0]);

            outputPortInfo.port.send(noteOnMsg, timeStamp);
            outputPortInfo.port.send(noteOffMsg, timeStamp + (durationInSeconds * 1000));
        }
    }

    playInternalSynth(channel, pitch, velocity, time, duration) {
        if (!this.audioCtx) return;
        
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);
        
        const maxGain = velocity / 127;

        // A single, pure sine tone for fallback debugging.
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, time); 
        
        // ZERO-CLICK ENVELOPE
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(maxGain, time + 0.005);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1); 

        osc.start(time);
        osc.stop(time + 0.15); 
    }
}