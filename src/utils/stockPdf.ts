import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { StockProduct } from '../types';

export function generateStockPurchaseReport(products: StockProduct[], generatedBy?: string) {
  const needPurchase = products
    .filter((p) => p.active !== false && p.currentStock < p.pt)
    .sort((a, b) => a.code.localeCompare(b.code, 'pt-BR'));

  if (needPurchase.length === 0) throw new Error('Não existem itens abaixo do PT para gerar o relatório.');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('RELATÓRIO DE NECESSIDADE DE COMPRA', 14, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 21);
  if (generatedBy) doc.text(`Gerado por: ${generatedBy}`, 14, 26);

  autoTable(doc, {
    startY: 32,
    head: [['Código', 'Descrição', 'Local', 'Un.', 'PT', 'LT', 'Ideal (PT+LT)', 'Saldo atual', 'Comprar']],
    body: needPurchase.map((p) => [
      p.code,
      p.description,
      p.location || '-',
      p.unit || '-',
      p.pt.toLocaleString('pt-BR'),
      p.lt.toLocaleString('pt-BR'),
      (p.pt + p.lt).toLocaleString('pt-BR'),
      p.currentStock.toLocaleString('pt-BR'),
      Math.max(p.pt + p.lt - p.currentStock, 0).toLocaleString('pt-BR'),
    ]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fontStyle: 'bold' },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const totalQty = needPurchase.reduce((sum, p) => sum + Math.max(p.pt + p.lt - p.currentStock, 0), 0);
  const finalY = Number((doc as any).lastAutoTable?.finalY || 40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Itens abaixo do PT: ${needPurchase.length}`, 14, finalY + 8);
  doc.text(`Quantidade total sugerida: ${totalQty.toLocaleString('pt-BR')}`, 14, finalY + 14);

  doc.save(`necessidade_compra_${new Date().toISOString().slice(0, 10)}.pdf`);
}
