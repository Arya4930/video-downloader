import "dotenv/config";
import express, { Application } from "express";
import downloadRoutes from "./route/download"
import cors from "cors";

const app: Application = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    if (
        req.path.startsWith("/.") ||
        req.path.includes(".git") ||
        req.path.includes(".env")
    ) {
        return res.sendStatus(404);
    }
    next();
});

app.use("/api/download", downloadRoutes)

const PORT = 9000;

app.listen(PORT, async () => {
    console.log(`🚀 Express TS server running on port ${PORT}`);
});