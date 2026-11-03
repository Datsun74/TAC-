import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Задачник",
  description: "Особисті, сімейні та робочі задачі в одному місці.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
