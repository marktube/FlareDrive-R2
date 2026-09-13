#!/usr/bin/env node
// 生成用于直接向 D1 数据库插入第一个管理员账户的 SQL。
//
// 为什么需要这个脚本：数据库里的密码是用 PBKDF2-SHA256（100000 次迭代）
// 加盐哈希存储的，不是明文，没办法手写一条 INSERT 语句就把账户建好——
// 必须用完全一样的算法算出 password_hash 和 salt。这个脚本用 Node.js
// 内置的 crypto 模块，按和 utils/d1auth.ts 里 hashPassword() 完全相同的
// 参数（PBKDF2、SHA-256、100000 次迭代、256 位输出）计算，保证生成的哈希
// 能被应用正常校验通过。
//
// 用法：
//   node scripts/create-admin-sql.js <username> <password> [permissions] [--readonly]
//
// 例子（创建一个用户名 admin、拥有全部目录权限的管理员账户）：
//   node scripts/create-admin-sql.js admin "a-very-strong-password" > admin.sql
//   wrangler d1 execute <YOUR_DB_NAME> --file=./admin.sql --remote
//
// permissions 参数默认是 "*"（全部目录权限），也可以传别的，比如 "docs/,photos/"。
// 建成后请删除本地生成的 admin.sql 文件，它包含账户密码的哈希值。

const crypto = require("crypto");

const PBKDF2_ITERATIONS = 100000;
const KEY_LENGTH_BYTES = 32; // 256 bits，和 d1auth.ts 的 HASH_BITLEN = 256 对应

function generateSaltHex() {
  return crypto.randomBytes(16).toString("hex");
}

function hashPassword(password, saltHex) {
  const salt = Buffer.from(saltHex, "hex");
  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH_BYTES,
    "sha256"
  );
  return derivedKey.toString("hex");
}

function sqlEscape(value) {
  return String(value).replace(/'/g, "''");
}

function main() {
  const [, , username, password, permissionsArg, flag] = process.argv;

  if (!username || !password) {
    console.error(
      '用法: node scripts/create-admin-sql.js <username> <password> [permissions="*"] [--readonly]'
    );
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("密码长度至少为 6 位");
    process.exit(1);
  }

  const permissions = permissionsArg || "*";
  const isReadOnly = flag === "--readonly" ? 1 : 0;
  const salt = generateSaltHex();
  const passwordHash = hashPassword(password, salt);
  const now = Math.floor(Date.now() / 1000);

  const sql = `INSERT INTO users (username, password_hash, salt, permissions, is_readonly, is_admin, created_at, updated_at)
VALUES ('${sqlEscape(username)}', '${passwordHash}', '${salt}', '${sqlEscape(permissions)}', ${isReadOnly}, 1, ${now}, ${now});`;

  console.log(sql);
}

main();
