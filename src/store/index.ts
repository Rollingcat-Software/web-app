import {combineReducers, configureStore} from '@reduxjs/toolkit'
import {FLUSH, PAUSE, PERSIST, persistReducer, persistStore, PURGE, REGISTER, REHYDRATE,} from 'redux-persist'
import storage from 'redux-persist/lib/storage'
import authReducer from './slices/authSlice'
import usersReducer from './slices/usersSlice'
import tenantsReducer from './slices/tenantsSlice'
import enrollmentsReducer from './slices/enrollmentsSlice'
import auditLogsReducer from './slices/auditLogsSlice'
import dashboardReducer from './slices/dashboardSlice'

const rootReducer = combineReducers({
    auth: authReducer,
    users: usersReducer,
    tenants: tenantsReducer,
    enrollments: enrollmentsReducer,
    auditLogs: auditLogsReducer,
    dashboard: dashboardReducer,
})

const persistConfig = {
    key: 'fivucsas-admin',
    version: 1,
    storage,
    whitelist: ['auth'], // Only persist auth state
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

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
