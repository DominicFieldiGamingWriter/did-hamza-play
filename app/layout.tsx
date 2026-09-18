import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";

const siteUrl =
  process.env.SITE_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://did-hamza-play.vercel.app";

const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Hamza Choudhury",
  jobTitle: "Footballer",
  url: siteUrl
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Did Hamza Choudhury Play?",
  description: "Did Hamza Choudhury play in his last match for club or country? Find out whether Hamza started, was on the bench, scored or assisted in his latest game."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(personJsonLd)
          }}
        />
        {children}

        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-8LPT86SVY1"
          strategy="afterInteractive"
        />

        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){window.dataLayer.push(arguments);}
            gtag("js", new Date());
            gtag("config", "G-8LPT86SVY1");
          `}
        </Script>
      </body>
    </html>
  );
}