import { jsPDF } from 'jspdf';
import { CalculatedEntry, IncomeEntry } from '../types';
import { formatBRL, parseBRDate } from './calculations';

export interface SupplierPDFReportData {
  supplierName: string;
  periodLabel: string;
  totalPurchased: number;
  totalPaid: number;
  totalPending: number;
  pendingEntries: CalculatedEntry[];
  paidEntries: CalculatedEntry[];
  monthlyHistory: { monthLabel: string; paid: number; total: number }[];
}

export function generateSupplierPDFReport(data: SupplierPDFReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let currentY = 16;

  const primaryColor: [number, number, number] = [30, 41, 59]; // slate-800
  const accentBlue: [number, number, number] = [37, 99, 235]; // blue-600
  const textDark: [number, number, number] = [15, 23, 42]; // slate-900
  const textMuted: [number, number, number] = [100, 116, 139]; // slate-500
  const greenColor: [number, number, number] = [5, 150, 105]; // emerald-600
  const redColor: [number, number, number] = [225, 29, 72]; // rose-600

  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 16) {
      doc.addPage();
      currentY = 16;
      drawHeaderSmall();
    }
  };

  const drawHeaderSmall = () => {
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(`Relatório Financeiro do Fornecedor - ${data.supplierName}`, margin, 10);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, 12, pageWidth - margin, 12);
  };

  // Header Banner
  doc.setFillColor(...primaryColor);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text('RELATÓRIO FINANCEIRO DO FORNECEDOR', margin + 6, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Fornecedor: ${data.supplierName}`, margin + 6, currentY + 16);

  const issueDateStr = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Período: ${data.periodLabel}  |  Emissão: ${issueDateStr}`, margin + 6, currentY + 21);

  currentY += 28;

  // Resumo Financeiro (Cards)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...textDark);
  doc.text('RESUMO FINANCEIRO', margin, currentY);
  currentY += 4;

  const cardWidth = (contentWidth - 6) / 3;
  const cardHeight = 18;

  // Card 1: Total Lançado
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textMuted);
  doc.text('TOTAL LANÇADO', margin + 4, currentY + 5.5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...textDark);
  doc.text(formatBRL(data.totalPurchased), margin + 4, currentY + 13);

  // Card 2: Total Pago
  const card2X = margin + cardWidth + 3;
  doc.setFillColor(240, 253, 244); // emerald-50
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(card2X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...greenColor);
  doc.text('TOTAL PAGO', card2X + 4, currentY + 5.5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(formatBRL(data.totalPaid), card2X + 4, currentY + 13);

  // Card 3: Saldo Pendente
  const card3X = margin + (cardWidth + 3) * 2;
  doc.setFillColor(255, 241, 242); // rose-50
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(card3X, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...redColor);
  doc.text('SALDO PENDENTE', card3X + 4, currentY + 5.5);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(formatBRL(data.totalPending), card3X + 4, currentY + 13);

  currentY += cardHeight + 6;

  // Helper to draw a table
  const drawTableHeader = (title: string, columns: { name: string; width: number; align?: 'left' | 'right' | 'center' }[], badgeColor: [number, number, number]) => {
    checkPageBreak(16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...textDark);
    doc.text(title, margin, currentY);
    currentY += 4;

    doc.setFillColor(...badgeColor);
    doc.rect(margin, currentY, contentWidth, 6, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);

    let curX = margin + 3;
    columns.forEach((col) => {
      if (col.align === 'right') {
        doc.text(col.name, curX + col.width - 6, currentY + 4.2, { align: 'right' });
      } else if (col.align === 'center') {
        doc.text(col.name, curX + col.width / 2, currentY + 4.2, { align: 'center' });
      } else {
        doc.text(col.name, curX, currentY + 4.2);
      }
      curX += col.width;
    });

    currentY += 6;
  };

  // Section 1: Contas Pendentes
  const pendingCols = [
    { name: 'Documento / NF', width: 44, align: 'left' as const },
    { name: 'Tipo', width: 28, align: 'left' as const },
    { name: 'Vencimento', width: 26, align: 'center' as const },
    { name: 'Status', width: 26, align: 'center' as const },
    { name: 'Juros', width: 24, align: 'right' as const },
    { name: 'Valor Total', width: 34, align: 'right' as const },
  ];

  drawTableHeader(
    `CONTAS PENDENTES (${data.pendingEntries.length}) - Total: ${formatBRL(data.totalPending)}`,
    pendingCols,
    [225, 29, 72] // rose-600
  );

  if (data.pendingEntries.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text('Nenhuma conta pendente encontrada para este fornecedor no período.', margin + 4, currentY + 5.5);
    currentY += 11;
  } else {
    data.pendingEntries.forEach((entry, idx) => {
      checkPageBreak(7);
      const isOdd = idx % 2 === 1;
      if (isOdd) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, 6, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...textDark);

      let curX = margin + 3;

      // Documento / NF
      const docLabel = entry.nfNumber ? `NF ${entry.nfNumber}` : `Doc #${entry.id}`;
      doc.text(docLabel, curX, currentY + 4.2);
      curX += pendingCols[0].width;

      // Tipo
      doc.text(entry.docType || 'Boleto', curX, currentY + 4.2);
      curX += pendingCols[1].width;

      // Vencimento
      doc.text(parseBRDate(entry.dueDate), curX + pendingCols[2].width / 2, currentY + 4.2, { align: 'center' });
      curX += pendingCols[2].width;

      // Status
      const isAtrasado = entry.status === 'Atrasado';
      doc.setFont('helvetica', 'bold');
      if (isAtrasado) {
        doc.setTextColor(...redColor);
        doc.text(`Atrasado (${entry.daysOverdue}d)`, curX + pendingCols[3].width / 2, currentY + 4.2, { align: 'center' });
      } else {
        doc.setTextColor(37, 99, 235);
        doc.text('A Vencer', curX + pendingCols[3].width / 2, currentY + 4.2, { align: 'center' });
      }
      curX += pendingCols[3].width;

      // Juros
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...textDark);
      const jurosStr = entry.interestValue > 0 ? formatBRL(entry.interestValue) : 'R$ 0,00';
      doc.text(jurosStr, curX + pendingCols[4].width - 6, currentY + 4.2, { align: 'right' });
      curX += pendingCols[4].width;

      // Valor Total
      doc.setFont('helvetica', 'bold');
      doc.text(formatBRL(entry.totalWithInterest || entry.value), curX + pendingCols[5].width - 6, currentY + 4.2, { align: 'right' });

      currentY += 6;
    });

    // Subtotal Pendente row
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...redColor);
    doc.text('Subtotal Pendente:', margin + contentWidth - 60, currentY + 4);
    doc.text(formatBRL(data.totalPending), margin + contentWidth - 3, currentY + 4, { align: 'right' });
    currentY += 8;
  }

  // Section 2: Contas Pagas
  const paidCols = [
    { name: 'Documento / NF', width: 50, align: 'left' as const },
    { name: 'Tipo', width: 32, align: 'left' as const },
    { name: 'Vencimento', width: 32, align: 'center' as const },
    { name: 'Data Pagamento', width: 34, align: 'center' as const },
    { name: 'Valor Pago', width: 34, align: 'right' as const },
  ];

  drawTableHeader(
    `CONTAS PAGAS (${data.paidEntries.length}) - Total: ${formatBRL(data.totalPaid)}`,
    paidCols,
    [5, 150, 105] // emerald-600
  );

  if (data.paidEntries.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text('Nenhuma conta paga registrada para este fornecedor no período.', margin + 4, currentY + 5.5);
    currentY += 11;
  } else {
    data.paidEntries.forEach((entry, idx) => {
      checkPageBreak(7);
      const isOdd = idx % 2 === 1;
      if (isOdd) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, 6, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...textDark);

      let curX = margin + 3;

      // Documento / NF
      const docLabel = entry.nfNumber ? `NF ${entry.nfNumber}` : `Doc #${entry.id}`;
      doc.text(docLabel, curX, currentY + 4.2);
      curX += paidCols[0].width;

      // Tipo
      doc.text(entry.docType || 'Boleto', curX, currentY + 4.2);
      curX += paidCols[1].width;

      // Vencimento
      doc.text(parseBRDate(entry.dueDate), curX + paidCols[2].width / 2, currentY + 4.2, { align: 'center' });
      curX += paidCols[2].width;

      // Data Pagamento
      const payDate = entry.paymentDate ? parseBRDate(entry.paymentDate) : '-';
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...greenColor);
      doc.text(payDate, curX + paidCols[3].width / 2, currentY + 4.2, { align: 'center' });
      curX += paidCols[3].width;

      // Valor Pago
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...textDark);
      doc.text(formatBRL(entry.totalWithInterest || entry.value), curX + paidCols[4].width - 6, currentY + 4.2, { align: 'right' });

      currentY += 6;
    });

    // Subtotal Pago row
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...greenColor);
    doc.text('Subtotal Pago:', margin + contentWidth - 60, currentY + 4);
    doc.text(formatBRL(data.totalPaid), margin + contentWidth - 3, currentY + 4, { align: 'right' });
    currentY += 8;
  }

  // Section 3: Histórico Financeiro por Mês
  if (data.monthlyHistory.length > 0) {
    const historyCols = [
      { name: 'Mês / Período', width: 60, align: 'left' as const },
      { name: 'Total Pago no Mês', width: 61, align: 'right' as const },
      { name: 'Volume Total (Lançado)', width: 61, align: 'right' as const },
    ];

    drawTableHeader('HISTÓRICO FINANCEIRO (EVOLUÇÃO POR MÊS)', historyCols, accentBlue);

    data.monthlyHistory.forEach((item, idx) => {
      checkPageBreak(7);
      const isOdd = idx % 2 === 1;
      if (isOdd) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, currentY, contentWidth, 6, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...textDark);

      let curX = margin + 3;
      doc.text(item.monthLabel, curX, currentY + 4.2);
      curX += historyCols[0].width;

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...greenColor);
      doc.text(formatBRL(item.paid), curX + historyCols[1].width - 6, currentY + 4.2, { align: 'right' });
      curX += historyCols[1].width;

      doc.setTextColor(...textDark);
      doc.text(formatBRL(item.total), curX + historyCols[2].width - 6, currentY + 4.2, { align: 'right' });

      currentY += 6;
    });

    currentY += 6;
  }

  // Page Numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);
    doc.text(
      `Financeiro  |  Fornecedor: ${data.supplierName}  |  Emitido em: ${issueDateStr}`,
      margin,
      pageHeight - 6.5
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 6.5, { align: 'right' });
  }

  // Trigger download in browser
  const sanitizedName = data.supplierName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  doc.save(`relatorio_fornecedor_${sanitizedName}.pdf`);
}

export interface StatusDetailsPDFReportData {
  type: 'overdue' | 'to-pay' | 'paid' | 'incomes';
  filterLabel: string;
  searchTerm?: string;
  entries: CalculatedEntry[];
  rawIncomes?: IncomeEntry[];
  totalAmount: number;
  totalCount: number;
  kpiCards?: {
    label: string;
    value: string;
    subtext?: string;
  }[];
}

export function generateStatusDetailsPDFReport(data: StatusDetailsPDFReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm
  let currentY = 14;

  const isOverdue = data.type === 'overdue';
  const isToPay = data.type === 'to-pay';
  const isPaid = data.type === 'paid';
  const isIncomes = data.type === 'incomes';

  // Palette definition
  const primaryDark: [number, number, number] = [15, 23, 42]; // slate-900
  const textDark: [number, number, number] = [30, 41, 59]; // slate-800
  const textMuted: [number, number, number] = [100, 116, 139]; // slate-500
  const borderLight: [number, number, number] = [226, 232, 240]; // slate-200

  // Category specific accent colors
  let accentColor: [number, number, number];
  let accentLightBg: [number, number, number];
  let categoryTitle = '';
  let categorySubtitle = '';
  let statusBadgeText = '';
  let filePrefix = '';

  if (isOverdue) {
    accentColor = [225, 29, 72]; // rose-600
    accentLightBg = [255, 241, 242]; // rose-50
    categoryTitle = 'RELATÓRIO DE CONTAS EM ATRASO';
    categorySubtitle = 'Demonstrativo analítico de pendências e obrigações vencidas';
    statusBadgeText = 'STATUS: ATRASADO';
    filePrefix = 'relatorio_total_atrasado';
  } else if (isToPay) {
    accentColor = [37, 99, 235]; // blue-600
    accentLightBg = [239, 246, 255]; // blue-50
    categoryTitle = 'RELATÓRIO DE CONTAS À VENCER';
    categorySubtitle = 'Planejamento e fluxo de pagamentos futuros programados';
    statusBadgeText = 'STATUS: À VENCER';
    filePrefix = 'relatorio_total_a_vencer';
  } else if (isPaid) {
    accentColor = [71, 85, 105]; // slate-600
    accentLightBg = [241, 245, 249]; // slate-100
    categoryTitle = 'RELATÓRIO DE CONTAS PAGAS';
    categorySubtitle = 'Histórico analítico de compromissos quitados e saídas realizadas';
    statusBadgeText = 'STATUS: PAGO';
    filePrefix = 'relatorio_total_pago';
  } else {
    accentColor = [5, 150, 105]; // emerald-600
    accentLightBg = [236, 253, 245]; // emerald-50
    categoryTitle = 'RELATÓRIO DE ENTRADAS / RECEITAS';
    categorySubtitle = 'Demonstrativo de receitas operacionais e recebimentos financeiros';
    statusBadgeText = 'STATUS: RECEITAS';
    filePrefix = 'relatorio_total_entradas';
  }

  // Issue Date/Time
  const issueDateStr = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Truncate helper
  const truncate = (text: string, maxWidth: number, fontSize: number = 7): string => {
    if (!text) return '-';
    doc.setFontSize(fontSize);
    if (doc.getTextWidth(text) <= maxWidth) return text;
    let t = text;
    while (t.length > 0 && doc.getTextWidth(t + '...') > maxWidth) {
      t = t.slice(0, -1);
    }
    return t ? t + '...' : '-';
  };

  // Define Columns per category
  interface ColumnDef {
    name: string;
    width: number;
    align: 'left' | 'center' | 'right';
  }

  let tableColumns: ColumnDef[] = [];

  if (isOverdue) {
    tableColumns = [
      { name: 'Favorecido / Fornecedor', width: 68, align: 'left' },
      { name: 'Tipo', width: 20, align: 'left' },
      { name: 'Vencimento', width: 20, align: 'center' },
      { name: 'Atraso', width: 18, align: 'center' },
      { name: 'Valor Orig.', width: 20, align: 'right' },
      { name: 'Juros/Multa', width: 18, align: 'right' },
      { name: 'Total Devido', width: 22, align: 'right' },
    ];
  } else if (isToPay) {
    tableColumns = [
      { name: 'Favorecido / Fornecedor', width: 80, align: 'left' },
      { name: 'Tipo', width: 24, align: 'left' },
      { name: 'Vencimento', width: 24, align: 'center' },
      { name: 'Situação / Prazo', width: 26, align: 'center' },
      { name: 'Valor Programado', width: 32, align: 'right' },
    ];
  } else if (isPaid) {
    tableColumns = [
      { name: 'Favorecido / Fornecedor', width: 72, align: 'left' },
      { name: 'Tipo', width: 20, align: 'left' },
      { name: 'Vencimento', width: 20, align: 'center' },
      { name: 'Data Pagto', width: 22, align: 'center' },
      { name: 'Forma Pagto', width: 22, align: 'left' },
      { name: 'Valor Quitado', width: 30, align: 'right' },
    ];
  } else {
    // Incomes
    tableColumns = [
      { name: 'Empresa / Cliente', width: 66, align: 'left' },
      { name: 'Data Receb.', width: 26, align: 'center' },
      { name: 'Origem Dinheiro', width: 32, align: 'left' },
      { name: 'Descrição / Ref.', width: 34, align: 'left' },
      { name: 'Valor Recebido', width: 28, align: 'right' },
    ];
  }

  // Draw Column Header
  const drawColumnHeader = () => {
    doc.setFillColor(...accentColor);
    doc.rect(margin, currentY, contentWidth, 6.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);

    let curX = margin;
    tableColumns.forEach((col) => {
      if (col.align === 'right') {
        doc.text(col.name, curX + col.width - 2.5, currentY + 4.5, { align: 'right' });
      } else if (col.align === 'center') {
        doc.text(col.name, curX + col.width / 2, currentY + 4.5, { align: 'center' });
      } else {
        doc.text(col.name, curX + 2.5, currentY + 4.5);
      }
      curX += col.width;
    });

    currentY += 6.5;
  };

  // Continuation Header on Pages 2+
  const drawPageSmallHeader = () => {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textDark);
    doc.text(`${categoryTitle} (Continuação)`, margin, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    const filterInfo = data.searchTerm ? `${data.filterLabel}  |  Busca: "${data.searchTerm}"` : data.filterLabel;
    doc.text(`Filtro: ${filterInfo}`, pageWidth - margin, 10, { align: 'right' });

    doc.setDrawColor(...borderLight);
    doc.setLineWidth(0.2);
    doc.line(margin, 12, pageWidth - margin, 12);
    currentY = 15;
  };

  // Check Page Break
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 16) {
      doc.addPage();
      drawPageSmallHeader();
      drawColumnHeader();
    }
  };

  // 1. HEADER BANNER (PAGE 1)
  doc.setFillColor(...primaryDark);
  doc.roundedRect(margin, currentY, contentWidth, 25, 2, 2, 'F');

  // Decorative Accent Bar on the left of banner
  doc.setFillColor(...accentColor);
  doc.rect(margin, currentY, 3, 25, 'F');

  // System Brand
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('CONTROLE FINANCEIRO & GERENCIAL', margin + 6, currentY + 6.5);

  // Main Category Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(255, 255, 255);
  doc.text(categoryTitle, margin + 6, currentY + 13.5);

  // Category Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(categorySubtitle, margin + 6, currentY + 19.5);

  // Right Side Info in Banner
  // Status Badge Pill
  doc.setFillColor(...accentColor);
  doc.roundedRect(pageWidth - margin - 46, currentY + 4, 42, 5.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(statusBadgeText, pageWidth - margin - 25, currentY + 8, { align: 'center' });

  // Emission Timestamp & Filter info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`Emissão: ${issueDateStr}`, pageWidth - margin - 4, currentY + 15, { align: 'right' });

  const filterSummary = data.searchTerm ? `${data.filterLabel} ("${data.searchTerm}")` : data.filterLabel;
  doc.text(`Filtro: ${truncate(filterSummary, 65, 7)}`, pageWidth - margin - 4, currentY + 20, { align: 'right' });

  currentY += 29;

  // 2. SUMMARY KPI CARDS (3 CARDS)
  if (data.kpiCards && data.kpiCards.length > 0) {
    const cardGap = 3;
    const numCards = Math.min(data.kpiCards.length, 3);
    const cardWidth = (contentWidth - cardGap * (numCards - 1)) / numCards;
    const cardHeight = 17;

    data.kpiCards.slice(0, 3).forEach((card, idx) => {
      const cardX = margin + idx * (cardWidth + cardGap);

      // Card Background & Border
      doc.setFillColor(248, 250, 252); // slate-50
      doc.setDrawColor(...borderLight);
      doc.setLineWidth(0.3);
      doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

      // Top color indicator strip
      const stripColor: [number, number, number] =
        idx === 0 ? accentColor : idx === 1 ? primaryDark : [100, 116, 139];
      doc.setFillColor(stripColor[0], stripColor[1], stripColor[2]);
      doc.rect(cardX, currentY, cardWidth, 1.2, 'F');

      // Card Label
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(...textMuted);
      doc.text(card.label.toUpperCase(), cardX + 3.5, currentY + 5.5);

      // Card Value
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(...textDark);
      doc.text(card.value, cardX + 3.5, currentY + 11.5);

      // Card Subtext if available
      if (card.subtext) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...textMuted);
        doc.text(truncate(card.subtext, cardWidth - 7, 6.5), cardX + 3.5, currentY + 15);
      }
    });

    currentY += cardHeight + 5;
  }

  // 3. TABLE SECTION TITLE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...textDark);
  doc.text(`DETALHAMENTO DOS LANÇAMENTOS (${data.entries.length} ${data.entries.length === 1 ? 'REGISTRO' : 'REGISTROS'})`, margin, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text(`Valor consolidado: ${formatBRL(data.totalAmount)}`, pageWidth - margin, currentY, { align: 'right' });

  currentY += 3.5;

  // 4. DRAW TABLE COLUMN HEADER
  drawColumnHeader();

  // 5. DRAW TABLE ROWS
  if (data.entries.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, currentY, contentWidth, 10, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text('Nenhum registro encontrado para os filtros selecionados.', margin + 6, currentY + 6);
    currentY += 14;
  } else {
    // Map incomes for quick lookup if needed
    const incomesMap = data.rawIncomes
      ? new Map(data.rawIncomes.map((inc) => [inc.id, inc]))
      : new Map<number, IncomeEntry>();

    data.entries.forEach((entry, idx) => {
      checkPageBreak(6.2);

      const isOdd = idx % 2 === 1;
      if (isOdd) {
        doc.setFillColor(248, 250, 252); // slate-50
        doc.rect(margin, currentY, contentWidth, 5.8, 'F');
      }

      // Draw subtle row bottom border
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.15);
      doc.line(margin, currentY + 5.8, pageWidth - margin, currentY + 5.8);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...textDark);

      let curX = margin;

      if (isOverdue) {
        // Col 1: Favorecido (68mm)
        doc.text(truncate(entry.favorecidoName || 'Não informado', 66), curX + 2.5, currentY + 4);
        curX += tableColumns[0].width;

        // Col 2: Tipo (20mm)
        doc.text(truncate(entry.docType || 'Boleto', 18), curX + 2.5, currentY + 4);
        curX += tableColumns[1].width;

        // Col 3: Vencimento (20mm)
        doc.text(parseBRDate(entry.dueDate), curX + tableColumns[2].width / 2, currentY + 4, { align: 'center' });
        curX += tableColumns[2].width;

        // Col 4: Atraso (18mm)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...accentColor);
        doc.text(`${entry.daysOverdue || 0} dias`, curX + tableColumns[3].width / 2, currentY + 4, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textDark);
        curX += tableColumns[3].width;

        // Col 5: Valor Orig. (20mm)
        doc.text(formatBRL(entry.value), curX + tableColumns[4].width - 2.5, currentY + 4, { align: 'right' });
        curX += tableColumns[4].width;

        // Col 6: Juros/Multa (18mm)
        const jurosStr = entry.interestValue > 0 ? formatBRL(entry.interestValue) : 'R$ 0,00';
        doc.text(jurosStr, curX + tableColumns[5].width - 2.5, currentY + 4, { align: 'right' });
        curX += tableColumns[5].width;

        // Col 7: Total Devido (22mm)
        doc.setFont('helvetica', 'bold');
        doc.text(formatBRL(entry.totalWithInterest || entry.value), curX + tableColumns[6].width - 2.5, currentY + 4, { align: 'right' });
      } else if (isToPay) {
        // Col 1: Favorecido (80mm)
        doc.text(truncate(entry.favorecidoName || 'Não informado', 78), curX + 2.5, currentY + 4);
        curX += tableColumns[0].width;

        // Col 2: Tipo (24mm)
        doc.text(truncate(entry.docType || 'Boleto', 22), curX + 2.5, currentY + 4);
        curX += tableColumns[1].width;

        // Col 3: Vencimento (24mm)
        doc.text(parseBRDate(entry.dueDate), curX + tableColumns[2].width / 2, currentY + 4, { align: 'center' });
        curX += tableColumns[2].width;

        // Col 4: Situação / Prazo (26mm)
        // Calculate days to due date
        const todayIso = new Date().toISOString().slice(0, 10);
        let situacaoText = 'À Vencer';
        if (entry.dueDate === todayIso) {
          situacaoText = 'Vence Hoje!';
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(225, 29, 72); // rose-600
        } else {
          doc.setTextColor(37, 99, 235); // blue-600
        }
        doc.text(situacaoText, curX + tableColumns[3].width / 2, currentY + 4, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textDark);
        curX += tableColumns[3].width;

        // Col 5: Valor Programado (32mm)
        doc.setFont('helvetica', 'bold');
        doc.text(formatBRL(entry.totalWithInterest || entry.value), curX + tableColumns[4].width - 2.5, currentY + 4, { align: 'right' });
      } else if (isPaid) {
        // Col 1: Favorecido (72mm)
        doc.text(truncate(entry.favorecidoName || 'Não informado', 70), curX + 2.5, currentY + 4);
        curX += tableColumns[0].width;

        // Col 2: Tipo (20mm)
        doc.text(truncate(entry.docType || 'Boleto', 18), curX + 2.5, currentY + 4);
        curX += tableColumns[1].width;

        // Col 3: Vencimento (20mm)
        doc.text(parseBRDate(entry.dueDate), curX + tableColumns[2].width / 2, currentY + 4, { align: 'center' });
        curX += tableColumns[2].width;

        // Col 4: Data Pagamento (22mm)
        const pDate = entry.paymentDate ? parseBRDate(entry.paymentDate) : parseBRDate(entry.dueDate);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105); // emerald-600
        doc.text(pDate, curX + tableColumns[3].width / 2, currentY + 4, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textDark);
        curX += tableColumns[3].width;

        // Col 5: Tipo / Doc (22mm)
        doc.text(truncate((entry as any).forma_pagamento || entry.docType || 'Boleto', 20), curX + 2.5, currentY + 4);
        curX += tableColumns[4].width;

        // Col 6: Valor Quitado (30mm)
        doc.setFont('helvetica', 'bold');
        doc.text(formatBRL(entry.totalWithInterest || entry.value), curX + tableColumns[5].width - 2.5, currentY + 4, { align: 'right' });
      } else {
        // Incomes
        const rawInc = incomesMap.get(entry.id);
        const origem = rawInc?.forma_recebimento || entry.docType || 'PIX';
        const desc = rawInc?.description || entry.nfNumber || '-';

        // Col 1: Empresa / Cliente (66mm)
        doc.text(truncate(entry.favorecidoName || 'Não informado', 64), curX + 2.5, currentY + 4);
        curX += tableColumns[0].width;

        // Col 2: Data Recebimento (26mm)
        doc.text(parseBRDate(entry.dueDate), curX + tableColumns[1].width / 2, currentY + 4, { align: 'center' });
        curX += tableColumns[1].width;

        // Col 3: Origem Dinheiro (32mm)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(truncate(origem, 30), curX + 2.5, currentY + 4);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...textDark);
        curX += tableColumns[2].width;

        // Col 4: Descrição / Ref. (34mm)
        doc.text(truncate(desc, 32), curX + 2.5, currentY + 4);
        curX += tableColumns[3].width;

        // Col 5: Valor Recebido (28mm)
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 150, 105);
        doc.text(formatBRL(entry.value), curX + tableColumns[4].width - 2.5, currentY + 4, { align: 'right' });
      }

      currentY += 5.8;
    });

    // 6. TOTAL CONSOLIDADO SUMMARY BAR
    checkPageBreak(12);

    doc.setFillColor(...accentLightBg);
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(0.3);
    doc.rect(margin, currentY + 1, contentWidth, 7.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...textDark);
    doc.text(`TOTAL GERAL CONSOLIDADO (${data.entries.length} ITENS):`, margin + 4, currentY + 5.8);

    doc.setFontSize(9);
    doc.setTextColor(...accentColor);
    doc.text(formatBRL(data.totalAmount), pageWidth - margin - 3, currentY + 5.8, { align: 'right' });

    currentY += 12;
  }

  // 7. FOOTER ON ALL PAGES
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...textMuted);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

    doc.text(
      `Sistema de Gestão Financeira  |  ${categoryTitle}  |  Emitido em: ${issueDateStr}`,
      margin,
      pageHeight - 5.5
    );
    doc.text(`Página ${i} de ${totalPages}`, pageWidth - margin, pageHeight - 5.5, { align: 'right' });
  }

  // 8. TRIGGER BROWSER DOWNLOAD
  const todayIso = new Date().toISOString().slice(0, 10);
  doc.save(`${filePrefix}_${todayIso}.pdf`);
}

