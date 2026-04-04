"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const s3_1 = require("../../lib/clients/s3");
const router = express_1.default.Router({ mergeParams: true });
const TEMP_FOLDER = "temp";
function getOriginalName(fileID) {
    const baseName = path_1.default.posix.basename(fileID);
    return baseName.replace(/^[0-9a-fA-F-]{36}-/, "");
}
router.get("/:userID", async (req, res) => {
    try {
        const now = new Date();
        const files = await (0, s3_1.ListFilesFromS3)(`${TEMP_FOLDER}/`);
        const activeFiles = [];
        for (const file of files) {
            const expiresAt = new Date((file.lastModified ?? now).getTime() + 24 * 60 * 60 * 1000);
            if (expiresAt <= now) {
                await (0, s3_1.DeleteFromS3)(file.key);
                continue;
            }
            const name = getOriginalName(file.key);
            const downloadUrl = await (0, s3_1.CreateSignedDownloadLink)(file.key, 24 * 60 * 60);
            activeFiles.push({
                fileID: path_1.default.posix.basename(file.key),
                extension: path_1.default.posix.extname(name).replace(".", ""),
                name,
                size: file.size,
                expiresAt,
                downloadUrl,
            });
        }
        res.json(activeFiles);
    }
    catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=fetchFiles.js.map