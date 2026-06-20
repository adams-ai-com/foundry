# Foundry Sheets — Improvement Batch 2

**Branch:** `feat/sheets-polish-2`  
**Date:** 2026-06-20

## Features shipped

### 1. Strikethrough formatting
- `CellFormat.strikethrough?: boolean` added to actions.ts
- Toolbar button (S̶) between underline and alignment group
- Ctrl+S keyboard shortcut (when not in external input)
- Grid applies `line-through` Tailwind class

### 2. Status bar (SUM / COUNT / AVERAGE)
- `components/StatusBar.tsx` — sits below the sheet tabs, above the scrollable grid area
- Shows only when a range is selected or a cell has content
- COUNT: any non-empty cell; SUM + AVERAGE: numeric cells only
- Auto-updates reactively with selection changes

### 3. Ctrl+Arrow navigation
- Jumps to data-region boundary in the pressed direction — standard Excel/Sheets behaviour
- If current cell is non-empty and neighbour is non-empty: runs to last contiguous non-empty cell
- If current cell is non-empty and neighbour is empty: jumps to next non-empty (or grid edge)
- If current cell is empty: jumps to next non-empty (or grid edge)
- Works with Shift (extend selection) and standalone (move cursor)

### 4. Row resize
- Drag handle on the bottom edge of every row-number header
- Minimum height: 16 px
- Mirrors the existing column resize behaviour
- Row height is local UI state (not persisted to DB)

### 5. Insert / delete rows and columns (context menu)
- Right-click any **row header** → Insert row above / Insert row below / Delete row
- Right-click any **column header** → Insert col left / Insert col right / Delete col / Sort A→Z / Sort Z→A
- Operations go through `HyperFormulaContext` — cell formats shift with rows/cols correctly
- `components/ContextMenu.tsx` — fixed-position overlay, closes on click-outside or Escape

### 6. Sort column A→Z / Z→A
- Available via column-header right-click context menu
- Sorts ALL rows of the current sheet by the clicked column's computed value
- Cell formats move with the rows during sort
- ⚠️ Formulas with relative references are written back as-is — references may be incorrect after sort. Absolute references (e.g. `$A$1`) are unaffected. This is a known MVP limitation.

### 7. Freeze panes (row 1 / column A)
- Toolbar "freeze row" button (lock icon): toggles row 1 sticky (top: 24 px, below col headers)
- Toolbar "freeze col" button (pin icon): toggles col A sticky (left: 50 px, beside row headers)
- Both can be active simultaneously — the A1 intersection cell sticks at top:24 left:50
- State lives in `SheetContent`; passed to Grid as `frozenRows` / `frozenCols` props
- Uses CSS `position: sticky` — no virtual DOM splitting required

### 8. Auto-fill handle
- Small blue square at the bottom-right corner of the selected cell
- **Drag down/right:** fills with value+1, value+2... (numeric series) or copies text
- **Drag up/left:** fills with value−1, value−2... (decreasing series) or copies text
- Formulas are copied as-is (same relative-reference caveat as sort, above)
- During drag: dashed blue `fill-preview` outline on cells that will be filled
- Applies via `bulkSetCells` on mouseup (single HyperFormula transaction)

## Files changed

| File | Change |
|---|---|
| `lib/actions.ts` | + `strikethrough?: boolean` in CellFormat |
| `lib/hyperformula.ts` | + `addRows`, `removeRows`, `addColumns`, `removeColumns` (raw) |
| `lib/hyperformula-context.tsx` | + format-aware `addRow`, `deleteRow`, `addColumn`, `deleteColumn`, `sortColumn` |
| `app/globals.css` | + `.cell.fill-preview` dashed accent border |
| `components/StatusBar.tsx` | NEW |
| `components/ContextMenu.tsx` | NEW |
| `components/Grid.tsx` | row resize, Ctrl+Arrow, freeze sticky, fill handle, context menu callbacks |
| `components/Toolbar.tsx` | + strikethrough button, + freeze row / freeze col toggles |
| `components/SpreadsheetShell.tsx` | freeze state, context menu state + handlers, StatusBar render |
