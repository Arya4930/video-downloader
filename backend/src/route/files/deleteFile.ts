import type { Router } from "express";
import express from "express";
import path from "path";
import { DeleteFromS3 } from "../../lib/clients/s3";

const router: Router = express.Router({ mergeParams: true });
const TEMP_FOLDER = "temp";

router.delete("/:userID/:fileID", async (req, res) => {
    try {
        const { fileID } = req.params;
        if (!fileID) {
            return res.status(400).json({ error: "Invalid file request" });
        }

        try {
            await DeleteFromS3(`${TEMP_FOLDER}/${path.posix.basename(fileID)}`);
        } catch (error) {
            console.error("Error deleting file from S3:", error);
            return res.status(500).json({ error: "Failed to delete file from storage" });
        }

        res.json({
            message: "File deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).json({ error: "Internal server error" });
    }
})

export default router;
