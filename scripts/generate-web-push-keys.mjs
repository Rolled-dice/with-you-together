import { webcrypto } from "node:crypto";

const keys = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
  "sign",
  "verify",
]);
const publicKey = Buffer.from(await webcrypto.subtle.exportKey("raw", keys.publicKey)).toString(
  "base64url",
);
const privateKey = await webcrypto.subtle.exportKey("jwk", keys.privateKey);
// Keep this output private. Replacing these keys invalidates existing device subscriptions.
console.log(`WEB_PUSH_PUBLIC_KEY="${publicKey}"\nWEB_PUSH_PRIVATE_KEY="${privateKey.d}"`);
