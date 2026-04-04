import { Router } from "express";
import express from "express";
import path from "path";
import { StreamFileFromS3 } from "../../lib/clients/s3";

const router: Router = express.Router({ mergeParams: true });
const TEMP_FOLDER = "temp";

function getOriginalName(fileID: string): string {
    return path.posix.basename(fileID).replace(/^[0-9a-fA-F-]{36}-/, "");
}

router.get("/:userID/:fileID", async (req, res) => {
    try {
        const { fileID } = req.params;
        if (!fileID) {
            return res.status(400).json({ error: "Invalid file request" });
        }

        await StreamFileFromS3(
            `${TEMP_FOLDER}/${path.posix.basename(fileID)}`,
            res,
            getOriginalName(fileID)
        );
    } catch (error) {
        console.error("Download Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
})

export default router
