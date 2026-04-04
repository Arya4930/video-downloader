import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import fs from 'fs';

const ytDlpBinaryPath = path.join(__dirname, 'yt-dlp');

function sanitizeVideoTitle(title: string): string {
    return title
        .trim()
        .replace(/[<>:"'/\\|?*]+/g, '')
        .replace(/\s+/g, '-');
}

async function ensureYTDlpBinary(): Promise<void> {
    if (!fs.existsSync(ytDlpBinaryPath)) {
        console.log('Downloading yt-dlp binary...');
        try {
            await YTDlpWrap.downloadFromGithub(ytDlpBinaryPath);
            console.log('yt-dlp binary downloaded successfully.');
        } catch (error) {
            console.error('Failed to download yt-dlp:', error);
            throw error;
        }
    } else {
        console.log('yt-dlp binary already exists.');
    }
}

export type YtDlpProgress = {
    percent?: number;
    totalSize?: string;
    currentSpeed?: string;
    eta?: string;
};

export async function DownloadVideoToFile(
    videoURL: string,
    outputFilePath: string,
    onProgress?: (progress: YtDlpProgress) => void
): Promise<void> {
    try {
        await ensureYTDlpBinary();

        const outputDir = path.dirname(outputFilePath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const ytDlpWrap = new YTDlpWrap(ytDlpBinaryPath);
        console.log('Starting video download...');

        await new Promise<void>((resolve, reject) => {
            const ytDlpEventEmitter = ytDlpWrap.exec([
                videoURL,
                '--no-playlist',
                '--newline',
                '--no-warnings',
                '--cookies',
                '/home/ubuntu/video-downloader/cookies.txt',
                '--user-agent',
                'Mozilla/5.0',
                '--merge-output-format',
                'mp4',
                '-o',
                outputFilePath
            ]);

            ytDlpEventEmitter.on('progress', (progress: YtDlpProgress) => {
                if (onProgress) {
                    onProgress(progress);
                }
            });

            ytDlpEventEmitter.on('close', () => {
                resolve();
            });

            ytDlpEventEmitter.on('error', (error: Error) => {
                reject(error);
            });
        });

        if (!fs.existsSync(outputFilePath)) {
            throw new Error('yt-dlp finished but output file was not created.');
        }
    } catch (err: any) {
        console.error('Download failed:', err.message);
        throw err;
    }
}

export async function getVideoTitle(
    videoURL: string
): Promise<string | null> {
    try {
        await ensureYTDlpBinary();

        const ytDlpWrap = new YTDlpWrap(ytDlpBinaryPath);
        const metadata = await ytDlpWrap.getVideoInfo(videoURL);

        return sanitizeVideoTitle(metadata.title);
    } catch (error) {
        console.error('Failed to get video title:', error);
        return null;
    }
}
