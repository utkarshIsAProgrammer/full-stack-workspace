import fs from "fs";

const file = process.argv[2];
const b = fs.readFileSync(file);
// PNG parse minimal: find IDAT? Too complex. Instead, just report size.
console.log("file:", file, "size:", b.length, "bytes");
// Check PNG signature
console.log("sig:", b.slice(0,8).toString("hex"));
// IHDR width/height at offset 16
if (b.length > 24) {
  const w = b.readUInt32BE(16);
  const h = b.readUInt32BE(20);
  console.log("dimensions:", w, "x", h);
}
