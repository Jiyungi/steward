import {
  RoomEvent,
  TrackKind,
  VideoStream,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Room,
  type VideoFrame,
  type VideoFrameEvent,
} from "@livekit/rtc-node";

export class LiveKitVisionFrameSource {
  #track: RemoteTrack | undefined;
  #reader: ReadableStreamDefaultReader<VideoFrameEvent> | undefined;
  #readerTrack: RemoteTrack | undefined;
  #pendingFrame: Promise<ReadableStreamReadResult<VideoFrameEvent>> | undefined;
  readonly #waiting = new Set<(track: RemoteTrack) => void>();

  constructor(
    private readonly room: Room,
    private readonly participant: RemoteParticipant,
  ) {
    for (const publication of participant.trackPublications.values()) {
      if (publication.kind === TrackKind.KIND_VIDEO && publication.track !== undefined) {
        this.#track = publication.track as RemoteTrack;
      }
    }
    room.on(RoomEvent.TrackSubscribed, this.#onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, this.#onTrackUnsubscribed);
  }

  async captureFrame(timeoutMs = 8_000): Promise<VideoFrame | null> {
    const track = this.#track ?? await this.#waitForTrack(timeoutMs);
    if (track === null) return null;

    const reader = this.#readerFor(track);
    const pendingFrame = this.#pendingFrame ?? reader.read();
    this.#pendingFrame = pendingFrame;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        pendingFrame,
        new Promise<null>((resolve) => {
          timeout = setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);
      if (result === null || result.done) return null;
      if (this.#pendingFrame === pendingFrame) this.#pendingFrame = undefined;
      return result.value.frame;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
    }
  }

  dispose(): void {
    this.room.off(RoomEvent.TrackSubscribed, this.#onTrackSubscribed);
    this.room.off(RoomEvent.TrackUnsubscribed, this.#onTrackUnsubscribed);
    this.#waiting.clear();
    this.#track = undefined;
    this.#resetReader();
  }

  #readerFor(track: RemoteTrack): ReadableStreamDefaultReader<VideoFrameEvent> {
    if (this.#reader !== undefined && this.#readerTrack === track) return this.#reader;
    this.#resetReader();
    this.#readerTrack = track;
    this.#reader = new VideoStream(track).getReader();
    return this.#reader;
  }

  #resetReader(): void {
    const reader = this.#reader;
    this.#reader = undefined;
    this.#readerTrack = undefined;
    this.#pendingFrame = undefined;
    if (reader !== undefined) {
      void reader.cancel().catch(() => undefined).finally(() => reader.releaseLock());
    }
  }

  #waitForTrack(timeoutMs: number): Promise<RemoteTrack | null> {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (track: RemoteTrack | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.#waiting.delete(onTrack);
        resolve(track);
      };
      const onTrack = (track: RemoteTrack) => finish(track);
      const timeout = setTimeout(() => finish(null), timeoutMs);
      this.#waiting.add(onTrack);
    });
  }

  #onTrackSubscribed = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => {
    if (
      participant.identity !== this.participant.identity
      || publication.kind !== TrackKind.KIND_VIDEO
    ) return;
    this.#track = track;
    for (const resolve of this.#waiting) resolve(track);
    this.#waiting.clear();
  };

  #onTrackUnsubscribed = (
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) => {
    if (
      participant.identity === this.participant.identity
      && publication.kind === TrackKind.KIND_VIDEO
      && this.#track === track
    ) this.#track = undefined;
    if (this.#readerTrack === track) this.#resetReader();
  };
}
