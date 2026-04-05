import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import fs from 'fs';

const ytDlpBinaryPath = path.join(__dirname, 'yt-dlp');
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.m4v']);

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

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePathFromYtDlp(rawPath: string): string {
    return rawPath
        .replace(/\x1B\[[0-9;]*m/g, '')
        .replace(/^"|"$/g, '')
        .trim();
}

function isVideoFilePath(filePath: string): boolean {
    return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function waitForExistingPath(candidatePath: string, retries = 10, delayMs = 200): Promise<boolean> {
    for (let i = 0; i < retries; i += 1) {
        if (fs.existsSync(candidatePath)) {
            return true;
        }

        await sleep(delayMs);
    }

    return false;
}

async function resolveDownloadedFilePath(expectedPath: string, reportedPath: string): Promise<string | null> {
    const normalizedReportedPath = normalizePathFromYtDlp(reportedPath);
    const normalizedExpectedPath = normalizePathFromYtDlp(expectedPath);

    if (isVideoFilePath(normalizedReportedPath) && await waitForExistingPath(normalizedReportedPath)) {
        return normalizedReportedPath;
    }

    if (isVideoFilePath(normalizedExpectedPath) && await waitForExistingPath(normalizedExpectedPath)) {
        return normalizedExpectedPath;
    }

    const outputDir = path.dirname(normalizedExpectedPath);
    const expectedName = path.basename(normalizedExpectedPath);
    const expectedPrefix = path.parse(expectedName).name;

    if (!fs.existsSync(outputDir)) {
        return null;
    }

    const candidate = fs
        .readdirSync(outputDir)
        .filter((name) => {
            if (!name.startsWith(expectedPrefix) || name.endsWith('.part')) {
                return false;
            }

            const candidatePath = path.join(outputDir, name);
            return isVideoFilePath(candidatePath);
        })
        .sort((a, b) => {
            const aTime = fs.statSync(path.join(outputDir, a)).mtimeMs;
            const bTime = fs.statSync(path.join(outputDir, b)).mtimeMs;
            return bTime - aTime;
        })[0];

    if (!candidate) {
        return null;
    }

    const candidatePath = path.join(outputDir, candidate);
    return fs.existsSync(candidatePath) ? candidatePath : null;
}

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
                'bestvideo+bestaudio/best[vcodec!=none]',

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

            ytDlpEventEmitter.on('close', (code: number | null) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp exited with code ${code}.`));
                    return;
                }

                resolve(finalPathFromYtDlp ?? outputFilePath);
            });

            ytDlpEventEmitter.on('error', (error: Error) => {
                reject(error);
            });
        });

        const resolvedDownloadedPath = await resolveDownloadedFilePath(outputFilePath, downloadedFilePath);
        if (resolvedDownloadedPath) {
            return resolvedDownloadedPath;
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
