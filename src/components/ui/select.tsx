import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  id?: string;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ value, onValueChange, options, placeholder, className, label, error, disabled, id }, ref) => {
    const [open, setOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const selectedOption = options.find((opt) => opt.value === value);

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Close on Escape
    React.useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      if (open) {
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
      }
    }, [open]);

    const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1" ref={containerRef}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium leading-none"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <button
            ref={ref}
            id={selectId}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setOpen(!open)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setOpen(!open);
              }
            }}
            className={cn(
              "flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm",
              "border-border text-foreground",
              "ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-destructive",
              className
            )}
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className={cn(!selectedOption && placeholder && "text-muted-foreground")}>
              {selectedOption ? selectedOption.label : placeholder || "请选择"}
            </span>
            <svg
              className={cn("h-4 w-4 ml-2 shrink-0 opacity-50 transition-transform", open && "rotate-180")}
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {open && (
            <div
              className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover text-popover-foreground shadow-md overflow-hidden"
              role="listbox"
            >
              {options.map((opt) => (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={opt.value === value}
                  tabIndex={0}
                  className={cn(
                    "relative cursor-default select-none px-3 py-2 text-sm outline-none",
                    "hover:bg-accent hover:text-accent-foreground",
                    opt.value === value && "bg-accent text-accent-foreground font-medium"
                  )}
                  onClick={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onValueChange(opt.value);
                      setOpen(false);
                    }
                  }}
                >
                  {opt.label}
                </div>
              ))}
              {options.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  无选项
                </div>
              )}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
export type { SelectOption };
