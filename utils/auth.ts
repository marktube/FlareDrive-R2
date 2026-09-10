import { verifyD1Credentials, hasD1 } from "./d1auth";

// 解析并校验 "username:password" 账户信息。
// 优先查询 D1 数据库中的账户（密码经过校验），
// 如果没有配置 D1 或者 D1 中不存在该用户，则回退到旧版的环境变量账户
// （格式：环境变量名为 "username:password"，值为权限目录列表），以兼容历史部署。
export async function resolveAccount(account, context) {
    const sepIndex = account.indexOf(":");
    const username = sepIndex >= 0 ? account.slice(0, sepIndex) : account;
    const password = sepIndex >= 0 ? account.slice(sepIndex + 1) : "";

    if (hasD1(context) && username) {
        const d1User = await verifyD1Credentials(context, username, password);
        if (d1User) {
            return {
                exists: true,
                permissions: d1User.permissions,
                isReadOnly: d1User.isReadOnly,
                isAdmin: d1User.isAdmin,
                actualAccount: account,
                username,
                source: "d1"
            };
        }
    }

    // 回退：旧版环境变量账户
    let isReadOnly = false;
    let permissions = null;

    if(context.env[account]) {
        permissions = context.env[account].split(",");
        isReadOnly = false;
    }
    else if(context.env[account + ':r']) {
        permissions = context.env[account + ':r'].split(",");
        isReadOnly = true;
    }

    return {
        exists: !!permissions,
        permissions: permissions || [],
        isReadOnly: isReadOnly,
        isAdmin: !!permissions && permissions.includes("*"),
        actualAccount: account,
        username,
        source: "env"
    };
}

export async function get_auth_status(context) {
    // 用与 parseBucketPath 一致的方式解码路径：直接切原始 URL 字符串拿到的是
    // 未解码的 percent-encoding 形式，而实际写入 R2 用的是 decodeURIComponent
    // 之后的路径。两边如果不一致，理论上可能出现"校验的路径"和"实际写入的路径"
    // 对不上的情况（虽然 R2 的 key 是不透明字符串，不会被当成文件路径解析，
    // 这里没有发现可利用的越权，但保持一致更安全、更不容易出现未来的隐患）。
    let dopath: string;
    try {
        dopath = decodeURIComponent(context.request.url.split("/api/write/items/")[1] || "")
    } catch {
        // 非法的 percent-encoding，直接拒绝而不是抛出异常导致 500
        return false;
    }

    console.log('get_auth_status - checking write permission for path:', dopath);

    const guestEnv = context.env["GUEST"] || context.env["guest"];
    if(guestEnv){
        // 注意：此前这里对缩略图路径无条件放行（只要配置了 GUEST 就行，不检查具体目录），
        // 相当于任何人都能匿名写入共享的缩略图目录，与 GUEST 里配置的目录限制无关。
        // 现在缩略图路径和其他路径一样，走下面统一的按目录匹配逻辑，
        // 管理员如果确实需要允许游客写缩略图，可在 GUEST 里显式加上 "_$flaredrive$/thumbnails/"。
        const allow_guest = guestEnv.split(",")
        for (var aa of allow_guest){
            if(aa == "*"){
                return true
            }else if(dopath.startsWith(aa)){
                return true
            }
        }
    }
    var headers = new Headers(context.request.headers);
    if(!headers.get('Authorization'))return false
    const Authorization=headers.get('Authorization').split("Basic ")[1]
    const account = atob(Authorization);
    if(!account)return false

    // 解析用户账户信息（先查 D1，再回退环境变量）
    const userInfo = await resolveAccount(account, context);
    if(!userInfo.exists)return false;

    // 只读用户不能进行写操作
    if(userInfo.isReadOnly) {
        console.log('get_auth_status - read-only user cannot write');
        return false;
    }

    if(dopath.startsWith("_$flaredrive$/thumbnails/"))return true;
    const allow = userInfo.permissions;

    console.log('get_auth_status - user permissions:', allow);
    console.log('get_auth_status - checking path:', dopath);

    for (var a of allow){
        console.log('get_auth_status - checking permission:', a, 'against path:', dopath);
        if(a == "*"){
            console.log('get_auth_status - admin access granted');
            return true;
        }else if(dopath.startsWith(a)){
            console.log('get_auth_status - permission granted for path');
            return true;
        }
    }

    // 检查是否是游客目录 - 已登录用户也应该能访问游客目录
    if(guestEnv){
        const allow_guest = guestEnv.split(",")
        console.log('get_auth_status - checking guest permissions:', allow_guest);
        for (var aa of allow_guest){
            console.log('get_auth_status - checking guest permission:', aa, 'against path:', dopath);
            if(aa == "*"){
                console.log('get_auth_status - guest admin access granted');
                return true
            }else if(dopath.startsWith(aa)){
                console.log('get_auth_status - guest permission granted for path');
                return true
            }
        }
    }

    console.log('get_auth_status - no permission found, access denied');
    return false;
  }

// 新增：检查文件列表访问权限
export async function get_list_auth_status(context, path = "") {
    var headers = new Headers(context.request.headers);

    console.log('get_list_auth_status - path:', path);
    console.log('get_list_auth_status - Authorization header:', headers.get('Authorization'));

    // 检查是否有登录用户
    if(headers.get('Authorization')) {
        const Authorization = headers.get('Authorization').split("Basic ")[1]
        const account = atob(Authorization);
        console.log('get_list_auth_status - decoded account:', account);

        // 解析用户账户信息（先查 D1，再回退环境变量）
        const userInfo = await resolveAccount(account, context);
        if(userInfo.exists) {
            // 已登录用户，检查目录权限
            const allow = userInfo.permissions;
            console.log('get_list_auth_status - user permissions:', allow);
            console.log('get_list_auth_status - user isReadOnly:', userInfo.isReadOnly);
            console.log('get_list_auth_status - checking path:', path);

            // 特殊情况：根目录始终允许访问，以便显示用户有权限的子目录
            if(path === "") {
                console.log('get_list_auth_status - root access granted for logged user');
                return { hasAccess: true, isGuest: false };
            }

            for (var a of allow){
                console.log('get_list_auth_status - checking permission:', a, 'against path:', path);
                if(a == "*"){
                    console.log('get_list_auth_status - admin access granted');
                    return { hasAccess: true, isGuest: false };
                }else {
                    // 标准化路径比较：确保两边都有或都没有尾部斜杠
                    const normalizedPath = path.endsWith('/') ? path : path + '/';
                    const normalizedPermission = a.endsWith('/') ? a : a + '/';

                    console.log('get_list_auth_status - normalized comparison:', normalizedPath, 'vs', normalizedPermission);

                    if(normalizedPath.startsWith(normalizedPermission) || normalizedPermission.startsWith(normalizedPath)){
                        console.log('get_list_auth_status - path access granted');
                        return { hasAccess: true, isGuest: false };
                    }
                }
            }

            // 检查是否是游客目录 - 已登录用户也应该能访问游客目录
            const guestEnv = context.env["GUEST"] || context.env["guest"];
            if(guestEnv && path !== "") {
                const allow_guest = guestEnv.split(",");
                for (var aa of allow_guest){
                    if(aa == "*"){
                        console.log('get_list_auth_status - logged user accessing guest admin directory');
                        return { hasAccess: true, isGuest: false };
                    }else {
                        const normalizedPath = path.endsWith('/') ? path : path + '/';
                        const normalizedGuestPermission = aa.endsWith('/') ? aa : aa + '/';

                        if(normalizedPath.startsWith(normalizedGuestPermission) || normalizedGuestPermission.startsWith(normalizedPath)){
                            console.log('get_list_auth_status - logged user accessing guest directory');
                            return { hasAccess: true, isGuest: false };
                        }
                    }
                }
            }

            console.log('get_list_auth_status - no matching permissions for non-root path');
            return { hasAccess: false, isGuest: false };
        } else {
            console.log('get_list_auth_status - account not found or invalid');
        }
    } else {
        console.log('get_list_auth_status - no Authorization header');
    }

    // 未登录用户，检查游客权限
    console.log('get_list_auth_status - checking guest permissions');
    console.log('get_list_auth_status - GUEST env var:', context.env["GUEST"]);
    console.log('get_list_auth_status - guest env var:', context.env["guest"]);

    const guestEnv = context.env["GUEST"] || context.env["guest"];
    if(guestEnv){
        const allow_guest = guestEnv.split(",")
        console.log('get_list_auth_status - guest permissions:', allow_guest);

        // 特殊情况：根目录始终允许游客访问，以便显示游客有权限的子目录
        if(path === "" && allow_guest.length > 0) {
            console.log('get_list_auth_status - root access granted for guest');
            return { hasAccess: true, isGuest: true };
        }

        for (var aa of allow_guest){
            console.log('get_list_auth_status - checking guest permission:', aa, 'against path:', path);
            if(aa == "*"){
                console.log('get_list_auth_status - guest admin access granted');
                return { hasAccess: true, isGuest: true };
            }else {
                // 标准化路径比较：确保两边都有或都没有尾部斜杠
                const normalizedPath = path.endsWith('/') ? path : path + '/';
                const normalizedPermission = aa.endsWith('/') ? aa : aa + '/';

                console.log('get_list_auth_status - guest normalized comparison:', normalizedPath, 'vs', normalizedPermission);

                if(normalizedPath.startsWith(normalizedPermission) || normalizedPermission.startsWith(normalizedPath)){
                    console.log('get_list_auth_status - guest path access granted');
                    return { hasAccess: true, isGuest: true };
                }
            }
        }
        console.log('get_list_auth_status - no matching guest permissions for non-root path');
    } else {
        console.log('get_list_auth_status - no GUEST env var');
    }

    return { hasAccess: false, isGuest: true };
}
