import { useEffect, useRef, useState } from "react";
import { Bell, BookOpen, Clock, Film } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useStore } from "@/store/StoreContext";
import { relativeTime } from "@/lib/format";
import type { NotificationKind } from "@/lib/types";

function KindIcon({ kind }: { kind: NotificationKind }) {
  if (kind === "new_chapter") return <BookOpen size={15} />;
  if (kind === "new_episode") return <Film size={15} />;
  return <Clock size={15} />;
}

/** Bell + dropdown. The bell rings (CSS) and shows a live pulse dot when unread. */
export function Notifications() {
  const { t } = useI18n();
  const { notifications, markAllRead } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="notif" ref={ref}>
      <button
        className={`notif-bell ${unread ? "has-unread" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={t("notif.title")}
      >
        <Bell size={18} />
        {unread > 0 && <i className="notif-dot" />}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label={t("notif.title")}>
          <header>
            <strong>{t("notif.title")}</strong>
            {unread > 0 && (
              <button onClick={markAllRead} className="notif-clear">
                {t("notif.markAll")}
              </button>
            )}
          </header>
          {notifications.length === 0 ? (
            <p className="notif-empty">{t("notif.empty")}</p>
          ) : (
            <ul>
              {notifications.slice(0, 8).map((n) => (
                <li key={n.id} className={`notif-item ${n.read ? "" : "unread"}`}>
                  <span className="notif-icon">
                    <KindIcon kind={n.kind} />
                  </span>
                  <div>
                    <strong>{n.title}</strong>
                    <p>{n.body}</p>
                    <small>{relativeTime(n.createdAt, t)}</small>
                  </div>
                  {!n.read && <i className="notif-unread-dot" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
