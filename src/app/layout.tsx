import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Лист сімейних побажань",
  description: "Сімейний список покупок і побажань.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
