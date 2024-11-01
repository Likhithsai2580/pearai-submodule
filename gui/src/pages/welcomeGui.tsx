'use client'

import { useEffect, useState, useRef, useContext, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Bot, Search, Sparkles } from "lucide-react"
import { useNavigate } from 'react-router-dom';
import { ArrowLongRightIcon } from "@heroicons/react/24/outline"
import { IdeMessengerContext } from '@/context/IdeMessenger'

declare global {
    interface Window {
      vscMediaUrl: string;
    }
  }
  
  // Function to get correct asset path (FOR GIFs)
  const getAssetPath = (assetName: string) => {
    return `${window.vscMediaUrl}/assets/${assetName}`;
  }
  
  console.dir(window.vscMediaUrl);

export default function Welcome() {
  const [currentFeature, setCurrentFeature] = useState(0)
  const [progress, setProgress] = useState(0)
  const progressInterval = useRef<NodeJS.Timeout>()
  const [isLoading, setIsLoading] = useState(true)
  const [timestamp, setTimestamp] = useState(Date.now())
  const navigate = useNavigate();
  const [step, setStep] = useState<'features' | 'import-extensions' | 'add-to-path' | 'final'>('features');

  const FEATURE_DURATION = 5000 // TODO: 5 seconds per feature, to be changed individually when have final demo gifs
  const AUTO_PROGRESS = false // Flag to control auto-progression

  const features = [
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: "PearAI Assistant",
      description: "Ask Assistant to help you understand code and make changes, powered by Continue.",
      video: getAssetPath('high-def.png'),
    },
    {
      icon: <Bot className="h-6 w-6" />,
      title: "PearAI Create",
      description: "Generate code and solutions with AI assistance.",
      video: getAssetPath('pearai-@file.gif')
    },
    {
      icon: <Search className="h-6 w-6" />,
      title: "PearAI Search",
      description: "Search through your codebase intelligently.",
      video: getAssetPath('pearai-CMD+I.gif')
    }
  ]

  const ideMessenger = useContext(IdeMessengerContext);

  const isUserSignedIn = useMemo(() => {
    return ideMessenger.request("getPearAuth", undefined).then((res) => {
      return res?.accessToken ? true : false;
    });
  }, [ideMessenger]);

  const [videoSrc, setVideoSrc] = useState(features[0].video)

  // Preload the next GIF before transition
  useEffect(() => {
    setIsLoading(true)
    const img = new Image()
    img.onload = () => {
      setIsLoading(false)
      setVideoSrc(features[currentFeature].video)
    }
    img.src = features[currentFeature].video
  }, [currentFeature])

  useEffect(() => {
    if (!AUTO_PROGRESS) return; // Skip if auto-progress is disabled

    // Start progress animation
    const startTime = Date.now()
    progressInterval.current = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = (elapsed / FEATURE_DURATION) * 100

      if (newProgress >= 100) {
        // Move to next feature
        setCurrentFeature(current => (current + 1) % features.length)
        setProgress(0)
        clearInterval(progressInterval.current)
      } else {
        setProgress(newProgress)
      }
    }, 50)

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [currentFeature])

  const startWalkthrough = () => {
    setCurrentFeature(0)
    setProgress(0)
  }

  const handleFeatureChange = (index: number) => {
    setCurrentFeature(index)
    setProgress(0)
    setTimestamp(Date.now())
  }

  const handleNextClick = () => {
    if (step === 'features') {
      if (currentFeature < features.length - 1) {
        handleFeatureChange(currentFeature + 1);
      } else {
        setStep('import-extensions');
      }
    } else {
      // Handle completion of import extensions step
      // This will be implemented later
    }
  };

  const getButtonText = () => {
    if (currentFeature === features.length - 1) {
      return "Next";
    }
    return "Next";
  }

  if (step === 'import-extensions') {
    return (
      <div className="flex w-full overflow-hidden bg-background text-foreground">
        <div className="w-full flex flex-col h-screen">
          <div 
            onClick={() => setStep('features')}
            className="absolute top-4 left-4 md:top-6 md:left-6 lg:top-8 lg:left-8 flex items-center gap-2 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] cursor-pointer transition-colors group"
          >
            <ArrowLongRightIcon className="w-4 h-4 rotate-180" />
            <span className="text-sm">Back</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-6">
              Import Extensions and Settings
            </h2>
            
            <p className="text-muted-foreground text-sm md:text-base mb-12">
              Import your VS Code extensions and settings to PearAI
            </p>

            <div className="flex items-center justify-center gap-12 mb-12">
              <div className="w-24 h-24 md:w-28 md:h-28 flex items-center justify-center">
                <img 
                  src={`${window.vscMediaUrl}/assets/vscode-icon.svg`} 
                  alt="VS Code"
                  className="w-full h-full object-contain"
                />
              </div>

              <ArrowLongRightIcon className="w-12 h-12 ml-6 md:w-20 md:h-20 text-muted-foreground" />

              <div className="w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
                <img 
                  src={`${window.vscMediaUrl}/assets/pear-icon.svg`}
                  alt="PearAI"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <Button 
                className="w-[200px] text-button-foreground bg-button hover:bg-button-hover p-4 md:p-5 lg:p-6 text-sm md:text-base cursor-pointer"
                onClick={() => {ideMessenger.post("importUserSettingsFromVSCode", undefined)}}
              >
                Import Extensions
              </Button>

              <div
                onClick={() => setStep('add-to-path')}
                className="text-sm text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] underline cursor-pointer transition-colors"
              >
                Skip importing extensions
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'add-to-path') {
    return (
      <div className="flex w-full overflow-hidden bg-background text-foreground">
        <div className="w-full flex flex-col h-screen">
          <div 
            onClick={() => setStep('import-extensions')}
            className="absolute top-4 left-4 md:top-6 md:left-6 lg:top-8 lg:left-8 flex items-center gap-2 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] cursor-pointer transition-colors group"
          >
            <ArrowLongRightIcon className="w-4 h-4 rotate-180" />
            <span className="text-sm">Back</span>
          </div>
  
          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-6">
              Add Pear to PATH
            </h2>
            
            <p className="text-muted-foreground text-sm md:text-base mb-12">
              Access Pear directly from your terminal
            </p>
  
            {/* Terminal UI */}
            <div className="w-full max-w-2xl mb-12 rounded-lg overflow-hidden border border-solid border-input shadow-sm">
              {/* Terminal Header */}
              <div className="bg-input p-2 border-b border-input flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[var(--vscode-terminal-ansiRed)]"></div>
                  <div className="w-3 h-3 rounded-full bg-[var(--vscode-terminal-ansiYellow)]"></div>
                  <div className="w-3 h-3 rounded-full bg-[var(--vscode-terminal-ansiGreen)]"></div>
                </div>
                <span className="text-xs text-muted-foreground">Terminal</span>
              </div>
              
              {/* Terminal Content */}
              <div className="bg-[var(--vscode-terminal-background)] p-4 border border-input m-1 rounded-sm">
                <div className="font-mono text-sm">
                  <span className="text-[var(--vscode-terminal-foreground)]">$ cd /path/to/your/project</span>
                </div>
                <div className="font-mono text-sm mt-2 flex items-center">
                  <span className="text-[var(--vscode-terminal-foreground)]">$&nbsp;</span>
                  <span className="text-[var(--vscode-terminal-ansiCyan)]">pear .</span>
                  <span className="ml-1 animate-pulse">▋</span>
                </div>
              </div>
            </div>
  
            <div className="flex flex-col items-center gap-4">
              <Button 
                className="w-[200px] text-button-foreground bg-button hover:bg-button-hover p-4 md:p-5 lg:p-6 text-sm md:text-base cursor-pointer"
                onClick={() => {
                  // First handle the import functionality
                  /* Import functionality will go here */
                  
                  // Then navigate to add-to-path step
                  setStep('add-to-path');
                }}
              >
                Add to PATH
              </Button>
  
              <div
                onClick={() => setStep('final')}
                className="text-sm text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] underline cursor-pointer transition-colors"
              >
                Skip adding to PATH
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'final' && !isUserSignedIn) {
    return (
      <div className="flex w-full overflow-hidden bg-background text-foreground">
        <div className="w-full flex flex-col h-screen">
          <div 
            onClick={() => setStep('add-to-path')}
            className="absolute top-4 left-4 md:top-6 md:left-6 lg:top-8 lg:left-8 flex items-center gap-2 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] cursor-pointer transition-colors group"
          >
            <ArrowLongRightIcon className="w-4 h-4 rotate-180" />
            <span className="text-sm">Back</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-10">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-6">
              Sign in to your account
            </h2>
            
            <p className="text-muted-foreground text-base md:text-md max-w-[500px] text-center mb-16">
              Sign up to start using PearAI and supercharge your development workflow
            </p>

            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-12">
              <Button 
                className="w-[250px] md:w-[280px] text-button-foreground bg-button hover:bg-button-hover p-5 md:p-6 text-base md:text-lg cursor-pointer"
                onClick={() => ideMessenger.post("pearaiLogin", undefined)}
              >
                Sign in
              </Button>

              <Button
                className="w-[250px] md:w-[280px] bg-input  border border-input p-5 md:p-6 text-base md:text-lg cursor-pointer"
              >
                <a href="https://trypear.ai/signup" target="_blank" className='text-foreground hover:text-button-foreground no-underline'>Sign up</a>
              </Button>
            </div>

            <div
              onClick={() => {/* Close functionality */}}
              className="text-sm underline cursor-pointer text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] transition-colors"
            >
              Close
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'final' && isUserSignedIn) {
    return (
      <div className="flex w-full overflow-hidden bg-background text-foreground">
        <div className="w-full flex flex-col h-screen">
          <div 
            onClick={() => setStep('add-to-path')}
            className="absolute top-4 left-4 md:top-6 md:left-6 lg:top-8 lg:left-8 flex items-center gap-2 text-[var(--vscode-descriptionForeground)] hover:text-[var(--vscode-foreground)] cursor-pointer transition-colors group"
          >
            <ArrowLongRightIcon className="w-4 h-4 rotate-180" />
            <span className="text-sm">Back</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 lg:p-10">
            <div className="w-24 h-24 md:w-32 md:h-32 mb-8 flex items-center justify-center">
              <img 
                src={`${window.vscMediaUrl}/assets/pear-icon.svg`}
                alt="PearAI"
                className="w-full h-full object-contain"
              />
            </div>

            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-6">
              You are all set!
            </h2>
            
            <p className="text-muted-foreground text-base md:text-lg max-w-[500px] text-center mb-12">
              Start using PearAI by opening a folder and remember CMD/CTRL + L
            </p>

            <div className="flex flex-col items-center gap-3">
              <Button 
                className="w-[250px] md:w-[280px] text-button-foreground bg-button hover:bg-button-hover p-5 md:p-6 text-base md:text-lg cursor-pointer"
                onClick={() => {ideMessenger.post("pearWelcomeOpenFolder", undefined)}}
              >
                Open a folder 
              </Button>

              <p className="text-sm md:text-base text-muted-foreground text-center max-w-[400px] mt-4 mb-6">
                Join our growing community of developers to share experiences, get help, and shape the future of PearAI
              </p>

              <div className="flex flex-col md:flex-row items-center gap-4">
                <a 
                  href="https://twitter.com/pearai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-[250px] md:w-[200px] flex text-foreground hover:text-button-foreground no-underline items-center justify-center gap-2 p-4 text-white bg-[#000000] transition-colors rounded-md text-sm md:text-base cursor-pointer"
                >
                  <img 
                    src={`${window.vscMediaUrl}/assets/twitter-x.svg`} 
                    alt="Twitter"
                    className="w-5 h-5"
                    style={{filter: 'brightness(0) invert(1)'}}
                  />
                  Follow us
                </a>
                <a 
                  href="https://discord.gg/pearai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="w-[250px] md:w-[200px] flex text-button-foreground hover:text-button-foreground no-underline items-center justify-center gap-2 p-4 text-white bg-[#5865F2] hover:bg-[#4752C4] transition-colors rounded-md text-sm md:text-base cursor-pointer"
                >
                  <img 
                    src={`${window.vscMediaUrl}/assets/discord.svg`} 
                    alt="Discord"
                    className="w-5 h-5"
                    style={{filter: 'brightness(0) invert(1)'}}
                  />
                  Join Discord
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }


  // features step
  return (
    <div className="flex w-full overflow-hidden bg-background text-foreground">
      {/* Left side - Content */}
      <div className="w-[35%] min-w-[320px] max-w-[420px] flex flex-col h-screen">
        {/* Content section scrollable if user's screen small */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
                Welcome to PearAI.
              </h2>
              <p className="text-sm text-muted-foreground">
                Speed up your development process by seamlessly integrating AI into your workflow.
              </p>
            </div>
            <div className="space-y-3">
              {features.map((feature, index) => (
                <Card 
                  key={index}
                  className={`border-none p-3 transition-all duration-200 hover:scale-[1.02] ${
                    currentFeature === index 
                      ? 'bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] shadow-sm ring-1 ring-[var(--vscode-input-border)]' 
                      : 'bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] opacity-60 hover:opacity-80'
                  }`}
                  onClick={() => handleFeatureChange(index)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${
                      currentFeature === index 
                        ? 'bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)]' 
                        : 'bg-[var(--vscode-input-background)] text-[var(--vscode-foreground)] opacity-60'
                    }`}>
                      {feature.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm">
                        {feature.title}
                      </h3>
                      {currentFeature === index && 
                      <p className="text-xs text-muted-foreground mt-1">
                        {feature.description}
                      </p>}
                      {currentFeature === index && (
                        <Progress 
                          value={progress} 
                          className="mt-2 h-0.5 bg-input [&>div]:bg-button"
                        />
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Button section at bottom */}
        <div className="p-6 border-t border-input shrink-0">
          <Button 
            className="w-full text-button-foreground bg-button hover:bg-button-hover p-3 text-sm cursor-pointer"
            onClick={handleNextClick}
          >
            {getButtonText()}
          </Button>
        </div>
      </div>

      {/* Right side - Video/Demo */}
      <div className="flex-1 relative bg-[var(--vscode-input-background)]">
        {features.map((feature, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-700 ${
              currentFeature === index 
                ? 'opacity-100 z-10' 
                : 'opacity-0 z-0'
            }`}
          >
            {currentFeature === index && (
              <img
                key={`${feature.title}-${timestamp}`}
                src={`${feature.video}?t=${timestamp}`}
                alt={`${feature.title} demonstration`}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  isLoading ? 'opacity-0' : 'opacity-100'
                }`}
                loading="eager"
                style={{
                  willChange: 'transform, opacity',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>    
  )  
}