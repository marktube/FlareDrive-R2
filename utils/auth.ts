export function get_auth_status(context) {
    var dopath = context.request.url.split("/api/write/items/")[1]
    if(context.env["GUEST"]){
        if(dopath.startsWith("_$flaredrive$/thumbnails/"))return true;
        const allow_guest = context.env["GUEST"].split(",")
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
    if(!context.env[account])return false
    if(dopath.startsWith("_$flaredrive$/thumbnails/"))return true;
    const allow = context.env[account].split(",")
    for (var a of allow){
        if(a == "*"){
            return true
        }else if(dopath.startsWith(a)){
            return true
        }
    }
    return false;
  }

// 新增：检查文件列表访问权限
export function get_list_auth_status(context, path = "") {
    var headers = new Headers(context.request.headers);

    console.log('get_list_auth_status - path:', path);
    console.log('get_list_auth_status - Authorization header:', headers.get('Authorization'));

    // 检查是否有登录用户
    if(headers.get('Authorization')) {
        const Authorization = headers.get('Authorization').split("Basic ")[1]
        const account = atob(Authorization);
        console.log('get_list_auth_status - decoded account:', account);
        console.log('get_list_auth_status - env[account] exists:', !!context.env[account]);

        if(account && context.env[account]) {
            // 已登录用户，检查目录权限
            const allow = context.env[account].split(",")
            console.log('get_list_auth_status - user permissions:', allow);
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

    if(context.env["GUEST"]){
        const allow_guest = context.env["GUEST"].split(",")
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
