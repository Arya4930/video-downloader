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
        await new Promise((resolve, reject) => {
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
            ytDlpEventEmitter.on('progress', (progress) => {
                if (onProgress) {
                    onProgress(progress);
                }
            });
            ytDlpEventEmitter.on('close', () => {
                resolve();
            });
            ytDlpEventEmitter.on('error', (error) => {
                reject(error);
            });
        });
        if (!fs_1.default.existsSync(outputFilePath)) {
            throw new Error('yt-dlp finished but output file was not created.');
        }
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