// 简单的同源校验，用于给状态变更类接口（PUT/DELETE/POST）加一层跨站请求防护。
//
// 背景：本项目使用 HTTP Basic 认证而非 Cookie 保存登录态，浏览器不会像 Cookie
// 那样自动把 Authorization 头带到跨站请求里 —— 除非该来源此前通过响应
// "WWW-Authenticate: Basic" 触发过浏览器原生登录框，浏览器会把用户输入的凭据
// 缓存下来，并在之后对同一 origin 的**所有**请求（包括由其他网站发起的跨站请求）
// 自动附带上 Authorization 头，从而重新引入 CSRF 风险。
//
// 因此这里做两层防护：
//   1) 状态变更接口不再返回 WWW-Authenticate 头，避免浏览器缓存 Basic 凭据。
//   2) 额外做一次 Origin 同源校验作为纵深防御：仅当请求带有 Origin 头且和
//      当前域名不一致时才拒绝；不强制要求必须带 Origin，避免误伤 curl / 服务端
//      脚本等本来就不发送 Origin 头的合法调用（例如管理员用 curl 调用注册接口）。
export function isCrossOriginRequest(context): boolean {
    const headers = new Headers(context.request.headers);
    const origin = headers.get("Origin");
    if (!origin) return false;

    try {
        const originHost = new URL(origin).host;
        const requestHost = new URL(context.request.url).host;
        return originHost !== requestHost;
    } catch {
        // Origin 头格式非法，保守起见按跨域处理
        return true;
    }
}

export function crossOriginRejectedResponse(): Response {
    return new Response("跨站请求被拒绝", { status: 403 });
}
