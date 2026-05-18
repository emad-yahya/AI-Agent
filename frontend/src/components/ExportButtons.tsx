// frontend/src/components/ExportButtons.tsx
import { Download, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import type { ScanResult, Recommendation } from '../api/client';

interface Stats {
  total: number;
  mentioned: number;
  mentionRate: number;
  avgScore: number;
}

interface Props {
  brand: string;
  category: string;
  results: ScanResult[];
  stats: Stats;
  recommendations: Recommendation[];
}

function escapeCsv(val: string | number | boolean | null): string {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function buildCsv(brand: string, category: string, results: ScanResult[]): string {
  const header = ['Brand', 'Category', 'Engine', 'Prompt', 'Mentioned', 'Position', 'Sentiment', 'Score'];
  const rows = results.map((r) => [
    brand,
    category,
    r.engine,
    r.prompt,
    r.mentioned ? 'Yes' : 'No',
    r.position ?? '',
    r.sentiment,
    r.visibilityScore,
  ]);
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function downloadCsv(brand: string, category: string, results: ScanResult[]) {
  const csv = buildCsv(brand, category, results);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${brand.replace(/\s+/g, '_')}_ai_visibility_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPdf(brand: string, category: string, stats: Stats, results: ScanResult[], recommendations: Recommendation[]) {
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
  line(`${brand} — AI Visibility Report`, 16, true);
  newline(2);
  line(`Category: ${category}  |  Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 9, false, '#666666');
  newline(4);
  rule();

  // Stats
  line('Overview', 12, true);
  newline(3);
  const statItems = [
    ['Avg Score', `${stats.avgScore}/100`],
    ['Mention Rate', `${stats.mentionRate}%`],
    ['Mentions', `${stats.mentioned}/${stats.total}`],
  ];
  const statW = col / 3;
  statItems.forEach(([label, val], i) => {
    const x = margin + i * statW;
    doc.setFontSize(18);
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

  // Results
  line('Scan Results', 12, true);
  newline(3);
  const cols = ['Engine', 'Mentioned', 'Position', 'Sentiment', 'Score'];
  const colW = [50, 22, 20, 24, 20];
  let xOff = margin;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(80, 80, 80);
  cols.forEach((c, i) => { doc.text(c, xOff, y); xOff += colW[i]; });
  y += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, W - margin, y);
  y += 3;

  for (const r of results) {
    checkPage(7);
    xOff = margin;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    const rowData = [
      r.engine.replace('-style', ''),
      r.mentioned ? 'Yes' : 'No',
      String(r.position ?? '—'),
      r.sentiment,
      String(r.visibilityScore),
    ];
    rowData.forEach((v, i) => { doc.text(v, xOff, y); xOff += colW[i]; });
    y += 6;
  }

  if (recommendations.length > 0) {
    newline(4);
    rule();
    checkPage(12);
    line('Recommendations', 12, true);
    newline(3);
    for (const rec of recommendations) {
      checkPage(14);
      const priorityColor = rec.priority === 'high' ? '#dc2626' : rec.priority === 'medium' ? '#d97706' : '#16a34a';
      line(`[${rec.priority.toUpperCase()}] ${rec.title}`, 9, true, priorityColor);
      newline(1);
      const descLines = doc.splitTextToSize(rec.description, col);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      descLines.forEach((dl: string) => { checkPage(5); doc.text(dl, margin, y); y += 4; });
      newline(3);
    }
  }

  doc.save(`${brand.replace(/\s+/g, '_')}_ai_visibility_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function ExportButtons({ brand, category, results, stats, recommendations }: Props) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => downloadCsv(brand, category, results)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200
                   rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export CSV
      </button>
      <button
        onClick={() => downloadPdf(brand, category, stats, results, recommendations)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200
                   rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <FileText className="w-3.5 h-3.5" />
        Export PDF
      </button>
    </div>
  );
}
