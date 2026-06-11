import { Logger } from '@nestjs/common';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, weld } from '@gltf-transform/functions';

const log = new Logger('AvatarModelCompress');

let ioPromise: Promise<NodeIO> | null = null;

async function getIo(): Promise<NodeIO> {
  if (!ioPromise) {
    ioPromise = (async () => {
      const draco3d = await import('draco3dgltf');
      return new NodeIO()
        .registerExtensions(ALL_EXTENSIONS)
        .registerDependencies({
          'draco3d.decoder': await draco3d.default.createDecoderModule(),
          'draco3d.encoder': await draco3d.default.createEncoderModule(),
        });
    })();
  }
  return ioPromise;
}

function isGlbBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'glTF';
}

export type AvatarCompressResult = {
  buffer: Buffer;
  contentType: 'model/gltf-binary';
  originalBytes: number;
  compressedBytes: number;
  compressed: boolean;
};

/** Optimize and Draco-compress an uploaded GLB/GLTF for faster widget loading. */
export async function compressAvatarModel(
  input: Buffer,
  ext: '.glb' | '.gltf',
): Promise<AvatarCompressResult> {
  const originalBytes = input.length;
  try {
    const io = await getIo();
    const document = isGlbBuffer(input) || ext === '.glb'
      ? await io.readBinary(new Uint8Array(input))
      : await io.readJSON({
          json: JSON.parse(input.toString('utf8')) as Record<string, unknown>,
          resources: {},
        });

    await document.transform(
      prune(),
      dedup(),
      weld(),
      draco({ method: 'edgebreaker', encodeSpeed: 5, decodeSpeed: 5 }),
    );

    const out = Buffer.from(await io.writeBinary(document));
    const compressedBytes = out.length;
    const savedPct =
      originalBytes > 0
        ? Math.round((1 - compressedBytes / originalBytes) * 100)
        : 0;

    log.log(
      `Avatar model compressed ${originalBytes} → ${compressedBytes} bytes (${savedPct}% smaller)`,
    );

    return {
      buffer: out,
      contentType: 'model/gltf-binary',
      originalBytes,
      compressedBytes,
      compressed: compressedBytes < originalBytes,
    };
  } catch (err) {
    log.warn(
      `Avatar compression failed, storing original: ${err instanceof Error ? err.message : err}`,
    );
    return {
      buffer: input,
      contentType:
        ext === '.gltf' ? 'model/gltf+json' : 'model/gltf-binary',
      originalBytes,
      compressedBytes: originalBytes,
      compressed: false,
    };
  }
}
