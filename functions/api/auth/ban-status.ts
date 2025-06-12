// 查询用户封禁状态API
function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') || 
           request.headers.get('X-Forwarded-For') || 
           request.headers.get('X-Real-IP') || 
           'unknown';
}

export async function onRequestPost(context) {
    try {
        const headers = new Headers(context.request.headers);
        const clientIP = getClientIP(context.request);
        
        // 检查管理员权限
        if (!headers.get('Authorization')) {
            return new Response(JSON.stringify({
                success: false,
                message: "需要管理员权限"
            }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        const authHeader = headers.get('Authorization');
        if (!authHeader.startsWith('Basic ')) {
            return new Response(JSON.stringify({
                success: false,
                message: "无效的认证格式"
            }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        const Authorization = authHeader.split("Basic ")[1];
        const account = atob(Authorization);
        
        if (!account || !context.env[account]) {
            return new Response(JSON.stringify({
                success: false,
                message: "无效的管理员凭据"
            }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 检查是否为管理员
        const permissions = context.env[account].split(",");
        if (!permissions.includes("*")) {
            return new Response(JSON.stringify({
                success: false,
                message: "需要管理员权限"
            }), {
                status: 403,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 获取请求参数
        const requestBody = await context.request.json();
        const { username, checkIP } = requestBody;

        if (!username) {
            return new Response(JSON.stringify({
                success: false,
                message: "缺少用户名参数"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        if (!context.env.LOGIN_ATTEMPTS) {
            return new Response(JSON.stringify({
                success: true,
                message: "登录限制功能未启用",
                status: "disabled"
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        const targetIP = checkIP || clientIP;
        const key = `login_limit:${username}:${targetIP}`;
        const limitData = await context.env.LOGIN_ATTEMPTS.get(key);
        
        if (!limitData) {
            return new Response(JSON.stringify({
                success: true,
                status: "clean",
                message: `用户 ${username} (IP: ${targetIP}) 无登录限制记录`,
                username,
                clientIP: targetIP
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        }

        const data = JSON.parse(limitData);
        const now = Math.floor(Date.now() / 1000);

        let status = "limited";
        let message = `用户 ${username} (IP: ${targetIP}) 已尝试登录 ${data.attempts} 次`;
        
        if (data.bannedUntil && now < data.bannedUntil) {
            status = "banned";
            const remainingBanTime = data.bannedUntil - now;
            message = `用户 ${username} (IP: ${targetIP}) 已被封禁，剩余时间：${Math.ceil(remainingBanTime / 60)} 分钟`;
        }

        return new Response(JSON.stringify({
            success: true,
            status,
            message,
            username,
            clientIP: targetIP,
            attempts: data.attempts,
            firstAttempt: data.firstAttempt,
            lastAttempt: data.lastAttempt,
            bannedUntil: data.bannedUntil,
            remainingBanTime: data.bannedUntil && now < data.bannedUntil ? data.bannedUntil - now : 0
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error('Ban status check error:', error);
        return new Response(JSON.stringify({
            success: false,
            message: "服务器内部错误"
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
