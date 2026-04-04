import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import "dotenv/config";
import dns from "dns";
import 'multer'

dns.setDefaultResultOrder("ipv4first");

const s3 = new S3Client({
  region: process.env.B2_REGION!,
  endpoint: process.env.B2_ENDPOINT!,
  forcePathStyle: true,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.B2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!,
  }
});

export async function UploadFileToS3(
  file: Express.Multer.File,
  key: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );
}

export async function UploadStreamToS3(params: {
  key: string;
  body: Readable;
  contentType?: string;
}): Promise<void> {
  const uploader = new Upload({
    client: s3,
    params: {
      Bucket: process.env.B2_BUCKET_NAME!,
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

export async function DeleteFromS3(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: key,
    })
  );
}

export async function StreamFileFromS3(key: string, res: any, filename: string): Promise<void> {
  try {
    const command = new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: key,
    });
    const data = await s3.send(command);

    if(!data.Body) {
      return res.status(404).json({ error: "File not found in storage" });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', data.ContentType || 'application/octet-stream');

    (data.Body as any).pipe(res);
  } catch (error) {
    console.error("Error streaming file from S3:", error);
    res.status(500).json({ error: "Failed to stream file" });
  }
}

export interface S3FileEntry {
  key: string;
  size: number;
  lastModified: Date | null;
}

export async function ListFilesFromS3(prefix: string): Promise<S3FileEntry[]> {
  const files: S3FileEntry[] = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.B2_BUCKET_NAME!,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

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

export async function CreateSignedDownloadLink(key: string, expiresInSeconds = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.B2_BUCKET_NAME!,
      Key: key,
    }),
    { expiresIn: expiresInSeconds }
  );
}
