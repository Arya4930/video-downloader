"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const downloadVideo_1 = require("./downloadVideo");
const s3_1 = require("../lib/clients/s3");
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
const TEMP_FOLDER = "temp";
const DOWNLOAD_TIMEOUT_MS = 3 * 60 * 1000;
function withTimeout(promise, timeoutMs, errorMessage) {
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
function sendSseEvent(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
}
function shouldUseSse(req) {
    const stream = req.query.stream;
    if (stream === "1" || stream === "true") {
        return true;
    }
    const accept = req.headers.accept;
    return typeof accept === "string" && accept.includes("text/event-stream");
}
async function processVideoDownload(videoURL, onProgress) {
    const title = (await (0, downloadVideo_1.getVideoTitle)(videoURL)) ?? "video";
    const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `${safeTitle || "video"}.mp4`;
    const fileID = `${Date.now()}-${(0, crypto_1.randomUUID)()}-${fileName}`;
    const fileKey = `${TEMP_FOLDER}/${fileID}`;
    const localTempDir = path_1.default.join(os_1.default.tmpdir(), "video-downloader-temp");
    const localFilePath = path_1.default.join(localTempDir, `${fileID}.mp4`);
    if (!fs_1.default.existsSync(localTempDir)) {
        fs_1.default.mkdirSync(localTempDir, { recursive: true });
    }
    await (0, downloadVideo_1.DownloadVideoToFile)(videoURL, localFilePath, (progress) => {
        if (onProgress) {
            onProgress(progress);
        }
    });
    const fileReadStream = fs_1.default.createReadStream(localFilePath);
    try {
        await withTimeout((0, s3_1.UploadStreamToS3)({
            key: fileKey,
            body: fileReadStream,
            contentType: "video/mp4"
        }), DOWNLOAD_TIMEOUT_MS, "Video download timed out.");
    }
    catch (uploadError) {
        fileReadStream.destroy();
        throw uploadError;
    }
    finally {
        try {
            fs_1.default.unlinkSync(localFilePath);
        }
        catch (cleanupError) {
            console.warn(`Failed to clean temp file: ${localFilePath}`, cleanupError);
        }
    }
    const expiresInSeconds = 60 * 60;
    const downloadUrl = await (0, s3_1.CreateSignedDownloadLink)(fileKey, expiresInSeconds);
    setTimeout(async () => {
        try {
            await (0, s3_1.DeleteFromS3)(fileKey);
            console.log(`Deleted expired file from storage: ${fileKey}`);
        }
        catch (deleteError) {
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
async function streamVideo(req, res) {
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
            const percent = Number.isFinite(progress.percent) ? Math.max(0, Math.min(100, Math.round(progress.percent))) : null;
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
    }
    catch (error) {
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
exports.default = router;
//# sourceMappingURL=download.js.map