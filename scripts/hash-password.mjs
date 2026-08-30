import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error('Nutzung: node scripts/hash-password.mjs "DeinPasswort"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log("Trage diesen Wert in AUTH_USER_X_PASSWORD_HASH_B64 ein:");
console.log(Buffer.from(hash, "utf8").toString("base64"));
