import { Check } from "lucide-react";
import { LIST_COLORS } from "@/store/StoreContext";

/** Row of pastel color chips for list personalization. */
export function ColorSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="swatches">
      {LIST_COLORS.map((c) => (
        <button
          key={c}
          className={`swatch ${value === c ? "selected" : ""}`}
          style={{ ["--swatch" as string]: c }}
          onClick={() => onChange(c)}
          aria-label={c}
          aria-pressed={value === c}
        >
          {value === c && <Check size={13} />}
        </button>
      ))}
    </div>
  );
}
