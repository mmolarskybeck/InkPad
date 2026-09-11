import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Fake Worker: records posted messages, lets tests answer them, and lets tests
 * simulate a crash. Instances are tracked so reuse can be asserted.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  posted: any[] = [];
  terminated = false;
  constructor() {
    FakeWorker.instances.push(this);
  }
  postMessage(data: any) {
    this.posted.push(data);
  }
  terminate() {
    this.terminated = true;
  }
  respond(requestId: string, storyJson = '{"inkVersion":21,"root":[["^ok","\\n",["done",{"#n":"g-0"}],null],"done",{}],"listDefs":{}}') {
    this.onmessage?.({ data: { type: "compile-success", requestId, storyJson, warnings: [] } } as MessageEvent);
  }
  crash(message = "boom") {
    this.onerror?.(new ErrorEvent("error", { message }));
  }
}

vi.mock("../workers/ink-compiler.worker?worker", () => ({ default: FakeWorker }));

describe("shared compiler worker lifecycle", () => {
  beforeEach(() => {
    FakeWorker.instances = [];
    vi.resetModules();
  });
  afterEach(async () => {
    const mod = await import("./ink-compiler");
    mod.disposeCompilerWorker();
  });

  it("reuses one worker across compiles and routes responses by requestId", async () => {
    const { compileInkScript } = await import("./ink-compiler");
    const first = compileInkScript("Hello", "req-1");
    const second = compileInkScript("Hello again", "req-2");

    expect(FakeWorker.instances).toHaveLength(1);
    const worker = FakeWorker.instances[0];
    expect(worker.posted.map((m) => m.requestId)).toEqual(["req-1", "req-2"]);

    // Answer out of order; each promise must get its own response.
    worker.respond("req-2");
    worker.respond("req-1");
    const [r1, r2] = await Promise.all([first, second]);
    expect(r1.requestId).toBe("req-1");
    expect(r2.requestId).toBe("req-2");
    expect(r1.runtimeStory).not.toBeNull();
    expect(worker.terminated).toBe(false);
  });

  it("ignores responses for unknown or already-settled requests", async () => {
    const { compileInkScript } = await import("./ink-compiler");
    const pending = compileInkScript("Hello", "req-1");
    const worker = FakeWorker.instances[0];
    worker.respond("req-unknown");
    worker.respond("req-1");
    worker.respond("req-1");
    await expect(pending).resolves.toMatchObject({ requestId: "req-1" });
  });

  it("rejects pending compiles on crash and creates a fresh worker next time", async () => {
    const { compileInkScript } = await import("./ink-compiler");
    const pending = compileInkScript("Hello", "req-1");
    FakeWorker.instances[0].crash("worker died");

    const failed = await pending;
    expect(failed.runtimeStory).toBeNull();
    expect(failed.errors[0]?.message).toContain("worker died");
    expect(FakeWorker.instances[0].terminated).toBe(true);

    const next = compileInkScript("Hello", "req-2");
    expect(FakeWorker.instances).toHaveLength(2);
    FakeWorker.instances[1].respond("req-2");
    await expect(next).resolves.toMatchObject({ requestId: "req-2" });
  });
});
