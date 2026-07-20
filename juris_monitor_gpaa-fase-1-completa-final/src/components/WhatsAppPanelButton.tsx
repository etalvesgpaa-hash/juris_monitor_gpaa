// src/components/WhatsAppPanelButton.tsx
// Botão que abre o WhatsApp no Side Panel do Chrome via extensão
// Coloque-o dentro do TopNav, ao lado dos outros botões de ação.

import { useEffect, useState, useCallback } from "react";

type ExtensionStatus = "checking" | "installed" | "not_installed";

export function WhatsAppPanelButton() {
  const [status, setStatus]   = useState<ExtensionStatus>("checking");
  const [opening, setOpening] = useState(false);

  // Verifica se a extensão está instalada ao montar
  useEffect(() => {
    const timer = setTimeout(() => {
      // Se nenhuma resposta em 800ms → extensão não instalada
      setStatus("not_installed");
    }, 800);

    const handler = (event: MessageEvent) => {
      if (event.data?.source !== "JURISMONITOR_EXTENSION") return;
      if (event.data?.type === "EXTENSION_STATUS") {
        clearTimeout(timer);
        setStatus(event.data.installed ? "installed" : "not_installed");
      }
    };

    window.addEventListener("message", handler);

    // Pede status à extensão
    window.postMessage(
      { source: "JURISMONITOR_APP", type: "CHECK_EXTENSION" },
      "*"
    );

    return () => {
      window.removeEventListener("message", handler);
      clearTimeout(timer);
    };
  }, []);

  const handleClick = useCallback(() => {
    if (status === "not_installed") {
      // Abre instruções de instalação
      window.open(
        "https://github.com/seu-usuario/jurismonitor-whatsapp-extension#instalacao",
        "_blank"
      );
      return;
    }

    setOpening(true);

    // Pede para a extensão abrir o Side Panel
    window.postMessage(
      { source: "JURISMONITOR_APP", type: "OPEN_WHATSAPP_PANEL" },
      "*"
    );

    setTimeout(() => setOpening(false), 1500);
  }, [status]);

  // ── Estilos base (idênticos ao padrão do TopNav) ──
  const baseClass =
    "flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap border";

  if (status === "checking") {
    return (
      <button disabled className={`${baseClass} bg-white/5 border-white/10 text-white/30 cursor-wait`}>
        <WhatsAppIcon className="h-3.5 w-3.5 shrink-0 opacity-50" />
        <span className="hidden sm:inline">WhatsApp</span>
      </button>
    );
  }

  if (status === "not_installed") {
    return (
      <button
        onClick={handleClick}
        title="Instalar extensão JurisMonitor WhatsApp"
        className={`${baseClass} bg-[#25d366]/10 border-[#25d366]/25 text-[#25d366]/60 hover:bg-[#25d366]/20 hover:text-[#25d366]/90`}
      >
        <WhatsAppIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden sm:inline">Instalar ext.</span>
      </button>
    );
  }

  // installed
  return (
    <button
      onClick={handleClick}
      disabled={opening}
      title="Abrir WhatsApp no painel lateral"
      className={`${baseClass} bg-[#25d366]/15 border-[#25d366]/40 text-[#25d366] hover:bg-[#25d366]/25 disabled:opacity-60`}
    >
      <WhatsAppIcon className={`h-3.5 w-3.5 shrink-0 ${opening ? "animate-pulse" : ""}`} />
      <span className="hidden sm:inline">{opening ? "Abrindo…" : "WhatsApp"}</span>
    </button>
  );
}

// SVG minificado do WhatsApp
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
