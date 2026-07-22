export function preparePathInput(
  inputEl: HTMLInputElement | HTMLTextAreaElement,
): void {
  inputEl.setAttribute("autocapitalize", "off");
  inputEl.setAttribute("autocomplete", "off");
  inputEl.spellcheck = false;
}
