import { Download, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { SeoSiteScan, SeoResult } from '../api/client';

interface Props {
  scan: SeoSiteScan;
}

function escapeCsv(val: string | number | boolean | null | undefined): string {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function buildCsv(scan: SeoSiteScan): string {
  const header = [
    'Keyword',
    'Position',
    'Title',
    'URL',
    'Top 3 Competitors',
    'SERP Features',
  ];
  const rows = (scan.results ?? []).map((r: SeoResult) => [
    r.keyword,
    r.position ?? '',
    r.title ?? '',
    r.url ?? '',
    (r.topCompetitors ?? []).slice(0, 3).map((c) => `${c.domain}(#${c.position})`).join('; '),
    (r.serpFeatures ?? []).join('; '),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function downloadCsv(scan: SeoSiteScan) {
  const csv = buildCsv(scan);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${scan.domain.replace(/[^a-z0-9]/gi, '_')}_seo_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(scan: SeoSiteScan) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 16;
  const col = W - margin * 2;
  let y = margin;

  const line = (text: string, size = 10, bold = false, color = '#111111') => {
    doc.setFontSize(size);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    const [r, g, b] = color.match(/\w\w/g)!.map((h) => parseInt(h, 16));
    doc.setTextColor(r, g, b);
    doc.text(text, margin, y);
    y += size * 0.45;
  };

  const newline = (h = 4) => { y += h; };
  const rule = () => {
    doc.setDrawColor(220, 220, 220);
    doc.line(margin, y, W - margin, y);
    y += 4;
  };
  const checkPage = (needed = 10) => {
    if (y + needed > 275) { doc.addPage(); y = margin; }
  };

  // Header
  line(`${scan.brand} — SEO Report (${scan.country.toUpperCase()})`, 16, true);
  newline(2);
  line(
    `Domain: ${scan.domain}  |  Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
    9,
    false,
    '#666666',
  );
  newline(4);
  rule();

  // Stats
  line('Overview', 12, true);
  newline(3);
  const stats: [string, string][] = [
    ['Keywords', String(scan.totalKeywords ?? 0)],
    ['Ranked top-10', String(scan.rankedCount ?? 0)],
    [
      'Avg position',
      scan.avgPosition !== null && scan.avgPosition !== undefined
        ? `#${scan.avgPosition.toFixed(1)}`
        : '—',
    ],
  ];
  const statW = col / 3;
  stats.forEach(([label, val], i) => {
    const x = margin + i * statW;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(val, x, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(label, x, y + 5);
  });
  y += 14;
  rule();

  // Anomalies
  if ((scan.anomalies ?? []).length > 0) {
    line('Changes vs last scan', 12, true);
    newline(3);
    for (const a of scan.anomalies ?? []) {
      checkPage(8);
      const color =
        a.severity === 'high'
          ? '#dc2626'
          : a.severity === 'medium'
            ? '#d97706'
            : '#16a34a';
      line(`• ${a.message}`, 9, false, color);
      newline(1);
    }
    rule();
  }

  // Keyword rankings
  line('Keyword rankings', 12, true);
  newline(3);
  const colHeaders = ['Keyword', 'Position', 'Top competitor'];
  const colW = [80, 25, 70];
  let xOff = margin;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  colHeaders.forEach((c, i) => { doc.text(c, xOff, y); xOff += colW[i]; });
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, W - margin, y);
  y += 3;

  for (const r of scan.results ?? []) {
    checkPage(7);
    xOff = margin;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    const topComp = (r.topCompetitors ?? [])[0];
    const rowData = [
      r.keyword.slice(0, 50),
      r.position ? `#${r.position}` : '—',
      topComp ? `${topComp.domain} (#${topComp.position})` : '—',
    ];
    rowData.forEach((v, i) => { doc.text(v, xOff, y); xOff += colW[i]; });
    y += 6;
  }

  // Top competitors
  const competitors = Object.entries(scan.competitorMap ?? {}).slice(0, 8);
  if (competitors.length > 0) {
    newline(4);
    rule();
    checkPage(10);
    line('Top SERP competitors', 12, true);
    newline(3);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    for (const [domain, count] of competitors) {
      checkPage(5);
      doc.text(`• ${domain} — appears in ${count} keyword${count !== 1 ? 's' : ''}`, margin, y);
      y += 5;
    }
  }

  doc.save(
    `${scan.domain.replace(/[^a-z0-9]/gi, '_')}_seo_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

export function SeoExportButtons({ scan }: Props) {
  if (scan.status !== 'done') return null;
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => downloadCsv(scan)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>
      <button
        onClick={() => downloadPdf(scan)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        Export PDF
      </button>
    </div>
  );
}
