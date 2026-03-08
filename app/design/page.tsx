"use client";

import { useDesignSession } from "@/lib/store/design-session";
import DesignSessionHeader from "@/app/components/atelier/DesignSessionHeader";
import ComponentBrowser from "@/app/components/atelier/ComponentBrowser";
import FabricPicker from "@/app/components/atelier/FabricPicker";
import ModelViewer from "@/app/components/ModelViewer";
import TaraChat from "@/app/components/TaraChat";

export default function DesignStudioPage() {
  const studioMode = useDesignSession((s) => s.studioMode);
  const isImagine = studioMode === "imagine";

  return (
    <div className="flex h-screen flex-col bg-[#1a1a1a]">
      {/* Top header with mode switcher, name, save */}
      <DesignSessionHeader />

      {/* Main content: sidebar + viewer */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — both panels stay mounted, visibility toggled via CSS */}
        <div className="flex w-full flex-shrink-0 flex-col border-r border-gray-800 md:w-[400px]">
          {/* Imagine mode: TARA chat */}
          <div className={isImagine ? "flex flex-1 flex-col" : "hidden"}>
            <TaraChat />
          </div>

          {/* Atelier mode: component browser + fabric picker */}
          <div className={isImagine ? "hidden" : "flex flex-1 flex-col overflow-hidden"}>
            {/* Component browser takes most of the space */}
            <div className="flex-1 overflow-hidden">
              <ComponentBrowser />
            </div>
            {/* Fabric picker in lower portion */}
            <div className="max-h-[40%] border-t border-gray-800 overflow-y-auto">
              <FabricPicker />
            </div>
          </div>
        </div>

        {/* 3D Viewer — fills remaining space */}
        <div className="relative flex-1">
          <ModelViewer designMode />
        </div>
      </div>
    </div>
  );
}
