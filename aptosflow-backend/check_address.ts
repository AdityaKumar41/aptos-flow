
import { Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

const privateKeyStr = 'ed25519-priv-0x52a3d72a0f6072a2393c1a40ea2b32af8082081df84cc5df5fd659265fc20b19';
const privateKeyHex = privateKeyStr.replace('ed25519-priv-', '');

const privateKey = new Ed25519PrivateKey(privateKeyHex);
console.log('Address:', privateKey.publicKey().authKey().toString());
