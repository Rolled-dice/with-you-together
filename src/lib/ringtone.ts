/**
 * Browser ringtone synthesizer for SomeoneNear Listener Softphone.
 * Uses Web Audio API to produce an authentic, gentle telephone ringback cadence
 * (440Hz + 480Hz dual-frequency with smooth sinusoidal gain envelope) without
 * requiring external MP3 downloads or network dependencies.
 */

class RingtonePlayer {
  private ctx: AudioContext | null = null;
  private timer: any = null;
  private isPlaying = false;

  public start() {
    if (this.isPlaying || typeof window === "undefined") return;
    this.isPlaying = true;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
        void this.ctx.resume();
      }

      const playBurst = () => {
        if (!this.isPlaying || !this.ctx || this.ctx.state === "closed") return;
        try {
          const now = this.ctx.currentTime;
          const osc1 = this.ctx.createOscillator();
          const osc2 = this.ctx.createOscillator();
          const gain = this.ctx.createGain();

          osc1.type = "sine";
          osc1.frequency.setValueAtTime(440, now);

          osc2.type = "sine";
          osc2.frequency.setValueAtTime(480, now);

          // Gentle telephone chime ring envelope (1.8s sound, smooth fade)
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.15, now + 0.08);
          gain.gain.setValueAtTime(0.15, now + 1.6);
          gain.gain.linearRampToValueAtTime(0, now + 1.8);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(this.ctx.destination);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 1.85);
          osc2.stop(now + 1.85);
        } catch (e) {
          console.warn("[RingtonePlayer] burst error:", e);
        }
      };

      playBurst();
      // Cadence: 1.8s ring + 2.2s silence = 4s loop
      this.timer = setInterval(playBurst, 4000);
    } catch (e) {
      console.warn("[RingtonePlayer] audio context initialize error:", e);
    }
  }

  public stop() {
    this.isPlaying = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const ringtone = new RingtonePlayer();
