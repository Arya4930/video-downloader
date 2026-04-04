import express, { Request, Response } from "express";
import { DownloadVideo, getVideoTitle } from "./downloadVideo";
import { createB2DownloadLink, deleteFromB2, uploadVideoToB2 } from "../lib/clients/b2";
import { randomUUID } from "crypto";

const router = express.Router();

async function streamVideo(req: Request, res: Response) {
    const videoURL = req.query.url;

    if (typeof videoURL !== "string" || videoURL.trim().length === 0) {
        return res.status(400).json({ error: "Query parameter 'url' is required." });
    }

    try {
        const title = (await getVideoTitle(videoURL)) ?? "video";
        const safeTitle = title.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
        const fileName = `${safeTitle || "video"}.mp4`;
        const fileKey = `videos/${Date.now()}-${randomUUID()}-${fileName}`;

        const videoStream = await DownloadVideo(videoURL);

        await uploadVideoToB2({
            fileKey,
            body: videoStream,
            contentType: "video/mp4"
        });

        const expiresInSeconds = 60 * 60;
        const downloadUrl = await createB2DownloadLink(fileKey, expiresInSeconds);

        setTimeout(async () => {
            try {
                await deleteFromB2(fileKey);
                console.log(`Deleted expired file from B2: ${fileKey}`);
            } catch (deleteError) {
                console.error(`Failed to delete expired file from B2: ${fileKey}`, deleteError);
            }
        }, expiresInSeconds * 1000);

        return res.status(200).json({
            message: "Video uploaded to storage.",
            fileName,
            fileKey,
            link: downloadUrl,
            expiresInSeconds
        });
    } catch (error) {
        console.error("Download failed:", error);

        if (!res.headersSent) {
            return res.status(500).json({ error: "Failed to download video." });
        }

        res.end();
    }
}

router.get("/", streamVideo);

export default router;