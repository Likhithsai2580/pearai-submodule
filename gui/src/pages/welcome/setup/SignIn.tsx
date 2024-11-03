"use client";

import { Button } from "@/components/ui/button";
import { ArrowLongRightIcon } from "@heroicons/react/24/outline";
import { useContext, useEffect } from "react";
import { IdeMessengerContext } from "@/context/IdeMessenger";
import { useWebviewListener } from "@/hooks/useWebviewListener";

export default function SignIn({
  onNext,
}: {
  onNext: () => void;
}) {
  const ideMessenger = useContext(IdeMessengerContext);

  useWebviewListener("pearAISignedIn", async () => {
    onNext();
    return Promise.resolve();
  });

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        ideMessenger.post("markNewOnboardingComplete", undefined);
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className="step-content flex w-full overflow-hidden bg-background text-foreground">
      <div className="w-full flex flex-col h-screen">
        <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-10">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-6">
            Sign in to your account
          </h2>

          <p className="text-muted-foreground text-base md:text-md max-w-[500px] text-center mb-16">
            Sign up to start using PearAI and supercharge your development
            workflow
          </p>

          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-12">
            <Button
              className="w-[250px] md:w-[280px] text-button-foreground bg-button hover:bg-button-hover p-5 md:p-6 text-base md:text-lg cursor-pointer"
              onClick={() => ideMessenger.post("pearaiLogin", undefined)}
            >
              Sign in
            </Button>

            <Button className="w-[250px] md:w-[280px] bg-input  border border-input p-5 md:p-6 text-base md:text-lg cursor-pointer">
              <a
                href="https://trypear.ai/signup"
                target="_blank"
                className="text-foreground hover:text-button-foreground no-underline"
              >
                Sign up
              </a>
            </Button>
          </div>

          <div
            onClick={() => {
              ideMessenger.post("markNewOnboardingComplete", undefined);
              onNext();
            }}
          >
            <kbd className="flex cursor-pointer items-center font-mono text-xs bg-[var(--vscode-input-background)] min-w-[1rem]">Space to Skip</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}