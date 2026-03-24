import prisma from '../../config/prisma';
import supabase from '../../config/supabase';
import { ApiError } from '../../utils/apiError';
import { transcribeAudio } from '../../services/mlClient.service';
import { logger } from '../../utils/logger';
import path from 'path';

export const uploadAudio = async (
  userId: string,
  sessionId: string,
  questionId: string,
  file: Express.Multer.File,
  answerOrder: number = 1,
  durationSeconds?: number
) => {
  // Check session ownership
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  // Check question exists
  const question = await prisma.question.findUnique({
    where: { id: questionId },
  });
  if (!question) throw new ApiError('NOT_FOUND', 'Question not found.', 404);

  // Upload to Supabase Storage
  const fileName = `${userId}/${sessionId}/${questionId}_${Date.now()}${path.extname(file.originalname) || '.webm'}`;

  const { data, error } = await supabase.storage
    .from('audio-uploads')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
    });

  if (error) throw new ApiError('UPLOAD_FAILED', error.message, 500);

  // Get signed URL (valid for 1 hour) instead of public URL
  const { data: signedData, error: signedError } = await supabase.storage
    .from('audio-uploads')
    .createSignedUrl(fileName, 3600);

  if (signedError) throw new ApiError('URL_FAILED', signedError.message, 500);

  const fileUrl = signedData.signedUrl;
  const storagePath = fileName;

  // Create or update Response
  const existing = await prisma.response.findUnique({
    where: { sessionId_questionId: { sessionId, questionId } },
  });

  let response;
  if (existing) {
    response = await prisma.response.update({
      where: { id: existing.id },
      data: { durationSeconds, answerOrder },
    });
  } else {
    response = await prisma.response.create({
      data: {
        sessionId,
        questionId,
        answerOrder,
        durationSeconds,
      },
    });
  }

  // Create Upload record
  const upload = await prisma.upload.create({
    data: {
      userId,
      sessionId,
      responseId: response.id,
      type: 'AUDIO',
      fileUrl,
      storagePath,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      durationSeconds,
    },
  });

  // Trigger transcription in background (non-blocking)
  transcribeAndSave(response.id, fileUrl).catch((err) => {
    logger.error('Background transcription failed:', err);
  });

  return { success: true, responseId: response.id, uploadId: upload.id };
};

// Background transcription function
async function transcribeAndSave(responseId: string, audioUrl: string) {
  logger.info(`Starting transcription for response: ${responseId}`);

  const result = await transcribeAudio(audioUrl, responseId);

  if (result?.transcript) {
    await prisma.response.update({
      where: { id: responseId },
      data: { transcript: result.transcript },
    });
    logger.info(`Transcript saved for response: ${responseId}`);
  }
}

export const getTranscript = async (
  userId: string,
  sessionId: string,
  questionId: string
) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
  });
  if (!session) throw new ApiError('NOT_FOUND', 'Session not found.', 404);

  const response = await prisma.response.findUnique({
    where: { sessionId_questionId: { sessionId, questionId } },
  });
  if (!response) throw new ApiError('NOT_FOUND', 'Response not found.', 404);

  return { transcript: response.transcript || null };
};
