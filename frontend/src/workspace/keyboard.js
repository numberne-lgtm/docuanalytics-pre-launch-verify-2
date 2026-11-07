export function navigateRows(event) {
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  if (event.target.closest("input:not([type='checkbox']), select, textarea, [contenteditable='true']")) return;
  const row = event.target.closest("[data-ws-nav-row]");
  if (!row) return;
  const rows = [...event.currentTarget.querySelectorAll("[data-ws-nav-row]")];
  const index = rows.indexOf(row);
  if (index < 0) return;
  event.preventDefault();
  const next = rows[index + (event.key === "ArrowDown" ? 1 : -1)];
  if (!next) return;
  const target = next.matches("button") ? next :
    next.querySelector("[data-ws-nav-target]:not(:disabled)") || next.querySelector("button:not(:disabled)");
  target?.focus();
}
