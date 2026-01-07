class SoundManager {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    _playTone(freq, duration, type = 'sine', startTime = 0) {
        if (!this.enabled) return;
        this.init();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    playClick() {
        // High pitched short tick
        this._playTone(800, 0.05, 'triangle');
    }

    playShuffle() {
        if (!this.enabled) return;
        // Rapid series of ticks
        for (let i = 0; i < 5; i++) {
            this._playTone(400 + Math.random() * 200, 0.05, 'square', i * 0.05);
        }
    }

    playSuccess() {
        if (!this.enabled) return;
        // Major chord arpeggio
        this._playTone(440, 0.3, 'sine', 0); // A4
        this._playTone(554.37, 0.3, 'sine', 0.1); // C#5
        this._playTone(659.25, 0.5, 'sine', 0.2); // E5
    }

    playError() {
        if (!this.enabled) return;
        // Dissonant low buzz
        this._playTone(150, 0.3, 'sawtooth', 0);
        this._playTone(140, 0.3, 'sawtooth', 0.05);
    }
}

export const soundManager = new SoundManager();
