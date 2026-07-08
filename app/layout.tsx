import './globals.css';

export const metadata = {
  title: 'ChamuyoCheck V6',
  description: 'Auditor inteligente de credibilidad, evidencia, costos ocultos, IA académica y señales de riesgo.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
