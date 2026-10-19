import OSS from "ali-oss";
import { TRPCError } from "@trpc/server";
import { env, isOssConfigured } from "./env";

type OSSClient = {
  signatureUrl: (
    objectName: string,
    options?: {
      method?: "GET" | "PUT";
      expires?: number;
      "Content-Type"?: string;
      response?: Record<string, string>;
    },
  ) => string | Promise<string>;
  get: (objectName: string) => Promise<{ content: Buffer }>;
  put: (
    objectName: string,
    file: Buffer | string,
    options?: { headers?: Record<string, string> },
  ) => Promise<{ name: string; url: string }>;
  delete: (objectName: string) => Promise<unknown>;
};

type OSSConstructor = new (options: {
  accessKeyId: string;
  accessKeySecret: string;
  endpoint: string;
  bucket: string;
  region: string;
  secure: boolean;
}) => OSSClient;

const OSSClientConstructor = OSS as unknown as OSSConstructor;

let client: OSSClient | null = null;

export function getOssClient(): OSSClient {
  if (!isOssConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "文件存储（阿里云 OSS）未配置，请在 .env 中填写 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET / OSS_ENDPOINT / OSS_BUCKET / OSS_REGION",
    });
  }
  client ??= new OSSClientConstructor({
    accessKeyId: env.OSS_ACCESS_KEY_ID!,
    accessKeySecret: env.OSS_ACCESS_KEY_SECRET!,
    endpoint: env.OSS_ENDPOINT!,
    bucket: env.OSS_BUCKET!,
    region: env.OSS_REGION!,
    secure: true,
  });
  return client;
}

function bucketUrlPrefix(): string | null {
  return isOssConfigured() ? `https://${env.OSS_BUCKET}.${env.OSS_ENDPOINT}/` : null;
}

export function getOSSObjectUrl(objectName: string): string {
  getOssClient();
  return `${bucketUrlPrefix()}${objectName}`;
}

/** Returns the object key if the URL points into our bucket, otherwise null. */
export function getOSSObjectKey(url: string): string | null {
  const prefix = bucketUrlPrefix();
  if (!prefix || !url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length).split("?")[0];
  if (!key) return null;
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

export type UploadFolder = "assignment-uploads" | "exam-uploads" | "student-reports" | "teaching-materials";

export function uploadOwnerSegment(auth: { teacherId?: number; parentId?: number }): string {
  return auth.teacherId != null ? `teacher-${auth.teacherId}` : `parent-${auth.parentId}`;
}

/**
 * Rejects client-supplied file URLs that do not point at an object the caller uploaded itself
 * (keys are `<folder>/<owner>/<file>`, see generatePresignedUploadUrl). Prevents both server-side
 * requests to arbitrary URLs and attaching another user's files.
 */
export function assertOwnedUpload(
  url: string,
  auth: { teacherId?: number; parentId?: number },
  folders: readonly UploadFolder[],
): void {
  const key = getOSSObjectKey(url);
  const [folder, owner] = key?.split("/") ?? [];
  if (!key || !folders.includes(folder as UploadFolder) || owner !== uploadOwnerSegment(auth)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "文件地址无效，请重新上传" });
  }
}

/**
 * Downloads a file from our bucket through the authenticated client (works for private buckets).
 * Arbitrary external URLs are refused so stored URLs can never make the server fetch other hosts.
 */
export async function fetchStoredFile(url: string): Promise<Buffer> {
  const key = getOSSObjectKey(url);
  if (!key) {
    throw new Error("文件不在本系统的存储中，无法读取");
  }
  const result = await getOssClient().get(key);
  if (!result.content || result.content.length === 0) {
    throw new Error("存储中的文件内容为空");
  }
  return Buffer.from(result.content);
}

/** Short-lived signed GET URL for displaying a stored image in the browser. */
export async function getSignedReadUrl(url: string, expiresSeconds = 900): Promise<string> {
  const key = getOSSObjectKey(url);
  if (!key) return url;
  return getOssClient().signatureUrl(key, { method: "GET", expires: expiresSeconds });
}
