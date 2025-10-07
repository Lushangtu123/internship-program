export interface QoEMetrics {
  ttff: number; // time-to-first-frame in ms
  stallCount: number;
  stallDurationMs: number;
  framesDropped: number;
  scrollNext: number;
  scrollPrev: number;
  likeTapped: number;
  commentOpened: number;
  captionToggled: number;
}

export interface VideoQoE {
  videoId: string;
  startTime: number;
  endTime?: number;
  ttff?: number;
  stallCount: number;
  stallDurationMs: number;
  completed: boolean;
}

