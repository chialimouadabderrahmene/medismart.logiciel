import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";

const rootDir = path.resolve(process.cwd());
const backupPath = path.join(rootDir, "GestionMedicaleDBbackup_02-05-2026.sql");

const config = {
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "gmdb"
};

if (!fs.existsSync(backupPath)) {
  console.error(`Backup not found: ${backupPath}`);
  process.exit(1);
}

let admin;

try {
  admin = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    multipleStatements: true
  });
} catch (error) {
  if (error.code === "ECONNREFUSED") {
    console.error("");
    console.error(`Cannot connect to MySQL at ${config.host}:${config.port}.`);
    console.error("");
    console.error("Start or install a MySQL/MariaDB server, then run this command again.");
    console.error("Your current .env expects:");
    console.error(`  MYSQL_HOST=${config.host}`);
    console.error(`  MYSQL_PORT=${config.port}`);
    console.error(`  MYSQL_USER=${config.user}`);
    console.error(`  MYSQL_DATABASE=${config.database}`);
    console.error("");
    console.error("Windows quick checks:");
    console.error("  Get-Service *mysql*");
    console.error("  Test-NetConnection 127.0.0.1 -Port 3306");
    process.exit(1);
  }

  if (error.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("MySQL rejected the username/password in .env.");
    console.error("Edit MYSQL_USER and MYSQL_PASSWORD, then run npm run import:db again.");
    process.exit(1);
  }

  throw error;
}

await admin.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8 COLLATE utf8_unicode_ci`);
await admin.end();

const args = [
  "--default-character-set=utf8",
  "--max_allowed_packet=512M",
  "-h",
  config.host,
  "-P",
  String(config.port),
  "-u",
  config.user,
  config.database
];

const env = { ...process.env };
if (config.password) {
  env.MYSQL_PWD = config.password;
}

console.log(`Importing ${path.basename(backupPath)} into MySQL database ${config.database}...`);

const mysqlProcess = spawn("mysql", args, {
  stdio: ["pipe", "inherit", "inherit"],
  env
});

fs.createReadStream(backupPath).pipe(mysqlProcess.stdin);

mysqlProcess.on("close", (code) => {
  if (code === 0) {
    console.log("Import finished successfully.");
  } else {
    console.error(`Import failed with exit code ${code}. Check MySQL credentials and that mysql.exe is in PATH.`);
    process.exit(code || 1);
  }
});
