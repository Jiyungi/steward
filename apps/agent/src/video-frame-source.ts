import {
  RoomEvent,
  TrackKind,
  VideoStream,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type Room,
  type VideoFrame,
} from "@livekit/rtc-node";

export class LiveKitVisionFrameSource {
  #track: RemoteTrack | undefined;
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

    const stream = new VideoStream(track);
    const reader = stream.getReader();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        reader.read(),
        new Promise<null>((resolve) => {
          timeout = setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);
      if (result === null || result.done) return null;
      return result.value.frame;
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
  }

  dispose(): void {
    this.room.off(RoomEvent.TrackSubscribed, this.#onTrackSubscribed);
    this.room.off(RoomEvent.TrackUnsubscribed, this.#onTrackUnsubscribed);
    this.#waiting.clear();
    this.#track = undefined;
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
  };
}
