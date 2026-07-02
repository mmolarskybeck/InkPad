import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AutosaveLeaderCoordinator,
  type AutosaveChannel,
  type AutosaveLeaderMessage,
} from "./autosave-leader";

class FakeBus {
  channels = new Set<FakeChannel>();

  createChannel() {
    const channel = new FakeChannel(this);
    this.channels.add(channel);
    return channel;
  }

  send(sender: FakeChannel, message: AutosaveLeaderMessage) {
    for (const channel of this.channels) {
      if (channel !== sender && !channel.closed) {
        channel.onmessage?.({ data: message } as MessageEvent<AutosaveLeaderMessage>);
      }
    }
  }
}

class FakeChannel implements AutosaveChannel {
  onmessage: ((event: MessageEvent<AutosaveLeaderMessage>) => void) | null = null;
  closed = false;

  constructor(private readonly bus: FakeBus) {}

  postMessage(message: AutosaveLeaderMessage) {
    this.bus.send(this, message);
  }

  close() {
    this.closed = true;
    this.bus.channels.delete(this);
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AutosaveLeaderCoordinator", () => {
  it("elects exactly one deterministic leader", () => {
    vi.useFakeTimers();
    const bus = new FakeBus();
    const states = new Map<string, boolean>();
    const coordinators = ["tab-b", "tab-a", "tab-c"].map((tabId) => {
      const coordinator = new AutosaveLeaderCoordinator({
        tabId,
        channel: bus.createChannel(),
        onLeadershipChange: (leader) => states.set(tabId, leader),
      });
      coordinator.start();
      return coordinator;
    });

    vi.advanceTimersByTime(200);
    expect(states.get("tab-a")).toBe(true);
    expect([...states.values()].filter(Boolean)).toHaveLength(1);
    coordinators.forEach((coordinator) => coordinator.stop());
  });

  it("lets a follower take over immediately when the leader resigns", () => {
    vi.useFakeTimers();
    const bus = new FakeBus();
    const states = new Map<string, boolean>();
    const leader = new AutosaveLeaderCoordinator({
      tabId: "tab-a",
      channel: bus.createChannel(),
      onLeadershipChange: (value) => states.set("tab-a", value),
    });
    const follower = new AutosaveLeaderCoordinator({
      tabId: "tab-b",
      channel: bus.createChannel(),
      onLeadershipChange: (value) => states.set("tab-b", value),
    });

    leader.start();
    follower.start();
    vi.advanceTimersByTime(200);
    expect(states.get("tab-a")).toBe(true);

    leader.stop();
    vi.advanceTimersByTime(1);
    expect(states.get("tab-b")).toBe(true);
    follower.stop();
  });

  it("takes over after a silent leader lease expires", () => {
    vi.useFakeTimers();
    const bus = new FakeBus();
    let followerIsLeader = false;
    const silentLeaderChannel = bus.createChannel();
    const follower = new AutosaveLeaderCoordinator({
      tabId: "tab-b",
      channel: bus.createChannel(),
      heartbeatMs: 100,
      leaseMs: 300,
      electionDelayMs: 10,
      onLeadershipChange: (value) => {
        followerIsLeader = value;
      },
    });

    follower.start();
    silentLeaderChannel.postMessage({
      type: "heartbeat",
      tabId: "tab-a",
      sentAt: Date.now(),
    });
    vi.advanceTimersByTime(20);
    expect(followerIsLeader).toBe(false);

    silentLeaderChannel.close();
    vi.advanceTimersByTime(400);
    expect(followerIsLeader).toBe(true);
    follower.stop();
  });

  it("responds to a late presence using current leadership state", () => {
    vi.useFakeTimers();
    const bus = new FakeBus();
    const leaderChannel = bus.createChannel();
    const messages: AutosaveLeaderMessage[] = [];
    const observer = bus.createChannel();
    observer.onmessage = (event) => messages.push(event.data);
    const leader = new AutosaveLeaderCoordinator({
      tabId: "tab-a",
      channel: leaderChannel,
      onLeadershipChange: () => {},
    });

    leader.start();
    vi.advanceTimersByTime(200);
    observer.postMessage({ type: "presence", tabId: "tab-z", sentAt: Date.now() });

    expect(messages.some((message) => (
      message.type === "heartbeat" && message.tabId === "tab-a"
    ))).toBe(true);
    leader.stop();
  });
});
