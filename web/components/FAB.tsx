"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import CreatePostModal from "./CreatePostModal";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  onPostCreated?: () => void;
}

export default function FAB({ onPostCreated }: Props) {
  const router = useRouter();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const items = [
    {
      label: t("fab_post"),
      onClick: () => { setOpen(false); setShowModal(true); },
    },
    {
      label: t("fab_history"),
      onClick: () => { setOpen(false); router.push("/stories/create"); },
    },
    {
      label: t("fab_live"),
      onClick: () => {},
    },
  ];

  return (
    <>
      {/* Backdrop para cerrar al hacer click afuera */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}

      <div
        className="fixed bottom-[25px] flex flex-col-reverse items-center gap-3 z-50"
        style={{ right: "max(25px, calc(50% - 190px))" }}
      >
        {/* Main button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-gray-700 text-white flex items-center justify-center shadow-xl hover:border-gray-500 transition-colors duration-200"
        >
          <span
            className="text-2xl font-thin leading-none select-none transition-transform duration-300"
            style={{ transform: open ? "rotate(45deg)" : "rotate(0deg)" }}
          >
            +
          </span>
        </button>

        {/* Sub-buttons */}
        {items.map((btn, i) => (
          <button
            key={btn.label}
            onClick={btn.onClick}
            className="w-14 h-14 rounded-full bg-[#1A1A1A] border border-gray-700 text-white text-[9px] font-bold leading-tight flex items-center justify-center shadow-xl whitespace-pre-line text-center transition-all duration-300"
            style={{
              opacity: open ? 1 : 0,
              transform: open ? "translateY(0)" : "translateY(16px)",
              transitionDelay: open ? `${i * 60}ms` : "0ms",
              pointerEvents: open ? "auto" : "none",
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {showModal && (
        <CreatePostModal
          onClose={() => setShowModal(false)}
          onCreated={() => { onPostCreated?.(); }}
        />
      )}
    </>
  );
}
