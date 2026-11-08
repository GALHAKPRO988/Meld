import { db, uid } from "./db";
import { useEffect, useState } from "react";

const urlCache = new Map<string, string>();

export async function saveAttachment(
  file: File | Blob,
  name = "imagen",
): Promise<{ id: string; url: string }> {
  const id = uid();
  await db.attachments.add({ id, blob: file, type: file.type, name, createdAt: Date.now() });
  const url = URL.createObjectURL(file);
  urlCache.set(id, url);
  return { id, url };
}

async function urlFor(id: string): Promise<string | null> {
  const cached = urlCache.get(id);
  if (cached) return cached;
  const a = await db.attachments.get(id);
  if (!a) return null;
  const url = URL.createObjectURL(a.blob);
  urlCache.set(id, url);
  return url;
}

export async function getAttachmentUrl(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("attachment:")) {
    return await urlFor(src.slice("attachment:".length));
  }
  return src;
}

export function useAttachmentUrl(src: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!src) {
      setUrl(null);
      return;
    }
    if (src.startsWith("attachment:")) {
      void getAttachmentUrl(src).then((resolved) => {
        if (active) setUrl(resolved);
      });
    } else {
      setUrl(src);
    }
    return () => {
      active = false;
    };
  }, [src]);

  return url;
}

/** Stored HTML (src="attachment:ID") → displayable HTML with object URLs. */
export async function resolveAttachments(html: string): Promise<string> {
  if (!html.includes("attachment:")) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  await Promise.all(
    Array.from(doc.querySelectorAll("img[src^='attachment:']")).map(async (img) => {
      const id = img.getAttribute("src")!.slice("attachment:".length);
      img.setAttribute("data-attachment", id);
      const url = await urlFor(id);
      if (url) img.setAttribute("src", url);
    }),
  );
  return doc.body.innerHTML;
}

/** Editor HTML (object URLs) → stored HTML with stable attachment references. */
export function serializeAttachments(html: string): string {
  if (!html.includes("data-attachment")) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  doc.querySelectorAll("img[data-attachment]").forEach((img) => {
    img.setAttribute("src", `attachment:${img.getAttribute("data-attachment")}`);
    img.removeAttribute("data-attachment");
  });
  return doc.body.innerHTML;
}
