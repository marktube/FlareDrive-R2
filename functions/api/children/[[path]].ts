import { notFound, parseBucketPath } from "@/utils/bucket";
import { get_list_auth_status } from "@/utils/auth";

export async function onRequestGet(context) {
  try {
    const [bucket, path] = parseBucketPath(context);
    const prefix = path && `${path}/`;
    if (!bucket || prefix.startsWith("_$flaredrive$/")) return notFound();

    // 检查文件列表访问权限
    const authResult = get_list_auth_status(context, path || "");

    if (!authResult.hasAccess) {
      // 没有权限访问，返回需要登录的响应（不包含WWW-Authenticate头，避免弹出浏览器登录框）
      return new Response(JSON.stringify({
        needLogin: true,
        message: "需要登录才能查看文件列表"
      }), {
        status: 200, // 改为200状态码，避免触发浏览器登录框
        headers: {
          "Content-Type": "application/json"
        },
      });
    }

    const objList = await bucket.list({
      prefix,
      delimiter: "/",
      include: ["httpMetadata", "customMetadata"],
    });

    let objKeys = objList.objects
      .filter((obj) => !obj.key.endsWith("/_$folder$"))
      .map((obj) => {
        const { key, size, uploaded, httpMetadata, customMetadata } = obj;
        return { key, size, uploaded, httpMetadata, customMetadata };
      });

    let folders = objList.delimitedPrefixes;
    if (!path)
      folders = folders.filter((folder) => folder !== "_$flaredrive$/");

    // 如果是游客且设置了游客目录，只显示允许的目录内容
    if (authResult.isGuest && context.env["GUEST"]) {
      const allow_guest = context.env["GUEST"].split(",");
      const currentPath = path || "";

      // 过滤文件：只显示游客有权限的文件
      objKeys = objKeys.filter(file => {
        for (var aa of allow_guest) {
          if (aa == "*") return true;
          if (file.key.startsWith(aa)) return true;
        }
        return false;
      });

      // 过滤文件夹：只显示游客有权限的文件夹
      folders = folders.filter(folder => {
        for (var aa of allow_guest) {
          if (aa == "*") return true;
          if (folder.startsWith(aa)) return true;
        }
        return false;
      });
    }

    return new Response(JSON.stringify({
      value: objKeys,
      folders,
      isGuest: authResult.isGuest
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(e.toString(), { status: 500 });
  }
}
