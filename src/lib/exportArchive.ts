import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { track } from './analytics';
import type { Profile, Week } from './api';
import { formatDayLong, formatMonth, formatWeekRange, monthKey } from './week';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A printable scrapbook of everything you've kept: one section per week, oldest first. */
export function archiveHtml(me: Profile, weeks: Week[]): string {
  const kept = weeks.filter((w) => w.snippets.length).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  const first = kept[0]?.weekStart;
  const last = kept[kept.length - 1]?.weekStart;
  let lastMonth = '';

  const body = kept
    .map((w) => {
      const mk = monthKey(w.weekStart);
      const monthHeader = mk !== lastMonth ? `<h2 class="month">${esc(formatMonth(w.weekStart))}</h2>` : '';
      lastMonth = mk;
      const moments = w.snippets
        .map((s) => {
          const photos = s.media
            .filter((m) => m.kind === 'image' || m.thumbUrl)
            .map((m) => `<img src="${esc(m.kind === 'image' ? m.url : m.thumbUrl!)}" />`)
            .join('');
          return `<div class="moment">
            <div class="day">${esc(formatDayLong(s.happenedOn))}</div>
            ${s.title ? `<div class="title">${esc(s.title)}</div>` : ''}
            ${s.reflection ? `<p class="reflection">${esc(s.reflection)}</p>` : ''}
            ${photos ? `<div class="photos n${Math.min(s.media.length, 3)}">${photos}</div>` : ''}
          </div>`;
        })
        .join('');
      return `${monthHeader}<section class="week"><h3>${esc(formatWeekRange(w.weekStart))}</h3>${moments}</section>`;
    })
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  @page { margin: 48px 44px; }
  body { font-family: -apple-system, Helvetica, sans-serif; color: #2E2926; }
  .cover { height: 92vh; display: flex; flex-direction: column; justify-content: center; page-break-after: always; }
  .cover .mark { color: #BF6547; font-size: 28px; }
  .cover h1 { font-weight: 500; font-size: 44px; margin: 12px 0 6px; }
  .cover p { color: #857B73; font-size: 18px; margin: 0; }
  h2.month { font-weight: 500; font-size: 26px; margin: 28px 0 8px; page-break-after: avoid; }
  .week { break-inside: avoid; page-break-inside: avoid; border-top: 1px solid #eee5dd; padding-top: 14px; margin-bottom: 18px; }
  h3 { font-weight: 500; font-size: 15px; color: #857B73; margin: 0 0 10px; }
  .moment { margin-bottom: 16px; break-inside: avoid; }
  .day { color: #BF6547; font-size: 12px; font-weight: 600; }
  .title { font-size: 18px; font-weight: 500; margin-top: 2px; }
  .reflection { font-size: 14px; line-height: 1.5; color: #5E5550; margin: 4px 0 0; }
  .photos { display: flex; gap: 6px; margin-top: 8px; }
  .photos img { flex: 1; height: 170px; object-fit: cover; border-radius: 8px; min-width: 0; }
  .photos.n1 img { height: 260px; }
</style></head><body>
  <div class="cover">
    <div class="mark">✦</div>
    <h1>${esc(me.displayName)}’s Snippets</h1>
    <p>${first ? `${esc(formatMonth(first))} – ${esc(formatMonth(last!))}` : ''} · ${kept.length} weeks kept</p>
  </div>
  ${body}
</body></html>`;
}

/** Render the archive to a PDF and open the share sheet (save to Files, print, AirDrop…). */
export async function exportArchive(me: Profile, weeks: Week[]) {
  const { uri } = await Print.printToFileAsync({ html: archiveHtml(me, weeks) });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Your Snippets archive' });
  track('archive_exported', { weeks: weeks.filter((w) => w.snippets.length).length });
}
