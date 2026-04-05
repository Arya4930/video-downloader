"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, Link as LinkIcon, LoaderCircle, Play, Clipboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

const API_BASE =
  process.env.NODE_ENV === "development"
    ? "http://localhost:9000"
    : "https://downloader.uni-cc.site";

function getFileNameFromDisposition(contentDisposition: string | null): string {
  if (!contentDisposition) {
    return "video.mp4";
  }

  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? "video.mp4";
}

type DownloadApiResponse = {
  message: string;
  fileName: string;
  fileKey: string;
  fileID: string;
  downloadUrl: string;
  expiresInSeconds: number;
};

type DownloadProgressEvent = {
  percent: number | null;
  totalSize: string | null;
  currentSpeed: string | null;
  eta: string | null;
};

export default function Home() {
  const [videoLink, setVideoLink] = useState("");
  const [status, setStatus] = useState("Idle");
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [downloadLink, setDownloadLink] = useState<string | null>(null);
  const [attachmentLink, setAttachmentLink] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState("video.mp4");
  const blobUrlRef = useRef<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!videoLink.trim()) {
      setError("Please paste a valid video link.");
      return;
    }

    try {
      new URL(videoLink);
    } catch {
      setError("That URL format looks invalid.");
      return;
    }

    const endpoint = `${API_BASE}/api/download?stream=1&url=${encodeURIComponent(videoLink)}`;

    setError(null);
    setStatus("Preparing download...");
    setIsDownloading(true);
    setProgress(0);
    setDownloadLink(null);
    setAttachmentLink(null);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
      setVideoBlobUrl(null);
    }

    try {
      const eventSource = new EventSource(endpoint);
      eventSourceRef.current = eventSource;

      await new Promise<void>((resolve, reject) => {
        eventSource.addEventListener("status", (event) => {
          const messageEvent = event as MessageEvent<string>;
          const payload = JSON.parse(messageEvent.data) as { message?: string };

          if (payload.message) {
            setStatus(payload.message);
          }
        });

        eventSource.addEventListener("progress", (event) => {
          const progressEvent = event as MessageEvent<string>;
          const payload = JSON.parse(progressEvent.data) as DownloadProgressEvent;
          const percent = typeof payload.percent === "number" ? payload.percent : null;

          if (percent !== null) {
            setProgress(percent);
          }

          const speedPart = payload.currentSpeed ? ` at ${payload.currentSpeed}` : "";
          const sizePart = payload.totalSize ? ` of ${payload.totalSize}` : "";
          const etaPart = payload.eta ? `, ETA ${payload.eta}` : "";
          setStatus(`Downloading${sizePart}${speedPart}${etaPart}`);
        });

        eventSource.addEventListener("complete", (event) => {
          const completeEvent = event as MessageEvent<string>;
          const data = JSON.parse(completeEvent.data) as DownloadApiResponse;

          eventSource.close();
          eventSourceRef.current = null;

          setProgress(100);
          setStatus("Ready");
          setIsDownloading(false);
          setDownloadFileName(data.fileName || getFileNameFromDisposition(null));
          setDownloadLink(data.downloadUrl);
          setAttachmentLink(
            `${API_BASE}/api/download/file/${encodeURIComponent(data.fileID)}?name=${encodeURIComponent(data.fileName || "video.mp4")}`
          );
          setVideoBlobUrl(data.downloadUrl);
          resolve();
        });

        eventSource.addEventListener("error", () => {
          eventSource.close();
          eventSourceRef.current = null;
          reject(new Error("Download failed"));
        });
      });
    } catch {
      setStatus("Failed");
      setIsDownloading(false);
      setProgress(0);
      setError("Network error while downloading video.");
    }
  }

  async function pasteURL() {
    try {
      const text = await navigator.clipboard.readText();
      setVideoLink(text);
    } catch (err) {
      console.error("Failed to read clipboard:", err);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-linear-to-br from-zinc-950 via-zinc-900 to-stone-950 p-4">
      <div className="pointer-events-none absolute -top-32 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-white/5 blur-3xl" />
      <Card className="relative w-full max-w-2xl border border-white/10 bg-zinc-900/90 shadow-2xl shadow-black/30 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-2xl">Video Downloader</CardTitle>
          <CardDescription>Insert video link below to download</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="video-link">
              Video URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative w-full sm:grow">
                <LinkIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="video-link"
                  className="h-10 pl-8"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={videoLink}
                  onChange={(event) => setVideoLink(event.target.value)}
                />
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-none">
                <Button className="h-10 w-full px-3 sm:w-auto sm:px-4" type="button" disabled={isDownloading} onClick={() => pasteURL()}>
                  <Clipboard className="size-4" />
                  Paste
                </Button>
                <Button className="h-10 w-full px-3 sm:w-auto sm:px-4" type="submit" disabled={isDownloading}>
                  {isDownloading ? <LoaderCircle className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}
                  {isDownloading ? "Downloading" : "Download"}
                </Button>
              </div>
            </div>
          </form>

          {(isDownloading || progress > 0) && (
            <section className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{status}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </section>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {videoBlobUrl && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Play className="size-4" />
                <span>Preview</span>
              </div>
              <video
                className="w-full rounded-lg border border-white/10 bg-black"
                controls
                preload="metadata"
                src={videoBlobUrl}
              />
              <Button asChild variant="outline">
                <a href={attachmentLink ?? downloadLink ?? videoBlobUrl} download={downloadFileName}>
                  Save Video
                </a>
              </Button>
            </section>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
