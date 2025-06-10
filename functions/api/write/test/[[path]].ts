export async function onRequest(context) {
    try {
        var headers = new Headers(context.request.headers);

        // 检查是否有Authorization头
        if(!headers.get('Authorization')) {
            var header = new Headers()
            header.set("WWW-Authenticate",'Basic realm="需要登录"')
            return new Response("没有操作权限", {
                status: 401,
                headers: header,
            });
        }

        // 解析Basic Auth
        const authHeader = headers.get('Authorization');
        if (!authHeader.startsWith('Basic ')) {
            return new Response("无效的认证格式", {
                status: 401,
            });
        }

        const Authorization = authHeader.split("Basic ")[1];
        const account = atob(Authorization);

        if(!account) {
            return new Response("无效的认证信息", {
                status: 401,
            });
        }

        // 检查环境变量中是否存在该账户
        if(!context.env[account]) {
            return new Response("用户名或密码错误", {
                status: 401,
            });
        }

        // 认证成功
        return new Response("access", {
            status: 200,
        });

    } catch (error) {
        console.error('Login test error:', error);
        return new Response("服务器内部错误", {
            status: 500,
        });
    }
}