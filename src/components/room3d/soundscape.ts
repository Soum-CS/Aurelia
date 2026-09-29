"use client";

import { WindowView } from "@/lib/types";

/**
 * Procedural ambient soundscapes for the Aurelia 3D room experience.
 * Powered by Web Audio API — zero external audio assets or network requests.
 * Runs completely client-side with organic, non-looping continuous synthesis.
 */

class RoomSoundscape {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: { stop?: () => void; disconnect: () => void }[] = [];
  private isPlaying = false;
  private currentView: WindowView = "city";
  private currentNight = false;

  private init() {
    if (this.ctx) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
  }

  /** Generates continuous white/pink noise buffer for wind and waves. */
  private createNoiseBuffer(durationSec = 5): AudioBuffer | null {
    if (!this.ctx) return null;
    const sampleRate = this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, sampleRate * durationSec, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise filter
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  public play(view: WindowView, night: boolean) {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    this.stop();
    this.isPlaying = true;
    this.currentView = view;
    this.currentNight = night;

    const noiseBuffer = this.createNoiseBuffer(5);
    if (!noiseBuffer) return;

    // Continuous looping noise source
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    if (view === "ocean") {
      // Ocean waves: LFO modulates lowpass filter frequency for rhythmic swells
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(320, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.8, this.ctx.currentTime);

      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime); // ~8-second wave cycle
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(220, this.ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      const waveGain = this.ctx.createGain();
      waveGain.gain.setValueAtTime(night ? 0.15 : 0.22, this.ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(waveGain);
      waveGain.connect(this.masterGain);

      lfo.start();
      noiseSource.start();
      this.activeNodes.push(lfo, noiseSource, waveGain, filter);
    } else if (view === "garden") {
      // Garden: gentle ambient breeze through leaves
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(480, this.ctx.currentTime);
      filter.Q.setValueAtTime(0.8, this.ctx.currentTime);

      const breezeGain = this.ctx.createGain();
      breezeGain.gain.setValueAtTime(night ? 0.08 : 0.14, this.ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(breezeGain);
      breezeGain.connect(this.masterGain);

      noiseSource.start();
      this.activeNodes.push(noiseSource, filter, breezeGain);
    } else if (view === "mountain" || view === "alps") {
      // Alpine mountain: soft mountain wind
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(260, this.ctx.currentTime);

      const windGain = this.ctx.createGain();
      windGain.gain.setValueAtTime(night ? 0.1 : 0.16, this.ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(windGain);
      windGain.connect(this.masterGain);

      noiseSource.start();
      this.activeNodes.push(noiseSource, filter, windGain);
    } else {
      // City: warm, distant urban room ambiance
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(180, this.ctx.currentTime);

      const cityGain = this.ctx.createGain();
      cityGain.gain.setValueAtTime(night ? 0.07 : 0.12, this.ctx.currentTime);

      noiseSource.connect(filter);
      filter.connect(cityGain);
      cityGain.connect(this.masterGain);

      noiseSource.start();
      this.activeNodes.push(noiseSource, filter, cityGain);
    }
  }

  public stop() {
    this.activeNodes.forEach((node) => {
      try {
        if (typeof node.stop === "function") node.stop();
        node.disconnect();
      } catch {
        // Ignored
      }
    });
    this.activeNodes = [];
    this.isPlaying = false;
  }

  public toggle(view: WindowView, night: boolean): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    } else {
      this.play(view, night);
      return true;
    }
  }

  public updateView(view: WindowView, night: boolean) {
    if (this.isPlaying && (view !== this.currentView || night !== this.currentNight)) {
      this.play(view, night);
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const soundscape = typeof window !== "undefined" ? new RoomSoundscape() : null;
