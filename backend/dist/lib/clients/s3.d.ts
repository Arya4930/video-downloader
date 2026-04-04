import { Readable } from "stream";
import "dotenv/config";
import 'multer';
export declare function UploadFileToS3(file: Express.Multer.File, key: string): Promise<void>;
export declare function UploadStreamToS3(params: {
    key: string;
    body: Readable;
    contentType?: string;
}): Promise<void>;
export declare function DeleteFromS3(key: string): Promise<void>;
export declare function StreamFileFromS3(key: string, res: any, filename: string): Promise<void>;
export interface S3FileEntry {
    key: string;
    size: number;
    lastModified: Date | null;
}
export declare function ListFilesFromS3(prefix: string): Promise<S3FileEntry[]>;
export declare function CreateSignedDownloadLink(key: string, expiresInSeconds?: number): Promise<string>;
//# sourceMappingURL=s3.d.ts.map