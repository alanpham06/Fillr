/** Scroll a PDF page node into its nearest scrollport. */
export function scrollPageIntoView(node, behavior = "smooth") {
  if (!node || typeof node.scrollIntoView !== "function") {
    return;
  }
  node.scrollIntoView({ behavior, block: "start", inline: "nearest" });
}

/**
 * Watch stacked page blocks and report the one most visible in `root`.
 * Returns an unsubscribe function.
 */
export function observeVisiblePage(root, nodes, onPage, { threshold = 0.45 } = {}) {
  if (!root || typeof IntersectionObserver === "undefined") {
    return () => {};
  }
  const visible = new Map();
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const page = Number(entry.target.dataset.page);
        if (!Number.isFinite(page) || page < 1) {
          return;
        }
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
          visible.set(page, entry.intersectionRatio);
        } else {
          visible.delete(page);
        }
      });
      if (visible.size === 0) {
        return;
      }
      let bestPage = 0;
      let bestRatio = -1;
      visible.forEach((ratio, page) => {
        if (ratio > bestRatio || (ratio === bestRatio && page < bestPage)) {
          bestPage = page;
          bestRatio = ratio;
        }
      });
      if (bestPage > 0) {
        onPage(bestPage);
      }
    },
    { root, threshold: [0, threshold, 0.6, 0.85] },
  );
  nodes.forEach((node) => {
    if (node) {
      observer.observe(node);
    }
  });
  return () => observer.disconnect();
}
