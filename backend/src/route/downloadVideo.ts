import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import fs from 'fs';

const ytDlpBinaryPath = path.join(__dirname, 'yt-dlp.exe');

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

export async function DownloadVideo(videoURL: string) {
    try {
        await ensureYTDlpBinary();

        const ytDlpWrap = new YTDlpWrap(ytDlpBinaryPath);
        console.log('Starting video download stream...');

        return ytDlpWrap.execStream([
            videoURL,
            '-f',
            'bv*[height=1080]',
            '-o',
            '-',
            '--no-audio'
        ]);
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

        let title: string = metadata.title.trim();

        // sanitize filename
        title = title.replace(/[<>:"'/\\|?*]+/g, '');

        return title;
    } catch (error) {
        console.error('Failed to get video title:', error);
        return null;
    }
}