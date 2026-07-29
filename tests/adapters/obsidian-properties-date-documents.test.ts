// @vitest-environment happy-dom

import { Window } from "happy-dom";
import { describe, expect, it, vi } from "vitest";

import type { ObsidianPropertiesDateDisplay } from "../../src/adapters/obsidian/obsidian-properties-date-display";
import { ObsidianPropertiesDateDocuments } from "../../src/adapters/obsidian/obsidian-properties-date-documents";
import type { ObsidianPropertiesDateInterceptor } from "../../src/adapters/obsidian/obsidian-properties-date-interceptor";

describe("Obsidian Properties date documents", () => {
  it("keeps display and click interception aligned across existing and opened windows", () => {
    const popoutWindow = new Window();
    const popoutDocument = popoutWindow.document as unknown as Document;
    const display = {
      addDocument: vi.fn(),
      removeDocument: vi.fn(),
      dispose: vi.fn(),
    } as unknown as ObsidianPropertiesDateDisplay;
    const interceptor = {
      handleClick: vi.fn(),
    } as unknown as ObsidianPropertiesDateInterceptor;
    const documents = new ObsidianPropertiesDateDocuments(display, interceptor);

    documents.addDocument(document);
    documents.addDocument(document);
    documents.addDocument(popoutDocument);

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    popoutDocument.body.dispatchEvent(
      new popoutWindow.MouseEvent("click", { bubbles: true }) as unknown as MouseEvent,
    );

    expect(display.addDocument).toHaveBeenCalledTimes(2);
    expect(interceptor.handleClick).toHaveBeenCalledTimes(2);

    documents.removeDocument(popoutDocument);
    documents.removeDocument(popoutDocument);
    popoutDocument.body.dispatchEvent(
      new popoutWindow.MouseEvent("click", { bubbles: true }) as unknown as MouseEvent,
    );

    expect(display.removeDocument).toHaveBeenCalledOnce();
    expect(interceptor.handleClick).toHaveBeenCalledTimes(2);

    documents.dispose();
    documents.dispose();
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(display.removeDocument).toHaveBeenCalledTimes(2);
    expect(display.dispose).toHaveBeenCalledOnce();
    expect(interceptor.handleClick).toHaveBeenCalledTimes(2);

    documents.addDocument(popoutDocument);
    expect(display.addDocument).toHaveBeenCalledTimes(2);
  });

  it("releases every click listener when one display removal fails", () => {
    const popoutWindow = new Window();
    const popoutDocument = popoutWindow.document as unknown as Document;
    const removeDocument = vi.fn()
      .mockImplementationOnce(() => {
        throw new Error("injected display removal failure");
      });
    const display = {
      addDocument: vi.fn(),
      removeDocument,
      dispose: vi.fn(),
    } as unknown as ObsidianPropertiesDateDisplay;
    const interceptor = {
      handleClick: vi.fn(),
    } as unknown as ObsidianPropertiesDateInterceptor;
    const documents = new ObsidianPropertiesDateDocuments(display, interceptor);
    documents.addDocument(document);
    documents.addDocument(popoutDocument);

    expect(() => documents.dispose()).toThrow("injected display removal failure");

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    popoutDocument.body.dispatchEvent(
      new popoutWindow.MouseEvent("click", { bubbles: true }) as unknown as MouseEvent,
    );
    expect(interceptor.handleClick).not.toHaveBeenCalled();
    expect(removeDocument).toHaveBeenCalledTimes(2);
    expect(display.dispose).toHaveBeenCalledOnce();
  });

  it("removes a partially attached display when document setup fails", () => {
    const setupError = new Error("injected display setup failure");
    const display = {
      addDocument: vi.fn(() => {
        throw setupError;
      }),
      removeDocument: vi.fn(),
      dispose: vi.fn(),
    } as unknown as ObsidianPropertiesDateDisplay;
    const interceptor = {
      handleClick: vi.fn(),
    } as unknown as ObsidianPropertiesDateInterceptor;
    const documents = new ObsidianPropertiesDateDocuments(display, interceptor);

    expect(() => documents.addDocument(document)).toThrow(setupError);
    expect(display.removeDocument).toHaveBeenCalledWith(document);

    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(interceptor.handleClick).not.toHaveBeenCalled();
  });
});
