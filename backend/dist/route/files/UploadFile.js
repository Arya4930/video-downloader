"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const s3_1 = require("../../lib/clients/s3");
const uuid_1 = require("uuid");
const router = express_1.default.Router({ mergeParams: true });
const upload = (0, multer_1.default)();
const TEMP_FOLDER = "temp";
router.post("/:userID", upload.single("file"), async (req, res) => {
    try {
        const file = req.file;
        if (!file)
            return res.status(400).json({ error: "No file uploaded" });
        const extension = path_1.default.extname(file.originalname);
        const cleanName = path_1.default.basename(file.originalname, extension);
        const fileID = `${(0, uuid_1.v4)()}-${cleanName}${extension}`;
        const uniqueKey = `${TEMP_FOLDER}/${fileID}`;
        await (0, s3_1.UploadFileToS3)(file, uniqueKey);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const downloadUrl = await (0, s3_1.CreateSignedDownloadLink)(uniqueKey, 24 * 60 * 60);
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
    }
    catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ error: "Upload failed" });
    }
});
exports.default = router;
//# sourceMappingURL=UploadFile.js.map