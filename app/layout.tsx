import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EazyApply - Auto-Fill Job Applications in One Click",
  description: "Upload your resume, fill your profile once, and auto-fill job applications on Greenhouse, Lever, Workday and 100+ ATS platforms instantly.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#09090b] text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
