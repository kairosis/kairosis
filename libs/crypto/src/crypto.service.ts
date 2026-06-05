import { Injectable } from '@nestjs/common';
import * as nodeCrypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;
  private readonly tagLength = 16;

  private get key(): Buffer {
    const hex = process.env['ENCRYPTION_KEY'];
    if (!hex) throw new Error('ENCRYPTION_KEY env var is not set');
    if (hex.length !== 64) throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)');
    return Buffer.from(hex, 'hex');
  }

  encrypt(plaintext: string): Buffer {
    const iv = nodeCrypto.randomBytes(this.ivLength);
    const cipher = nodeCrypto.createCipheriv(this.algorithm, this.key, iv) as nodeCrypto.CipherGCM;
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]);
  }

  decrypt(data: Buffer): string {
    const iv = data.subarray(0, this.ivLength);
    const tag = data.subarray(this.ivLength, this.ivLength + this.tagLength);
    const ciphertext = data.subarray(this.ivLength + this.tagLength);
    const decipher = nodeCrypto.createDecipheriv(this.algorithm, this.key, iv) as nodeCrypto.DecipherGCM;
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  }
}
