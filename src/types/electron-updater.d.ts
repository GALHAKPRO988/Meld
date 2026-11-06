interface Window {
  meldUpdater?: {
    installLatest(): Promise<boolean>;
    onDownloadProgress(callback: (progress: { percent: number }) => void): () => void;
  };
}
