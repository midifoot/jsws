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
        
        for (let output of this.midiAccess.outputs.values()) {
            this.outputs.set(output.id, { name: output.name, id: output.id, port: output });
        }

        if (this.onPortsChanged) this.onPortsChanged(this.outputs);
    }

    setRoute(moduleName, portId, channel) {
        if (this.routing[moduleName]) {
            this.routing[moduleName].portId = portId;
            this.routing[moduleName].channel = parseInt(channel);
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

        // A single, pure sine tone. No weird frequencies, no dual tones.
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, time);
        
        // ZERO-CLICK ENVELOPE: Must start strictly at 0.
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(maxGain, time + 0.005); // 5ms attack to prevent popping
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.1); // Smooth 100ms decay

        osc.start(time);
        osc.stop(time + 0.15); // Stop slightly after envelope finishes
    }
}