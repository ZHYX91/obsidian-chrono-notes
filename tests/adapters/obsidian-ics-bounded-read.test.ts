import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("obsidian", () => ({ TFile: class {} }));

import { MAX_ICS_SOURCE_BYTES } from "../../src/core/calendar/ics-calendar";
import { ObsidianIcsSourceReader } from "../../src/adapters/obsidian/obsidian-ics-source-reader";

function setup(content: Uint8Array, options: { size?: number; file?: boolean; fail?: boolean } = {}) {
  const read = vi.fn(async (buffer: Uint8Array, offset: number, length: number, position: number) => {
    if (options.fail) throw new Error("read failed");
    // Deliberately short reads verify that a partial chunk is not treated as EOF.
    const chunk = content.subarray(position, position + Math.min(length, 7777));
    buffer.set(chunk, offset);
    return { bytesRead: chunk.length };
  });
  const close = vi.fn(async () => {});
  const open = vi.fn(async () => ({
    stat: async () => ({ size: options.size ?? 0, isFile: () => options.file ?? true }),
    read,
    close,
  }));
  const stat = vi.fn(async () => ({ size: 0, isFile: (): boolean => true }));
  vi.stubGlobal("window", { require: (id: string) => {
    if (id === "node:fs/promises") return { open, stat };
    if (id === "node:fs") return { constants: { O_RDONLY: 0, O_NONBLOCK: 2048 } };
    throw new Error(`Unexpected module ${id}`);
  } });
  const reader = new ObsidianIcsSourceReader({
    getAbstractFileByPath: () => null,
    adapter: {},
  } as never);
  return { reader, open, stat, read, close };
}

describe("bounded local ICS reads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stops at limit plus one byte when a file grows after stat", async () => {
    const { reader, open, read, close } = setup(new Uint8Array(MAX_ICS_SOURCE_BYTES + 100));
    await expect(reader.read("/fixture/growing.ics")).rejects.toThrow("exceeds");
    const last = read.mock.calls.at(-1)!;
    expect(last[1] + last[2]).toBe(MAX_ICS_SOURCE_BYTES + 1);
    expect(open).toHaveBeenCalledWith("/fixture/growing.ics", 2048);
    expect(close).toHaveBeenCalledOnce();
  });

  it("accepts short reads and preserves multibyte characters across chunks", async () => {
    const content = "中📅".repeat(3000);
    const { reader, read, close } = setup(new TextEncoder().encode(content));
    await expect(reader.read("C:\\fixture\\source.ics")).resolves.toBe(content);
    expect(read.mock.calls.length).toBeGreaterThan(2);
    expect(close).toHaveBeenCalledOnce();
  });

  it.each([{ size: MAX_ICS_SOURCE_BYTES + 1 }, { file: false }])(
    "rechecks the opened handle when the path changes: %j", async (options) => {
      const { reader, read, close } = setup(new Uint8Array(), options);
      await expect(reader.read("/fixture/replaced.ics")).rejects.toThrow();
      expect(read).not.toHaveBeenCalled();
      expect(close).toHaveBeenCalledOnce();
    },
  );

  it("closes the handle on read failure", async () => {
    const { reader, close } = setup(new Uint8Array(), { fail: true });
    await expect(reader.read("\\\\server\\share\\source.ics")).rejects.toThrow("read failed");
    expect(close).toHaveBeenCalledOnce();
  });

  it("rejects known special files before opening", async () => {
    const { reader, stat, open } = setup(new Uint8Array());
    stat.mockResolvedValue({ size: 0, isFile: () => false });
    await expect(reader.read("/fixture/pipe.ics")).rejects.toThrow("regular file");
    expect(open).not.toHaveBeenCalled();
  });
});
