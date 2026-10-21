/**
 * FILE UPLOAD, browser version (the Expo web build). Phones use
 * upload.native.ts instead.
 *
 * In the browser, a recording or picked file is a "blob:" URL. We read it
 * into a Blob, put it in a multipart form, and send it with fetch. Browsers'
 * fetch can't report upload progress, so onProgress is only called once, at
 * the end.
 */
import type { AudioFile } from "./api";

export async function uploadFile(
  url: string,
  file: AudioFile,
  headers: Record<string, string>,
  onProgress?: (fraction: number) => void,
): Promise<{ status: number; body: string }> {
  const blob = await (await fetch(file.uri)).blob();
  const form = new FormData();
  form.append("file", blob, file.name);
  const res = await fetch(url, { method: "POST", body: form, headers });
  onProgress?.(1);
  return { status: res.status, body: await res.text() };
}
