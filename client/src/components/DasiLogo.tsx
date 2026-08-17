/** The Dasi mark: a soft rounded tile with a bookmark notch, in the pastel lilac→mint gradient. */
export function DasiLogo({ size = 28 }: { size?: number }) {
  return (
    <span className="dasi-logo" style={{ width: size, height: size }} aria-hidden>
      <i />
    </span>
  );
}

/**
 * Loading indicator: the Dasi logo silhouette spinning inside a conic ring of the
 * brand pastels. Motion is disabled under prefers-reduced-motion via CSS.
 */
export function DasiLoader({ label }: { label?: string }) {
  return (
    <div className="dasi-loader-wrap" role="status" aria-live="polite">
      <div className="dasi-loader">
        <span className="dasi-loader-core">
          <i />
        </span>
      </div>
      {label ? <span className="dasi-loader-label">{label}</span> : null}
    </div>
  );
}
