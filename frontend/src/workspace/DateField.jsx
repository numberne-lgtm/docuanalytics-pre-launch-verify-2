import { useState } from "react";
import { it } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

export default function DateField({ value, onChange, testid }) {
  const [open, setOpen] = useState(false);
  const sel = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="as-input ws-date-btn" data-testid={testid}>
          <CalendarDays size={15} /> {sel ? format(sel, "dd/MM/yyyy") : <span className="ws-muted">gg/mm/aaaa</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="ws-cal" align="start" collisionPadding={8} data-testid={`${testid}-calendar`}>
        <DayPicker mode="single" required locale={it} weekStartsOn={1} selected={sel} defaultMonth={sel} showOutsideDays
          onSelect={(d) => { if (d) onChange(format(d, "yyyy-MM-dd")); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}
