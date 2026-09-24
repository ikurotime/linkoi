export function extractVideoId(url: URL): string | null {
  const host = url.hostname.toLowerCase();
  if (host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") return url.searchParams.get("v");
    const match = /^\/(?:embed|v|shorts)\/([a-zA-Z0-9_-]{11})/.exec(url.pathname);
    if (match) return match[1]!;
  }
  if (host === "youtu.be") {
    const match = /^\/([a-zA-Z0-9_-]{11})/.exec(url.pathname);
    if (match) return match[1]!;
  }
  return null;
}

interface YoutubeSnippet {
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnails: Record<string, { url: string; width: number; height: number }>;
}

interface YoutubeApiResponse {
  items?: { snippet: YoutubeSnippet }[];
}

export async function resolveYouTube(
  videoId: string,
  apiKey: string,
): Promise<{
  title: string;
  description: string;
  image: string | null;
  publisher: string;
  author: string;
  date: string;
  url: string;
}> {
  const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`;
  const res = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`YouTube API responded ${res.status}`);

  const data: YoutubeApiResponse = await res.json();
  const snippet = data.items?.[0]?.snippet;
  if (!snippet) throw new Error("Video not found");

  const thumbs = snippet.thumbnails;
  const thumb = thumbs.maxres ?? thumbs.high ?? thumbs.medium ?? thumbs.default;

  return {
    title: snippet.title,
    description: snippet.description,
    image: thumb?.url ?? null,
    publisher: snippet.channelTitle,
    author: snippet.channelTitle,
    date: snippet.publishedAt,
    url: `https://www.youtube.com/watch?v=${videoId}`,
  };
}
