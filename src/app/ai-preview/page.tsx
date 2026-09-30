import { notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import DemoClient from "./demo-client";

export default function PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <div className="flex min-h-screen"><Sidebar profile={null} /><main className="min-w-0 flex-1"><DemoClient /></main></div>;
}
