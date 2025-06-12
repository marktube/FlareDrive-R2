// 登录限制配置
const LOGIN_LIMIT_CONFIG = {
    MAX_ATTEMPTS: 5,        // 最大尝试次数
    BAN_DURATION: 30 * 60,  // 封禁时长（秒），30分钟
    ATTEMPT_WINDOW: 60 * 60 // 尝试次数重置窗口（秒），1小时
};

// 获取客户端IP地址
function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') ||
           request.headers.get('X-Forwarded-For') ||
           request.headers.get('X-Real-IP') ||
           'unknown';
}

// 检查用户是否被封禁
async function checkLoginLimit(context, username, clientIP) {
    if (!context.env.LOGIN_ATTEMPTS) {
        return { allowed: true, remainingAttempts: LOGIN_LIMIT_CONFIG.MAX_ATTEMPTS };
    }

    const key = `login_limit:${username}:${clientIP}`;
    const limitData = await context.env.LOGIN_ATTEMPTS.get(key);

    if (!limitData) {
        return { allowed: true, remainingAttempts: LOGIN_LIMIT_CONFIG.MAX_ATTEMPTS };
    }

    const data = JSON.parse(limitData);
    const now = Math.floor(Date.now() / 1000);

    // 检查是否在封禁期内
    if (data.bannedUntil && now < data.bannedUntil) {
        const remainingBanTime = data.bannedUntil - now;
        return {
            allowed: false,
            banned: true,
            remainingBanTime,
            message: `账户已被临时锁定，请在 ${Math.ceil(remainingBanTime / 60)} 分钟后重试`
        };
    }

    // 检查尝试次数是否超限
    if (data.attempts >= LOGIN_LIMIT_CONFIG.MAX_ATTEMPTS) {
        // 检查是否超过重置窗口
        if (now - data.firstAttempt > LOGIN_LIMIT_CONFIG.ATTEMPT_WINDOW) {
            // 重置计数
            await context.env.LOGIN_ATTEMPTS.delete(key);
            return { allowed: true, remainingAttempts: LOGIN_LIMIT_CONFIG.MAX_ATTEMPTS };
        } else {
            // 设置封禁
            const bannedUntil = now + LOGIN_LIMIT_CONFIG.BAN_DURATION;
            await context.env.LOGIN_ATTEMPTS.put(key, JSON.stringify({
                ...data,
                bannedUntil
            }), { expirationTtl: LOGIN_LIMIT_CONFIG.BAN_DURATION + 3600 });

            return {
                allowed: false,
                banned: true,
                remainingBanTime: LOGIN_LIMIT_CONFIG.BAN_DURATION,
                message: `登录尝试次数过多，账户已被锁定 ${LOGIN_LIMIT_CONFIG.BAN_DURATION / 60} 分钟`
            };
        }
    }

    return {
        allowed: true,
        remainingAttempts: LOGIN_LIMIT_CONFIG.MAX_ATTEMPTS - data.attempts
    };
}

// 记录登录失败
async function recordLoginFailure(context, username, clientIP) {
    if (!context.env.LOGIN_ATTEMPTS) {
        return;
    }

    const key = `login_limit:${username}:${clientIP}`;
    const limitData = await context.env.LOGIN_ATTEMPTS.get(key);
    const now = Math.floor(Date.now() / 1000);

    let data;
    if (limitData) {
        data = JSON.parse(limitData);
        // 如果超过重置窗口，重新开始计数
        if (now - data.firstAttempt > LOGIN_LIMIT_CONFIG.ATTEMPT_WINDOW) {
            data = { attempts: 1, firstAttempt: now, lastAttempt: now };
        } else {
            data.attempts += 1;
            data.lastAttempt = now;
        }
    } else {
        data = { attempts: 1, firstAttempt: now, lastAttempt: now };
    }

    // 设置过期时间为封禁时长 + 1小时的缓冲
    const ttl = LOGIN_LIMIT_CONFIG.BAN_DURATION + 3600;
    await context.env.LOGIN_ATTEMPTS.put(key, JSON.stringify(data), { expirationTtl: ttl });
}

// 清除登录限制记录（登录成功时调用）
async function clearLoginLimit(context, username, clientIP) {
    if (!context.env.LOGIN_ATTEMPTS) {
        return;
    }

    const key = `login_limit:${username}:${clientIP}`;
    await context.env.LOGIN_ATTEMPTS.delete(key);
}

export async function onRequestPost(context) {
    try {
        var headers = new Headers(context.request.headers);
        const clientIP = getClientIP(context.request);

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

        // 提取用户名用于限制检查
        let username = account.split(':')[0];

        // 检查登录限制
        const limitCheck = await checkLoginLimit(context, username, clientIP);
        if (!limitCheck.allowed) {
            return new Response(JSON.stringify({
                success: false,
                message: limitCheck.message,
                banned: limitCheck.banned,
                remainingBanTime: limitCheck.remainingBanTime
            }), {
                status: 429, // Too Many Requests
                headers: { "Content-Type": "application/json" }
            });
        }

        // 检查用户账户：先检查普通用户，再检查只读用户
        let isReadOnly = false;
        let permissions = null;

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

        // 如果都不存在，记录失败并返回错误
        if(!permissions) {
            await recordLoginFailure(context, username, clientIP);

            // 重新检查限制状态，获取最新的剩余次数
            const updatedLimitCheck = await checkLoginLimit(context, username, clientIP);
            let message = "用户名或密码错误";

            if (updatedLimitCheck.allowed && updatedLimitCheck.remainingAttempts < LOGIN_LIMIT_CONFIG.MAX_ATTEMPTS) {
                message += `，剩余尝试次数：${updatedLimitCheck.remainingAttempts}`;
            } else if (!updatedLimitCheck.allowed && updatedLimitCheck.banned) {
                message = updatedLimitCheck.message;
            }

            return new Response(JSON.stringify({
                success: false,
                message: message,
                remainingAttempts: updatedLimitCheck.remainingAttempts,
                banned: !updatedLimitCheck.allowed && updatedLimitCheck.banned
            }), {
                status: updatedLimitCheck.allowed ? 401 : 429,
                headers: { "Content-Type": "application/json" }
            });
        }

        // 登录成功，清除限制记录
        await clearLoginLimit(context, username, clientIP);

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
