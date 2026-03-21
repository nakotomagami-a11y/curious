import type { Metadata } from 'next';

const basePath = process.env.NODE_ENV === 'production' ? '/lab/curious' : '';

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
            src: url('${basePath}/fonts/Matemasie/Matemasie-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Lexend';
            src: url('${basePath}/fonts/Lexend/Lexend-Regular.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
          }
          @font-face {
            font-family: 'Lexend';
            src: url('${basePath}/fonts/Lexend/Lexend-Medium.ttf') format('truetype');
            font-weight: 500;
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
