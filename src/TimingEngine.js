export class TimingEngine {
    constructor() {
        this.audioCtx = null; 
        this.tempo = 120.0;          
        this.lookahead = 25.0;       
        this.scheduleAheadTime = 0.1;
        
        this.isPlaying = false;
        this.currentPulse = 0;       
        this.nextPulseTime = 0.0;    
        this.timerID = null;         
        this.startTime = 0;          // Absolute time when Pulse 0 occurs
        this.onPulseCallback = null; 
        this.onTickCallback = null;  // Optional custom tick (e.g. SF2 Rimshot) with osc fallback
        
        // Precount & Metronome Settings
        this.precountAmount = 4;           // Number of precount pulses
        this.tickDuringPrecount = true;    // Audio tick during negative pulses
        this.tickDuringPlayback = false;   // Audio tick from pulse 0 onwards
    }

    initAudioContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    advancePulse() {
        const secondsPerPulse = 60.0 / this.tempo;
        this.nextPulseTime += secondsPerPulse;
        this.currentPulse++; 
    }

    schedulePulse(pulseNumber, time) {
        // Always fire the callback for visual UI rendering
        if (this.onPulseCallback) {
            this.onPulseCallback(pulseNumber, time);
        }

        // Determine if we should hear a tick based on precount vs playback state
        const isPrecount = pulseNumber < 0;
        const shouldTick = isPrecount ? this.tickDuringPrecount : this.tickDuringPlayback;

        if (shouldTick && this.audioCtx) {
            // Try SoundFont Rimshot tick first if available; fallback to local oscillator beep
            if (this.onTickCallback && this.onTickCallback(isPrecount, time, pulseNumber)) {
                return;
            }

            const osc = this.audioCtx.createOscillator();
            const envelope = this.audioCtx.createGain();

            // Slightly lower pitch for precount to distinguish the transition
            osc.frequency.value = isPrecount ? 600.0 : 800.0; 
            
            osc.connect(envelope);
            envelope.connect(this.audioCtx.destination);
            
            // Mathematically clean envelope (2ms attack) to prevent pops
            envelope.gain.setValueAtTime(0, time);
            envelope.gain.linearRampToValueAtTime(1, time + 0.002);
            envelope.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

            osc.start(time);
            osc.stop(time + 0.05);
        }
    }

    scheduler() {
        while (this.nextPulseTime < this.audioCtx.currentTime + this.scheduleAheadTime) {
            this.schedulePulse(this.currentPulse, this.nextPulseTime);
            this.advancePulse();
        }
    }

    start() {
        if (this.isPlaying) return;
        this.initAudioContext();
        this.isPlaying = true;
        
        // Start at negative pulse count
        this.currentPulse = -this.precountAmount;
        
        // Calculate the absolute AudioContext time when Pulse 0 will occur
        const secondsPerPulse = 60.0 / this.tempo;
        const precountDuration = this.precountAmount * secondsPerPulse;
        
        this.nextPulseTime = this.audioCtx.currentTime + 0.05; 
        this.startTime = this.nextPulseTime + precountDuration; 
        
        this.timerID = setInterval(() => this.scheduler(), this.lookahead);
        console.log(`[TimingEngine] Started with ${this.precountAmount} precount pulses`);
    }

    stop() {
        this.isPlaying = false;
        clearInterval(this.timerID);
        console.log("[TimingEngine] Stopped");
    }

    setTempo(newTempo) { this.tempo = newTempo; }
    
    setPrecountSettings(amount, tickPrecount, tickPlayback) {
        this.precountAmount = parseInt(amount);
        this.tickDuringPrecount = tickPrecount;
        this.tickDuringPlayback = tickPlayback;
    }
    
    getElapsedTime() {
        if (!this.isPlaying || !this.audioCtx) return 0;
        // This will naturally return a negative number during the precount!
        return this.audioCtx.currentTime - this.startTime;
    }

    /**
     * Computes micro-timing displacement (deltaT) and strike-velocity jitter (deltaV)
     * for a given humanize percentage (0..100) without mutating the master clock.
     */
    applyHumanize(baseTime, baseVelocity, humanize = 0) {
        const hum = Math.max(0, Math.min(100, Number(humanize) || 0));
        const vel = Math.round(Number(baseVelocity) || 90);
        if (hum <= 0) {
            return {
                time: baseTime,
                velocity: Math.max(1, Math.min(127, vel)),
                deltaT: 0,
                deltaV: 0
            };
        }
        const deltaT = (Math.random() - 0.5) * 0.012 * (hum / 100);
        const deltaV = Math.round((Math.random() - 0.5) * 20 * (hum / 100));
        const minNow = this.audioCtx ? this.audioCtx.currentTime : 0;
        return {
            time: Math.max(minNow, baseTime + deltaT),
            velocity: Math.max(1, Math.min(127, vel + deltaV)),
            deltaT,
            deltaV
        };
    }
}

