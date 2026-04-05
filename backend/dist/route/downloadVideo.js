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
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm', '.mov', '.m4v']);
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
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function normalizePathFromYtDlp(rawPath) {
    return rawPath
        .replace(/\x1B\[[0-9;]*m/g, '')
        .replace(/^"|"$/g, '')
        .trim();
}
function isVideoFilePath(filePath) {
    return VIDEO_EXTENSIONS.has(path_1.default.extname(filePath).toLowerCase());
}
async function waitForExistingPath(candidatePath, retries = 10, delayMs = 200) {
    for (let i = 0; i < retries; i += 1) {
        if (fs_1.default.existsSync(candidatePath)) {
            return true;
        }
        await sleep(delayMs);
    }
    return false;
}
async function resolveDownloadedFilePath(expectedPath, reportedPath) {
    const normalizedReportedPath = normalizePathFromYtDlp(reportedPath);
    const normalizedExpectedPath = normalizePathFromYtDlp(expectedPath);
    if (isVideoFilePath(normalizedReportedPath) && await waitForExistingPath(normalizedReportedPath)) {
        return normalizedReportedPath;
    }
    if (isVideoFilePath(normalizedExpectedPath) && await waitForExistingPath(normalizedExpectedPath)) {
        return normalizedExpectedPath;
    }
    const outputDir = path_1.default.dirname(normalizedExpectedPath);
    const expectedName = path_1.default.basename(normalizedExpectedPath);
    const expectedPrefix = path_1.default.parse(expectedName).name;
    if (!fs_1.default.existsSync(outputDir)) {
        return null;
    }
    const candidate = fs_1.default
        .readdirSync(outputDir)
        .filter((name) => {
        if (!name.startsWith(expectedPrefix) || name.endsWith('.part')) {
            return false;
        }
        const candidatePath = path_1.default.join(outputDir, name);
        return isVideoFilePath(candidatePath);
    })
        .sort((a, b) => {
        const aTime = fs_1.default.statSync(path_1.default.join(outputDir, a)).mtimeMs;
        const bTime = fs_1.default.statSync(path_1.default.join(outputDir, b)).mtimeMs;
        return bTime - aTime;
    })[0];
    if (!candidate) {
        return null;
    }
    const candidatePath = path_1.default.join(outputDir, candidate);
    return fs_1.default.existsSync(candidatePath) ? candidatePath : null;
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
        const resolvedDownloadedPath = await resolveDownloadedFilePath(outputFilePath, downloadedFilePath);
        if (resolvedDownloadedPath) {
            return resolvedDownloadedPath;
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