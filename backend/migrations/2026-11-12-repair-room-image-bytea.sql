-- Repair RoomSync room_images values imported as ASCII hex text instead of raw BYTEA.
-- Run ONLY against the Neon migration-test branch and the RoomSync database.
-- This script is transactional, validates all four rows, and keeps a full backup
-- in public.room_images_backup_20261112 before changing the live image rows.

BEGIN;

DO $precheck$
DECLARE
  source_rows BIGINT;
BEGIN
  IF to_regclass('public.room_images_backup_20261112') IS NOT NULL THEN
    RAISE EXCEPTION
      'Backup public.room_images_backup_20261112 already exists. Stop and inspect it; do not rerun this repair script.';
  END IF;

  SELECT COUNT(*) INTO source_rows
  FROM roomsync.room_images;

  IF source_rows <> 4 THEN
    RAISE EXCEPTION
      'Expected exactly 4 migrated room images, found %. No changes were made.', source_rows;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM roomsync.room_images
    WHERE LEFT(convert_from(image_data, 'UTF8'), 1) <> 'X'
       OR MOD(LENGTH(SUBSTRING(convert_from(image_data, 'UTF8') FROM 2)), 2) <> 0
       OR SUBSTRING(convert_from(image_data, 'UTF8') FROM 2) !~ '^[0-9A-Fa-f]+$'
  ) THEN
    RAISE EXCEPTION
      'One or more image rows are not in the expected X-prefixed hexadecimal-text format. No changes were made.';
  END IF;
END
$precheck$;

CREATE TABLE public.room_images_backup_20261112 AS
SELECT *
FROM roomsync.room_images;

DO $backup_check$
DECLARE
  original_rows BIGINT;
  backup_rows BIGINT;
BEGIN
  SELECT COUNT(*) INTO original_rows FROM roomsync.room_images;
  SELECT COUNT(*) INTO backup_rows FROM public.room_images_backup_20261112;

  IF backup_rows <> original_rows OR backup_rows <> 4 THEN
    RAISE EXCEPTION
      'Image backup verification failed (source %, backup %). The transaction will be rolled back.',
      original_rows, backup_rows;
  END IF;
END
$backup_check$;

DO $repair$
DECLARE
  repaired_rows INTEGER;
BEGIN
  UPDATE roomsync.room_images
  SET image_data = decode(
    SUBSTRING(convert_from(image_data, 'UTF8') FROM 2),
    'hex'
  );

  GET DIAGNOSTICS repaired_rows = ROW_COUNT;

  IF repaired_rows <> 4 THEN
    RAISE EXCEPTION
      'Expected to repair 4 image rows, repaired %. The transaction will be rolled back.',
      repaired_rows;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM roomsync.room_images
    WHERE mime_type <> 'image/jpeg'
       OR OCTET_LENGTH(image_data) < 4
       OR get_byte(image_data, 0) <> 255
       OR get_byte(image_data, 1) <> 216
       OR get_byte(image_data, 2) <> 255
       OR get_byte(image_data, OCTET_LENGTH(image_data) - 2) <> 255
       OR get_byte(image_data, OCTET_LENGTH(image_data) - 1) <> 217
  ) THEN
    RAISE EXCEPTION
      'JPEG signature validation failed after decoding. The transaction will be rolled back.';
  END IF;
END
$repair$;

COMMIT;

-- Post-repair verification. Expected original byte sizes:
-- image IDs 1 and 4: 2,108,147 bytes each
-- image IDs 2 and 3: 1,279,872 bytes each
SELECT
  id,
  room_id,
  original_name,
  mime_type,
  OCTET_LENGTH(image_data) AS image_size_bytes,
  ENCODE(SUBSTRING(image_data FROM 1 FOR 3), 'hex') AS header_hex,
  ENCODE(SUBSTRING(image_data FROM GREATEST(OCTET_LENGTH(image_data) - 1, 1) FOR 2), 'hex') AS tail_hex
FROM roomsync.room_images
ORDER BY id;

-- Backup confirmation. Keep this backup until production cutover and image testing are complete.
SELECT COUNT(*) AS backed_up_image_rows
FROM public.room_images_backup_20261112;
