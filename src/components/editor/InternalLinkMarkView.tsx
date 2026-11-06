import { useLiveQuery } from "dexie-react-hooks";
import { MarkViewContent } from "@tiptap/react";
import type { MarkViewProps } from "@tiptap/core";
import { db, type Page, type Tag } from "@/lib/db";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

function getPageId(href: string): string | null {
  const match = /^\/paginas\/([^/?#]+)\/?$/.exec(href);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

function getExcerpt(html: string): string {
  if (typeof DOMParser === "undefined") return "";
  const text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

export function InternalLinkMarkView({ mark }: MarkViewProps) {
  const href = String(mark.attrs["href"] ?? "");
  const pageId = getPageId(href);
  const preview = useLiveQuery(
    async (): Promise<{ page: Page; tags: Tag[] } | null> => {
      if (!pageId) return null;
      const page = await db.pages.get(pageId);
      if (!page) return null;
      const tags = (await db.tags.bulkGet(page.tagIds)).filter((tag): tag is Tag => tag !== undefined);
      return { page, tags };
    },
    [pageId],
  );
  const link = (
    <a href={href} className="cursor-pointer text-coral underline decoration-coral/30 underline-offset-2">
      <MarkViewContent as="span" />
    </a>
  );

  if (!pageId) return link;

  const { page, tags } = preview ?? {};
  const excerpt = page ? getExcerpt(page.html) : "";

  return (
    <HoverCard openDelay={350} closeDelay={100}>
      <HoverCardTrigger asChild>{link}</HoverCardTrigger>
      <HoverCardContent className="glass glass-refract hidden w-72 rounded-2xl border-border/50 bg-popover/95 p-3 shadow-xl lg:block">
        {page ? (
          <>
            <span className="block truncate text-sm font-semibold">
              {page.icon} {page.title || "Sin título"}
            </span>
            {excerpt && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{excerpt}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
              <span>{new Date(page.updatedAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}</span>
              {tags?.map((tag) => (
                <span key={tag.id} className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: tag.color }} />
                  {tag.name}
                </span>
              ))}
            </div>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{preview === undefined ? "Cargando vista previa…" : "Página no disponible"}</span>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
