import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Сімейні покупки",
  description: "Спільний сімейний список покупок.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
