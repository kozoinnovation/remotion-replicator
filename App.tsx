import React, { useState, useRef, useCallback } from 'react';
import { Upload, Film, Loader2, Sparkles, AlertCircle, X } from 'lucide-react';
import { AnalysisView } from './components/AnalysisView';
import { AuthButton, UsageAlert } from './components/AuthButton';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import { VideoFile, AnalysisState } from './types';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB (Supabase Storage limit)

export default function App() {
  const { user, session, profile, refreshProfile } = useAuth();
  const [video, setVideo] = useState<VideoFile | null>(null);
  const [analysisState, setAnalysisState] = useState<AnalysisState>({ status: 'idle' });
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setAnalysisState({ status: 'error', error: 'File too large. Please upload a video under 100MB.' });
      return;
    }

    setAnalysisState({ status: 'idle' });
    const previewUrl = URL.createObjectURL(file);

    setVideo({
      file,
      previewUrl,
      base64Data: '', // Not needed anymore
      mimeType: file.type
    });
  }, []);

  const handleAnalyze = async () => {
    if (!video || !user || !session) return;

    // Check usage limit
    const limit = { free: 3, starter: 30, pro: 150 }[profile?.plan || 'free'] || 3;
    const usage = profile?.usage_count || 0;
    if (usage >= limit) {
      setAnalysisState({ status: 'error', error: 'Usage limit reached. Please upgrade your plan.' });
      return;
    }

    setAnalysisState({ status: 'analyzing' });
    setUploadProgress(0);

    try {
      // Upload video to Supabase Storage
      const filePath = `${user.id}/${Date.now()}-${video.file.name}`;

      setUploadProgress(10);

      const { error: uploadError } = await supabase
        .storage
        .from('videos')
        .upload(filePath, video.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setUploadProgress(50);

      // Call analyze API
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ storagePath: filePath }),
      });

      setUploadProgress(90);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();

      setUploadProgress(100);
      setAnalysisState({ status: 'complete', result: data.result });

      // Refresh profile to update usage count
      await refreshProfile();

      // Cleanup: delete the uploaded video (optional)
      await supabase.storage.from('videos').remove([filePath]);

    } catch (error: any) {
      setAnalysisState({ status: 'error', error: error.message || 'An unexpected error occurred' });
    }
  };

  const clearVideo = () => {
    if (video?.previewUrl) URL.revokeObjectURL(video.previewUrl);
    setVideo(null);
    setAnalysisState({ status: 'idle' });
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canAnalyze = user && profile && (profile.usage_count < ({ free: 3, starter: 30, pro: 150 }[profile.plan] || 3));

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-remotion-blue selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-md border-b border-remotion-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-remotion-blue to-purple-600 rounded-lg flex items-center justify-center">
              <Film className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">Remotion<span className="text-gray-400">Replicator</span></h1>
          </div>
          <AuthButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex flex-col items-center gap-12">

          {/* Hero Section */}
          {!video && (
            <div className="text-center space-y-4 animate-fade-in">
              <h2 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 pb-2">
                Turn any UI video into Code.
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
                Upload a screen recording of an animation. We'll extract the visual specs, timing, and logic, then generate a production-ready prompt for Remotion.dev.
              </p>
            </div>
          )}

          {/* Usage Alert */}
          <UsageAlert />

          {/* Sign in prompt for non-authenticated users */}
          {!user && (
            <div className="w-full max-w-2xl p-6 bg-remotion-card/50 border border-remotion-border rounded-2xl text-center">
              <p className="text-gray-400 mb-4">Sign in to start analyzing videos</p>
              <p className="text-sm text-gray-500">Free plan includes 3 analyses per month</p>
            </div>
          )}

          {/* Upload Area */}
          {user && (
            <div className="w-full max-w-2xl mx-auto">
              {!video ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative border-2 border-dashed border-remotion-border hover:border-remotion-blue/50 rounded-2xl p-12 transition-all duration-300 bg-remotion-card/50 hover:bg-remotion-card cursor-pointer"
                >
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-remotion-card border border-remotion-border flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Upload className="w-8 h-8 text-gray-400 group-hover:text-remotion-blue" />
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-medium text-white mb-1">Click to upload video</p>
                      <p className="text-sm text-gray-500">MP4, WebM, or MOV (max 100MB)</p>
                    </div>
                  </div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="video/*"
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="bg-remotion-card border border-remotion-border rounded-2xl overflow-hidden shadow-2xl animate-fade-in-up">
                  <div className="relative aspect-video bg-black">
                    <video
                      src={video.previewUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                    <button
                      onClick={clearVideo}
                      className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-sm transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Upload progress bar */}
                  {analysisState.status === 'analyzing' && uploadProgress > 0 && (
                    <div className="px-6 pt-4">
                      <div className="w-full h-2 bg-remotion-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-remotion-blue transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        {uploadProgress < 50 ? 'Uploading...' : uploadProgress < 90 ? 'Analyzing with AI...' : 'Finishing up...'}
                      </p>
                    </div>
                  )}

                  <div className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-remotion-border">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Film className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white text-sm truncate max-w-[200px]">{video.file.name}</p>
                        <p className="text-xs text-gray-500">{(video.file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>

                    {analysisState.status === 'analyzing' ? (
                      <button disabled className="w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-white bg-remotion-blue/50 cursor-not-allowed flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </button>
                    ) : (
                      <button
                        onClick={handleAnalyze}
                        disabled={analysisState.status === 'complete' || !canAnalyze}
                        className={`w-full sm:w-auto px-8 py-3 rounded-lg font-semibold text-white flex items-center justify-center gap-2 transition-all
                          ${analysisState.status === 'complete'
                            ? 'bg-green-600 hover:bg-green-700'
                            : !canAnalyze
                              ? 'bg-gray-600 cursor-not-allowed'
                              : 'bg-remotion-blue hover:bg-blue-600 shadow-[0_0_20px_rgba(11,132,243,0.3)] hover:shadow-[0_0_30px_rgba(11,132,243,0.5)]'
                          }`}
                      >
                        {analysisState.status === 'complete' ? (
                          <>
                            <Sparkles className="w-5 h-5" />
                            Analysis Complete
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            Analyze Animation
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {analysisState.status === 'error' && (
            <div className="w-full max-w-2xl p-4 bg-red-900/20 border border-red-500/50 text-red-200 rounded-lg flex items-center gap-3 animate-pulse">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{analysisState.error}</p>
            </div>
          )}

          {/* Results Area */}
          {analysisState.result && (
            <div className="w-full animate-fade-in-up">
              <div className="flex items-center gap-4 mb-8">
                <div className="h-px bg-remotion-border flex-1" />
                <span className="text-gray-500 font-mono text-sm uppercase tracking-wider">Analysis Results</span>
                <div className="h-px bg-remotion-border flex-1" />
              </div>
              <AnalysisView content={analysisState.result} />
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
