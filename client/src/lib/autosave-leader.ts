export type AutosaveLeaderMessage =
  | { type: "presence"; tabId: string; sentAt: number }
  | { type: "heartbeat"; tabId: string; sentAt: number }
  | { type: "resign"; tabId: string; sentAt: number };

export interface AutosaveChannel {
  postMessage(message: AutosaveLeaderMessage): void;
  close(): void;
  onmessage: ((event: MessageEvent<AutosaveLeaderMessage>) => void) | null;
}

interface AutosaveLeaderCoordinatorOptions {
  tabId: string;
  channel: AutosaveChannel;
  onLeadershipChange: (isLeader: boolean) => void;
  now?: () => number;
  heartbeatMs?: number;
  leaseMs?: number;
  electionDelayMs?: number;
}

export class AutosaveLeaderCoordinator {
  private readonly tabId: string;
  private readonly channel: AutosaveChannel;
  private readonly onLeadershipChange: (isLeader: boolean) => void;
  private readonly now: () => number;
  private readonly heartbeatMs: number;
  private readonly leaseMs: number;
  private readonly electionDelayMs: number;
  private readonly peers = new Map<string, number>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private electionTimer: ReturnType<typeof setTimeout> | null = null;
  private leader = false;
  private stopped = false;

  constructor({
    tabId,
    channel,
    onLeadershipChange,
    now = Date.now,
    heartbeatMs = 1_000,
    leaseMs = 3_500,
    electionDelayMs = 120,
  }: AutosaveLeaderCoordinatorOptions) {
    this.tabId = tabId;
    this.channel = channel;
    this.onLeadershipChange = onLeadershipChange;
    this.now = now;
    this.heartbeatMs = heartbeatMs;
    this.leaseMs = leaseMs;
    this.electionDelayMs = electionDelayMs;
  }

  start() {
    this.channel.onmessage = (event) => this.handleMessage(event.data);
    this.post("presence");
    this.scheduleElection(this.electionDelayMs);
    this.heartbeatTimer = setInterval(() => {
      this.post("presence");
      this.elect();
      if (this.leader) {
        this.post("heartbeat");
      }
    }, this.heartbeatMs);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.leader) {
      this.post("resign");
    }
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.electionTimer) clearTimeout(this.electionTimer);
    this.channel.onmessage = null;
    this.channel.close();
  }

  private handleMessage(message: AutosaveLeaderMessage) {
    if (this.stopped || !message || message.tabId === this.tabId) return;

    if (message.type === "resign") {
      this.peers.delete(message.tabId);
      this.scheduleElection(0);
      return;
    }

    this.peers.set(message.tabId, this.now());
    if (message.type === "presence" && this.leader) {
      this.post("heartbeat");
    }
    this.scheduleElection(0);
  }

  private scheduleElection(delay: number) {
    if (this.electionTimer) clearTimeout(this.electionTimer);
    this.electionTimer = setTimeout(() => {
      this.electionTimer = null;
      this.elect();
    }, delay);
  }

  private elect() {
    if (this.stopped) return;

    const cutoff = this.now() - this.leaseMs;
    this.peers.forEach((lastSeen, peerId) => {
      if (lastSeen < cutoff) {
        this.peers.delete(peerId);
      }
    });

    const electedId = [this.tabId, ...Array.from(this.peers.keys())].sort()[0];
    const nextLeader = electedId === this.tabId;
    if (nextLeader === this.leader) return;

    this.leader = nextLeader;
    this.onLeadershipChange(nextLeader);
    if (nextLeader) {
      this.post("heartbeat");
    }
  }

  private post(type: AutosaveLeaderMessage["type"]) {
    this.channel.postMessage({ type, tabId: this.tabId, sentAt: this.now() });
  }
}

export function createAutosaveTabId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
