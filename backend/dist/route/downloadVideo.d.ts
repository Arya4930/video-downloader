export type YtDlpProgress = {
    percent?: number;
    totalSize?: string;
    currentSpeed?: string;
    eta?: string;
};
export declare function DownloadVideoToFile(videoURL: string, outputFilePath: string, onProgress?: (progress: YtDlpProgress) => void): Promise<string>;
export declare function getVideoTitle(videoURL: string): Promise<string | null>;
//# sourceMappingURL=downloadVideo.d.ts.map