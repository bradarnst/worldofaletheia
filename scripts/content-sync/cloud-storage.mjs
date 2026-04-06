import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

function sanitizePrefix(value = '') {
  return value.replace(/^\/+|\/+$/g, '');
}

function sanitizeRelative(value = '') {
  return value.replace(/^\/+/, '');
}

function createS3Client(config) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: config.credentials,
  });
}

async function writeBodyToFile(body, destination) {
  if (!body) {
    throw new Error('Empty body received from R2.');
  }

  if (typeof body.pipe === 'function') {
    await pipeline(body, fs.createWriteStream(destination));
    return;
  }

  if (typeof body.transformToWebStream === 'function') {
    const stream = Readable.fromWeb(body.transformToWebStream());
    await pipeline(stream, fs.createWriteStream(destination));
    return;
  }

  if (body instanceof Uint8Array) {
    await fsp.writeFile(destination, body);
    return;
  }

  throw new Error('Unsupported response body type from R2.');
}

async function bodyToText(body) {
  if (!body) {
    throw new Error('Empty body received from R2.');
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof Uint8Array) {
    return Buffer.from(body).toString('utf8');
  }

  if (typeof body.transformToString === 'function') {
    return body.transformToString();
  }

  if (typeof body.transformToByteArray === 'function') {
    const bytes = await body.transformToByteArray();
    return Buffer.from(bytes).toString('utf8');
  }

  if (typeof body.transformToWebStream === 'function') {
    const stream = Readable.fromWeb(body.transformToWebStream());
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  if (typeof body.pipe === 'function') {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  throw new Error('Unsupported response body type from R2.');
}

export function createContentCloudAdapter(cloudConfig) {
  const client = createS3Client(cloudConfig);
  const bucket = cloudConfig.bucket;

  const buildKey = (prefix, relativePath = '') => {
    const safePrefix = sanitizePrefix(prefix);
    const safeRelative = sanitizeRelative(relativePath);
    if (!safePrefix) {
      return safeRelative;
    }
    return safeRelative ? `${safePrefix}/${safeRelative}` : safePrefix;
  };

  const listObjects = async (prefix, includeExtensions) => {
    const safePrefix = sanitizePrefix(prefix);
    const prefixForList = safePrefix ? `${safePrefix}/` : '';
    const results = new Map();
    let continuationToken;

    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: safePrefix ? prefixForList : undefined,
        ContinuationToken: continuationToken,
      });
      const response = await client.send(command);
      const contents = response.Contents || [];
      for (const object of contents) {
        const key = object.Key || '';
        const ext = path.extname(key).toLowerCase();
        if (!includeExtensions.includes(ext)) {
          continue;
        }
        const relative = safePrefix ? key.slice(prefixForList.length) : key;
        if (!relative) {
          continue;
        }
        results.set(relative, {
          key,
          etag: object.ETag ? object.ETag.replace(/"/g, '') : null,
          size: typeof object.Size === 'number' ? object.Size : null,
        });
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return results;
  };

  const uploadFile = async (prefix, relativePath, filePath, contentType) => {
    const key = buildKey(prefix, relativePath);
    const body = fs.createReadStream(filePath);
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return key;
  };

  const uploadText = async (key, text, contentType = 'text/plain; charset=utf-8') => {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: text,
      ContentType: contentType,
    }));
    return key;
  };

  const uploadBytes = async (key, body, contentType = 'application/octet-stream') => {
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return key;
  };

  const deleteObject = async (prefix, relativePath) => {
    const key = buildKey(prefix, relativePath);
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return key;
  };

  const deleteKey = async (key) => {
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return key;
  };

  const downloadObject = async (prefix, relativePath, destinationAbs) => {
    const key = buildKey(prefix, relativePath);
    const response = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    await writeBodyToFile(response.Body, destinationAbs);
    return key;
  };

  const readText = async (key) => {
    const response = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }));
    return bodyToText(response.Body);
  };

  return {
    client,
    bucket,
    buildKey,
    listObjects,
    uploadFile,
    uploadText,
    uploadBytes,
    deleteObject,
    deleteKey,
    downloadObject,
    readText,
  };
}

export const createCampaignCloudAdapter = createContentCloudAdapter;
