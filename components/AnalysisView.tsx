import React from 'react';
import { Copy, Check, Terminal, Layers, Palette, Clock, Database, Clapperboard } from 'lucide-react';

interface AnalysisViewProps {
  content: string;
}

const SectionIcon = ({ title }: { title: string }) => {
  const t = title.toLowerCase();
  if (t.includes('visual')) return <Palette className="w-5 h-5 text-purple-400" />;
  if (t.includes('video')) return <Clapperboard className="w-5 h-5 text-blue-400" />;
  if (t.includes('data')) return <Database className="w-5 h-5 text-green-400" />;
  if (t.includes('logic') || t.includes('choreography')) return <Layers className="w-5 h-5 text-orange-400" />;
  if (t.includes('prompt')) return <Terminal className="w-5 h-5 text-pink-400" />;
  return <Clock className="w-5 h-5 text-gray-400" />;
};

export const AnalysisView: React.FC<AnalysisViewProps> = ({ content }) => {
  // Simple parser to chunk the markdown content by headers for better UX
  const sections = React.useMemo(() => {
    // Split by headers like "1. VISUAL SPECS" or "### Visual Specs"
    const regex = /(?=\n#{1,3} |\n\d+\. )/g;
    const rawSections = content.split(regex);
    return rawSections.map(s => s.trim()).filter(s => s.length > 0);
  }, [content]);

  const [copiedSection, setCopiedSection] = React.useState<number | null>(null);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(index);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto pb-20">
      {sections.map((section, index) => {
        // Attempt to extract a title
        const titleMatch = section.match(/^(#{1,3} |\d+\. )(.*)/);
        const title = titleMatch ? titleMatch[2] : "Analysis Overview";
        const body = section.replace(/^(#{1,3} |\d+\. )(.*)/, '').trim();

        // Check if this section contains the final prompt code block
        const codeBlockMatch = body.match(/```(?:markdown|text)?([\s\S]*?)```/);
        const isPromptSection = title.toLowerCase().includes('prompt');
        
        return (
          <div key={index} className="bg-remotion-card border border-remotion-border rounded-xl overflow-hidden shadow-lg animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
            <div className="bg-[#1A1D1F] px-6 py-4 flex items-center justify-between border-b border-remotion-border">
              <div className="flex items-center gap-3">
                <SectionIcon title={title} />
                <h3 className="font-bold text-lg text-gray-100">{title}</h3>
              </div>
              <button
                onClick={() => handleCopy(isPromptSection && codeBlockMatch ? codeBlockMatch[1].trim() : section, index)}
                className="flex items-center gap-2 text-xs font-mono text-gray-400 hover:text-white transition-colors bg-remotion-border/30 px-3 py-1.5 rounded-md hover:bg-remotion-border/60"
              >
                {copiedSection === index ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isPromptSection ? 'Copy Prompt' : 'Copy Section'}</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="p-6 text-gray-300 leading-relaxed font-sans">
              {isPromptSection && codeBlockMatch ? (
                 // Special rendering for the prompt section
                 <div className="relative">
                   <div className="text-sm mb-4 text-gray-400 italic">
                     Paste the code block below into your AI coding assistant (Cursor/Claude).
                   </div>
                   <pre className="bg-[#0D0E10] p-4 rounded-lg overflow-x-auto border border-remotion-border/50 text-sm font-mono text-green-400">
                     {codeBlockMatch[1].trim()}
                   </pre>
                 </div>
              ) : (
                // Standard markdown-ish rendering
                <div className="whitespace-pre-wrap">
                    {body.split('\n').map((line, i) => {
                        // Simple highlighting for list items or keys
                        if (line.trim().startsWith('*') || line.trim().startsWith('-')) {
                             const parts = line.split(':');
                             if (parts.length > 1) {
                                 return (
                                     <div key={i} className="mb-2 pl-4">
                                         <span className="text-blue-400 font-medium">{parts[0]}</span>
                                         <span>{parts.slice(1).join(':')}</span>
                                     </div>
                                 )
                             }
                             return <div key={i} className="mb-2 pl-4 text-gray-300">{line}</div>
                        }
                        if (line.trim().length === 0) return <div key={i} className="h-4" />;
                        return <div key={i} className="mb-1">{line}</div>;
                    })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};