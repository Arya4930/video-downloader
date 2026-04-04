import express, { Request, Response, Router } from "express";
import { DownloadVideoToFile, getVideoTitle, YtDlpProgress } from "./downloadVideo";
import { CreateSignedDownloadLink, DeleteFromS3, UploadStreamToS3 } from "../lib/clients/s3";
import { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

const router: Router = express.Router();
const TEMP_FOLDER = "temp";
const DOWNLOAD_TIMEOUT_MS = 3 * 60 * 1000;

type DownloadProgress = YtDlpProgress;

type DownloadResult = {
    message: string;
    fileName: string;
    fileID: string;
    fileKey: string;
    downloadUrl: string;
    expiresInSeconds: number;
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);

        promise
            .then((value) => {
                clearTimeout(timeoutId);
                resolve(value);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
}

function sendSseEvent(res: Response, event: string, data: unknown) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function shouldUseSse(req: Request): boolean {
    const stream = req.query.stream;

    if (stream === "1" || stream === "true") {
        return true;
    }

    const accept = req.headers.accept;
    return typeof accept === "string" && accept.includes("text/event-stream");
}

async function processVideoDownload(videoURL: string, onProgress?: (progress: DownloadProgress) => void): Promise<DownloadResult> {
    const title = (await getVideoTitle(videoURL)) ?? "video";
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `${safeTitle || "video"}.mp4`;
    const fileID = `${Date.now()}-${randomUUID()}-${fileName}`;
    const fileKey = `${TEMP_FOLDER}/${fileID}`;
    const localTempDir = path.join(os.tmpdir(), "video-downloader-temp");
    const localFilePath = path.join(localTempDir, `${fileID}.mp4`);

    if (!fs.existsSync(localTempDir)) {
        fs.mkdirSync(localTempDir, { recursive: true });
    }

    await DownloadVideoToFile(videoURL, localFilePath, (progress) => {
        if (onProgress) {
            onProgress(progress);
        }
    });

    const fileReadStream = fs.createReadStream(localFilePath);

    try {
        await withTimeout(
            UploadStreamToS3({
                key: fileKey,
                body: fileReadStream,
                contentType: "video/mp4"
            }),
            DOWNLOAD_TIMEOUT_MS,
            "Video download timed out."
        );
    } catch (uploadError) {
        fileReadStream.destroy();
        throw uploadError;
    } finally {
        try {
            fs.unlinkSync(localFilePath);
        } catch (cleanupError) {
            console.warn(`Failed to clean temp file: ${localFilePath}`, cleanupError);
        }
    }

    const expiresInSeconds = 60 * 60;
    const downloadUrl = await CreateSignedDownloadLink(fileKey, expiresInSeconds);

    setTimeout(async () => {
        try {
            await DeleteFromS3(fileKey);
            console.log(`Deleted expired file from storage: ${fileKey}`);
        } catch (deleteError) {
            console.error(`Failed to delete expired file from storage: ${fileKey}`, deleteError);
        }
    }, expiresInSeconds * 1000);

    return {
        message: "Video uploaded to storage.",
        fileName,
        fileID,
        fileKey,
        downloadUrl,
        expiresInSeconds
    };
}

async function streamVideo(req: Request, res: Response) {
    const videoURL = req.query.url;
    const useSse = shouldUseSse(req);

    if (typeof videoURL !== "string" || videoURL.trim().length === 0) {
        return res.status(400).json({ error: "Query parameter 'url' is required." });
    }

    if (useSse) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();
        sendSseEvent(res, "status", { message: "Preparing download..." });
    }

    try {
        let lastEmittedPercent = -1;

        const result = await processVideoDownload(videoURL, useSse ? (progress) => {
            const percent = Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, Math.round(progress.percent!))) : null;

            if (percent !== null && percent === lastEmittedPercent) {
                return;
            }

            if (percent !== null) {
                lastEmittedPercent = percent;
            }

            sendSseEvent(res, "progress", {
                percent,
                totalSize: progress.totalSize ?? null,
                currentSpeed: progress.currentSpeed ?? null,
                eta: progress.eta ?? null
            });
        } : undefined);

        if (useSse) {
            sendSseEvent(res, "complete", result);
            res.end();
            return;
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error("Download failed:", error);

        if (useSse && !res.writableEnded) {
            sendSseEvent(res, "error", { message: "Failed to download video." });
            res.end();
            return;
        }

        if (!res.headersSent) {
            return res.status(500).json({ error: "Failed to download video." });
        }

        res.end();
    }
}

router.get("/", streamVideo);

export default router;
