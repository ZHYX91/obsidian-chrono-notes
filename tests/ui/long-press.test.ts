import { describe, expect, it, vi } from "vitest";

import {
  bindLongPress,
  LongPressGesture,
  type LongPressClock,
} from "../../src/ui/calendar/long-press";

class FakeClock implements LongPressClock {
  private nextHandle = 1;
  private readonly callbacks = new Map<number, () => void>();

  setTimeout(callback: () => void, _delay: number): number {
    const handle = this.nextHandle++;
    this.callbacks.set(handle, callback);
    return handle;
  }

  clearTimeout(handle: number): void {
    this.callbacks.delete(handle);
  }

  fireAll(): void {
    const callbacks = [...this.callbacks.values()];
    this.callbacks.clear();
    for (const callback of callbacks) callback();
  }

  get pending(): number {
    return this.callbacks.size;
  }
}

describe("LongPressGesture", () => {
  it("fires after 500ms and consumes exactly one synthetic click", () => {
    const clock = new FakeClock();
    const open = vi.fn();
    const gesture = new LongPressGesture(clock);

    gesture.start(open);
    expect(clock.pending).toBe(1);
    clock.fireAll();

    expect(open).toHaveBeenCalledOnce();
    expect(gesture.consumeClick()).toBe(true);
    expect(gesture.consumeClick()).toBe(false);
  });

  it.each(["move", "end", "cancel"] as const)("cancels on touch %s", (event) => {
    const clock = new FakeClock();
    const open = vi.fn();
    const gesture = new LongPressGesture(clock);

    gesture.start(open);
    gesture[event]();
    clock.fireAll();

    expect(open).not.toHaveBeenCalled();
    expect(gesture.consumeClick()).toBe(false);
  });

  it("replaces a pending press and clears work when disposed", () => {
    const clock = new FakeClock();
    const first = vi.fn();
    const second = vi.fn();
    const gesture = new LongPressGesture(clock);

    gesture.start(first);
    gesture.start(second);
    expect(clock.pending).toBe(1);
    gesture.dispose();
    clock.fireAll();

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it("binds the complete touch lifecycle to a reusable target action", () => {
    const clock = new FakeClock();
    const open = vi.fn();
    const gesture = new LongPressGesture(clock);
    const binding = bindLongPress(gesture, open);

    binding.onTouchStart();
    clock.fireAll();

    expect(open).toHaveBeenCalledOnce();
    expect(binding.consumeClick()).toBe(true);
    expect(binding.consumeClick()).toBe(false);

    binding.onTouchStart();
    binding.onTouchMove();
    clock.fireAll();
    binding.onTouchStart();
    binding.onTouchEnd();
    clock.fireAll();
    binding.onTouchStart();
    binding.onTouchCancel();
    clock.fireAll();

    expect(open).toHaveBeenCalledOnce();
  });

  it("lets a synthetic context menu claim a recognized date press", () => {
    const clock = new FakeClock();
    const open = vi.fn();
    const gesture = new LongPressGesture(clock);
    const binding = bindLongPress(gesture, open, {
      preferContextMenu: true,
    });

    binding.onTouchStart();
    clock.fireAll();
    expect(open).not.toHaveBeenCalled();

    binding.onContextMenu();
    binding.onTouchEnd();
    clock.fireAll();

    expect(open).not.toHaveBeenCalled();
    expect(binding.consumeClick()).toBe(true);
    expect(binding.consumeClick()).toBe(false);
  });

  it("keeps a note-opening fallback when no context menu is generated", () => {
    const clock = new FakeClock();
    const open = vi.fn();
    const gesture = new LongPressGesture(clock);
    const binding = bindLongPress(gesture, open, {
      preferContextMenu: true,
    });

    binding.onTouchStart();
    clock.fireAll();
    binding.onTouchEnd();
    expect(open).not.toHaveBeenCalled();

    clock.fireAll();

    expect(open).toHaveBeenCalledOnce();
    expect(binding.consumeClick()).toBe(true);
  });

  it("cancels a released fallback when contextmenu arrives in the next task", () => {
    const clock = new FakeClock();
    const open = vi.fn();
    const gesture = new LongPressGesture(clock);
    const binding = bindLongPress(gesture, open, {
      preferContextMenu: true,
    });

    binding.onTouchStart();
    clock.fireAll();
    binding.onTouchEnd();
    binding.onContextMenu();
    clock.fireAll();

    expect(open).not.toHaveBeenCalled();
    expect(binding.consumeClick()).toBe(true);
  });

  it("does not suppress an unrelated click after a recognized press is canceled", () => {
    const clock = new FakeClock();
    const open = vi.fn();
    const gesture = new LongPressGesture(clock);

    gesture.start(open, { preferContextMenu: true });
    clock.fireAll();
    gesture.cancel();

    expect(open).not.toHaveBeenCalled();
    expect(gesture.consumeClick()).toBe(false);
  });

  it("does not let an undelivered synthetic click suppress the next touch", () => {
    const clock = new FakeClock();
    const open = vi.fn();
    const gesture = new LongPressGesture(clock);

    gesture.start(open);
    clock.fireAll();
    expect(open).toHaveBeenCalledOnce();

    gesture.start(open);
    gesture.end();

    expect(gesture.consumeClick()).toBe(false);
  });
});
