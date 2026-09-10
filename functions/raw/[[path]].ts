import { notFound, parseBucketPath } from "@/utils/bucket";

// 会被浏览器当作可执行文档解析、存在脚本执行风险的内容类型。
// 这些类型即便被设置为 inline，也会被强制加上 Content-Disposition: attachment，
// 避免用户直接点开一个被上传的恶意 .html/.svg 文件时在本域名下执行脚本、
// 进而通过 localStorage 里保存的登录凭据（Basic Auth）冒充用户。
const DANGEROUS_CONTENT_TYPES = [
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "application/xml",
  "text/xml",
];

function isDangerousContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  const base = contentType.split(";")[0].trim().toLowerCase();
  return DANGEROUS_CONTENT_TYPES.includes(base);
}

export async function onRequestGet(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();
  const url = context.env["PUBURL"] + "/" + context.request.url.split("/raw/")[1]

  var response =await fetch(new Request(url, {
    body: context.request.body,
    headers: context.request.headers,
    method: context.request.method,
    redirect: "follow",
}))


  const headers = new Headers(response.headers);
  if (path.startsWith("_$flaredrive$/thumbnails/")){
    headers.set("Cache-Control", "max-age=31536000");
  }

  // 安全加固：R2 中的对象内容完全来自用户上传，不能被信任。
  // 1) 禁止浏览器基于内容嗅探把非 HTML 文件当成 HTML 解析执行。
  headers.set("X-Content-Type-Options", "nosniff");
  // 2) 用 CSP sandbox 把这个响应强制视为一个隔离的、无脚本执行能力的文档，
  //    无论是被 <img>/<video> 内联加载，还是被用户直接在浏览器新标签页打开
  //    （本项目的"预览"功能就是 window.open 直接导航过去），都不会执行其中的脚本，
  //    也不能发起表单提交、弹窗或读取本页面的 localStorage/Cookie。
  //    这对图片、视频、音频等正常预览没有任何影响。
  headers.set("Content-Security-Policy", "sandbox");
  // 3) 对天然就是"可执行文档"的内容类型（html/xhtml/svg/xml），额外强制下载，
  //    双重保险，即使未来某个浏览器对 CSP sandbox 的直接导航支持有缺陷也不受影响。
  const contentType = headers.get("Content-Type") || response.headers.get("content-type");
  if (isDangerousContentType(contentType)) {
    headers.set("Content-Disposition", "attachment");
  }

  return new Response(response.body, {
    headers: headers,
    status: response.status,
    statusText: response.statusText
});
}