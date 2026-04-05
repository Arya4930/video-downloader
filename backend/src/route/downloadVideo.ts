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
): Promise<string> {
    try {
        await ensureYTDlpBinary();

        const outputDir = path.dirname(outputFilePath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const ytDlpWrap = new YTDlpWrap(ytDlpBinaryPath);
        console.log('Starting video download...');
        const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';

        const downloadedFilePath = await new Promise<string>((resolve, reject) => {
            const args = [
                videoURL,
                '--no-playlist',
                '--newline',
                '--no-warnings',

                '--proxy',
                proxy,

                '--cookies',
                '/home/ubuntu/video-downloader/cookies.txt',

                '--user-agent',
                'Mozilla/5.0',

                '--format',
                'bestvideo+bestaudio/best',

                '--merge-output-format',
                'mp4',

                '--print',
                'after_move:filepath',

                '-o',
                outputFilePath
            ];
            console.log(args);
            const ytDlpEventEmitter = ytDlpWrap.exec(args);
            let finalPathFromYtDlp: string | null = null;
            let stderrOutput = '';

            ytDlpEventEmitter.on('progress', (progress: YtDlpProgress) => {
                if (onProgress) {
                    onProgress(progress);
                }
            });

            ytDlpEventEmitter.on('ytDlpEvent', (eventType: string, eventData: string) => {
                if (eventType === 'CustomEvent' && typeof eventData === 'string') {
                    const trimmed = eventData.trim();
                    if (trimmed.length > 0) {
                        finalPathFromYtDlp = trimmed;
                    }
                }
            });

            ytDlpEventEmitter.on('stderr', (stderr: string | Buffer) => {
                stderrOutput += stderr.toString();
            });

            ytDlpEventEmitter.on('close', (code: number) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp exited with code ${code}. ${stderrOutput}`.trim()));
                    return;
                }

                resolve(finalPathFromYtDlp ?? outputFilePath);
            });

            ytDlpEventEmitter.on('error', (error: Error) => {
                reject(error);
            });
        });

        if (fs.existsSync(downloadedFilePath)) {
            return downloadedFilePath;
        }

        if (fs.existsSync(outputFilePath)) {
            return outputFilePath;
        }

        throw new Error(`yt-dlp finished but output file was not created. Expected: ${outputFilePath}, yt-dlp reported: ${downloadedFilePath}`);
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
