import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { useAuthMethods } from '../useAuthMethods'
import { DependencyProvider } from '@app/providers'
import { Container } from 'inversify'
import { TYPES } from '@core/di/types'
import { DEFAULT_AUTH_METHODS, AuthMethodType, type AuthMethod } from '@domain/models/AuthMethod'

describe('useAuthMethods', () => {
    let container: Container
    let mockAuthMethodRepo: {
        listMethods: ReturnType<typeof vi.fn>
    }
    let mockLogger: {
        info: ReturnType<typeof vi.fn>
        error: ReturnType<typeof vi.fn>
        warn: ReturnType<typeof vi.fn>
        debug: ReturnType<typeof vi.fn>
    }

    const mockMethods: AuthMethod[] = [
        {
            id: 'pwd-1',
            name: 'Password',
            type: AuthMethodType.PASSWORD,
            description: 'Password auth',
            icon: 'lock',
            platforms: ['web', 'mobile'],
            isActive: true,
            category: 'BASIC',
        },
        {
            id: 'face-1',
            name: 'Face Recognition',
            type: AuthMethodType.FACE,
            description: 'Face auth',
            icon: 'face',
            platforms: ['web', 'mobile'],
            isActive: true,
            category: 'PREMIUM',
        },
    ]

    const createWrapper = () => {
        return function Wrapper({ children }: { children: React.ReactNode }) {
            return React.createElement(
                DependencyProvider,
                { container },
                children,
            )
        }
    }

    beforeEach(() => {
        mockAuthMethodRepo = {
            listMethods: vi.fn().mockResolvedValue(mockMethods),
        }

        mockLogger = {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
        }

        container = new Container()
        container.bind(TYPES.AuthMethodRepository).toConstantValue(mockAuthMethodRepo)
        container.bind(TYPES.Logger).toConstantValue(mockLogger)
    })

    it('should start with default auth methods and loading true', () => {
        const { result } = renderHook(() => useAuthMethods(), {
            wrapper: createWrapper(),
        })

        expect(result.current.loading).toBe(true)
        expect(result.current.authMethods).toEqual(DEFAULT_AUTH_METHODS)
        expect(result.current.warning).toBeNull()
    })

    it('should load methods from backend on mount', async () => {
        const { result } = renderHook(() => useAuthMethods(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.authMethods).toEqual(mockMethods)
        expect(result.current.warning).toBeNull()
        expect(mockAuthMethodRepo.listMethods).toHaveBeenCalled()
    })

    it('should show warning when backend returns DEFAULT_AUTH_METHODS reference', async () => {
        mockAuthMethodRepo.listMethods.mockResolvedValue(DEFAULT_AUTH_METHODS)

        const { result } = renderHook(() => useAuthMethods(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.authMethods).toEqual(DEFAULT_AUTH_METHODS)
        expect(result.current.warning).toBe(
            'Could not load authentication methods from backend. Showing fallback defaults.'
        )
    })

    it('should fall back to defaults on error', async () => {
        mockAuthMethodRepo.listMethods.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(() => useAuthMethods(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.authMethods).toEqual(DEFAULT_AUTH_METHODS)
        expect(result.current.warning).toBe(
            'Could not load authentication methods from backend. Showing fallback defaults.'
        )
        expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should refresh methods when refresh is called', async () => {
        const { result } = renderHook(() => useAuthMethods(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        const newMethods: AuthMethod[] = [{
            id: 'totp-1',
            name: 'TOTP',
            type: AuthMethodType.TOTP,
            description: 'Time-based OTP',
            icon: 'timer',
            platforms: ['web'],
            isActive: true,
            category: 'STANDARD',
        }]
        mockAuthMethodRepo.listMethods.mockResolvedValue(newMethods)

        await waitFor(async () => {
            await result.current.refresh()
        })

        await waitFor(() => {
            expect(result.current.authMethods).toEqual(newMethods)
        })

        expect(mockAuthMethodRepo.listMethods).toHaveBeenCalledTimes(2)
    })
})
