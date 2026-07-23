import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Controlled Document Approval System | ElevateBox',
  description: 'Full-stack engineering challenge: state machine, server permissions, atomic audit logs, and OCC.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 antialiased selection:bg-sky-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
