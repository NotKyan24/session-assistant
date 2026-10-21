/**
 * FILE UPLOAD, phone version (iOS / Android). Expo picks this file instead of
 * upload.ts on phones; the browser uses upload.ts.
 *
 * Uses expo-file-system's File.upload(), the SDK 57 way to send a file from
 * disk. It streams the file rather than loading it into memory, which matters
 * for multi-hour recordings, and reports how many bytes have been sent so the
 * Record screen can show "Uploading… 45%". (The older React Native style,
 * FormData.append("file", { uri, name, type }), isn't supported by Expo's
 * fetch: it fails with "Unsupported FormDataPart implementation".)
 */
import { File, UploadType } from "expo-file-system";

import type { AudioFile } from "./api";

export async function uploadFile(
  url: string,
  file: AudioFile,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void,
): Promise<{ status: number; body: string }> {
  const result = await new File(file.uri).upload(url, {
    uploadType: UploadType.MULTIPART,
    fieldName: "file", // The backend reads the upload from the "file" field.
    mimeType: file.mimeType,
    headers,
    // iOS defaults to a "background" session, which can outlive the app. In
    // Expo Go its completion never reached the app: the server had the file,
    // but the screen stayed on "Uploading…". The app stays open and awake
    // during an upload anyway, so a foreground session is enough.
    sessionType: "foreground",
    onProgress: ({ bytesSent, totalBytes }) => {
      if (onProgress && totalBytes > 0) onProgress(Math.min(1, bytesSent / totalBytes));
    },
  });
  return { status: result.status, body: result.body };
}
