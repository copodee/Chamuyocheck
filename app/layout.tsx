import './globals.css';

const leasingSite = process.env.NEXT_PUBLIC_SITE_MODE === 'leasing';

export const metadata = {
  title: leasingSite ? 'LeasingScoring | Transparencia financiera del leasing' : 'ChamuyoCheck | Finanzas, estafas y derecho argentino',
  description: leasingSite
    ? 'Analizá cotizaciones de leasing, calculá su costo financiero y medí la transparencia de la información aportada.'
    : 'Analizá créditos, costos financieros, posibles estafas y documentos legales argentinos con evidencia y alcance claros.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
