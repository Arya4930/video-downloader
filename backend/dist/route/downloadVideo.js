"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadVideoToFile = DownloadVideoToFile;
exports.getVideoTitle = getVideoTitle;
const yt_dlp_wrap_1 = __importDefault(require("yt-dlp-wrap"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ytDlpBinaryPath = path_1.default.join(__dirname, 'yt-dlp');
function sanitizeVideoTitle(title) {
    return title
        .trim()
        .replace(/[<>:"'/\\|?*]+/g, '')
        .replace(/\s+/g, '-');
}
async function ensureYTDlpBinary() {
    if (!fs_1.default.existsSync(ytDlpBinaryPath)) {
        console.log('Downloading yt-dlp binary...');
        try {
            await yt_dlp_wrap_1.default.downloadFromGithub(ytDlpBinaryPath);
            console.log('yt-dlp binary downloaded successfully.');
        }
        catch (error) {
            console.error('Failed to download yt-dlp:', error);
            throw error;
        }
    }
    else {
        console.log('yt-dlp binary already exists.');
    }
}
async function DownloadVideoToFile(videoURL, outputFilePath, onProgress) {
    try {
        await ensureYTDlpBinary();
        const outputDir = path_1.default.dirname(outputFilePath);
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        const ytDlpWrap = new yt_dlp_wrap_1.default(ytDlpBinaryPath);
        console.log('Starting video download...');
        const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
        const downloadedFilePath = await new Promise((resolve, reject) => {
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
            let finalPathFromYtDlp = null;
            ytDlpEventEmitter.on('progress', (progress) => {
                if (onProgress) {
                    onProgress(progress);
                }
            });
            ytDlpEventEmitter.on('ytDlpEvent', (eventType, eventData) => {
                if (eventType === 'CustomEvent' && typeof eventData === 'string') {
                    const trimmed = eventData.trim();
                    if (trimmed.length > 0) {
                        finalPathFromYtDlp = trimmed;
                    }
                }
            });
            ytDlpEventEmitter.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`yt-dlp exited with code ${code}.`));
                    return;
                }
                resolve(finalPathFromYtDlp ?? outputFilePath);
            });
            ytDlpEventEmitter.on('error', (error) => {
                reject(error);
            });
        });
        if (fs_1.default.existsSync(downloadedFilePath)) {
            return downloadedFilePath;
        }
        if (fs_1.default.existsSync(outputFilePath)) {
            return outputFilePath;
        }
        throw new Error(`yt-dlp finished but output file was not created. Expected: ${outputFilePath}, yt-dlp reported: ${downloadedFilePath}`);
    }
    catch (err) {
        console.error('Download failed:', err.message);
        throw err;
    }
}
async function getVideoTitle(videoURL) {
    try {
        await ensureYTDlpBinary();
        const ytDlpWrap = new yt_dlp_wrap_1.default(ytDlpBinaryPath);
        const metadata = await ytDlpWrap.getVideoInfo(videoURL);
        return sanitizeVideoTitle(metadata.title);
    }
    catch (error) {
        console.error('Failed to get video title:', error);
        return null;
    }
}
//# sourceMappingURL=downloadVideo.js.map