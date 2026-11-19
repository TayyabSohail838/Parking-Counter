import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Everything the live counter has counted on this device: totals, peak hours, vehicle types and sessions.",
};

export default function DashboardPage() {
  return <Dashboard />;
}
