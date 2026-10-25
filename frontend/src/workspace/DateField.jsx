import { useState } from "react";
import { it } from "date-fns/locale";
import { format, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";

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
      <PopoverContent className="ws-cal" align="start" data-testid={`${testid}-calendar`}>
        <Calendar mode="single" locale={it} weekStartsOn={1} selected={sel} defaultMonth={sel}
          onSelect={(d) => { onChange(d ? format(d, "yyyy-MM-dd") : ""); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}
