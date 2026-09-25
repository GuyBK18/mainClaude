import type { Metadata } from "next";
import { Inter, Newsreader, Space_Grotesk } from "next/font/google";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/shell/site-header";
import "./globals.css";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "LuminaRead", template: "%s · LuminaRead" },
  description: "A personal library and reading journal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${newsreader.variable} ${spaceGrotesk.variable} ${inter.variable} min-h-dvh antialiased`}>
        <Providers>
          {/* Clips the cover glows sideways. On body, mobile browsers would still widen the page for them. */}
          <div className="overflow-x-clip">
            <SiteHeader />
            <main className="mx-auto w-full max-w-[1240px] px-4 pt-10 pb-28 sm:px-8 sm:pt-14">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
