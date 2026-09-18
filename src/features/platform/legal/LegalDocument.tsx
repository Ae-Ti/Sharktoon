import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";

/**
 * 약관과 개인정보 처리방침은 content/legal/*.md 한 곳에만 둔다.
 * 법무 검토를 받는 대상이 그 파일이고, 화면은 그걸 그려주기만 한다.
 * 마크다운 라이브러리를 넣지 않고 쓰는 문법만 직접 처리한다.
 */

type Block =
  | { kind: "h1" | "h2" | "h3" | "p"; text: string }
  | { kind: "ul" | "ol"; items: string[]; nested: boolean };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split("\n");
  let para: string[] = [];

  const flushPara = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ") });
      para = [];
    }
  };

  const pushItem = (kind: "ul" | "ol", item: string, nested: boolean) => {
    const last = blocks[blocks.length - 1];
    if (last && last.kind === kind && last.nested === nested) {
      last.items.push(item);
      return;
    }
    blocks.push({ kind, items: [item], nested });
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const nested = /^\s{2,}/.test(line);
    const t = line.trim();

    if (!t) {
      flushPara();
      continue;
    }
    if (t.startsWith("### ")) {
      flushPara();
      blocks.push({ kind: "h3", text: t.slice(4) });
    } else if (t.startsWith("## ")) {
      flushPara();
      blocks.push({ kind: "h2", text: t.slice(3) });
    } else if (t.startsWith("# ")) {
      flushPara();
      blocks.push({ kind: "h1", text: t.slice(2) });
    } else if (t.startsWith("- ")) {
      flushPara();
      pushItem("ul", t.slice(2), nested);
    } else if (/^\d+\.\s/.test(t)) {
      flushPara();
      pushItem("ol", t.replace(/^\d+\.\s/, ""), nested);
    } else {
      para.push(t);
    }
  }
  flushPara();
  return blocks;
}

/** **굵게** 만 처리한다. 법률 문서에 그 이상은 쓰지 않는다. */
function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export async function LegalDocument({ slug }: { slug: "terms" | "privacy" }) {
  const file = path.join(process.cwd(), "content", "legal", `${slug}.md`);
  const blocks = parse(await readFile(file, "utf8"));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-12">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "h1":
            return (
              <h1 key={i} className="text-display font-bold tracking-[-0.015em]">
                {b.text}
              </h1>
            );
          case "h2":
            return (
              <h2 key={i} className="mt-8 text-title font-semibold">
                {inline(b.text)}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="mt-4 text-body font-semibold">
                {inline(b.text)}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="text-body text-ink-muted">
                {inline(b.text)}
              </p>
            );
          default: {
            const List = b.kind === "ol" ? "ol" : "ul";
            return (
              <List
                key={i}
                className={`flex list-outside flex-col gap-2 text-body text-ink-muted ${
                  b.kind === "ol" ? "list-decimal" : "list-disc"
                } ${b.nested ? "pl-10" : "pl-5"}`}
              >
                {b.items.map((it, j) => (
                  <li key={j}>{inline(it)}</li>
                ))}
              </List>
            );
          }
        }
      })}
    </main>
  );
}
