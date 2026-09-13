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

// 根据请求到的 R2Range 和对象总大小，算出 Content-Range 响应头里的
// "bytes <start>-<end>/<size>"。注意 R2 绑定实际的 R2Range 类型是
// { offset, length? } | { offset?, length } | { suffix }，并没有现成的
// "end" 字段，需要自己根据 offset/length/suffix 换算出结束字节的下标。
function formatContentRange(range: any, size: number): string {
  let start: number;
  let end: number;

  if (typeof range?.suffix === "number") {
    // "bytes=-N"：最后 N 个字节
    start = Math.max(0, size - range.suffix);
    end = size - 1;
  } else {
    start = typeof range?.offset === "number" ? range.offset : 0;
    end =
      typeof range?.length === "number"
        ? start + range.length - 1
        : size - 1;
  }

  return `bytes ${start}-${end}/${size}`;
}

export async function onRequestGet(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const request: Request = context.request;

  // 直接用 R2 绑定读取对象，不再依赖桶的公开访问地址（env["PUBURL"]）。
  // R2 绑定原生支持按 Range 分段读取（视频拖动进度条、"重新生成缩略图"功能
  // 靠这个才能不用整份下载大文件就能截取到某一帧），也支持 onlyIf 条件请求
  // （配合 ETag 做 304 缓存）——这些能力和走公开 URL 代理时是一样的，
  // 不会丢失任何功能，同时不再需要把整个存储桶暴露成任何人都能直接访问的
  // 公开地址。
  const object = await bucket.get(path, {
    range: request.headers,
    onlyIf: request.headers,
  });

  if (!object) return notFound();

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Accept-Ranges", "bytes");

  if (path.startsWith("_$flaredrive$/thumbnails/")) {
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
  const contentType = headers.get("Content-Type");
  if (isDangerousContentType(contentType)) {
    headers.set("Content-Disposition", "attachment");
  }

  // onlyIf 条件没有通过（比如 If-None-Match 命中了当前 etag）时，R2 绑定的
  // 约定是返回一个没有 body 的 R2Object，而不是抛错或返回 null——这时应该
  // 回 304，让浏览器直接用本地缓存，不用再传一次内容。
  if (!("body" in object) || !object.body) {
    return new Response(null, { status: 304, headers });
  }

  // 请求带了 Range 头、且 R2 确实按范围返回了部分内容时，回 206 + Content-Range。
  const rangeHeader = request.headers.get("range");
  if (rangeHeader && object.range) {
    headers.set("Content-Range", formatContentRange(object.range, object.size));
    return new Response(object.body, { headers, status: 206 });
  }

  return new Response(object.body, { headers, status: 200 });
}
