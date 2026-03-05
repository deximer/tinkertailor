import ModelViewer from "@/app/components/ModelViewer";
import LogoutButton from "@/app/components/LogoutButton";
import TaraChat from "@/app/components/TaraChat";

export default function Home() {
  return (
    <div className="flex h-screen bg-[#1a1a1a]">
      {/* Chat panel — left */}
      <div className="w-[400px] flex-shrink-0 border-r border-gray-800">
        <TaraChat />
      </div>

      {/* Viewer panel — right */}
      <div className="relative flex-1">
        <ModelViewer />
        <LogoutButton />
      </div>
    </div>
  );
}
