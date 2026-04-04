import { Readable } from "stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const b2Endpoint = process.env.B2_ENDPOINT;
const b2Region = process.env.B2_REGION;
const b2BucketName = process.env.B2_BUCKET_NAME;
const b2AccessKeyId = process.env.B2_ACCESS_KEY_ID;
const b2SecretAccessKey = process.env.B2_SECRET_ACCESS_KEY;

if (!b2Endpoint || !b2Region || !b2BucketName || !b2AccessKeyId || !b2SecretAccessKey) {
  throw new Error("B2 environment variables are missing. Set B2_ENDPOINT, B2_REGION, B2_BUCKET_NAME, B2_ACCESS_KEY_ID, and B2_SECRET_ACCESS_KEY.");
}

const b2Client = new S3Client({
  region: b2Region,
  endpoint: b2Endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: b2AccessKeyId,
    secretAccessKey: b2SecretAccessKey,
  },
});

export async function uploadVideoToB2(params: {
  fileKey: string;
  body: Readable;
  contentType?: string;
}) {
  const { fileKey, body, contentType = "video/mp4" } = params;

  await b2Client.send(
    new PutObjectCommand({
      Bucket: b2BucketName,
      Key: fileKey,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function createB2DownloadLink(fileKey: string, expiresInSeconds = 3600) {
  return getSignedUrl(
    b2Client,
    new GetObjectCommand({
      Bucket: b2BucketName,
      Key: fileKey,
    }),
    { expiresIn: expiresInSeconds }
  );
}

export async function deleteFromB2(fileKey: string) {
  await b2Client.send(
    new DeleteObjectCommand({
      Bucket: b2BucketName,
      Key: fileKey,
    })
  );
}
