export async function onRequestGet(context) {
  const { env } = context;
  
  // 返回前端需要的环境变量配置
  const config = {
    QRCODE_API: env.QRCODE_API || ''
  };
  
  return new Response(JSON.stringify(config), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300' // 缓存5分钟
    }
  });
}
