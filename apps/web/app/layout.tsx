import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Curious — Combat Sandbox',
  description: 'Multiplayer top-down combat sandbox prototype',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <style>{`
          @font-face {
            font-family: 'Matemasie';
            src: url('/lab/curious/fonts/Matemasie/Matemasie-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
        `}</style>
      </head>
      <body style={{ margin: 0, overflow: 'hidden', background: '#000' }}>
        {children}
      </body>
    </html>
  );
}
