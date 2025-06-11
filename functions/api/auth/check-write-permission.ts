// 解析用户账户信息，支持只读权限
function parseUserAccount(account, context) {
    let isReadOnly = false;
    let permissions = null;

    console.log('parseUserAccount - checking account:', account);
    console.log('parseUserAccount - env[account] exists:', !!context.env[account]);
    console.log('parseUserAccount - env[account] value:', context.env[account]);
    console.log('parseUserAccount - env[account + ":r"] exists:', !!context.env[account + ':r']);
    console.log('parseUserAccount - env[account + ":r"] value:', context.env[account + ':r']);

    // 先检查普通用户
    if(context.env[account]) {
        permissions = context.env[account].split(",");
        isReadOnly = false;
        console.log('parseUserAccount - found normal user, permissions:', permissions);
    }
    // 再检查只读用户
    else if(context.env[account + ':r']) {
        permissions = context.env[account + ':r'].split(",");
        isReadOnly = true;
        console.log('parseUserAccount - found readonly user, permissions:', permissions);
    } else {
        console.log('parseUserAccount - user not found in environment variables');
    }

    const result = {
        exists: !!permissions,
        permissions: permissions || [],
        isReadOnly: isReadOnly,
        actualAccount: account
    };

    console.log('parseUserAccount - final result:', result);
    return result;
}

// 检查写入权限的函数
function checkWritePermission(context, dopath) {
    console.log('checkWritePermission - checking write permission for path:', dopath);

    const guestEnv = context.env["GUEST"] || context.env["guest"];
    if(guestEnv){
        if(dopath.startsWith("_$flaredrive$/thumbnails/"))return true;
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

    // 解析用户账户信息
    const userInfo = parseUserAccount(account, context);
    if(!userInfo.exists)return false;

    // 只读用户不能进行写操作
    if(userInfo.isReadOnly) {
        console.log('checkWritePermission - read-only user cannot write');
        return false;
    }

    if(dopath.startsWith("_$flaredrive$/thumbnails/"))return true;
    const allow = userInfo.permissions;

    console.log('checkWritePermission - user permissions:', allow);
    console.log('checkWritePermission - checking path:', dopath);

    for (var a of allow){
        console.log('checkWritePermission - checking permission:', a, 'against path:', dopath);
        if(a == "*"){
            console.log('checkWritePermission - admin access granted');
            return true;
        }else if(dopath.startsWith(a)){
            console.log('checkWritePermission - permission granted for path');
            return true;
        }
    }

    // 检查是否是游客目录 - 已登录用户也应该能访问游客目录
    if(guestEnv){
        const allow_guest = guestEnv.split(",")
        console.log('checkWritePermission - checking guest permissions:', allow_guest);
        for (var aa of allow_guest){
            console.log('checkWritePermission - checking guest permission:', aa, 'against path:', dopath);
            if(aa == "*"){
                console.log('checkWritePermission - guest admin access granted');
                return true
            }else if(dopath.startsWith(aa)){
                console.log('checkWritePermission - guest permission granted for path');
                return true
            }
        }
    }

    console.log('checkWritePermission - no permission found, access denied');
    return false;
}

export async function onRequestPost(context) {
    try {
        const requestBody = await context.request.json();
        const { path } = requestBody;

        console.log('check-write-permission - checking path:', path);

        // 构造测试路径，模拟真实的文件操作
        const testPath = path === '' ? 'test_file.txt' : `${path}test_file.txt`;

        console.log('check-write-permission - test path:', testPath);

        const hasPermission = checkWritePermission(context, testPath);

        console.log('check-write-permission - result:', hasPermission);

        return new Response(JSON.stringify({
            hasPermission: hasPermission,
            path: path,
            testPath: testPath
        }), {
            status: 200,
            headers: {
                "Content-Type": "application/json"
            }
        });

    } catch (error) {
        console.error('check-write-permission error:', error);
        return new Response(JSON.stringify({
            hasPermission: false,
            error: error.message,
            path: requestBody?.path || 'unknown'
        }), {
            status: 200, // 返回200避免触发浏览器错误处理
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}
