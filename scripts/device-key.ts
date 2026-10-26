import { join } from 'node:path';
import { MAC_ADDRESS_PATTERN } from '../src/common/constants/mac-address.constant';
import { deriveDeviceKey } from '../src/common/utils/device-key';

const [identifierArg] = process.argv.slice(2);

if (!identifierArg || !MAC_ADDRESS_PATTERN.test(identifierArg)) {
  console.error(
    'Uso: npm run device-key -- <identificador>\n' +
      'Ex.: npm run device-key -- AA:BB:CC:DD:EE:FF',
  );
  process.exit(1);
}

try {
  process.loadEnvFile(join(__dirname, '..', '.env'));
} catch {}
const secret = process.env.DEVICE_KEY_SECRET;
if (!secret) {
  console.error('Defina DEVICE_KEY_SECRET no .env da API.');
  process.exit(1);
}

const identifier = identifierArg.toUpperCase();
console.log(`Identificador: ${identifier}`);
console.log(`Chave do dispositivo (RNF03): ${deriveDeviceKey(secret, identifier)}`);
console.log(
  'Grave no firmware: -DDEVICE_KEY=\\"<chave>\\" em build_flags (veja o README do IoT).',
);
