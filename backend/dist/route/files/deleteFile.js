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
router.delete("/:userID/:fileID", async (req, res) => {
    try {
        const { fileID } = req.params;
        if (!fileID) {
            return res.status(400).json({ error: "Invalid file request" });
        }
        try {
            await (0, s3_1.DeleteFromS3)(`${TEMP_FOLDER}/${path_1.default.posix.basename(fileID)}`);
        }
        catch (error) {
            console.error("Error deleting file from S3:", error);
            return res.status(500).json({ error: "Failed to delete file from storage" });
        }
        res.json({
            message: "File deleted successfully",
        });
    }
    catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=deleteFile.js.map