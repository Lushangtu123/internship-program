import { QoEMetrics, VideoQoE } from '@/types/qoe';

class QoELogger {
  private metrics: QoEMetrics = {
    ttff: 0,
    stallCount: 0,
    stallDurationMs: 0,
    framesDropped: 0,
    scrollNext: 0,
    scrollPrev: 0,
    likeTapped: 0,
    commentOpened: 0,
    captionToggled: 0,
  };

  private videoMetrics: Map<string, VideoQoE> = new Map();

  startVideo(videoId: string) {
    this.videoMetrics.set(videoId, {
      videoId,
      startTime: Date.now(),
      stallCount: 0,
      stallDurationMs: 0,
      completed: false,
    });
  }

  recordTTFF(videoId: string, ttff: number) {
    const video = this.videoMetrics.get(videoId);
    if (video) {
      video.ttff = ttff;
      this.metrics.ttff = ttff;
    }
  }

  recordStall(videoId: string, duration: number) {
    const video = this.videoMetrics.get(videoId);
    if (video) {
      video.stallCount++;
      video.stallDurationMs += duration;
      this.metrics.stallCount++;
      this.metrics.stallDurationMs += duration;
    }
  }

  recordScrollNext() {
    this.metrics.scrollNext++;
  }

  recordScrollPrev() {
    this.metrics.scrollPrev++;
  }

  recordLikeTap() {
    this.metrics.likeTapped++;
  }

  recordCommentOpen() {
    this.metrics.commentOpened++;
  }

  recordCaptionToggle() {
    this.metrics.captionToggled++;
  }

  endVideo(videoId: string, completed: boolean) {
    const video = this.videoMetrics.get(videoId);
    if (video) {
      video.endTime = Date.now();
      video.completed = completed;
    }
  }

  getMetrics(): QoEMetrics {
    return { ...this.metrics };
  }

  getVideoMetrics(videoId: string): VideoQoE | undefined {
    return this.videoMetrics.get(videoId);
  }

  getAllVideoMetrics(): VideoQoE[] {
    return Array.from(this.videoMetrics.values());
  }

  logToConsole() {
    console.group('📊 QoE Metrics');
    console.table(this.metrics);
    console.groupEnd();
  }

  async sendToServer() {
    // Placeholder for sending metrics to server
    try {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: this.metrics,
          videos: this.getAllVideoMetrics(),
        }),
      });
    } catch (error) {
      console.error('Failed to send telemetry:', error);
    }
  }
}

export const qoeLogger = new QoELogger();

