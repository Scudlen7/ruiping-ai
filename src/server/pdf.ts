import { existsSync } from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import puppeteer, { type Browser } from "puppeteer-core";
import { env } from "~/server/env";

function candidateBrowserPaths(): string[] {
  if (process.platform === "win32") {
    const roots = [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(
      (root): root is string => Boolean(root),
    );
    return roots.flatMap((root) => [
      path.join(root, "Microsoft", "Edge", "Application", "msedge.exe"),
      path.join(root, "Google", "Chrome", "Application", "chrome.exe"),
    ]);
  }
  if (process.platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
  ];
}

/** PDF_BROWSER_PATH if set, otherwise the first locally installed Edge/Chrome/Chromium. */
export function findBrowserExecutable(): string | null {
  if (env.PDF_BROWSER_PATH) return existsSync(env.PDF_BROWSER_PATH) ? env.PDF_BROWSER_PATH : null;
  return candidateBrowserPaths().find((candidate) => existsSync(candidate)) ?? null;
}

export type RenderPdf = (html: string) => Promise<Buffer>;

/** Launches one headless browser for a batch of PDFs and always closes it afterwards. */
export async function withPdfRenderer<T>(work: (render: RenderPdf) => Promise<T>): Promise<T> {
  const executablePath = findBrowserExecutable();
  if (!executablePath) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: env.PDF_BROWSER_PATH
        ? "PDF_BROWSER_PATH 指向的浏览器不存在，请检查 .env 配置"
        : "未找到可用于生成 PDF 的浏览器，请安装 Microsoft Edge 或 Google Chrome，或在 .env 中设置 PDF_BROWSER_PATH",
    });
  }

  let browser: Browser;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
    });
  } catch (error) {
    console.error("[pdf] failed to launch browser:", error);
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "启动 PDF 渲染浏览器失败，请检查本机浏览器安装" });
  }

  const render: RenderPdf = async (html) => {
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => {});
    }
  };

  try {
    return await work(render);
  } finally {
    await browser.close().catch(() => {});
  }
}
