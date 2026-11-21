
import type { Metadata } from "next";
import { hasUsageDashboardSession } from "../../../lib/usage-auth";
import UsageDashboard from "./usage-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BSD API Usage Dashboard",
  robots: { index: false, follow: false }
};

export default async function ApiUsagePage() {
  const authenticated = await hasUsageDashboardSession();
  return <UsageDashboard initialAuthenticated={authenticated} />;
}
