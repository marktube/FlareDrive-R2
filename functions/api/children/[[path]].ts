import { notFound, parseBucketPath } from "@/utils/bucket";
import {
  get_list_auth_status,
  userCanRead,
  userCanTraverse,
  getGuestDirs,
  isSafeKey,
  INTERNAL_PREFIX,
  FOLDER_MARKER,
} from "@/utils/auth";
import { signToken, sessionTokenExpiry } from "@/utils/signing";
import { thumbnailKeyForDigest } from "@/utils/thumbnails";

const MAX_PAGES = 20; // 每页最多 1000 个对象

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function onRequestGet(context) {
  try {
    const [bucket, rawPath] = parseBucketPath(context);
    if (!bucket) return notFound();

    const path = rawPath.replace(/\/+$/, "");
    const prefix = path && `${path}/`;
    if (prefix.startsWith(INTERNAL_PREFIX)) return notFound();
    if (prefix && !isSafeKey(prefix)) return notFound();

    const authResult = await get_list_auth_status(context, path);
    if (!authResult.hasAccess) {
      // 200 + needLogin：不带 WWW-Authenticate，避免弹出浏览器原生登录框
      // R3-3：needLogin 不只代表凭据错——有合法登录但无权进该目录时也
      // 返回 needLogin。前端只在凭据确实错了时才清本地凭据（badCredentials
      // 为真时才清），否则一个 ?p=<无权目录> 的链接会把正常用户登出；
      // 被封时也不清，封禁解除后凭据还能用。
      const authHeader = context.request.headers.get("Authorization") || "";
      const badCredentials =
        /^Basic /i.test(authHeader) && !authResult.user && !context.__fdAuthBanned;
      return json({ needLogin: true, badCredentials, message: "需要登录才能查看文件列表" });
    }
    const user = authResult.user;
    const env = context.env;

    // 此前只取第一页（最多 1000 个对象），超出的文件既看不到，
    // 递归删除/移动文件夹时也会被漏掉。
    // M6：支持 ?marker= 续读，返回 marker（下一页的 R2 游标）和 truncated，
    // 前端按 marker 循环拉完；超过 20 页（2 万个对象）时 truncated 为 true。
    const url = new URL(context.request.url);
    const objects: any[] = [];
    const folderSet = new Set<string>();
    let cursor: string | undefined = url.searchParams.get("marker") || undefined;
    let truncated = false;
    for (let page = 0; page < MAX_PAGES; page++) {
      const list = await bucket.list({
        prefix,
        delimiter: "/",
        cursor,
        include: ["httpMetadata", "customMetadata"],
      });
      objects.push(...list.objects);
      for (const p of list.delimitedPrefixes) folderSet.add(p);
      truncated = !!list.truncated;
      if (!list.truncated) break;
      cursor = list.cursor;
    }

    const value = objects
      .filter((obj) => !obj.key.endsWith("/" + FOLDER_MARKER) && obj.key !== FOLDER_MARKER)
      .filter((obj) => userCanRead(user, env, obj.key))
      .map(({ key, size, uploaded, httpMetadata, customMetadata }) => ({
        key,
        size,
        uploaded,
        httpMetadata,
        customMetadata,
      }));

    const folders = [...folderSet]
      .filter((folder) => !folder.startsWith(INTERNAL_PREFIX))
      .filter((folder) => userCanTraverse(user, env, folder));

    const expires = sessionTokenExpiry();
    // #13：缩略图令牌不再覆盖整个缩略图目录。此前 rawToken 的 p 里固定带
    // THUMBNAIL_PREFIX，匿名列一次访客目录就能拿到可读全部缩略图的令牌
    // （私密文件的缩略图只差一个摘要）；现在每个文件自带只对自己的缩略
    // 图有效的令牌（f = 精确 key），rawToken 只保留当前目录前缀。
    await Promise.all(
      value.map(async (file) => {
        const thumbKey = thumbnailKeyForDigest(file.customMetadata?.thumbnail);
        if (thumbKey) file.thumbToken = await signToken(env, bucket, { e: expires, f: thumbKey });
      }),
    );

    // 应用内读取 /raw/ 用的签名令牌：只覆盖当前目录（登录且有读权限时）。
    const scopes = [];
    if (user && userCanRead(user, env, prefix)) scopes.push(prefix);
    const rawToken = await signToken(env, bucket, { e: expires, p: scopes });

    return json({
      value,
      folders,
      isGuest: authResult.isGuest,
      guestDirs: getGuestDirs(env),
      truncated,
      marker: truncated ? cursor : null,
      rawToken,
      rawTokenPrefix: scopes.length > 0 ? prefix : null,
      rawTokenExpires: expires,
    });
  } catch (e) {
    // L10：路径解码失败是客户端错误，返回 400 即可，不记 error 日志
    if (e && (e as any).status === 400) return new Response("路径无效", { status: 400 });
    console.error("children error:", e);
    return new Response("服务器内部错误", { status: 500 });
  }
}
