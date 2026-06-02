import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Broward News — Fort Lauderdale & Broward County Public Safety",
  description:
    "Arrest records, public safety news, and booking reports for Fort Lauderdale and Broward County, Florida.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
