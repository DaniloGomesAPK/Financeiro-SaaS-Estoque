import { NfeInstallment, NfeItem } from '../types';

export interface ParsedNfe {
  accessKey: string;
  number: string;
  series: string;
  supplierName: string;
  supplierCnpj: string;
  issueDate: string;
  totalValue: number;
  installments: NfeInstallment[];
  items: NfeItem[];
}

const textOf = (root: Element | Document, tagName: string): string => {
  const all = Array.from(root.getElementsByTagName('*'));
  const el = all.find((node) => node.localName === tagName);
  return (el?.textContent || '').trim();
};

const childrenByLocalName = (root: Element | Document, tagName: string): Element[] =>
  Array.from(root.getElementsByTagName('*')).filter((node) => node.localName === tagName) as Element[];

const numberOf = (value: string): number => {
  const n = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const dateOnly = (value: string): string => {
  if (!value) return '';
  return value.length >= 10 ? value.slice(0, 10) : value;
};

export function parseNfeXml(xmlText: string): ParsedNfe {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const parserError = xml.getElementsByTagName('parsererror')[0];
  if (parserError) throw new Error('O arquivo XML está inválido ou corrompido.');

  const infNFe = childrenByLocalName(xml, 'infNFe')[0];
  if (!infNFe) throw new Error('O arquivo não contém uma NF-e reconhecível (infNFe).');

  const rawId = infNFe.getAttribute('Id') || '';
  const accessKey = rawId.replace(/^NFe/i, '') || textOf(xml, 'chNFe');
  const number = textOf(infNFe, 'nNF');
  const series = textOf(infNFe, 'serie');
  const issueDate = dateOnly(textOf(infNFe, 'dhEmi') || textOf(infNFe, 'dEmi'));

  const emit = childrenByLocalName(infNFe, 'emit')[0];
  const supplierName = emit ? textOf(emit, 'xNome') : '';
  const supplierCnpj = emit ? (textOf(emit, 'CNPJ') || textOf(emit, 'CPF')) : '';

  const totalNode = childrenByLocalName(infNFe, 'ICMSTot')[0];
  const totalValue = totalNode ? numberOf(textOf(totalNode, 'vNF')) : 0;

  const installments: NfeInstallment[] = childrenByLocalName(infNFe, 'dup').map((dup, index) => ({
    number: textOf(dup, 'nDup') || String(index + 1).padStart(3, '0'),
    dueDate: dateOnly(textOf(dup, 'dVenc')),
    value: numberOf(textOf(dup, 'vDup')),
  })).filter((item) => item.dueDate && item.value > 0);

  const items: NfeItem[] = childrenByLocalName(infNFe, 'det').map((det, index) => {
    const prod = childrenByLocalName(det, 'prod')[0];
    return {
      line: Number(det.getAttribute('nItem') || index + 1),
      supplierCode: prod ? textOf(prod, 'cProd') : '',
      description: prod ? textOf(prod, 'xProd') : '',
      unit: prod ? textOf(prod, 'uCom') : '',
      quantity: prod ? numberOf(textOf(prod, 'qCom')) : 0,
      unitValue: prod ? numberOf(textOf(prod, 'vUnCom')) : 0,
      totalValue: prod ? numberOf(textOf(prod, 'vProd')) : 0,
      selectedForStock: false,
    };
  });

  if (!accessKey && !number) throw new Error('Não foi possível identificar a chave ou o número da NF-e.');

  return {
    accessKey,
    number,
    series,
    supplierName,
    supplierCnpj,
    issueDate,
    totalValue,
    installments,
    items,
  };
}
