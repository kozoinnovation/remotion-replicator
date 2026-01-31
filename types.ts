export interface AnalysisState {
  status: 'idle' | 'uploading' | 'analyzing' | 'complete' | 'error';
  error?: string;
  result?: string;
}

export interface VideoFile {
  file: File;
  previewUrl: string;
  base64Data?: string;
  mimeType: string;
}
