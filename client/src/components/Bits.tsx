import type { ReactNode } from "react";
import type { LibraryItem } from "@/lib/types";

/** Hide a broken cover image so its color block (and initial) shows instead of a broken-image icon. */
export function onImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
  const holder = e.currentTarget.parentElement;
  if (holder && !holder.querySelector(".img-fallback")) {
    const span = document.createElement("span");
    span.className = "img-fallback";
    span.textContent = holder.getAttribute("data-initial") || "";
    holder.appendChild(span);
  }
}

export function Progress({ value, accent = "#6CBE9E" }: { value: number; accent?: string }) {
  return (
    <div className="progress-track">
      <div className="progress-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: accent }} />
    </div>
  );
}

/** Accent color for a progress fill based on the item type. */
export function itemAccent(item: LibraryItem): string {
  return item.type === "watching" ? "#8EA8E7" : "#6CBE9E";
}

export function Cover({ item, className = "" }: { item: LibraryItem; className?: string }) {
  return (
    <div className={className} style={{ background: item.accent }} data-initial={item.title[0]}>
      {item.cover ? <img src={item.cover} alt="" loading="lazy" onError={onImgError} /> : <span>{item.title[0]}</span>}
    </div>
  );
}

export function Pill({
  children,
  active = false,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button onClick={onClick} className={`category-pill ${active ? "active" : ""}`}>
      {children}
    </button>
  );
}
