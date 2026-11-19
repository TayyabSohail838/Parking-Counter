import type { Metadata } from "next";
import { CounterApp } from "@/components/counter/CounterApp";

export const metadata: Metadata = {
  title: "Live counter",
  description: "Count vehicles and people live from your camera. Detection runs privately in your browser.",
};

export default function CounterPage() {
  return <CounterApp />;
}
