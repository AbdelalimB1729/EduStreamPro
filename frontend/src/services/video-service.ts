import Hls from 'hls.js';

export class VideoService {
  private hls: Hls | null = null;
  private videoElement: HTMLVideoElement | null = null;

  public initializePlayer(
    videoElement: HTMLVideoElement,
    src: string,
    onError?: (error: Error) => void,
  ): void {
    this.videoElement = videoElement;

    if (Hls.isSupported()) {
      this.initializeHLS(src, onError);
    } else if (
      this.videoElement.canPlayType('application/vnd.apple.mpegurl')
    ) {
      // For Safari, which has native HLS support
      this.videoElement.src = src;
    } else {
      onError?.(new Error('HLS is not supported in this browser.'));
    }
  }

  private initializeHLS(src: string, onError?: (error: Error) => void): void {
    if (this.hls) {
      this.hls.destroy();
    }

    this.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
    });

    this.hls.attachMedia(this.videoElement);

    this.hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      this.hls.loadSource(src);
    });

    this.hls.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            this.hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            this.hls.recoverMediaError();
            break;
          default:
            this.destroyPlayer();
            onError?.(new Error('Fatal HLS error.'));
            break;
        }
      }
    });
  }

  public setQuality(level: number): void {
    if (this.hls) {
      this.hls.currentLevel = level;
    }
  }

  public getAvailableQualities(): { height: number; bitrate: number }[] {
    if (!this.hls) return [];

    return this.hls.levels.map((level) => ({
      height: level.height,
      bitrate: level.bitrate,
    }));
  }

  public getCurrentQuality(): number {
    return this.hls?.currentLevel ?? -1;
  }

  public async captureSnapshot(): Promise<string> {
    if (!this.videoElement) {
      throw new Error('Video element not initialized');
    }

    const canvas = document.createElement('canvas');
    canvas.width = this.videoElement.videoWidth;
    canvas.height = this.videoElement.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.videoElement, 0, 0);

    return canvas.toDataURL('image/jpeg');
  }

  public destroyPlayer(): void {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    this.videoElement = null;
  }

  public isPlaying(): boolean {
    return this.videoElement
      ? !this.videoElement.paused && !this.videoElement.ended
      : false;
  }

  public getDuration(): number {
    return this.videoElement?.duration ?? 0;
  }

  public getCurrentTime(): number {
    return this.videoElement?.currentTime ?? 0;
  }

  public setCurrentTime(time: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
  }

  public setPlaybackRate(rate: number): void {
    if (this.videoElement) {
      this.videoElement.playbackRate = rate;
    }
  }

  public async play(): Promise<void> {
    if (this.videoElement) {
      try {
        await this.videoElement.play();
      } catch (error) {
        console.error('Failed to play video:', error);
        throw error;
      }
    }
  }

  public pause(): void {
    if (this.videoElement) {
      this.videoElement.pause();
    }
  }

  public togglePlayPause(): void {
    if (this.isPlaying()) {
      this.pause();
    } else {
      this.play();
    }
  }

  public setVolume(volume: number): void {
    if (this.videoElement) {
      this.videoElement.volume = Math.max(0, Math.min(1, volume));
    }
  }

  public toggleMute(): void {
    if (this.videoElement) {
      this.videoElement.muted = !this.videoElement.muted;
    }
  }

  public requestPictureInPicture(): void {
    if (
      this.videoElement &&
      document.pictureInPictureEnabled &&
      !document.pictureInPictureElement
    ) {
      this.videoElement.requestPictureInPicture();
    }
  }

  public exitPictureInPicture(): void {
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture();
    }
  }
}