import { createHash } from 'crypto';
import * as FormData from 'form-data';
import { createReadStream } from 'fs';

import { BundleNameTakenError, UploaderHttpError } from '../errors';
import { Project } from '../project';
import { IRequester } from '../util';

/**
 * Uploader tosses a packaged bundle to the Mixer servers.
 */
export class Uploader {
  constructor(private readonly requester: IRequester, private readonly project: Project) {}

  /**
   * Uploads the bundle output to
   */
  public async upload(filename: string): Promise<void> {
    const config = await this.project.packageConfig();
    const checksum = await this.makeChecksum(filename);
    const form = new FormData();
    form.append('checksum', checksum);
    form.append('metadata', JSON.stringify(config));
    form.append('tarball', createReadStream(filename));
    const path = `/interactive/bundles/${config.name}/versions/${config.version}/tarball`;

    return this.requester
      .run(path, {
        method: 'PUT',
        headers: form.getHeaders(),
        body: form,
      })
      .then(async res => {
        if (res.status < 300) {
          return;
        }
        if (res.status === 403) {
          throw new BundleNameTakenError(res, await res.text());
        }

        throw new UploaderHttpError(res, await res.text());
      });
  }

  private async makeChecksum(filename: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      createReadStream(filename)
        .pipe(createHash('sha512'))
        .on('error', reject)
        .on('data', (hash: Buffer) => {
          resolve(hash.toString('hex').slice(0, 64));
        });
    });
  }
}