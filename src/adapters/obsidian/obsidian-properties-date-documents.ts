import type { ObsidianPropertiesDateDisplay } from "./obsidian-properties-date-display";
import type { ObsidianPropertiesDateInterceptor } from "./obsidian-properties-date-interceptor";

interface ManagedPropertiesDateDocument {
  readonly clickTarget: EventTarget;
  readonly handleClick: EventListener;
}

/**
 * Keeps Properties date presentation and click interception attached to the
 * same set of documents, including Obsidian popout windows.
 */
export class ObsidianPropertiesDateDocuments {
  private readonly documents = new Map<Document, ManagedPropertiesDateDocument>();
  private disposed = false;

  constructor(
    private readonly display: ObsidianPropertiesDateDisplay,
    private readonly interceptor: ObsidianPropertiesDateInterceptor,
  ) {}

  addDocument(document: Document): void {
    if (this.disposed || this.documents.has(document)) return;

    const clickTarget: EventTarget = document.defaultView ?? document;
    const handleClick: EventListener = (event) => {
      this.interceptor.handleClick(event as MouseEvent);
    };

    try {
      this.display.addDocument(document);
      clickTarget.addEventListener("click", handleClick, true);
    } catch (error) {
      try {
        this.display.removeDocument(document);
      } catch (cleanupError) {
        throw new AggregateError(
          [toError(error), toError(cleanupError)],
          "Failed to attach Properties date document resources.",
        );
      }
      throw toError(error);
    }
    this.documents.set(document, { clickTarget, handleClick });
  }

  removeDocument(document: Document): void {
    const managed = this.documents.get(document);
    if (managed === undefined) return;

    this.documents.delete(document);
    try {
      managed.clickTarget.removeEventListener("click", managed.handleClick, true);
    } finally {
      this.display.removeDocument(document);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    let firstError: Error | null = null;
    for (const document of [...this.documents.keys()]) {
      try {
        this.removeDocument(document);
      } catch (error) {
        firstError ??= toError(error);
      }
    }
    try {
      this.display.dispose();
    } catch (error) {
      firstError ??= toError(error);
    }

    if (firstError !== null) throw firstError;
  }
}

function toError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("Properties date document cleanup failed.", { cause: error });
}
