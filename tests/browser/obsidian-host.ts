// Only the Obsidian primitives used by the settings fixture are simulated.
// Product tab routing, settings controls, saving, translations and CSS stay real.
export class PluginSettingTab {
  readonly containerEl = document.createElement("div");
  constructor(readonly app: unknown) {}
  hide(): void {}
}

export class AbstractInputSuggest {}
export function prepareFuzzySearch(): () => null { return () => null; }
export function renderResults(): void {}

function track(result: unknown): void {
  window.chronoSettingsPending = Promise.resolve(result);
}

class Dropdown {
  readonly selectEl = document.createElement("select");
  addOption(value: string, label: string): this {
    this.selectEl.add(new Option(label, value));
    return this;
  }
  setValue(value: string): this { this.selectEl.value = value; return this; }
  onChange(callback: (value: string) => unknown): this {
    this.selectEl.addEventListener("change", () => track(callback(this.selectEl.value)));
    return this;
  }
}

class Toggle {
  readonly inputEl = document.createElement("input");
  constructor() { this.inputEl.type = "checkbox"; }
  setValue(value: boolean): this { this.inputEl.checked = value; return this; }
  onChange(callback: (value: boolean) => unknown): this {
    this.inputEl.addEventListener("change", () => track(callback(this.inputEl.checked)));
    return this;
  }
}

class TextArea {
  readonly inputEl = document.createElement("textarea");
  setPlaceholder(value: string): this { this.inputEl.placeholder = value; return this; }
  setValue(value: string): this { this.inputEl.value = value; return this; }
  onChange(callback: (value: string) => unknown): this {
    this.inputEl.addEventListener("input", () => track(callback(this.inputEl.value)));
    return this;
  }
}

class Button {
  readonly buttonEl = document.createElement("button");
  setButtonText(value: string): this { this.buttonEl.textContent = value; return this; }
  setDisabled(value: boolean): this { this.buttonEl.disabled = value; return this; }
  onClick(callback: () => unknown): this {
    this.buttonEl.addEventListener("click", () => track(callback()));
    return this;
  }
}

export class Setting {
  readonly settingEl: HTMLElement;
  readonly nameEl: HTMLElement;
  readonly descEl: HTMLElement;
  readonly controlEl: HTMLElement;
  constructor(container: HTMLElement) {
    this.settingEl = container.createDiv({ cls: "setting-item" });
    const infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
    this.nameEl = infoEl.createDiv({ cls: "setting-item-name" });
    this.descEl = infoEl.createDiv({ cls: "setting-item-description" });
    this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" });
  }
  setName(value: string): this { this.nameEl.textContent = value; return this; }
  setDesc(value: string): this { this.descEl.textContent = value; return this; }
  addDropdown(configure: (component: Dropdown) => void): this {
    const component = new Dropdown();
    this.controlEl.appendChild(component.selectEl);
    configure(component);
    return this;
  }
  addToggle(configure: (component: Toggle) => void): this {
    const component = new Toggle();
    this.controlEl.appendChild(component.inputEl);
    configure(component);
    return this;
  }
  addTextArea(configure: (component: TextArea) => void): this {
    const component = new TextArea();
    this.controlEl.appendChild(component.inputEl);
    configure(component);
    return this;
  }
  addButton(configure: (component: Button) => void): this {
    const component = new Button();
    this.controlEl.appendChild(component.buttonEl);
    configure(component);
    return this;
  }
}
