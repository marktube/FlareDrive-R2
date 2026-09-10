// D1 数据库账户体系工具函数
//
// 依赖绑定名为 `DB` 的 D1 数据库（在 Cloudflare Pages 项目设置里绑定），
// 表结构见 /migrations/0001_create_users.sql。
//
// 密码使用 PBKDF2-SHA256（Web Crypto，Workers 运行时原生支持）加盐哈希后存储，
// 数据库中不保存明文密码。

const PBKDF2_ITERATIONS = 100000;
const HASH_BITLEN = 256;

function bufToHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export function generateSaltHex(): string {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bufToHex(salt);
}

export async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: hexToBuf(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    HASH_BITLEN
  );
  return bufToHex(bits);
}

// 定长比较，避免通过响应时间差异泄露哈希信息
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function hasD1(context): boolean {
  return !!(context && context.env && context.env.DB);
}

export async function getD1User(context, username: string) {
  if (!hasD1(context) || !username) return null;
  const row = await context.env.DB.prepare("SELECT * FROM users WHERE username = ?")
    .bind(username)
    .first();
  return row || null;
}

export type D1AuthResult = {
  username: string;
  permissions: string[];
  isReadOnly: boolean;
  isAdmin: boolean;
};

// 校验用户名密码是否匹配 D1 中记录，匹配则返回归一化的用户信息，否则返回 null
export async function verifyD1Credentials(
  context,
  username: string,
  password: string
): Promise<D1AuthResult | null> {
  const user = await getD1User(context, username);
  if (!user) return null;

  const computedHash = await hashPassword(password, user.salt as string);
  if (!timingSafeEqual(computedHash, user.password_hash as string)) return null;

  const permissions =
    user.permissions === "*" ? ["*"] : String(user.permissions).split(",").filter(Boolean);

  return {
    username: user.username as string,
    permissions,
    isReadOnly: !!user.is_readonly,
    isAdmin: !!user.is_admin || permissions.includes("*"),
  };
}

export async function createD1User(
  context,
  opts: {
    username: string;
    password: string;
    permissions: string[] | string;
    isReadOnly?: boolean;
    isAdmin?: boolean;
  }
) {
  if (!hasD1(context)) throw new Error("D1 数据库 (DB 绑定) 未配置");
  const { username, password } = opts;
  if (!username || !password) throw new Error("缺少用户名或密码");

  const existing = await getD1User(context, username);
  if (existing) throw new Error("用户已存在");

  const salt = generateSaltHex();
  const passwordHash = await hashPassword(password, salt);
  const now = Math.floor(Date.now() / 1000);
  const permsStr = Array.isArray(opts.permissions) ? opts.permissions.join(",") : opts.permissions;

  await context.env.DB.prepare(
    `INSERT INTO users (username, password_hash, salt, permissions, is_readonly, is_admin, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      username,
      passwordHash,
      salt,
      permsStr,
      opts.isReadOnly ? 1 : 0,
      opts.isAdmin ? 1 : 0,
      now,
      now
    )
    .run();
}

export async function updateD1Password(context, username: string, newPassword: string) {
  if (!hasD1(context)) throw new Error("D1 数据库 (DB 绑定) 未配置");

  const salt = generateSaltHex();
  const passwordHash = await hashPassword(newPassword, salt);
  const now = Math.floor(Date.now() / 1000);

  const result = await context.env.DB.prepare(
    `UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE username = ?`
  )
    .bind(passwordHash, salt, now, username)
    .run();

  return result;
}
