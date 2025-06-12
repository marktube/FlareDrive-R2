// 管理员解封用户API
export async function onRequestPost(context) {
    try {
        const headers = new Headers(context.request.headers);
        
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
        const { username, clientIP } = requestBody;

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
                success: false,
                message: "登录限制功能未启用"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 如果指定了IP，解封特定IP的用户
        if (clientIP) {
            const key = `login_limit:${username}:${clientIP}`;
            await context.env.LOGIN_ATTEMPTS.delete(key);
            
            return new Response(JSON.stringify({
                success: true,
                message: `已解封用户 ${username} (IP: ${clientIP})`
            }), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        } else {
            // 解封该用户的所有IP限制
            // 注意：KV不支持前缀删除，这里只能提供单个IP解封
            // 如果需要批量解封，需要前端传入具体的IP列表
            return new Response(JSON.stringify({
                success: false,
                message: "请指定要解封的客户端IP地址"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }

    } catch (error) {
        console.error('Unban error:', error);
        return new Response(JSON.stringify({
            success: false,
            message: "服务器内部错误"
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
