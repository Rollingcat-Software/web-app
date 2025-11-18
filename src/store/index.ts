import { configureStore } from '@reduxjs/toolkit'
import {
    FLUSH,
    PAUSE,
    PERSIST,
    persistReducer,
    persistStore,
    PURGE,
    REGISTER,
    REHYDRATE,
} from 'redux-persist'
import storage from 'redux-persist/lib/storage'

/**
 * Minimal Redux store
 *
 * Note: This application has been migrated to use a clean architecture
 * with dependency injection and custom hooks. Redux is kept here only
 * for backwards compatibility during the transition period.
 *
 * For new features, use:
 * - Custom hooks (useAuth, useUsers, useDashboard, etc.)
 * - Services from the DI container
 * - The new feature modules under src/features/
 */

// Minimal state for backwards compatibility
interface MinimalState {
    _placeholder: boolean
}

const initialState: MinimalState = {
    _placeholder: true,
}

const minimalReducer = (state = initialState): MinimalState => state

const persistConfig = {
    key: 'fivucsas-admin',
    version: 1,
    storage,
    whitelist: [], // Nothing to persist - auth is handled by TokenService
}

const persistedReducer = persistReducer(persistConfig, minimalReducer)

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
            },
        }),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
