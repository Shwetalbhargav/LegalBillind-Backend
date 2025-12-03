import bcrypt from "bcryptjs";

const hash = await bcrypt.hash("changeme", 10);
console.log(hash);
