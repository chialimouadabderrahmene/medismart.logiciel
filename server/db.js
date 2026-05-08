import mysql from "mysql2/promise";

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const dbConfig = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: toNumber(process.env.MYSQL_PORT, 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "gmdb",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
};

let pool;

export function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }

  return pool;
}

export async function query(sql, params = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

export async function tableCount(tableName) {
  const safeTableName = tableName.replace(/[^a-zA-Z0-9_]/g, "");
  const rows = await query(`SELECT COUNT(*) AS total FROM \`${safeTableName}\``);
  return Number(rows[0]?.total || 0);
}
