import Link from "next/link";
import ModelViewer from "@/app/components/ModelViewer";
import TaraChat from "@/app/components/TaraChat";
import UserNav from "@/app/components/UserNav";

export default function Home() {
  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      {/* Chat panel — left */}
      <div className="w-[400px] flex-shrink-0 border-r border-gray-800">
        <TaraChat />
      </div>

      {/* Viewer panel — right */}
      <div className="relative flex-1">
        <ModelViewer showcaseStoragePath="BOD-89/heavy.obj" />
        <UserNav />
        <div className="fixed bottom-4 right-4 z-10 flex items-center gap-3">
          <Link
            href="/design"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-200"
          >
            Open Design Studio
          </Link>
        </div>
      </div>
    </div>
  );
}
