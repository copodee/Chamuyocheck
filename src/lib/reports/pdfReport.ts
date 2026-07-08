export function buildReportTitle(documentType: string, score: number) {
  return `ChamuyoCheck - ${documentType} - ${score}/100`;
}

export function printReport() {
  if (typeof window === 'undefined') return;
  document.body.classList.add('printingReport');
  setTimeout(() => {
    window.print();
    document.body.classList.remove('printingReport');
  }, 80);
}
