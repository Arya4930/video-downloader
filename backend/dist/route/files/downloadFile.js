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
    return path_1.default.posix.basename(fileID).replace(/^[0-9a-fA-F-]{36}-/, "");
}
router.get("/:userID/:fileID", async (req, res) => {
    try {
        const { fileID } = req.params;
        if (!fileID) {
            return res.status(400).json({ error: "Invalid file request" });
        }
        await (0, s3_1.StreamFileFromS3)(`${TEMP_FOLDER}/${path_1.default.posix.basename(fileID)}`, res, getOriginalName(fileID));
    }
    catch (error) {
        console.error("Download Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
//# sourceMappingURL=downloadFile.js.map