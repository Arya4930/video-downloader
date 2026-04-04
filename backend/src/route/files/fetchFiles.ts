import express from 'express';
import type { Router } from 'express';
import path from 'path';
import { CreateSignedDownloadLink, DeleteFromS3, ListFilesFromS3 } from '../../lib/clients/s3';

const router: Router = express.Router({ mergeParams: true });
const TEMP_FOLDER = "temp";

function getOriginalName(fileID: string): string {
    const baseName = path.posix.basename(fileID);
    return baseName.replace(/^[0-9a-fA-F-]{36}-/, "");
}

router.get("/:userID", async (req, res) => {
    try {
        const now = new Date();
        const files = await ListFilesFromS3(`${TEMP_FOLDER}/`);
        const activeFiles = [];

        for (const file of files) {
            const expiresAt = new Date((file.lastModified ?? now).getTime() + 24 * 60 * 60 * 1000);

            if (expiresAt <= now) {
                await DeleteFromS3(file.key);
                continue;
            }

            const name = getOriginalName(file.key);
            const downloadUrl = await CreateSignedDownloadLink(file.key, 24 * 60 * 60);
            activeFiles.push({
                fileID: path.posix.basename(file.key),
                extension: path.posix.extname(name).replace(".", ""),
                name,
                size: file.size,
                expiresAt,
                downloadUrl,
            });
        }

        res.json(activeFiles);
    } catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
