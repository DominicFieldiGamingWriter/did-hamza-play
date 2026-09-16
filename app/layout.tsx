import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Did Hamza Play?",
  description: "Did Hamza Choudhury play in his club's last match?"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
