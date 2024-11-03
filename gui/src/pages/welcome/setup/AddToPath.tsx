"use client";

import { Button } from "@/components/ui/button";
import { IdeMessengerContext } from "@/context/IdeMessenger";
import { ArrowLongRightIcon } from "@heroicons/react/24/outline";
import { useContext, useState, useEffect } from "react";

export default function AddToPath({
  onNext,
}: {
  onNext: () => void;
}) {
  const ideMessenger = useContext(IdeMessengerContext);
  const [pathAdded, setPathAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToPath = () => {
    if (!isAdding) {
      setIsAdding(true);
      ideMessenger.post("pearInstallCommandLine", undefined);
      setTimeout(() => {
        setPathAdded(true);
        onNext();
      }, 2000);
    }
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !isAdding) {
        handleAddToPath();
      } else if (event.key === ' ') {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isAdding]);

  return (
    <div className="step-content flex w-full overflow-hidden bg-background text-foreground">
      <div className="w-full flex flex-col h-screen">
        <div className="flex-1 flex flex-col items-center justify-center">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-6">
            Add PearAI to PATH
          </h2>

          <p className="text-muted-foreground text-sm md:text-base">
            Access PearAI directly from your terminal
          </p>

          <div className="w-full max-w-2xl mb-8 rounded-lg overflow-hidden border border-solid border-input shadow-sm">
            <div className="bg-input p-2 border-b border-input flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[var(--vscode-terminal-ansiRed)]"></div>
                <div className="w-3 h-3 rounded-full bg-[var(--vscode-terminal-ansiYellow)]"></div>
                <div className="w-3 h-3 rounded-full bg-[var(--vscode-terminal-ansiGreen)]"></div>
              </div>
              <span className="text-xs text-muted-foreground">Terminal</span>
            </div>

            <div className="bg-[var(--vscode-terminal-background)] p-4 border border-input m-1 rounded-sm">
              <div className="font-mono text-sm">
                <span className="text-[var(--vscode-terminal-foreground)]">
                  $ cd /path/to/your/project
                </span>
              </div>
              <div className="font-mono text-sm mt-2 flex items-center">
                <span className="text-[var(--vscode-terminal-foreground)]">
                  $&nbsp;
                </span>
                <span className="text-[var(--vscode-terminal-ansiCyan)]">
                  pearai .
                </span>
                <span className="ml-1 animate-pulse">▋</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <Button
              className="w-[250px] text-button-foreground bg-button hover:bg-button-hover p-4 lg:py-6 lg:px-2 text-sm md:text-base cursor-pointer"
              onClick={handleAddToPath}
            >
              <div className="flex items-center justify-between w-full gap-2">
                {isAdding ? (
                  <div className="flex items-center justify-center w-full gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-button-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Adding...</span>
                  </div>
                ) : (
                  <>
                    <div className="w-8" /> {/* Spacer to balance the button */}
                    <span>Add to PATH</span>
                    <kbd className="flex items-center font-mono px-2 text-sm justify-center bg-[var(--vscode-input-background)] min-w-[2rem]">Enter</kbd>
                  </>
                )}
              </div>
            </Button>

            {!pathAdded ? (
              <kbd
                onClick={onNext}
                className="flex mt-2 cursor-pointer items-center font-mono text-xs bg-[var(--vscode-input-background)] min-w-[1rem]">Space to Skip</kbd>
            ):
            (
              <div className="text-sm text-muted-foreground text-center">
                <span>
                  PearAI added to PATH
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}