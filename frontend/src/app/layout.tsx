import type { Metadata } from "next";
import { Inter, Epilogue } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });
const epilogue = Epilogue({
  subsets: ["latin"],
  variable: '--font-epilogue',
});

export const metadata: Metadata = {
  title: "Linera Checkers",
  description: "Real-time checkers game on Linera blockchain",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${epilogue.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
