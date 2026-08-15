import { useState, useMemo, useCallback, useRef } from "react";
import { AvailabilityBlock, DAY_NAMES } from "../../lib/types";

const START_HOUR = 6; // 6 AM
const END_HOUR = 24; // midnight
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function cellKey(day: number, hour: number) {
  return `${day}-${hour}`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatHour(h: number) {
  const period = h >= 12 ? "PM" : "AM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
}

/** Expands stored HH:MM blocks into the set of hourly cells they cover (assumes hour-aligned data). */
function blocksToCells(blocks: AvailabilityBlock[]): Set<string> {
  const cells = new Set<string>();
  for (const b of blocks) {
    const startHour = Number(b.startTime.split(":")[0]);
    const endHour = Number(b.endTime.split(":")[0]);
    for (let h = startHour; h < endHour; h++) cells.add(cellKey(b.dayOfWeek, h));
  }
  return cells;
}

/** Collapses selected hourly cells back into contiguous per-day blocks for the API. */
function cellsToBlocks(cells: Set<string>): AvailabilityBlock[] {
  const blocks: AvailabilityBlock[] = [];
  for (let day = 0; day < 7; day++) {
    let runStart: number | null = null;
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      const has = h < END_HOUR && cells.has(cellKey(day, h));
      if (has && runStart === null) runStart = h;
      if (!has && runStart !== null) {
        blocks.push({ dayOfWeek: day, startTime: `${pad(runStart)}:00`, endTime: `${pad(h)}:00` });
        runStart = null;
      }
    }
  }
  return blocks;
}

export function DayTimeGrid({
  value,
  onChange,
}: {
  value: AvailabilityBlock[];
  onChange: (blocks: AvailabilityBlock[]) => void;
}) {
  const [cells, setCells] = useState<Set<string>>(() => blocksToCells(value));
  const dragMode = useRef<"add" | "remove" | null>(null);
  const isDragging = useRef(false);

  const totalHours = cells.size;

  const commit = useCallback(
    (next: Set<string>) => {
      setCells(next);
      onChange(cellsToBlocks(next));
    },
    [onChange],
  );

  const toggleCell = useCallback(
    (day: number, hour: number, forceMode?: "add" | "remove") => {
      const key = cellKey(day, hour);
      const next = new Set(cells);
      const mode = forceMode ?? (next.has(key) ? "remove" : "add");
      if (mode === "add") next.add(key);
      else next.delete(key);
      commit(next);
      return mode;
    },
    [cells, commit],
  );

  const grid = useMemo(() => {
    return (
      <div
        className="grid select-none rounded-xl2 overflow-hidden border border-pulse-100 dark:border-pulse-800"
        style={{ gridTemplateColumns: "3.5rem repeat(7, 1fr)" }}
        onMouseLeave={() => (isDragging.current = false)}
      >
        {/* Header row */}
        <div className="bg-pulse-50 dark:bg-pulse-900" />
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="bg-pulse-50 dark:bg-pulse-900 text-center text-xs font-mono font-bold py-2 text-pulse-700 dark:text-pulse-200"
          >
            {d}
          </div>
        ))}

        {HOURS.map((hour) => (
          <div className="contents" key={hour}>
            <div className="text-[10px] font-mono text-pulse-400 dark:text-pulse-300 text-right pr-2 py-1.5 border-t border-pulse-100 dark:border-pulse-800">
              {formatHour(hour)}
            </div>
            {DAY_NAMES.map((_, day) => {
              const key = cellKey(day, hour);
              const active = cells.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  aria-label={`${DAY_NAMES[day]} ${formatHour(hour)}${active ? ", free" : ", not free"}`}
                  className={`h-6 border-t border-l border-pulse-100 dark:border-pulse-800 transition-colors ${
                    active ? "bg-ember-500 hover:bg-ember-700" : "bg-white dark:bg-midnight hover:bg-pulse-50 dark:hover:bg-pulse-800"
                  }`}
                  onMouseDown={() => {
                    isDragging.current = true;
                    dragMode.current = toggleCell(day, hour);
                  }}
                  onMouseEnter={() => {
                    if (isDragging.current && dragMode.current) toggleCell(day, hour, dragMode.current);
                  }}
                  onMouseUp={() => (isDragging.current = false)}
                  onTouchStart={() => (dragMode.current = toggleCell(day, hour))}
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  }, [cells, toggleCell]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-pulse-700 dark:text-pulse-200">
          Click or drag across the grid to mark when you're usually free.
        </p>
        <span className="font-mono text-xs bg-pulse-50 dark:bg-pulse-800 text-pulse-700 dark:text-pulse-200 px-2 py-1 rounded-full">
          {totalHours}h/week
        </span>
      </div>
      {grid}
    </div>
  );
}
