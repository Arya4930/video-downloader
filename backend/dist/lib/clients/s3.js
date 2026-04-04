"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadFileToS3 = UploadFileToS3;
exports.UploadStreamToS3 = UploadStreamToS3;
exports.DeleteFromS3 = DeleteFromS3;
exports.StreamFileFromS3 = StreamFileFromS3;
exports.ListFilesFromS3 = ListFilesFromS3;
exports.CreateSignedDownloadLink = CreateSignedDownloadLink;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const lib_storage_1 = require("@aws-sdk/lib-storage");
require("dotenv/config");
const dns_1 = __importDefault(require("dns"));
require("multer");
dns_1.default.setDefaultResultOrder("ipv4first");
const s3 = new client_s3_1.S3Client({
    region: process.env.B2_REGION,
    endpoint: process.env.B2_ENDPOINT,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
        accessKeyId: process.env.B2_ACCESS_KEY_ID,
        secretAccessKey: process.env.B2_SECRET_ACCESS_KEY,
    }
});
async function UploadFileToS3(file, key) {
    await s3.send(new client_s3_1.PutObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    }));
}
async function UploadStreamToS3(params) {
    const uploader = new lib_storage_1.Upload({
        client: s3,
        params: {
            Bucket: process.env.B2_BUCKET_NAME,
            Key: params.key,
            Body: params.body,
            ContentType: params.contentType ?? "application/octet-stream",
        },
        partSize: 5 * 1024 * 1024,
        queueSize: 4,
        leavePartsOnError: false,
    });
    await uploader.done();
}
async function DeleteFromS3(key) {
    await s3.send(new client_s3_1.DeleteObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: key,
    }));
}
async function StreamFileFromS3(key, res, filename) {
    try {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: process.env.B2_BUCKET_NAME,
            Key: key,
        });
        const data = await s3.send(command);
        if (!data.Body) {
            return res.status(404).json({ error: "File not found in storage" });
        }
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', data.ContentType || 'application/octet-stream');
        data.Body.pipe(res);
    }
    catch (error) {
        console.error("Error streaming file from S3:", error);
        res.status(500).json({ error: "Failed to stream file" });
    }
}
async function ListFilesFromS3(prefix) {
    const files = [];
    let continuationToken;
    do {
        const response = await s3.send(new client_s3_1.ListObjectsV2Command({
            Bucket: process.env.B2_BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        }));
        for (const item of response.Contents ?? []) {
            if (!item.Key || item.Key.endsWith("/")) {
                continue;
            }
            files.push({
                key: item.Key,
                size: item.Size ?? 0,
                lastModified: item.LastModified ?? null,
            });
        }
        continuationToken = response.IsTruncated
            ? response.NextContinuationToken
            : undefined;
    } while (continuationToken);
    return files;
}
async function CreateSignedDownloadLink(key, expiresInSeconds = 3600) {
    return (0, s3_request_presigner_1.getSignedUrl)(s3, new client_s3_1.GetObjectCommand({
        Bucket: process.env.B2_BUCKET_NAME,
        Key: key,
    }), { expiresIn: expiresInSeconds });
}
//# sourceMappingURL=s3.js.map