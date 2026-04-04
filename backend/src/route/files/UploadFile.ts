import express, { Request } from 'express';
import type { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { CreateSignedDownloadLink, UploadFileToS3 } from '../../lib/clients/s3';
import { v4 as uuidv4 } from 'uuid';

interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

const router: Router = express.Router({ mergeParams: true });

const upload = multer();
const TEMP_FOLDER = "temp";

router.post("/:userID", upload.single("file"), async (req, res) => {
    try {
        const file = (req as MulterRequest).file;
        if (!file) return res.status(400).json({ error: "No file uploaded" });

        const extension = path.extname(file.originalname);
        const cleanName = path.basename(file.originalname, extension);
        const fileID = `${uuidv4()}-${cleanName}${extension}`;
        const uniqueKey = `${TEMP_FOLDER}/${fileID}`;

        await UploadFileToS3(file as any, uniqueKey);

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const downloadUrl = await CreateSignedDownloadLink(uniqueKey, 24 * 60 * 60);

        const newFile = {
            fileID,
            extension: extension.replace(".", ""),
            name: file.originalname,
            size: file.size,
            expiresAt,
            downloadUrl,
        };

        res.status(201).json({
            message: "File uploaded successfully",
            file: newFile,
        });

    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});

export default router;
