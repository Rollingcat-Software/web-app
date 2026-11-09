/**
 * embeddingPipeline: the one identifier of the client face-embedding pipeline.
 *
 * Embeddings are comparable only when both sides went through the same
 * pipeline (aligner geometry, channel order, model). The id is derived from the
 * constants that define those steps, never written by hand, so changing any of
 * them changes the id.
 *
 * The biometric processor records an id like this one with each template
 * (`face_embeddings.metadata.embedding_pipeline`). Templates enrolled before the
 * id existed carry none; they were made with BGR input and must be re-enrolled.
 * The enroll-embedding call does not send the id yet: identity-core-api rejects
 * unknown JSON fields today, so it has to accept and forward the field first.
 */
import { FACE_ALIGNMENT_VERSION } from './alignFace'
import { FACENET_CHANNEL_ORDER } from './facePreprocess'

export const FACE_EMBEDDING_PIPELINE =
    `client-facenet512-align${FACE_ALIGNMENT_VERSION}-${FACENET_CHANNEL_ORDER.toLowerCase()}` as const
