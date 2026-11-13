import multer from 'multer';
import { Request } from 'express';
import { AppError } from './errorHandler';

// Memory storage to process buffers directly without writing temporary files to disk
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = [
  // CSV
  'text/csv',
  'text/plain',
  'application/vnd.ms-excel',
  // Images
  'image/jpeg',
  'image/png',
  'image/webp',
  // Documents
  'application/pdf',
  // Audio
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  // Video
  'video/mp4',
];

const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Allow CSV file extension check as well since some OS report text/plain or octet-stream for CSVs
  const isCsv =
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.originalname.toLowerCase().endsWith('.csv');

  if (ALLOWED_MIME_TYPES.includes(file.mimetype) || isCsv) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'INVALID_FILE_TYPE',
        `Unsupported file type: ${file.mimetype}. Allowed types: CSV, JPEG, PNG, WebP, PDF, OGG, MP3, MP4`,
        400
      )
    );
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16 MB max limit for media files (5MB max for CSV handled in import route)
  },
});

export const uploadCsv = multer({
  storage,
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const isCsv =
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.toLowerCase().endsWith('.csv');

    if (isCsv) {
      cb(null, true);
    } else {
      cb(new AppError('INVALID_FILE_TYPE', 'Only CSV files are allowed for customer import', 400));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max for CSV import
  },
});

export default upload;
