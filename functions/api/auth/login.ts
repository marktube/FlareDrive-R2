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
        
        // 检查用户账户：先检查普通用户，再检查只读用户
        let isReadOnly = false;
        let permissions = null;
        let username = account.split(':')[0];

        // 先检查普通用户
        if(context.env[account]) {
            permissions = context.env[account].split(",");
            isReadOnly = false;
        }
        // 再检查只读用户
        else if(context.env[account + ':r']) {
            permissions = context.env[account + ':r'].split(",");
            isReadOnly = true;
        }

        // 如果都不存在，返回错误
        if(!permissions) {
            return new Response(JSON.stringify({
                success: false,
                message: "用户名或密码错误"
            }), {
                status: 401,
                headers: { "Content-Type": "application/json" }
            });
        }
        return new Response(JSON.stringify({
            success: true,
            message: "登录成功",
            user: {
                username: username,
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
