import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import {
  Command,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

function App() {
  const appWindow = getCurrentWindow();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Listen for streaming chunks
    const unlisten = listen<string>("query:chunk", (event) => {
      setResponse((prev) => prev + event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void appWindow.hide();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [appWindow]);

  const handleSubmit = async (value: string) => {
    if (!value.trim() || isLoading) return;

    setIsLoading(true);
    setResponse("");

    try {
      await invoke("query_stream", { prompt: value });
    } catch (error) {
      console.error("Query failed:", error);
      setResponse(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <main className="desktop-canvas relative z-10 w-full px-8 pointer-events-auto">
        <div className="w-full max-w-[900px]">
          <Command
            className="vercel-launcher-container bg-bg-main border border-border-gray rounded-xl overflow-hidden"
            shouldFilter={false}
          >
            <CommandInput
              placeholder="Search apps or ask AI (Tab to chat)"
              value={query}
              onValueChange={setQuery}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  void appWindow.hide();
                  return;
                }
                if (e.key === "Enter") {
                  handleSubmit(query);
                }
              }}
              autoFocus
            />

            <div className="border-t border-border-gray">
              <CommandList className="max-h-[400px] overflow-y-auto no-scrollbar">
                <div className="px-5 py-2.5 bg-[#FAFAFA]">
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-[0.05em]">
                    Suggestions
                  </span>
                </div>

                <div className="py-1">
                  <CommandItem
                    className="w-full flex items-center px-5 py-3.5 hover:bg-[#F9F9F9] transition-all group text-left cursor-pointer data-[selected=true]:bg-[#F9F9F9]"
                    onSelect={() => handleSubmit("Ask AI Assistant")}
                  >
                    <div className="w-9 h-9 rounded bg-black flex items-center justify-center text-white shadow-sm">
                      <span className="material-symbols-outlined text-[20px]">
                        auto_awesome
                      </span>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-[15px] font-medium tracking-tight">
                        Ask AI Assistant
                      </p>
                      <p className="text-[13px] text-text-secondary">
                        Query multiple LLMs simultaneously
                      </p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[12px] text-text-secondary font-medium">
                        Open
                      </span>
                      <span className="material-symbols-outlined text-text-secondary text-[18px]">
                        keyboard_return
                      </span>
                    </div>
                  </CommandItem>

                  <CommandItem
                    className="w-full flex items-center px-5 py-3.5 hover:bg-[#F9F9F9] transition-all group text-left cursor-pointer data-[selected=true]:bg-[#F9F9F9]"
                    onSelect={() => handleSubmit("Terminal")}
                  >
                    <div className="w-9 h-9 rounded border border-border-gray flex items-center justify-center bg-white">
                      <span className="material-symbols-outlined text-[20px] text-text-main">
                        terminal
                      </span>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-[15px] font-medium tracking-tight">
                        Terminal
                      </p>
                      <p className="text-[13px] text-text-secondary">
                        Recently opened • Applications
                      </p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[12px] text-text-secondary font-medium">
                        Open
                      </span>
                      <span className="material-symbols-outlined text-text-secondary text-[18px]">
                        keyboard_return
                      </span>
                    </div>
                  </CommandItem>

                  <CommandItem
                    className="w-full flex items-center px-5 py-3.5 hover:bg-[#F9F9F9] transition-all group text-left cursor-pointer data-[selected=true]:bg-[#F9F9F9]"
                    onSelect={() => handleSubmit("Q4 Roadmap.pdf")}
                  >
                    <div className="w-9 h-9 rounded border border-border-gray flex items-center justify-center bg-white">
                      <span className="material-symbols-outlined text-[20px] text-text-main">
                        description
                      </span>
                    </div>
                    <div className="ml-4 flex-1">
                      <p className="text-[15px] font-medium tracking-tight">
                        Q4 Roadmap.pdf
                      </p>
                      <p className="text-[13px] text-text-secondary">
                        Documents • 2MB
                      </p>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[12px] text-text-secondary font-medium">
                        Open
                      </span>
                      <span className="material-symbols-outlined text-text-secondary text-[18px]">
                        keyboard_return
                      </span>
                    </div>
                  </CommandItem>
                </div>
              </CommandList>
            </div>

            {response && (
              <div className="border-t border-border-gray p-5 bg-white">
                <div className="text-[14px] text-text-main whitespace-pre-wrap">
                  {response}
                </div>
              </div>
            )}

            <div className="px-5 py-3 border-t border-border-gray bg-[#FAFAFA] flex justify-between items-center">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded border border-border-gray bg-white text-[10px] font-sans font-bold text-text-secondary shadow-sm">
                    ENTER
                  </kbd>
                  <span className="text-[12px] text-text-secondary">
                    to select
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 rounded border border-border-gray bg-white text-[10px] font-sans font-bold text-text-secondary shadow-sm">
                    ESC
                  </kbd>
                  <span className="text-[12px] text-text-secondary">
                    to close
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[12px] text-text-secondary font-medium">
                    AI Systems Online
                  </span>
                </div>
                <div className="h-3 w-[1px] bg-border-gray"></div>
                <div className="flex items-center gap-1.5 hover:text-black cursor-pointer group">
                  <span className="material-symbols-outlined text-[16px] text-text-secondary group-hover:text-black">
                    settings
                  </span>
                  <span className="text-[12px] text-text-secondary group-hover:text-black font-medium">
                    Settings
                  </span>
                </div>
              </div>
            </div>
          </Command>
        </div>
      </main>
    </div>
  );
}

export default App;
