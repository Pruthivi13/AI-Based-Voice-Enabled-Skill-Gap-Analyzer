import { Response, NextFunction } from 'express';
import * as UploadsService from './uploads.service';
import { sendSuccess, sendError } from '../../utils/apiResponse';

const ALLOWED_MIME_TYPES = [
  'audio/webm',
  'audio/mp4',
  'audio/wav',
  'audio/mpeg',
  'audio/ogg',
  'application/octet-stream',
];

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

export const uploadAudio = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.file)
      return sendError(res, 'NO_FILE', 'No audio file provided.', 400);

    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return sendError(
        res,
        'UNSUPPORTED_AUDIO_FORMAT',
        'Unsupported audio format.',
        400
      );
    }

    if (req.file.size > MAX_SIZE) {
      return sendError(
        res,
        'FILE_TOO_LARGE',
        'Audio file exceeds the 25MB limit.',
        400
      );
    }

    const { id: sessionId, qid: questionId } = req.params;
    const answerOrder = Number(req.body.answerOrder) || 1;
    const durationSeconds = req.body.durationSeconds
      ? Number(req.body.durationSeconds)
      : undefined;

    const result = await UploadsService.uploadAudio(
      req.user.id,
      sessionId,
      questionId,
      req.file,
      answerOrder,
      durationSeconds
    );

    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
};

export const getTranscript = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id: sessionId, qid: questionId } = req.params;
    const result = await UploadsService.getTranscript(
      req.user.id,
      sessionId,
      questionId
    );
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
};

export const saveTranscriptHandler = async (
  req: any,
  res: Response,
  next: NextFunction
) => {
  try {
    const { saveTranscript } = await import('./saveTranscript');
    const { transcript, answerOrder, durationSeconds } = req.body;
    const result = await saveTranscript(
      req.user.id,
      req.params.id,
      req.params.qid,
      transcript || '',
      answerOrder || 1,
      durationSeconds
    );
    return sendSuccess(res, result, 201);
  } catch (err) {
    next(err);
  }
};
