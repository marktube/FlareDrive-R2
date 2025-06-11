import { get_auth_status } from "@/utils/auth";

export async function onRequestPost(context) {
    try {
        const requestBody = await context.request.json();
        const { path } = requestBody;
        
        console.log('check-write-permission - checking path:', path);
        
        // 临时修改请求URL以便get_auth_status函数正常工作
        const originalUrl = context.request.url;
        const testPath = path === '' ? '_$test_write_permission$' : `${path}_$test_write_permission$`;
        context.request.url = `${originalUrl.split('/api/')[0]}/api/write/items/${testPath}`;
        
        const hasPermission = get_auth_status(context);
        
        // 恢复原始URL
        context.request.url = originalUrl;
        
        console.log('check-write-permission - result:', hasPermission);
        
        return new Response(JSON.stringify({
            hasPermission: hasPermission,
            path: path
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
            error: error.message
        }), {
            status: 200, // 返回200避免触发浏览器错误处理
            headers: {
                "Content-Type": "application/json"
            }
        });
    }
}
