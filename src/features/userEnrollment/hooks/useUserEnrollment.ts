import { useState, useEffect, useCallback, useRef } from 'react'
import { useService } from '@app/providers'
import { TYPES } from '@core/di/types'
import type { IUserEnrollmentService } from '@domain/interfaces/IUserEnrollmentService'
import type { IdInfoData, UserEnrollmentStatusResponse } from '@domain/models/UserEnrollment'
import { UserEnrollmentStatus } from '@domain/models/UserEnrollment'
import type { ErrorHandler } from '@core/errors/ErrorHandler'

export enum EnrollmentStep {
    ID_INFO = 0,
    CAMERA_ACCESS = 1,
    LIVENESS = 2,
    COMPLETE = 3,
}

export type SubmittingPhase = null | 'processing_biometrics' | 'syncing' | 'done'

interface BiometricPayload {
    livenessToken: string
    livenessScore: number
    faceImage: Blob
}

interface UseUserEnrollmentReturn {
    currentStep: EnrollmentStep
    idInfo: IdInfoData | null
    enrollmentStatus: UserEnrollmentStatusResponse | null
    submitting: boolean
    submittingPhase: SubmittingPhase
    loading: boolean
    error: string | null
    nextStep: () => void
    prevStep: () => void
    setIdInfo: (data: IdInfoData) => void
    submitEnrollment: (biometrics: BiometricPayload) => Promise<void>
    refreshStatus: () => Promise<void>
}

export function useUserEnrollment(): UseUserEnrollmentReturn {
    const service = useService<IUserEnrollmentService>(TYPES.UserEnrollmentService)
    const errorHandler = useService<ErrorHandler>(TYPES.ErrorHandler)

    const [currentStep, setCurrentStep] = useState<EnrollmentStep>(EnrollmentStep.ID_INFO)
    const [idInfo, setIdInfoState] = useState<IdInfoData | null>(null)
    const [enrollmentStatus, setEnrollmentStatus] = useState<UserEnrollmentStatusResponse | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [submittingPhase, setSubmittingPhase] = useState<SubmittingPhase>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Ref to track current phase for error messages inside catch
    const phaseRef = useRef<SubmittingPhase>(null)
    // Ref for idInfo so submitEnrollment always reads latest
    const idInfoRef = useRef<IdInfoData | null>(null)

    const setIdInfo = useCallback((data: IdInfoData) => {
        idInfoRef.current = data
        setIdInfoState(data)
    }, [])

    // Check existing enrollment status on mount
    useEffect(() => {
        let mounted = true
        const checkStatus = async () => {
            try {
                const status = await service.getEnrollmentStatus()
                if (mounted) {
                    setEnrollmentStatus(status)
                    if (
                        status.status === UserEnrollmentStatus.COMPLETED ||
                        status.status === UserEnrollmentStatus.PROCESSING
                    ) {
                        setCurrentStep(EnrollmentStep.COMPLETE)
                    }
                }
            } catch {
                // No existing enrollment — start fresh
            } finally {
                if (mounted) setLoading(false)
            }
        }
        checkStatus()
        return () => {
            mounted = false
        }
    }, [service])

    const nextStep = useCallback(() => {
        setCurrentStep((prev) => {
            if (prev < EnrollmentStep.COMPLETE) return prev + 1
            return prev
        })
    }, [])

    const prevStep = useCallback(() => {
        setCurrentStep((prev) => {
            if (prev > EnrollmentStep.ID_INFO) return prev - 1
            return prev
        })
    }, [])

    const submitEnrollment = useCallback(async (biometrics: BiometricPayload) => {
        const currentIdInfo = idInfoRef.current
        if (!currentIdInfo) return

        setSubmitting(true)
        phaseRef.current = 'processing_biometrics'
        setSubmittingPhase('processing_biometrics')
        setError(null)

        try {
            // Show "Processing Biometrics..." phase
            await new Promise((resolve) => setTimeout(resolve, 500))

            phaseRef.current = 'syncing'
            setSubmittingPhase('syncing')

            const result = await service.submitEnrollment(
                currentIdInfo,
                biometrics.livenessToken,
                biometrics.livenessScore,
                biometrics.faceImage
            )

            phaseRef.current = 'done'
            setSubmittingPhase('done')
            setEnrollmentStatus(result)
            setCurrentStep(EnrollmentStep.COMPLETE)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to submit enrollment'
            if (phaseRef.current === 'processing_biometrics') {
                setError(`Biometric processing failed: ${message}`)
            } else {
                setError(`Enrollment sync failed: ${message}`)
            }
            errorHandler.handle(err)
        } finally {
            setSubmitting(false)
            setSubmittingPhase(null)
            phaseRef.current = null
        }
    }, [service, errorHandler])

    const refreshStatus = useCallback(async () => {
        try {
            const status = await service.getEnrollmentStatus()
            setEnrollmentStatus(status)
        } catch (err) {
            errorHandler.handle(err)
        }
    }, [service, errorHandler])

    return {
        currentStep,
        idInfo: idInfoRef.current ?? idInfo,
        enrollmentStatus,
        submitting,
        submittingPhase,
        loading,
        error,
        nextStep,
        prevStep,
        setIdInfo,
        submitEnrollment,
        refreshStatus,
    }
}
