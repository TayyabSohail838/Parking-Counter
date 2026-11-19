import type { Metadata, Viewport } from "next";
import { Anton, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

// Anton: condensed display face for headings, logo and big numbers (one weight).
const display = Anton({ variable: "--font-display", subsets: ["latin"], weight: "400" });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Parking Counter · Live vehicle counting in your browser",
    template: "%s · Parking Counter",
  },
  description:
    "Count cars, trucks, buses, bikes and people from any camera, live. YOLO11 object detection with OpenCV.js runs privately on your own device.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
