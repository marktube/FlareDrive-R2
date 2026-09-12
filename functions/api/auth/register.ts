import { resolveAccount } from "@/utils/auth";
import { createD1User, getD1User, hasD1 } from "@/utils/d1auth";

function json(obj: unknown, status: number) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { "Content-Type": "application/json" }
    });
}

// POST /api/auth/register
// 管理员专用接口，用于在 D1 数据库中创建新账户。
// 请求头需要携带管理员的 Basic Authorization（可以是 D1 管理员，也可以是旧版
// 环境变量里配置的 "user:pass=*" 管理员，方便从环境变量账户平滑过渡到 D1）。
// Body: { "username": "...", "password": "...", "permissions": ["dir1/", "dir2/"] | "*", "isReadOnly"?: boolean, "isAdmin"?: boolean }
//
// 注意：permissions 里的 "*"（全部目录读写权限）和 isAdmin（能管理账户系统，
// 比如调用本接口创建新账户、封禁/解封用户）是两个完全独立的权限维度。
// 给一个账户 "*" 权限只代表它能读写所有目录，不会让它自动变成管理员；
// 只有调用方显式传入 isAdmin: true（且调用方本身必须已经是真正的管理员，
// 已经在上面的权限校验里保证了这一点）才会创建出真正的管理员账户。
export async function onRequestPost(context) {
    try {
        if (!hasD1(context)) {
            return json({ success: false, message: "D1 数据库 (DB 绑定) 未配置，请先在 Pages 项目中绑定 D1 数据库" }, 500);
        }

        const headers = new Headers(context.request.headers);
        const authHeader = headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Basic ")) {
            return json({ success: false, message: "需要管理员权限" }, 401);
        }

        const account = atob(authHeader.split("Basic ")[1]);
        const adminInfo = await resolveAccount(account, context);
        if (!adminInfo.exists || !adminInfo.isAdmin) {
            return json({ success: false, message: "需要管理员权限" }, 403);
        }

        const body = await context.request.json().catch(() => ({} as any));
        const { username, password, permissions, isReadOnly, isAdmin } = body as {
            username?: string;
            password?: string;
            permissions?: string[] | string;
            isReadOnly?: boolean;
            isAdmin?: boolean;
        };

        if (!username || !password || !permissions) {
            return json({ success: false, message: "缺少必要参数：username, password, permissions" }, 400);
        }

        if (password.length < 6) {
            return json({ success: false, message: "密码长度至少为6位" }, 400);
        }

        // 用户名重复检查：D1 中已存在同名账户
        const existing = await getD1User(context, username);
        if (existing) {
            return json(
                {
                    success: false,
                    code: "USERNAME_TAKEN",
                    message: `用户名 "${username}" 已存在，请换一个用户名`
                },
                409 // Conflict
            );
        }

        // 用户名重复检查：环境变量中已配置同名账户。
        // 由于登录时优先匹配 D1 账户，同名会导致旧的环境变量账户被"顶掉"，
        // 因此这里也判定为冲突，避免管理员误操作把已有用户锁在门外。
        const envConflict = Object.keys(context.env || {}).some((key) => {
            // 环境变量账户的键形如 "username:password" 或 "username:password:r"
            return typeof context.env[key] === "string" && key.split(":")[0] === username;
        });
        if (envConflict) {
            return json(
                {
                    success: false,
                    code: "USERNAME_TAKEN",
                    message: `用户名 "${username}" 已在环境变量中配置，请换一个用户名，或先移除对应的环境变量账户`
                },
                409
            );
        }

        try {
            await createD1User(context, {
                username,
                password,
                permissions: Array.isArray(permissions) ? permissions : String(permissions).split(","),
                isReadOnly: !!isReadOnly,
                // 调用方已经在上面通过了 adminInfo.isAdmin 校验，是真正的管理员，
                // 所以这里允许它显式把新账户也设为管理员——这是现在唯一创建 D1
                // 管理员账户的正规途径（is_admin 不再能通过 "*" 权限间接拿到）。
                isAdmin: !!isAdmin
            });
        } catch (error: any) {
            // 并发创建同名用户时，上面的预检查可能都通过，最终由数据库的
            // UNIQUE 约束拦下，这里同样返回 409 而不是 500
            const msg = String(error && error.message);
            if (msg.includes("UNIQUE") || msg.includes("用户已存在")) {
                return json(
                    {
                        success: false,
                        code: "USERNAME_TAKEN",
                        message: `用户名 "${username}" 已存在，请换一个用户名`
                    },
                    409
                );
            }
            throw error;
        }

        return json({ success: true, message: `用户 ${username} 创建成功` }, 200);
    } catch (error: any) {
        console.error("register error:", error);
        return json({ success: false, message: error.message || "服务器内部错误" }, 500);
    }
}
