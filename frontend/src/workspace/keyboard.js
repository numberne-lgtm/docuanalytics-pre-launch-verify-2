// Shared list interaction for Documenti, Clienti, Priorità and Scadenze.
const ROW = "[data-ws-nav-row]";
const EDITING = "input:not([type='checkbox']), textarea, select, [contenteditable='true'], [role='textbox']";
const INTERACTIVE = "button, a, input, textarea, select, label, summary, [role='button']";

export function navigationRows(list) {
  if (!list) return [];
  return [...list.querySelectorAll(ROW)].filter((row) => {
    const owner = row.closest("[data-ws-nav-list]");
    return !owner || owner === list;
  });
}

function primaryControl(row) {
  if (row.matches("button:not(:disabled)")) return row;
  return row.querySelector("[data-ws-nav-target]:not(:disabled)") ||
    (row.hasAttribute("tabindex") ? row : null) ||
    row.querySelector("button:not(:disabled)");
}

export function focusListRow(list, key) {
  if (!list) return false;
  const rows = navigationRows(list);
  const row = rows.find((item) => key && item.dataset.wsNavKey === key) || rows[0];
  const control = row && primaryControl(row);
  if (!control) return false;
  control.focus({ preventScroll: true });
  return true;
}

export function markActiveRow(event) {
  const list = event.currentTarget;
  const row = event.target.closest?.(ROW);
  if (!row || !list.contains(row) || !navigationRows(list).includes(row)) return;
  for (const item of navigationRows(list)) {
    if (item === row) item.setAttribute("data-ws-selected", "true");
    else item.removeAttribute("data-ws-selected");
  }
}

// A click on unused card space selects its main action without activating
// destructive/secondary buttons. Native buttons and form controls keep their behaviour.
export function selectRowWithMouse(event) {
  if (event.target.closest?.(INTERACTIVE)) return;
  const row = event.target.closest?.(ROW);
  if (row && navigationRows(event.currentTarget).includes(row)) {
    primaryControl(row)?.focus({ preventScroll: true });
  }
}

export function navigateRows(event) {
  if (!["ArrowDown", "ArrowUp"].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest?.(EDITING)) return;
  const list = event.currentTarget;
  const row = event.target.closest?.(ROW);
  if (!row) return;
  const rows = navigationRows(list);
  const index = rows.indexOf(row);
  if (index < 0) return;
  event.preventDefault();
  const next = rows[index + (event.key === "ArrowDown" ? 1 : -1)];
  if (next) primaryControl(next)?.focus({ preventScroll: true });
}
