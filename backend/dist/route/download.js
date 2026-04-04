"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const downloadVideo_1 = require("./downloadVideo");
const router = express_1.default.Router();
async function streamVideo(req, res) {
    const videoURL = req.query.url;
    if (typeof videoURL !== "string" || videoURL.trim().length === 0) {
        return res.status(400).json({ error: "Query parameter 'url' is required." });
    }
    try {
        const title = (await (0, downloadVideo_1.getVideoTitle)(videoURL)) ?? "video";
        const fileName = `${title}.mp4`;
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        const videoStream = await (0, downloadVideo_1.DownloadVideo)(videoURL);
        req.on("close", () => {
            videoStream.destroy();
        });
        videoStream.on("error", (error) => {
            console.error("Stream failed:", error);
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to stream video." });
                return;
            }
            res.destroy(error);
        });
        videoStream.pipe(res);
    }
    catch (error) {
        console.error("Download failed:", error);
        if (!res.headersSent) {
            return res.status(500).json({ error: "Failed to download video." });
        }
        res.end();
    }
}
router.get("/", streamVideo);
exports.default = router;
//# sourceMappingURL=download.js.map