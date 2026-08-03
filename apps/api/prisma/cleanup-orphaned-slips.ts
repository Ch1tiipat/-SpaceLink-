import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const PAYMENT_SLIP_BUCKET = 'slips';
const STORAGE_REQUEST_TIMEOUT_MS = 15_000;
const STORAGE_DELETE_ATTEMPTS = 2;

interface StorageObjectRow {
  name: string;
}

function storedObjectPath(value: string): string | null {
  if (!value.includes('/storage/v1/object/')) {
    return value;
  }

  try {
    const url = new URL(value);
    const match = url.pathname.match(
      /^\/storage\/v1\/object\/(?:sign|public)\/slips\/(.+)$/,
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function deleteStorageObject(
  supabaseUrl: string,
  serviceRoleKey: string,
  objectPath: string,
): Promise<void> {
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/');
  const url = `${supabaseUrl}/storage/v1/object/${PAYMENT_SLIP_BUCKET}/${encodedPath}`;

  for (let attempt = 1; attempt <= STORAGE_DELETE_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        signal: AbortSignal.timeout(STORAGE_REQUEST_TIMEOUT_MS),
      });
      if (response.ok || response.status === 404) {
        return;
      }
      if (response.status < 500 || attempt === STORAGE_DELETE_ATTEMPTS) {
        throw new Error('Storage rejected orphan cleanup.');
      }
    } catch (error) {
      if (attempt === STORAGE_DELETE_ATTEMPTS) {
        if (
          error instanceof Error &&
          (error.name === 'TimeoutError' || error.name === 'AbortError')
        ) {
          throw new Error('Storage orphan cleanup timed out.');
        }
        throw error;
      }
    }
  }
}

async function main(): Promise<void> {
  const deleteMode = process.argv.includes('--delete');
  const referencedRows = await prisma.verifiedSlip.findMany({
    select: { slipImageUrl: true },
  });
  const referencedPaths = new Set(
    referencedRows
      .map(({ slipImageUrl }) => storedObjectPath(slipImageUrl))
      .filter((path): path is string => path !== null),
  );

  // The grace period avoids classifying an upload that is still being verified
  // as an orphan before its database transaction has committed.
  const storageObjects = await prisma.$queryRaw<StorageObjectRow[]>(Prisma.sql`
    SELECT name
    FROM storage.objects
    WHERE bucket_id = ${PAYMENT_SLIP_BUCKET}
      AND created_at < NOW() - INTERVAL '24 hours'
    ORDER BY name
  `);
  const orphanPaths = storageObjects
    .map(({ name }) => name)
    .filter((name) => !referencedPaths.has(name));

  console.log(
    `Orphaned slip audit: ${orphanPaths.length} unreferenced object(s) older than 24 hours.`,
  );
  if (!deleteMode || orphanPaths.length === 0) {
    console.log(
      deleteMode
        ? 'No orphaned objects needed deletion.'
        : 'Dry run only. Re-run with --delete after reviewing the count.',
    );
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Storage cleanup credentials are missing.');
  }

  let deleted = 0;
  for (const orphanPath of orphanPaths) {
    await deleteStorageObject(supabaseUrl, serviceRoleKey, orphanPath);
    deleted += 1;
  }
  console.log(`Deleted ${deleted} orphaned slip object(s).`);
}

main()
  .catch((error) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(`Orphaned slip audit failed with Prisma ${error.code}.`);
    } else if (error instanceof Prisma.PrismaClientInitializationError) {
      console.error('Orphaned slip audit could not connect to the database.');
    } else {
      console.error('Orphaned slip cleanup failed without exposing file data.');
    }
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
