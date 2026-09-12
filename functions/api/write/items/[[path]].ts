import { notFound, parseBucketPath } from "@/utils/bucket";
import {get_auth_status} from "@/utils/auth";
import {isCrossOriginRequest, crossOriginRejectedResponse} from "@/utils/csrf";

function unauthorizedResponse() {
  // 不设置 WWW-Authenticate 头：一是避免弹出浏览器原生登录框，
  // 二是避免浏览器缓存 Basic 凭据后被跨站请求利用（见 utils/csrf.ts 的说明）
  return new Response("没有操作权限", {
    status: 401,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function onRequestPostCreateMultipart(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const request: Request = context.request;

  const customMetadata: Record<string, string> = {};
  if (request.headers.has("fd-thumbnail"))
    customMetadata.thumbnail = request.headers.get("fd-thumbnail");

  const multipartUpload = await bucket.createMultipartUpload(path, {
    httpMetadata: {
      contentType: request.headers.get("content-type"),
    },
    customMetadata,
  });

  return new Response(
    JSON.stringify({
      key: multipartUpload.key,
      uploadId: multipartUpload.uploadId,
    })
  );
}

export async function onRequestPostCompleteMultipart(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const request: Request = context.request;
  const url = new URL(request.url);
  const uploadId = new URLSearchParams(url.search).get("uploadId");
  const multipartUpload = await bucket.resumeMultipartUpload(path, uploadId);

  const completeBody: { parts: Array<any> } = await request.json();

  try {
    const object = await multipartUpload.complete(completeBody.parts);
    return new Response(null, {
      headers: { etag: object.httpEtag },
    });
  } catch (error: any) {
    return new Response(error.message, { status: 400 });
  }
}

export async function onRequestPostFixMetadata(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const existing = await bucket.get(path);
  if (!existing) {
    return new Response(JSON.stringify({ error: "文件不存在" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body: { thumbnail?: string; contentType?: string } = await context.request
    .json()
    .catch(() => ({}));

  const customMetadata: Record<string, string> = { ...(existing.customMetadata || {}) };
  if (body.thumbnail) customMetadata.thumbnail = body.thumbnail;

  const contentType = body.contentType || existing.httpMetadata?.contentType;

  // 这是一次 R2 内部的读回写操作（get 之后立刻 put 回同一个 key），
  // 文件本体完全不经过发起请求的浏览器，不需要客户端重新上传整份文件——
  // 对于修复大视频文件缺失的 content-type / 重新生成缩略图这种场景，
  // 比让前端把整份原始视频再上传一遍要高效得多。
  const obj = await bucket.put(path, existing.body, {
    customMetadata,
    httpMetadata: contentType ? { contentType } : undefined,
  });

  const { key, size, uploaded } = obj;
  return new Response(JSON.stringify({ key, size, uploaded, customMetadata }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestPost(context) {
  // 修复：此前 POST（创建分片上传 / 完成分片上传）完全没有做权限校验，
  // 任何人都可以不登录直接写入任意路径（配合 PUT 分片上传即可绕过认证）。
  if (isCrossOriginRequest(context)) return crossOriginRejectedResponse();
  if (!(await get_auth_status(context))) return unauthorizedResponse();

  const url = new URL(context.request.url);
  const searchParams = new URLSearchParams(url.search);

  if (searchParams.has("uploads")) {
    return onRequestPostCreateMultipart(context);
  }

  if (searchParams.has("uploadId")) {
    return onRequestPostCompleteMultipart(context);
  }

  if (searchParams.has("fixMetadata")) {
    return onRequestPostFixMetadata(context);
  }

  return new Response("Method not allowed", { status: 405 });
}

export async function onRequestPutMultipart(context) {
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const request: Request = context.request;
  const url = new URL(request.url);

  const uploadId = new URLSearchParams(url.search).get("uploadId");
  const multipartUpload = await bucket.resumeMultipartUpload(path, uploadId);

  const partNumber = parseInt(
    new URLSearchParams(url.search).get("partNumber")
  );
  const uploadedPart = await multipartUpload.uploadPart(
    partNumber,
    request.body
  );

  return new Response(null, {
    headers: {
      "Content-Type": "application/json",
      etag: uploadedPart.etag,
    },
  });
}

export async function onRequestPut(context) {
  if (isCrossOriginRequest(context)) return crossOriginRejectedResponse();
  if(!(await get_auth_status(context))){
    return unauthorizedResponse();
   }
  const url = new URL(context.request.url);

  if (new URLSearchParams(url.search).has("uploadId")) {
    return onRequestPutMultipart(context);
  }

  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  const request: Request = context.request;

  let content = request.body;
  const customMetadata: Record<string, string> = {};
  // 之前这里完全没有设置 httpMetadata，导致所有走普通 PUT（非分片）上传的文件
  // 在 R2 里都没有存储 content-type——只有超过分片阈值、走 multipart 上传的
  // 大文件才会被正确设置。列表接口读到 httpMetadata.contentType 为 undefined 时
  // 前端只能把文件当成通用的 'application/octet-stream'，导致缩略图/预览图标
  // 完全无法显示，即使 customMetadata.thumbnail 本身是有效的。
  let contentType: string | undefined = request.headers.get("content-type") || undefined;

  if (request.headers.has("x-amz-copy-source")) {
    const sourceName = decodeURIComponent(
      request.headers.get("x-amz-copy-source")
    );
    const source = await bucket.get(sourceName);
    content = source.body;
    if (source.customMetadata.thumbnail)
      customMetadata.thumbnail = source.customMetadata.thumbnail;
    // 复制/移动场景下，前端发出的 Content-Type 请求头固定是占位值
    // "application/octet-stream"，并不代表源文件的真实类型；这里改为沿用
    // 源对象已经存储的 content-type，避免复制/移动后类型被错误覆盖成占位值。
    contentType = source.httpMetadata?.contentType || contentType;
  }

  if (request.headers.has("fd-thumbnail"))
    customMetadata.thumbnail = request.headers.get("fd-thumbnail");

  const obj = await bucket.put(path, content, {
    customMetadata,
    httpMetadata: contentType ? { contentType } : undefined,
  });
  const { key, size, uploaded } = obj;
  return new Response(JSON.stringify({ key, size, uploaded }), {
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestHead(context) {
  // HEAD请求用于检查写入权限，不实际执行操作
  if(!(await get_auth_status(context))){
    // 不设置WWW-Authenticate头，避免弹出浏览器登录框
    return new Response("没有操作权限", {
        status: 403, // 使用403而不是401，避免触发浏览器认证
        headers: {
          "Content-Type": "text/plain"
        },
    });
   }

  // 如果有权限，返回200状态码
  return new Response(null, { status: 200 });
}

export async function onRequestDelete(context) {
  if (isCrossOriginRequest(context)) return crossOriginRejectedResponse();
  if(!(await get_auth_status(context))){
    return unauthorizedResponse();
   }
  const [bucket, path] = parseBucketPath(context);
  if (!bucket) return notFound();

  await bucket.delete(path);
  return new Response(null, { status: 204 });
}
