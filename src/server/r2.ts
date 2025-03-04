import { S3Client } from "@aws-sdk/client-s3";
import { env } from "~/env";

const r2Client = new S3Client({
  region: env.R2_REGION,
  endpoint: env.R2_ENDPOINT,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export function getUrlFromFileR2FileKey(fileKey: string) {
  return `https://files.copyman.fr/${env.R2_BUCKET_NAME}/${fileKey}`;
}

export default r2Client;
