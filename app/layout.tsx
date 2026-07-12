import './globals.css';

export const metadata = {
  title: 'ChamuyoCheck | Finanzas, estafas y derecho argentino',
  description: 'Analizá créditos, costos financieros, posibles estafas y documentos legales argentinos con evidencia y alcance claros.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
