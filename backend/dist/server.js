"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const download_1 = __importDefault(require("./route/download"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((req, res, next) => {
    if (req.path.startsWith("/.") ||
        req.path.includes(".git") ||
        req.path.includes(".env")) {
        return res.sendStatus(404);
    }
    next();
});
app.use("/api/download", download_1.default);
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`🚀 Express TS server running on port ${PORT}`);
});
//# sourceMappingURL=server.js.map