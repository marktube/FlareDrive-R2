import { resolveAccount } from "@/utils/auth";
import { hasD1, updateD1Password } from "@/utils/d1auth";

function json(obj: unknown, status: number) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

// POST /api/auth/change-password
// 请求头需要携带当前账户的 Basic Authorization（即 "旧用户名:旧密码"），
// Body: { "newPassword": "..." }
//
// 仅支持修改存储在 D1 数据库中的账户密码。通过环境变量配置的旧版账户
// 密码固定在部署配置里，无法在线修改，会提示用户联系管理员在 Cloudflare
// Pages 的环境变量中修改。
export async function onRequestPost(context) {
    try {
        const headers = new Headers(context.request.headers);
        const authHeader = headers.get("Authorization");

        if (!authHeader || !authHeader.startsWith("Basic ")) {
            return json({ success: false, message: "需要登录才能修改密码" }, 401);
        }

        const account = atob(authHeader.split("Basic ")[1]);
        if (!account || account.indexOf(":") === -1) {
            return json({ success: false, message: "无效的认证信息" }, 401);
        }

        // 校验旧的用户名密码
        const userInfo = await resolveAccount(account, context);
        if (!userInfo.exists) {
            return json({ success: false, message: "用户名或密码错误" }, 401);
        }

        if (userInfo.source !== "d1") {
            return json(
                {
                    success: false,
                    message:
                        "该账户由环境变量配置管理，暂不支持在线修改密码，请联系管理员在 Cloudflare Pages 的环境变量中修改，或改用 D1 账户"
                },
                400
            );
        }

        if (!hasD1(context)) {
            return json({ success: false, message: "D1 数据库未配置" }, 500);
        }

        const body = await context.request.json().catch(() => ({} as any));
        const { newPassword, oldPassword } = body as { newPassword?: string; oldPassword?: string };

        // 出于安全考虑，除了 Basic Auth 里已经校验过的旧密码之外，
        // 若前端也在 body 里传了 oldPassword，则额外做一次一致性校验。
        const oldPasswordFromHeader = account.slice(account.indexOf(":") + 1);
        if (oldPassword !== undefined && oldPassword !== oldPasswordFromHeader) {
            return json({ success: false, message: "旧密码不一致" }, 400);
        }

        if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
            return json({ success: false, message: "新密码长度至少为6位" }, 400);
        }

        if (newPassword === oldPasswordFromHeader) {
            return json({ success: false, message: "新密码不能与旧密码相同" }, 400);
        }

        await updateD1Password(context, userInfo.username, newPassword);

        return json({ success: true, message: "密码修改成功，请使用新密码重新登录" }, 200);
    } catch (error) {
        console.error("change-password error:", error);
        return json({ success: false, message: "服务器内部错误" }, 500);
    }
}
