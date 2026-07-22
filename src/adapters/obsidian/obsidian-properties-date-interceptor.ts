import type { LocalDate } from "../../core/periodic/periodic-date";
import { parsePropertyDateInput } from "../../features/periodic/property-date-click";

interface ElementLike {
  readonly value?: string;
  closest(selector: string): ElementLike | null;
  querySelector(selector: string): ElementLike | null;
}

interface ClickEventLike {
  readonly button: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly target: unknown;
  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
}

export interface ObsidianPropertiesDateInterceptorDependencies {
  readonly getEnabled: () => boolean;
  readonly isDailyConfigured: () => boolean;
  readonly openDaily: (date: LocalDate, target: "default" | "tab") => void | Promise<void>;
}

export class ObsidianPropertiesDateInterceptor {
  constructor(
    private readonly dependencies: ObsidianPropertiesDateInterceptorDependencies,
  ) {}

  handleClick(event: ClickEventLike): void {
    if (
      !this.dependencies.getEnabled()
      || !this.dependencies.isDailyConfigured()
      || event.button !== 0
    ) return;
    const target = toElementLike(event.target);
    if (target === null) return;

    const date = this.resolveDateIcon(target);
    if (date === null) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    void this.dependencies.openDaily(
      date,
      event.ctrlKey || event.metaKey ? "tab" : "default",
    );
  }

  private resolveDateIcon(target: ElementLike): LocalDate | null {
    const icon = target.closest(".clickable-icon");
    if (icon === null) return null;
    const property = icon.closest(".metadata-property-value[data-property-type=\"date\"]");
    if (property === null || property.closest(".metadata-properties") === null) return null;
    const input = property.querySelector("input[type=\"date\"]");
    return typeof input?.value === "string" ? parsePropertyDateInput(input.value) : null;
  }
}

function toElementLike(value: unknown): ElementLike | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<ElementLike>;
  return typeof candidate.closest === "function"
    && typeof candidate.querySelector === "function"
    ? candidate as ElementLike
    : null;
}
