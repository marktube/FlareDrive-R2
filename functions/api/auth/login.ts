export async function onRequestPost(context) {
    try {
        var headers = new Headers(context.request.headers);
        
        // 检查是否有Authorization头
        if(!headers.get('Authorization')) {
            return new Response(JSON.stringify({
                success: false,
                message: "缺少认证信息"
            }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }
        
        // 解析Basic Auth
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
        
        if(!account) {
            return new Response(JSON.stringify({
                success: false,
                message: "无效的认证信息"
            }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }
        
        // 解析用户账户信息，支持只读权限
        const accountParts = account.split(':');
        let isReadOnly = false;
        let actualAccount = account;

        if (accountParts.length === 3 && accountParts[2] === 'r') {
            isReadOnly = true;
            actualAccount = `${accountParts[0]}:${accountParts[1]}`;
        }

        // 检查环境变量中是否存在该账户
        const envKey = isReadOnly ? `${actualAccount}:r` : actualAccount;
        if(!context.env[envKey]) {
            return new Response(JSON.stringify({
                success: false,
                message: "用户名或密码错误"
            }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 认证成功，返回用户信息
        const permissions = context.env[envKey].split(",");
        return new Response(JSON.stringify({
            success: true,
            message: "登录成功",
            user: {
                username: actualAccount.split(':')[0],
                permissions: permissions,
                isAdmin: permissions.includes("*"),
                isReadOnly: isReadOnly
            }
        }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        return new Response(JSON.stringify({
            success: false,
            message: "服务器内部错误"
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
