"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadVideo = DownloadVideo;
exports.getVideoTitle = getVideoTitle;
const yt_dlp_wrap_1 = __importDefault(require("yt-dlp-wrap"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const ytDlpBinaryPath = path_1.default.join(__dirname, 'yt-dlp.exe');
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
async function DownloadVideo(videoURL) {
    try {
        await ensureYTDlpBinary();
        const ytDlpWrap = new yt_dlp_wrap_1.default(ytDlpBinaryPath);
        console.log('Starting video download stream...');
        return ytDlpWrap.execStream([
            videoURL,
            '-f',
            'bv*[height=1080]',
            '-o',
            '-',
            '--no-audio'
        ]);
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
        let title = metadata.title.trim();
        // sanitize filename
        title = title.replace(/[<>:"'/\\|?*]+/g, '');
        return title;
    }
    catch (error) {
        console.error('Failed to get video title:', error);
        return null;
    }
}
//# sourceMappingURL=downloadVideo.js.map