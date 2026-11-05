// The web app, the classic extension worker and its file picker use the same import rules.
(() => {
  // Compare page numbers within their chapter and playback times within their episode.
  function positionOf(item) {
    const n = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
    if (item.type === "reading") return [n(item.volume) || 1, n(item.chapter), n(item.page)];
    if (item.type === "game") return [1, n(item.progress), 0];
    return [n(item.season) || 1, n(item.episode), n(item.position)];
  }

  function importedPosition(saved, incoming, suppliedProgress = Number.isFinite(incoming.progress)) {
    const previous = positionOf(saved);
    const next = positionOf(incoming);
    const sameScope = next[0] === previous[0];
    const sameUnit = sameScope && next[1] === previous[1];
    const difference = next[0] - previous[0] || next[1] - previous[1] || next[2] - previous[2];
    // A season number on its own does not establish a new viewing position.
    const advances = difference > 0 && (sameScope || next[1] > 0);
    const winner = advances ? incoming : saved;
    const other = advances ? saved : incoming;
    const total = sameScope ? Math.max(saved.total || 0, incoming.total || 0) || undefined : winner.total;
    const validTotal = total && total >= positionOf(winner)[1] ? total : undefined;
    let progress = Number(winner.progress) || 0;
    if (difference === 0) progress = Math.max(Number(saved.progress) || 0, Number(incoming.progress) || 0);
    else if (advances && !suppliedProgress && validTotal) progress = Math.round(100 * next[1] / validTotal);
    else if (advances && !suppliedProgress && sameScope) progress = Number(saved.progress) || 0;

    const fields = {progress, total: validTotal};
    if (saved.type === "reading") Object.assign(fields, {
      volume: winner.volume ?? (sameScope ? other.volume : undefined), chapter: winner.chapter,
      page: winner.page ?? (sameUnit ? other.page : undefined),
      totalPages: winner.totalPages ?? (sameUnit ? other.totalPages : undefined),
    });
    if (saved.type !== "reading" && saved.type !== "game") Object.assign(fields, {
      season: winner.season ?? (sameScope ? other.season : undefined), episode: winner.episode,
      position: winner.position ?? (sameUnit ? other.position : undefined),
      duration: winner.duration ?? (sameUnit ? other.duration : undefined),
      episodeTitle: winner.episodeTitle || (sameUnit ? other.episodeTitle : undefined),
    });
    return {advances, difference, fields};
  }
  globalThis.YomuImportedPosition = importedPosition;
})();
