#!/usr/bin/env node
// Empaqueta un .zip de l'extensió en un .crx (format CRX3) signat amb una clau RSA.
// Sense dependències: el protobuf de la capçalera es construeix a mà.
//
//   node scripts/pack-crx.js <extensio.zip> <clau.pem> <sortida.crx> [id-esperat]
//
// Si es passa id-esperat i l'ID que surt de la clau no coincideix, acaba amb error.
// Format: https://chromium.googlesource.com/chromium/src/+/main/components/crx_file/crx3.proto

const fs = require('fs');
const crypto = require('crypto');

const [zipPath, keyPath, outPath, expectedId] = process.argv.slice(2);
if (!zipPath || !keyPath || !outPath) {
  console.error('Ús: node scripts/pack-crx.js <extensio.zip> <clau.pem> <sortida.crx> [id-esperat]');
  process.exit(2);
}

const zip = fs.readFileSync(zipPath);
const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath));
const publicKey = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });

// L'ID d'una extensió són els 16 primers bytes del SHA-256 de la clau pública,
// escrits amb les lletres a-p en lloc de 0-f.
const crxId = crypto.createHash('sha256').update(publicKey).digest().subarray(0, 16);
const extensionId = [...crxId].map((b) => toLetter(b >> 4) + toLetter(b & 15)).join('');

if (expectedId && expectedId !== extensionId) {
  console.error(`La clau dona l'ID ${extensionId}, però s'esperava ${expectedId}.`);
  process.exit(1);
}

// SignedData { bytes crx_id = 1; }
const signedHeaderData = field(1, crxId);

// Es signa: "CRX3 SignedData\0" + longitud de signed_header_data (uint32 LE) + signed_header_data + zip
const signer = crypto.createSign('sha256');
signer.update(Buffer.from('CRX3 SignedData\x00', 'binary'));
signer.update(uint32(signedHeaderData.length));
signer.update(signedHeaderData);
signer.update(zip);
const signature = signer.sign(privateKey);

// CrxFileHeader {
//   repeated AsymmetricKeyProof sha256_with_rsa = 2;  // { public_key = 1; signature = 2; }
//   bytes signed_header_data = 10000;
// }
const header = Buffer.concat([
  field(2, Buffer.concat([field(1, publicKey), field(2, signature)])),
  field(10000, signedHeaderData),
]);

fs.writeFileSync(outPath, Buffer.concat([Buffer.from('Cr24'), uint32(3), uint32(header.length), header, zip]));
console.log(`${outPath} (ID ${extensionId})`);

function toLetter(n) {
  return String.fromCharCode(97 + n);
}

function uint32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

function varint(n) {
  const bytes = [];
  while (n > 0x7f) {
    bytes.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  bytes.push(n);
  return Buffer.from(bytes);
}

// Camp protobuf de tipus "length-delimited" (wire type 2).
function field(number, data) {
  return Buffer.concat([varint(number * 8 + 2), varint(data.length), data]);
}
