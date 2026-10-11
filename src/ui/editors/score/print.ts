// Printing scores and parts: render each document, cut it into pages between systems, and open
// one print window (the browser's Save as PDF makes the PDF).
import type { ScoreModel } from './notation';
import { renderScore, type RenderOpts } from './render';

export interface PrintDoc {
  model: ScoreModel;
  opts: RenderOpts;
  /** Footer label, e.g. "Trumpet in B♭". */
  footer: string;
}

export type Paper = 'a4' | 'letter';

const W = 760;

/** Pages of one document as SVG strings (between systems, never through one). */
function pagesOf(doc: PrintDoc, paper: Paper): string[] {
  const tmp = document.createElement('div');
  const l = renderScore(tmp, doc.model, W, 1, doc.opts);
  const svg = tmp.querySelector('svg');
  if (!svg) return [];
  const pageH = Math.round(W * (paper === 'letter' ? 1.29 : 1.41));
  const cuts: [number, number][] = [];
  let start = 0;
  for (const sys of l.systems) {
    if (sys.y1 - start > pageH && sys.y0 > start + 1) {
      cuts.push([start, sys.y0 - 16]);
      start = sys.y0 - 16;
    }
  }
  cuts.push([start, l.height]);
  return cuts.map(([y0, y1]) => {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('viewBox', `0 ${y0} ${W} ${y1 - y0}`);
    clone.setAttribute('width', '100%');
    clone.removeAttribute('height');
    clone.style.cssText = '';
    return clone.outerHTML;
  });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Open the print dialog for one or more documents (each starts on a new page). */
export function printDocs(title: string, docs: PrintDoc[], paper: Paper = 'a4'): boolean {
  const body = docs
    .map((doc) => {
      const pages = pagesOf(doc, paper);
      return pages
        .map((svg, i) => `<section class="page${i === 0 ? ' first' : ''}">${svg}<footer>${esc(doc.footer)}${pages.length > 1 ? ` · ${i + 1}/${pages.length}` : ''}</footer></section>`)
        .join('');
    })
    .join('');
  const w = window.open('', '_blank');
  if (!w) return false;
  const size = paper === 'letter' ? 'Letter' : 'A4';
  const width = paper === 'letter' ? '191mm' : '186mm';
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{margin:0;background:#888;font-family:Georgia,serif}
      .page{background:white;width:${width};margin:12px auto;padding:0 0 6px;box-shadow:0 2px 12px rgba(0,0,0,.4);position:relative}
      .page svg{display:block;width:100%;height:auto}
      footer{text-align:center;font-size:10px;color:#555;padding-top:4px}
      @page{size:${size} portrait;margin:12mm}
      @media print{body{background:white}.page{margin:0;box-shadow:none;break-after:page;page-break-after:always}.page:last-child{break-after:auto;page-break-after:auto}}
    </style></head><body>${body}</body></html>`,
  );
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
  return true;
}
