# Web App - Implementation Plan for 100% Completion

**Version**: 2.0
**Date**: January 2026
**Target**: 100% Production-Ready
**Current Status**: ~80% Complete
**Estimated Effort**: 14 days

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [API Contracts](#api-contracts)
4. [Implementation Phases](#implementation-phases)
   - [Phase 1: Settings Page Backend Integration](#phase-1-settings-page-backend-integration)
   - [Phase 2: Password Management](#phase-2-password-management)
   - [Phase 3: Role-Based UI Restrictions](#phase-3-role-based-ui-restrictions)
   - [Phase 4: Dark Mode Implementation](#phase-4-dark-mode-implementation)
   - [Phase 5: Test Coverage Expansion](#phase-5-test-coverage-expansion)
   - [Phase 6: Pagination Implementation](#phase-6-pagination-implementation)
   - [Phase 7: Real API Integration](#phase-7-real-api-integration)
5. [Integration Points](#integration-points)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Checklist](#deployment-checklist)

---

## Executive Summary

This document provides a comprehensive implementation plan for completing the FIVUCSAS Web Dashboard to 100% production readiness. The web-app is a React 18 + TypeScript application using Vite as the build tool.

### Architecture

```
web-app/
├── src/
│   ├── core/                    # Core infrastructure (DI, API, errors)
│   │   ├── api/                 # HTTP client, API configuration
│   │   ├── di/                  # Inversify DI container
│   │   ├── repositories/        # Data access layer
│   │   └── services/            # Core services
│   ├── domain/                  # Domain models and interfaces
│   │   ├── interfaces/          # Repository/Service contracts
│   │   ├── models/              # Domain entities
│   │   └── validators/          # Zod validation schemas
│   ├── features/                # Feature modules
│   │   ├── auth/               # Authentication
│   │   ├── users/              # User management
│   │   ├── dashboard/          # Dashboard statistics
│   │   ├── tenants/            # Tenant management
│   │   ├── enrollments/        # Biometric enrollments
│   │   ├── audit-logs/         # Audit trail
│   │   └── settings/           # User settings
│   ├── shared/                  # Shared components/hooks
│   └── app/                     # App providers and routing
└── __tests__/                   # Test files
```

### Key Dependencies

- **React 18.3** - UI framework
- **TypeScript 5.x** - Type safety
- **Vite** - Build tool
- **Inversify** - Dependency injection
- **Redux Toolkit** - State management
- **React Router 6** - Routing
- **Material-UI (MUI)** - Component library
- **Zod** - Schema validation
- **Axios** - HTTP client
- **notistack** - Notifications
- **Vitest** - Testing framework

---

## Current State Analysis

### Completed Features (80%)

| Feature | Status | Notes |
|---------|--------|-------|
| Login/Authentication | ✅ 100% | JWT auth with refresh tokens |
| Dashboard Overview | ✅ 100% | Statistics and charts |
| User Management | ✅ 95% | CRUD operations working |
| Tenant Management | ✅ 100% | Multi-tenant support |
| Enrollment List | ✅ 100% | View biometric enrollments |
| Audit Logs | ✅ 100% | View audit trail |
| DI Container | ✅ 100% | Inversify configured |
| Mock API Mode | ✅ 100% | Development without backend |

### Pending Features (20%)

| Feature | Status | Priority |
|---------|--------|----------|
| Settings Backend Integration | 🔴 0% | HIGH |
| Password Change Dialog | 🔴 0% | HIGH |
| Role-Based UI Restrictions | 🟡 50% | HIGH |
| Dark Mode | 🟡 30% | MEDIUM |
| Test Coverage | 🔴 10% | HIGH |
| Pagination | 🟡 50% | MEDIUM |
| Disable Mock Mode | 🟡 70% | HIGH |

---

## API Contracts

### Identity Core API (http://localhost:8080/api/v1)

All requests require the following headers:

```typescript
interface CommonHeaders {
  'Authorization': `Bearer ${accessToken}`;
  'X-Tenant-ID': string;  // Current tenant ID
  'Content-Type': 'application/json';
}
```

### Authentication Endpoints

```typescript
// POST /auth/login
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDTO;
}

// POST /auth/refresh
interface RefreshRequest {
  refreshToken: string;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// POST /auth/logout
// No body, returns 204

// GET /auth/me
// Returns UserDTO
```

### User Management Endpoints

```typescript
// GET /users?page=0&size=20&sort=createdAt,desc
interface PaginatedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// GET /users/{id}
// PUT /users/{id}
// DELETE /users/{id}
// POST /users

interface UserDTO {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER';
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  tenantId: number;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
}

// POST /users/{id}/change-password
interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
// Returns 204 No Content
```

### User Settings Endpoints

```typescript
// GET /users/{id}/settings
interface UserSettingsDTO {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  notificationsEnabled: boolean;
  emailNotifications: boolean;
}

// PUT /users/{id}/settings
// Request body: UserSettingsDTO
// Returns updated UserSettingsDTO
```

### Dashboard Endpoints

```typescript
// GET /dashboard/statistics
interface DashboardStatistics {
  totalUsers: number;
  activeUsers: number;
  totalEnrollments: number;
  totalVerifications: number;
  recentActivity: ActivityItem[];
  enrollmentTrend: TrendData[];
  verificationsByDay: ChartData[];
}
```

### Tenant Endpoints

```typescript
// GET /tenants
// GET /tenants/{id}
// POST /tenants
// PUT /tenants/{id}
// DELETE /tenants/{id}

interface TenantDTO {
  id: number;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  settings: TenantSettings;
  createdAt: string;
  updatedAt: string;
}
```

### Enrollment Endpoints

```typescript
// GET /enrollments?page=0&size=20
// GET /enrollments/{id}
// DELETE /enrollments/{id}

interface EnrollmentDTO {
  id: number;
  userId: number;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  qualityScore: number;
  capturedAt: string;
  expiresAt?: string;
  metadata: Record<string, unknown>;
}
```

### Audit Log Endpoints

```typescript
// GET /audit-logs?page=0&size=50
interface AuditLogDTO {
  id: number;
  action: string;
  entityType: string;
  entityId: number;
  userId: number;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, unknown>;
  timestamp: string;
}
```

---

## Implementation Phases

### Phase 1: Settings Page Backend Integration

**Duration**: 2 days
**Priority**: HIGH
**Dependencies**: Identity Core API `/users/{id}/settings` endpoint

#### 1.1 Create Settings Repository Interface

```typescript
// src/domain/interfaces/ISettingsRepository.ts
export interface ISettingsRepository {
  getSettings(userId: number): Promise<UserSettings>;
  updateSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings>;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  dateFormat: string;
  notificationsEnabled: boolean;
  emailNotifications: boolean;
}
```

#### 1.2 Implement Settings Repository

```typescript
// src/core/repositories/SettingsRepository.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '@core/di/types';
import type { IHttpClient } from '@domain/interfaces/IHttpClient';
import type { ISettingsRepository, UserSettings } from '@domain/interfaces/ISettingsRepository';

@injectable()
export class SettingsRepository implements ISettingsRepository {
  constructor(
    @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient
  ) {}

  async getSettings(userId: number): Promise<UserSettings> {
    const response = await this.httpClient.get<UserSettings>(`/users/${userId}/settings`);
    return response.data;
  }

  async updateSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings> {
    const response = await this.httpClient.put<UserSettings>(
      `/users/${userId}/settings`,
      settings
    );
    return response.data;
  }
}
```

#### 1.3 Create Mock Settings Repository

```typescript
// src/core/repositories/__mocks__/MockSettingsRepository.ts
import { injectable } from 'inversify';
import type { ISettingsRepository, UserSettings } from '@domain/interfaces/ISettingsRepository';

@injectable()
export class MockSettingsRepository implements ISettingsRepository {
  private settings: UserSettings = {
    theme: 'light',
    language: 'en',
    timezone: 'UTC',
    dateFormat: 'YYYY-MM-DD',
    notificationsEnabled: true,
    emailNotifications: true,
  };

  async getSettings(_userId: number): Promise<UserSettings> {
    return { ...this.settings };
  }

  async updateSettings(_userId: number, updates: Partial<UserSettings>): Promise<UserSettings> {
    this.settings = { ...this.settings, ...updates };
    return { ...this.settings };
  }
}
```

#### 1.4 Create Settings Service

```typescript
// src/features/settings/services/SettingsService.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '@core/di/types';
import type { ISettingsRepository, UserSettings } from '@domain/interfaces/ISettingsRepository';
import type { INotifier } from '@domain/interfaces/INotifier';

export interface ISettingsService {
  loadSettings(userId: number): Promise<UserSettings>;
  saveSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings>;
}

@injectable()
export class SettingsService implements ISettingsService {
  constructor(
    @inject(TYPES.SettingsRepository) private readonly repository: ISettingsRepository,
    @inject(TYPES.Notifier) private readonly notifier: INotifier
  ) {}

  async loadSettings(userId: number): Promise<UserSettings> {
    return this.repository.getSettings(userId);
  }

  async saveSettings(userId: number, settings: Partial<UserSettings>): Promise<UserSettings> {
    const updated = await this.repository.updateSettings(userId, settings);
    this.notifier.success('Settings saved successfully');
    return updated;
  }
}
```

#### 1.5 Create useSettings Hook

```typescript
// src/features/settings/hooks/useSettings.ts
import { useState, useEffect, useCallback } from 'react';
import { useService } from '@app/providers/DependencyProvider';
import { TYPES } from '@core/di/types';
import type { ISettingsService } from '../services/SettingsService';
import type { UserSettings } from '@domain/interfaces/ISettingsRepository';
import { useAuth } from '@features/auth/hooks/useAuth';

interface UseSettingsReturn {
  settings: UserSettings | null;
  loading: boolean;
  error: Error | null;
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const settingsService = useService<ISettingsService>(TYPES.SettingsService);
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadSettings = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);
    try {
      const data = await settingsService.loadSettings(user.id);
      setSettings(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [settingsService, user?.id]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    if (!user?.id) return;

    try {
      const updated = await settingsService.saveSettings(user.id, updates);
      setSettings(updated);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [settingsService, user?.id]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refreshSettings: loadSettings,
  };
}
```

#### 1.6 Update Settings Page Component

```typescript
// src/features/settings/pages/SettingsPage.tsx
import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  FormControl,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  InputLabel,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useSettings } from '../hooks/useSettings';
import type { UserSettings } from '@domain/interfaces/ISettingsRepository';

export function SettingsPage() {
  const { settings, loading, error, updateSettings } = useSettings();
  const [localSettings, setLocalSettings] = React.useState<UserSettings | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleChange = (field: keyof UserSettings, value: unknown) => {
    if (!localSettings) return;
    setLocalSettings({ ...localSettings, [field]: value });
  };

  const handleSave = async () => {
    if (!localSettings) return;
    setSaving(true);
    try {
      await updateSettings(localSettings);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load settings: {error.message}</Alert>;
  }

  if (!localSettings) return null;

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Settings</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Appearance</Typography>

          <FormControl fullWidth margin="normal">
            <InputLabel>Theme</InputLabel>
            <Select
              value={localSettings.theme}
              label="Theme"
              onChange={(e) => handleChange('theme', e.target.value)}
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth margin="normal">
            <InputLabel>Language</InputLabel>
            <Select
              value={localSettings.language}
              label="Language"
              onChange={(e) => handleChange('language', e.target.value)}
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="tr">Turkish</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Notifications</Typography>

          <FormControlLabel
            control={
              <Switch
                checked={localSettings.notificationsEnabled}
                onChange={(e) => handleChange('notificationsEnabled', e.target.checked)}
              />
            }
            label="Enable notifications"
          />

          <FormControlLabel
            control={
              <Switch
                checked={localSettings.emailNotifications}
                onChange={(e) => handleChange('emailNotifications', e.target.checked)}
              />
            }
            label="Email notifications"
          />
        </CardContent>
      </Card>

      <Button
        variant="contained"
        color="primary"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? <CircularProgress size={24} /> : 'Save Settings'}
      </Button>
    </Box>
  );
}
```

#### 1.7 Register in DI Container

```typescript
// Add to src/core/di/types.ts
export const TYPES = {
  // ... existing types
  SettingsRepository: Symbol.for('SettingsRepository'),
  SettingsService: Symbol.for('SettingsService'),
};

// Add to src/core/di/container.ts
import { SettingsRepository } from '@core/repositories/SettingsRepository';
import { MockSettingsRepository } from '@core/repositories/__mocks__/MockSettingsRepository';
import { SettingsService } from '@features/settings/services/SettingsService';

// In container setup:
if (config.useMockAPI) {
  container.bind<ISettingsRepository>(TYPES.SettingsRepository)
    .to(MockSettingsRepository).inSingletonScope();
} else {
  container.bind<ISettingsRepository>(TYPES.SettingsRepository)
    .to(SettingsRepository).inSingletonScope();
}

container.bind<ISettingsService>(TYPES.SettingsService)
  .to(SettingsService).inSingletonScope();
```

**Acceptance Criteria**:
- [ ] Settings load from API on page mount
- [ ] Settings persist to API on save
- [ ] Mock mode works for development
- [ ] Loading and error states handled
- [ ] Success notification shown on save

---

### Phase 2: Password Management

**Duration**: 2 days
**Priority**: HIGH
**Dependencies**: Identity Core API `/users/{id}/change-password` endpoint

#### 2.1 Create Password Service Interface

```typescript
// src/domain/interfaces/IPasswordService.ts
export interface IPasswordService {
  changePassword(userId: number, request: ChangePasswordRequest): Promise<void>;
  validatePassword(password: string): PasswordValidation;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface PasswordValidation {
  isValid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong';
}
```

#### 2.2 Create Password Validator

```typescript
// src/domain/validators/passwordValidator.ts
import { z } from 'zod';

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
}).refine((data) => data.newPassword !== data.currentPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

export function calculatePasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 3) return 'weak';
  if (score <= 5) return 'medium';
  return 'strong';
}
```

#### 2.3 Implement Password Service

```typescript
// src/features/auth/services/PasswordService.ts
import { injectable, inject } from 'inversify';
import { TYPES } from '@core/di/types';
import type { IHttpClient } from '@domain/interfaces/IHttpClient';
import type { INotifier } from '@domain/interfaces/INotifier';
import type {
  IPasswordService,
  ChangePasswordRequest,
  PasswordValidation
} from '@domain/interfaces/IPasswordService';
import { ChangePasswordSchema, calculatePasswordStrength } from '@domain/validators/passwordValidator';

@injectable()
export class PasswordService implements IPasswordService {
  constructor(
    @inject(TYPES.HttpClient) private readonly httpClient: IHttpClient,
    @inject(TYPES.Notifier) private readonly notifier: INotifier
  ) {}

  async changePassword(userId: number, request: ChangePasswordRequest): Promise<void> {
    // Validate first
    const validation = ChangePasswordSchema.safeParse(request);
    if (!validation.success) {
      const errors = validation.error.errors.map(e => e.message);
      throw new Error(errors[0]);
    }

    await this.httpClient.post(`/users/${userId}/change-password`, {
      currentPassword: request.currentPassword,
      newPassword: request.newPassword,
      confirmPassword: request.confirmPassword,
    });

    this.notifier.success('Password changed successfully');
  }

  validatePassword(password: string): PasswordValidation {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
      strength: calculatePasswordStrength(password),
    };
  }
}
```

#### 2.4 Create ChangePasswordDialog Component

```typescript
// src/features/auth/components/ChangePasswordDialog.tsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  LinearProgress,
  Typography,
  Alert,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useService } from '@app/providers/DependencyProvider';
import { TYPES } from '@core/di/types';
import type { IPasswordService } from '@domain/interfaces/IPasswordService';
import { useAuth } from '../hooks/useAuth';

interface ChangePasswordDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ChangePasswordDialog({ open, onClose }: ChangePasswordDialogProps) {
  const passwordService = useService<IPasswordService>(TYPES.PasswordService);
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<{ strength: string; errors: string[] }>({
    strength: 'weak',
    errors: [],
  });

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'newPassword') {
      const result = passwordService.validatePassword(value);
      setValidation({ strength: result.strength, errors: result.errors });
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      await passwordService.changePassword(user.id, formData);
      onClose();
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    switch (validation.strength) {
      case 'weak': return 'error';
      case 'medium': return 'warning';
      case 'strong': return 'success';
      default: return 'error';
    }
  };

  const getStrengthValue = () => {
    switch (validation.strength) {
      case 'weak': return 33;
      case 'medium': return 66;
      case 'strong': return 100;
      default: return 0;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Change Password</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          margin="normal"
          label="Current Password"
          type={showPasswords.current ? 'text' : 'password'}
          value={formData.currentPassword}
          onChange={handleChange('currentPassword')}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPasswords(p => ({ ...p, current: !p.current }))}
                >
                  {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        <TextField
          fullWidth
          margin="normal"
          label="New Password"
          type={showPasswords.new ? 'text' : 'password'}
          value={formData.newPassword}
          onChange={handleChange('newPassword')}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPasswords(p => ({ ...p, new: !p.new }))}
                >
                  {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {formData.newPassword && (
          <Box sx={{ mt: 1 }}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption">Strength:</Typography>
              <Box flexGrow={1}>
                <LinearProgress
                  variant="determinate"
                  value={getStrengthValue()}
                  color={getStrengthColor()}
                />
              </Box>
              <Typography variant="caption" color={`${getStrengthColor()}.main`}>
                {validation.strength}
              </Typography>
            </Box>
            {validation.errors.length > 0 && (
              <Box sx={{ mt: 1 }}>
                {validation.errors.map((err, i) => (
                  <Typography key={i} variant="caption" color="error" display="block">
                    - {err}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        )}

        <TextField
          fullWidth
          margin="normal"
          label="Confirm New Password"
          type={showPasswords.confirm ? 'text' : 'password'}
          value={formData.confirmPassword}
          onChange={handleChange('confirmPassword')}
          error={formData.confirmPassword !== '' && formData.newPassword !== formData.confirmPassword}
          helperText={
            formData.confirmPassword !== '' && formData.newPassword !== formData.confirmPassword
              ? "Passwords don't match"
              : ''
          }
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  onClick={() => setShowPasswords(p => ({ ...p, confirm: !p.confirm }))}
                >
                  {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading || validation.errors.length > 0 || formData.newPassword !== formData.confirmPassword}
        >
          {loading ? 'Changing...' : 'Change Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

#### 2.5 Add to Settings Page

```typescript
// Add to SettingsPage.tsx
import { ChangePasswordDialog } from '@features/auth/components/ChangePasswordDialog';

// Inside component:
const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

// Add this card after existing cards:
<Card sx={{ mb: 3 }}>
  <CardContent>
    <Typography variant="h6" gutterBottom>Security</Typography>
    <Button
      variant="outlined"
      onClick={() => setPasswordDialogOpen(true)}
    >
      Change Password
    </Button>
  </CardContent>
</Card>

<ChangePasswordDialog
  open={passwordDialogOpen}
  onClose={() => setPasswordDialogOpen(false)}
/>
```

**Acceptance Criteria**:
- [ ] Password change dialog opens from settings
- [ ] Current password is validated against API
- [ ] New password strength meter works
- [ ] Password validation rules enforced
- [ ] Success notification shown after change
- [ ] Dialog closes and form resets on success

---

### Phase 3: Role-Based UI Restrictions

**Duration**: 2 days
**Priority**: HIGH
**Dependencies**: User role information from auth context

#### 3.1 Define Permission Types

```typescript
// src/domain/models/Permission.ts
export enum Permission {
  // User permissions
  USERS_VIEW = 'users:view',
  USERS_CREATE = 'users:create',
  USERS_EDIT = 'users:edit',
  USERS_DELETE = 'users:delete',

  // Tenant permissions
  TENANTS_VIEW = 'tenants:view',
  TENANTS_CREATE = 'tenants:create',
  TENANTS_EDIT = 'tenants:edit',
  TENANTS_DELETE = 'tenants:delete',

  // Enrollment permissions
  ENROLLMENTS_VIEW = 'enrollments:view',
  ENROLLMENTS_CREATE = 'enrollments:create',
  ENROLLMENTS_DELETE = 'enrollments:delete',

  // Audit permissions
  AUDIT_LOGS_VIEW = 'audit:view',

  // Settings permissions
  SETTINGS_VIEW = 'settings:view',
  SETTINGS_EDIT = 'settings:edit',

  // Dashboard permissions
  DASHBOARD_VIEW = 'dashboard:view',
  DASHBOARD_ANALYTICS = 'dashboard:analytics',
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR' | 'VIEWER';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission),
  ADMIN: [
    Permission.USERS_VIEW,
    Permission.USERS_CREATE,
    Permission.USERS_EDIT,
    Permission.TENANTS_VIEW,
    Permission.ENROLLMENTS_VIEW,
    Permission.ENROLLMENTS_CREATE,
    Permission.ENROLLMENTS_DELETE,
    Permission.AUDIT_LOGS_VIEW,
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_EDIT,
    Permission.DASHBOARD_VIEW,
    Permission.DASHBOARD_ANALYTICS,
  ],
  OPERATOR: [
    Permission.USERS_VIEW,
    Permission.ENROLLMENTS_VIEW,
    Permission.ENROLLMENTS_CREATE,
    Permission.SETTINGS_VIEW,
    Permission.SETTINGS_EDIT,
    Permission.DASHBOARD_VIEW,
  ],
  VIEWER: [
    Permission.USERS_VIEW,
    Permission.ENROLLMENTS_VIEW,
    Permission.DASHBOARD_VIEW,
    Permission.SETTINGS_VIEW,
  ],
};
```

#### 3.2 Create Permission Context

```typescript
// src/features/auth/context/PermissionContext.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Permission, ROLE_PERMISSIONS, UserRole } from '@domain/models/Permission';

interface PermissionContextValue {
  permissions: Permission[];
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  role: UserRole | null;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const value = useMemo(() => {
    const role = user?.role as UserRole | null;
    const permissions = role ? ROLE_PERMISSIONS[role] : [];

    return {
      permissions,
      role,
      hasPermission: (permission: Permission) => permissions.includes(permission),
      hasAnyPermission: (perms: Permission[]) => perms.some(p => permissions.includes(p)),
      hasAllPermissions: (perms: Permission[]) => perms.every(p => permissions.includes(p)),
    };
  }, [user?.role]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
}
```

#### 3.3 Create Permission Guard Component

```typescript
// src/features/auth/components/PermissionGuard.tsx
import React from 'react';
import { usePermissions } from '../context/PermissionContext';
import { Permission } from '@domain/models/Permission';

interface PermissionGuardProps {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

  let hasAccess = false;

  if (permission) {
    hasAccess = hasPermission(permission);
  } else if (permissions) {
    hasAccess = requireAll
      ? hasAllPermissions(permissions)
      : hasAnyPermission(permissions);
  } else {
    hasAccess = true;
  }

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
```

#### 3.4 Create withPermission HOC

```typescript
// src/features/auth/hoc/withPermission.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../context/PermissionContext';
import { Permission } from '@domain/models/Permission';

interface WithPermissionOptions {
  permission?: Permission;
  permissions?: Permission[];
  requireAll?: boolean;
  redirectTo?: string;
}

export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  options: WithPermissionOptions
) {
  return function WrappedComponent(props: P) {
    const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();
    const { permission, permissions, requireAll = false, redirectTo = '/dashboard' } = options;

    let hasAccess = false;

    if (permission) {
      hasAccess = hasPermission(permission);
    } else if (permissions) {
      hasAccess = requireAll
        ? hasAllPermissions(permissions)
        : hasAnyPermission(permissions);
    } else {
      hasAccess = true;
    }

    if (!hasAccess) {
      return <Navigate to={redirectTo} replace />;
    }

    return <Component {...props} />;
  };
}
```

#### 3.5 Update Navigation Component

```typescript
// src/shared/components/Sidebar.tsx
import { usePermissions } from '@features/auth/context/PermissionContext';
import { Permission } from '@domain/models/Permission';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  permission?: Permission;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, permission: Permission.DASHBOARD_VIEW },
  { label: 'Users', path: '/users', icon: <PeopleIcon />, permission: Permission.USERS_VIEW },
  { label: 'Tenants', path: '/tenants', icon: <BusinessIcon />, permission: Permission.TENANTS_VIEW },
  { label: 'Enrollments', path: '/enrollments', icon: <FingerprintIcon />, permission: Permission.ENROLLMENTS_VIEW },
  { label: 'Audit Logs', path: '/audit-logs', icon: <HistoryIcon />, permission: Permission.AUDIT_LOGS_VIEW },
  { label: 'Settings', path: '/settings', icon: <SettingsIcon />, permission: Permission.SETTINGS_VIEW },
];

export function Sidebar() {
  const { hasPermission } = usePermissions();

  const visibleItems = navItems.filter(item =>
    !item.permission || hasPermission(item.permission)
  );

  return (
    <Drawer>
      <List>
        {visibleItems.map(item => (
          <ListItem key={item.path} component={NavLink} to={item.path}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
}
```

#### 3.6 Protect Routes

```typescript
// src/app/routes.tsx
import { withPermission } from '@features/auth/hoc/withPermission';
import { Permission } from '@domain/models/Permission';

// Wrap pages with permission requirements
const ProtectedUsersPage = withPermission(UsersPage, {
  permission: Permission.USERS_VIEW
});

const ProtectedTenantsPage = withPermission(TenantsPage, {
  permission: Permission.TENANTS_VIEW
});

const ProtectedAuditLogsPage = withPermission(AuditLogsPage, {
  permission: Permission.AUDIT_LOGS_VIEW
});

// Use in routes
<Route path="/users" element={<ProtectedUsersPage />} />
<Route path="/tenants" element={<ProtectedTenantsPage />} />
<Route path="/audit-logs" element={<ProtectedAuditLogsPage />} />
```

#### 3.7 Hide Action Buttons Based on Permissions

```typescript
// Example in UsersPage.tsx
import { PermissionGuard } from '@features/auth/components/PermissionGuard';
import { Permission } from '@domain/models/Permission';

// In the component:
<PermissionGuard permission={Permission.USERS_CREATE}>
  <Button variant="contained" onClick={handleCreateUser}>
    Add User
  </Button>
</PermissionGuard>

<PermissionGuard permission={Permission.USERS_EDIT}>
  <IconButton onClick={() => handleEditUser(user)}>
    <EditIcon />
  </IconButton>
</PermissionGuard>

<PermissionGuard permission={Permission.USERS_DELETE}>
  <IconButton onClick={() => handleDeleteUser(user)}>
    <DeleteIcon />
  </IconButton>
</PermissionGuard>
```

**Acceptance Criteria**:
- [ ] Navigation items hidden based on role
- [ ] Routes protected with permission HOC
- [ ] Action buttons conditionally rendered
- [ ] VIEWER cannot see create/edit/delete buttons
- [ ] OPERATOR can create enrollments but not users
- [ ] ADMIN can manage users but not tenants
- [ ] SUPER_ADMIN has full access

---

### Phase 4: Dark Mode Implementation

**Duration**: 2 days
**Priority**: MEDIUM
**Dependencies**: Settings backend integration (Phase 1)

#### 4.1 Create Theme Configuration

```typescript
// src/app/theme/themes.ts
import { createTheme, ThemeOptions } from '@mui/material/styles';

const commonOptions: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 500 },
    h6: { fontWeight: 500 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
  },
};

export const lightTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
});

export const darkTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
      light: '#e3f2fd',
      dark: '#42a5f5',
    },
    secondary: {
      main: '#ce93d8',
      light: '#f3e5f5',
      dark: '#ab47bc',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
});
```

#### 4.2 Create Theme Context

```typescript
// src/app/theme/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { lightTheme, darkTheme } from './themes';
import { useSettings } from '@features/settings/hooks/useSettings';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  mode: ThemeMode;
  effectiveMode: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark'>('light');

  // Listen to system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    setSystemPreference(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Sync with settings
  useEffect(() => {
    if (settings?.theme) {
      setModeState(settings.theme);
    }
  }, [settings?.theme]);

  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    if (updateSettings) {
      await updateSettings({ theme: newMode });
    }
  };

  const effectiveMode = mode === 'system' ? systemPreference : mode;

  const toggleTheme = () => {
    setMode(effectiveMode === 'light' ? 'dark' : 'light');
  };

  const theme = useMemo(
    () => (effectiveMode === 'dark' ? darkTheme : lightTheme),
    [effectiveMode]
  );

  const value = useMemo(
    () => ({ mode, effectiveMode, setMode, toggleTheme }),
    [mode, effectiveMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

#### 4.3 Add Theme Toggle to Header

```typescript
// src/shared/components/Header.tsx
import { IconButton, Tooltip } from '@mui/material';
import { Brightness4, Brightness7 } from '@mui/icons-material';
import { useTheme } from '@app/theme/ThemeContext';

export function Header() {
  const { effectiveMode, toggleTheme } = useTheme();

  return (
    <AppBar position="static">
      <Toolbar>
        {/* ... other header content */}

        <Tooltip title={`Switch to ${effectiveMode === 'light' ? 'dark' : 'light'} mode`}>
          <IconButton color="inherit" onClick={toggleTheme}>
            {effectiveMode === 'light' ? <Brightness4 /> : <Brightness7 />}
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}
```

#### 4.4 Update App Provider Hierarchy

```typescript
// src/app/App.tsx
import { ThemeProvider } from './theme/ThemeContext';
import { DependencyProvider } from './providers/DependencyProvider';
import { PermissionProvider } from '@features/auth/context/PermissionContext';

export function App() {
  return (
    <DependencyProvider>
      <AuthProvider>
        <ThemeProvider>
          <PermissionProvider>
            <SnackbarProvider>
              <Router>
                <Routes />
              </Router>
            </SnackbarProvider>
          </PermissionProvider>
        </ThemeProvider>
      </AuthProvider>
    </DependencyProvider>
  );
}
```

**Acceptance Criteria**:
- [ ] Light/dark themes properly styled
- [ ] Theme toggle in header works
- [ ] System preference detection works
- [ ] Theme persists in settings
- [ ] All components properly themed
- [ ] No flash of wrong theme on load

---

### Phase 5: Test Coverage Expansion

**Duration**: 3 days
**Priority**: HIGH
**Target**: 80% code coverage

#### 5.1 Unit Tests for Services

```typescript
// __tests__/unit/features/auth/services/PasswordService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Container } from 'inversify';
import { PasswordService } from '@features/auth/services/PasswordService';
import { TYPES } from '@core/di/types';

describe('PasswordService', () => {
  let container: Container;
  let passwordService: PasswordService;
  let mockHttpClient: any;
  let mockNotifier: any;

  beforeEach(() => {
    mockHttpClient = {
      post: vi.fn(),
    };
    mockNotifier = {
      success: vi.fn(),
      error: vi.fn(),
    };

    container = new Container();
    container.bind(TYPES.HttpClient).toConstantValue(mockHttpClient);
    container.bind(TYPES.Notifier).toConstantValue(mockNotifier);
    container.bind(PasswordService).toSelf();

    passwordService = container.get(PasswordService);
  });

  describe('changePassword', () => {
    it('should call API with correct payload', async () => {
      mockHttpClient.post.mockResolvedValue({ data: {} });

      await passwordService.changePassword(1, {
        currentPassword: 'oldPass123!',
        newPassword: 'newPass456!',
        confirmPassword: 'newPass456!',
      });

      expect(mockHttpClient.post).toHaveBeenCalledWith('/users/1/change-password', {
        currentPassword: 'oldPass123!',
        newPassword: 'newPass456!',
        confirmPassword: 'newPass456!',
      });
    });

    it('should show success notification', async () => {
      mockHttpClient.post.mockResolvedValue({ data: {} });

      await passwordService.changePassword(1, {
        currentPassword: 'oldPass123!',
        newPassword: 'newPass456!',
        confirmPassword: 'newPass456!',
      });

      expect(mockNotifier.success).toHaveBeenCalledWith('Password changed successfully');
    });

    it('should throw error for mismatched passwords', async () => {
      await expect(
        passwordService.changePassword(1, {
          currentPassword: 'oldPass123!',
          newPassword: 'newPass456!',
          confirmPassword: 'differentPass!',
        })
      ).rejects.toThrow("Passwords don't match");
    });

    it('should throw error for weak password', async () => {
      await expect(
        passwordService.changePassword(1, {
          currentPassword: 'oldPass123!',
          newPassword: 'weak',
          confirmPassword: 'weak',
        })
      ).rejects.toThrow();
    });
  });

  describe('validatePassword', () => {
    it('should return weak for short passwords', () => {
      const result = passwordService.validatePassword('abc');
      expect(result.strength).toBe('weak');
      expect(result.isValid).toBe(false);
    });

    it('should return strong for complex passwords', () => {
      const result = passwordService.validatePassword('ComplexPass123!@#');
      expect(result.strength).toBe('strong');
      expect(result.isValid).toBe(true);
    });

    it('should list specific validation errors', () => {
      const result = passwordService.validatePassword('password');
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
      expect(result.errors).toContain('Password must contain at least one number');
      expect(result.errors).toContain('Password must contain at least one special character');
    });
  });
});
```

#### 5.2 Unit Tests for Hooks

```typescript
// __tests__/unit/features/settings/hooks/useSettings.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useSettings } from '@features/settings/hooks/useSettings';
import { createTestWrapper } from '@tests/utils/testWrapper';

describe('useSettings', () => {
  let mockSettingsService: any;

  beforeEach(() => {
    mockSettingsService = {
      loadSettings: vi.fn(),
      saveSettings: vi.fn(),
    };
  });

  it('should load settings on mount', async () => {
    const settings = {
      theme: 'dark',
      language: 'en',
      notificationsEnabled: true,
    };
    mockSettingsService.loadSettings.mockResolvedValue(settings);

    const { result } = renderHook(() => useSettings(), {
      wrapper: createTestWrapper({ settingsService: mockSettingsService }),
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.settings).toEqual(settings);
  });

  it('should update settings', async () => {
    const initialSettings = { theme: 'light', language: 'en' };
    const updatedSettings = { theme: 'dark', language: 'en' };

    mockSettingsService.loadSettings.mockResolvedValue(initialSettings);
    mockSettingsService.saveSettings.mockResolvedValue(updatedSettings);

    const { result } = renderHook(() => useSettings(), {
      wrapper: createTestWrapper({ settingsService: mockSettingsService }),
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.updateSettings({ theme: 'dark' });
    });

    expect(result.current.settings?.theme).toBe('dark');
  });
});
```

#### 5.3 Component Tests

```typescript
// __tests__/unit/features/auth/components/ChangePasswordDialog.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChangePasswordDialog } from '@features/auth/components/ChangePasswordDialog';
import { createTestWrapper } from '@tests/utils/testWrapper';

describe('ChangePasswordDialog', () => {
  const mockOnClose = vi.fn();
  let mockPasswordService: any;

  beforeEach(() => {
    mockOnClose.mockClear();
    mockPasswordService = {
      changePassword: vi.fn(),
      validatePassword: vi.fn().mockReturnValue({
        isValid: true,
        errors: [],
        strength: 'strong',
      }),
    };
  });

  it('should render all form fields', () => {
    render(
      <ChangePasswordDialog open={true} onClose={mockOnClose} />,
      { wrapper: createTestWrapper({ passwordService: mockPasswordService }) }
    );

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm.*password/i)).toBeInTheDocument();
  });

  it('should show password strength indicator', async () => {
    render(
      <ChangePasswordDialog open={true} onClose={mockOnClose} />,
      { wrapper: createTestWrapper({ passwordService: mockPasswordService }) }
    );

    const newPasswordInput = screen.getByLabelText(/new password/i);
    await userEvent.type(newPasswordInput, 'StrongPass123!');

    expect(screen.getByText(/strong/i)).toBeInTheDocument();
  });

  it('should show error for mismatched passwords', async () => {
    render(
      <ChangePasswordDialog open={true} onClose={mockOnClose} />,
      { wrapper: createTestWrapper({ passwordService: mockPasswordService }) }
    );

    await userEvent.type(screen.getByLabelText(/new password/i), 'Password123!');
    await userEvent.type(screen.getByLabelText(/confirm.*password/i), 'Different123!');

    expect(screen.getByText(/passwords don't match/i)).toBeInTheDocument();
  });

  it('should call changePassword on submit', async () => {
    mockPasswordService.changePassword.mockResolvedValue(undefined);

    render(
      <ChangePasswordDialog open={true} onClose={mockOnClose} />,
      { wrapper: createTestWrapper({ passwordService: mockPasswordService }) }
    );

    await userEvent.type(screen.getByLabelText(/current password/i), 'OldPass123!');
    await userEvent.type(screen.getByLabelText(/new password/i), 'NewPass456!');
    await userEvent.type(screen.getByLabelText(/confirm.*password/i), 'NewPass456!');

    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => {
      expect(mockPasswordService.changePassword).toHaveBeenCalled();
    });
  });

  it('should close dialog on successful change', async () => {
    mockPasswordService.changePassword.mockResolvedValue(undefined);

    render(
      <ChangePasswordDialog open={true} onClose={mockOnClose} />,
      { wrapper: createTestWrapper({ passwordService: mockPasswordService }) }
    );

    await userEvent.type(screen.getByLabelText(/current password/i), 'OldPass123!');
    await userEvent.type(screen.getByLabelText(/new password/i), 'NewPass456!');
    await userEvent.type(screen.getByLabelText(/confirm.*password/i), 'NewPass456!');

    await userEvent.click(screen.getByRole('button', { name: /change password/i }));

    await waitFor(() => {
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
```

#### 5.4 Integration Tests

```typescript
// __tests__/integration/auth-flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '@app/App';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.post('/api/v1/auth/login', (req, res, ctx) => {
    return res(
      ctx.json({
        accessToken: 'mock-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
        user: {
          id: 1,
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          role: 'ADMIN',
        },
      })
    );
  }),
  rest.get('/api/v1/dashboard/statistics', (req, res, ctx) => {
    return res(
      ctx.json({
        totalUsers: 100,
        activeUsers: 80,
        totalEnrollments: 500,
      })
    );
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('Authentication Flow', () => {
  it('should login and redirect to dashboard', async () => {
    render(<App />);

    // Fill in login form
    await userEvent.type(screen.getByLabelText(/email/i), 'admin@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Should redirect to dashboard
    await waitFor(() => {
      expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
    });
  });

  it('should show error for invalid credentials', async () => {
    server.use(
      rest.post('/api/v1/auth/login', (req, res, ctx) => {
        return res(ctx.status(401), ctx.json({ message: 'Invalid credentials' }));
      })
    );

    render(<App />);

    await userEvent.type(screen.getByLabelText(/email/i), 'wrong@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
```

#### 5.5 Test Utilities

```typescript
// __tests__/utils/testWrapper.tsx
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { Container } from 'inversify';
import { DependencyProvider } from '@app/providers/DependencyProvider';
import { TYPES } from '@core/di/types';

interface TestWrapperOptions {
  settingsService?: any;
  passwordService?: any;
  authService?: any;
  user?: any;
}

export function createTestWrapper(options: TestWrapperOptions = {}) {
  const container = new Container();

  // Bind mocks
  if (options.settingsService) {
    container.bind(TYPES.SettingsService).toConstantValue(options.settingsService);
  }
  if (options.passwordService) {
    container.bind(TYPES.PasswordService).toConstantValue(options.passwordService);
  }
  if (options.authService) {
    container.bind(TYPES.AuthService).toConstantValue(options.authService);
  }

  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return (
      <BrowserRouter>
        <DependencyProvider container={container}>
          {children}
        </DependencyProvider>
      </BrowserRouter>
    );
  };
}
```

**Acceptance Criteria**:
- [ ] Service unit tests: ≥90% coverage
- [ ] Hook unit tests: ≥80% coverage
- [ ] Component tests: ≥70% coverage
- [ ] Integration tests for critical flows
- [ ] All tests pass in CI/CD

---

### Phase 6: Pagination Implementation

**Duration**: 1 day
**Priority**: MEDIUM
**Dependencies**: API pagination support

#### 6.1 Create Paginated Table Component

```typescript
// src/shared/components/PaginatedTable.tsx
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  TableSortLabel,
  CircularProgress,
  Box,
} from '@mui/material';

export interface Column<T> {
  id: keyof T | string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
}

interface PaginatedTableProps<T> {
  columns: Column<T>[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSort?: (column: string) => void;
  rowKey: keyof T;
  emptyMessage?: string;
}

export function PaginatedTable<T extends Record<string, any>>({
  columns,
  data,
  total,
  page,
  pageSize,
  loading = false,
  sortBy,
  sortOrder = 'asc',
  onPageChange,
  onPageSizeChange,
  onSort,
  rowKey,
  emptyMessage = 'No data available',
}: PaginatedTableProps<T>) {
  const handleChangePage = (_: unknown, newPage: number) => {
    onPageChange(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    onPageSizeChange(parseInt(event.target.value, 10));
    onPageChange(0);
  };

  const handleSort = (columnId: string) => {
    if (onSort) {
      onSort(columnId);
    }
  };

  return (
    <Paper>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={String(column.id)} align={column.align || 'left'}>
                  {column.sortable && onSort ? (
                    <TableSortLabel
                      active={sortBy === column.id}
                      direction={sortBy === column.id ? sortOrder : 'asc'}
                      onClick={() => handleSort(String(column.id))}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow key={String(row[rowKey])}>
                  {columns.map((column) => (
                    <TableCell key={String(column.id)} align={column.align || 'left'}>
                      {column.render
                        ? column.render(row)
                        : row[column.id as keyof T]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        rowsPerPage={pageSize}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Paper>
  );
}
```

#### 6.2 Create usePagination Hook

```typescript
// src/shared/hooks/usePagination.ts
import { useState, useCallback } from 'react';

export interface PaginationState {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder: 'asc' | 'desc';
}

export interface UsePaginationReturn extends PaginationState {
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  toggleSort: (column: string) => void;
  reset: () => void;
}

export function usePagination(
  initialState: Partial<PaginationState> = {}
): UsePaginationReturn {
  const [state, setState] = useState<PaginationState>({
    page: initialState.page ?? 0,
    pageSize: initialState.pageSize ?? 20,
    sortBy: initialState.sortBy,
    sortOrder: initialState.sortOrder ?? 'asc',
  });

  const setPage = useCallback((page: number) => {
    setState((prev) => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setState((prev) => ({ ...prev, pageSize, page: 0 }));
  }, []);

  const toggleSort = useCallback((column: string) => {
    setState((prev) => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 0,
    }));
  }, []);

  const reset = useCallback(() => {
    setState({
      page: 0,
      pageSize: 20,
      sortBy: undefined,
      sortOrder: 'asc',
    });
  }, []);

  return {
    ...state,
    setPage,
    setPageSize,
    toggleSort,
    reset,
  };
}
```

#### 6.3 Update Users Page with Pagination

```typescript
// src/features/users/pages/UsersPage.tsx
import { PaginatedTable, Column } from '@shared/components/PaginatedTable';
import { usePagination } from '@shared/hooks/usePagination';
import { useUsers } from '../hooks/useUsers';
import type { User } from '@domain/models/User';

export function UsersPage() {
  const pagination = usePagination({ pageSize: 20 });
  const { users, total, loading, error } = useUsers({
    page: pagination.page,
    pageSize: pagination.pageSize,
    sortBy: pagination.sortBy,
    sortOrder: pagination.sortOrder,
  });

  const columns: Column<User>[] = [
    { id: 'id', label: 'ID', sortable: true },
    { id: 'email', label: 'Email', sortable: true },
    {
      id: 'fullName',
      label: 'Name',
      sortable: true,
      render: (user) => `${user.firstName} ${user.lastName}`,
    },
    { id: 'role', label: 'Role', sortable: true },
    {
      id: 'status',
      label: 'Status',
      render: (user) => (
        <Chip
          label={user.status}
          color={user.status === 'ACTIVE' ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (user) => (
        <>
          <PermissionGuard permission={Permission.USERS_EDIT}>
            <IconButton onClick={() => handleEdit(user)}>
              <EditIcon />
            </IconButton>
          </PermissionGuard>
          <PermissionGuard permission={Permission.USERS_DELETE}>
            <IconButton onClick={() => handleDelete(user)}>
              <DeleteIcon />
            </IconButton>
          </PermissionGuard>
        </>
      ),
    },
  ];

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>Users</Typography>

      <PaginatedTable
        columns={columns}
        data={users}
        total={total}
        page={pagination.page}
        pageSize={pagination.pageSize}
        loading={loading}
        sortBy={pagination.sortBy}
        sortOrder={pagination.sortOrder}
        onPageChange={pagination.setPage}
        onPageSizeChange={pagination.setPageSize}
        onSort={pagination.toggleSort}
        rowKey="id"
      />
    </Box>
  );
}
```

**Acceptance Criteria**:
- [ ] Tables support server-side pagination
- [ ] Page size selection works
- [ ] Column sorting works
- [ ] Loading states shown during fetch
- [ ] Empty state shown when no data

---

### Phase 7: Real API Integration

**Duration**: 2 days
**Priority**: HIGH
**Dependencies**: All API endpoints implemented in Identity Core API

#### 7.1 Update Environment Configuration

```env
# .env.production
VITE_API_BASE_URL=https://api.fivucsas.com/api/v1
VITE_ENABLE_MOCK_API=false
VITE_ENV=production
VITE_LOG_LEVEL=warn

# .env.development
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_ENABLE_MOCK_API=false  # Change to false for real API
VITE_ENV=development
VITE_LOG_LEVEL=debug
```

#### 7.2 Update API Client with Auth Interceptor

```typescript
// src/core/api/authInterceptor.ts
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { ITokenService } from '@domain/interfaces/ITokenService';
import type { IAuthRepository } from '@domain/interfaces/IAuthRepository';

export function setupAuthInterceptor(
  client: AxiosInstance,
  tokenService: ITokenService,
  authRepository: IAuthRepository
): void {
  // Request interceptor - add token
  client.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    const token = await tokenService.getAccessToken();

    if (token) {
      // Check if token should be refreshed
      if (tokenService.shouldRefresh(token)) {
        try {
          const refreshToken = await tokenService.getRefreshToken();
          if (refreshToken) {
            const response = await authRepository.refresh(refreshToken);
            await tokenService.storeTokens({
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
            });
            config.headers.Authorization = `Bearer ${response.accessToken}`;
          }
        } catch (error) {
          // Refresh failed - will be handled by response interceptor
        }
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }

    return config;
  });

  // Response interceptor - handle 401
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const refreshToken = await tokenService.getRefreshToken();
          if (refreshToken) {
            const response = await authRepository.refresh(refreshToken);
            await tokenService.storeTokens({
              accessToken: response.accessToken,
              refreshToken: response.refreshToken,
            });
            originalRequest.headers.Authorization = `Bearer ${response.accessToken}`;
            return client(originalRequest);
          }
        } catch (refreshError) {
          // Refresh failed - redirect to login
          await tokenService.clearTokens();
          window.location.href = '/login';
        }
      }

      return Promise.reject(error);
    }
  );
}
```

#### 7.3 Update Repository Factory

```typescript
// src/core/di/repositoryFactory.ts
import type { Container } from 'inversify';
import { TYPES } from './types';

export function bindRepositories(container: Container, useMockAPI: boolean): void {
  if (useMockAPI) {
    // Mock repositories
    container.bind(TYPES.AuthRepository).to(MockAuthRepository).inSingletonScope();
    container.bind(TYPES.UserRepository).to(MockUserRepository).inSingletonScope();
    container.bind(TYPES.TenantRepository).to(MockTenantRepository).inSingletonScope();
    container.bind(TYPES.EnrollmentRepository).to(MockEnrollmentRepository).inSingletonScope();
    container.bind(TYPES.AuditLogRepository).to(MockAuditLogRepository).inSingletonScope();
    container.bind(TYPES.SettingsRepository).to(MockSettingsRepository).inSingletonScope();
    container.bind(TYPES.DashboardRepository).to(MockDashboardRepository).inSingletonScope();
  } else {
    // Real API repositories
    container.bind(TYPES.AuthRepository).to(AuthRepository).inSingletonScope();
    container.bind(TYPES.UserRepository).to(UserRepository).inSingletonScope();
    container.bind(TYPES.TenantRepository).to(TenantRepository).inSingletonScope();
    container.bind(TYPES.EnrollmentRepository).to(EnrollmentRepository).inSingletonScope();
    container.bind(TYPES.AuditLogRepository).to(AuditLogRepository).inSingletonScope();
    container.bind(TYPES.SettingsRepository).to(SettingsRepository).inSingletonScope();
    container.bind(TYPES.DashboardRepository).to(DashboardRepository).inSingletonScope();
  }
}
```

#### 7.4 Error Response Handling

```typescript
// src/core/api/errorMapper.ts
import { AxiosError } from 'axios';
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  BusinessError
} from '@core/errors/AppError';

interface ApiErrorResponse {
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

export function mapApiError(error: AxiosError<ApiErrorResponse>): Error {
  const status = error.response?.status;
  const data = error.response?.data;
  const message = data?.message || error.message;

  switch (status) {
    case 400:
      return new ValidationError(message, data?.details);
    case 401:
      return new UnauthorizedError(message);
    case 403:
      return new ForbiddenError(message);
    case 404:
      return new NotFoundError(message);
    case 422:
      return new BusinessError(message, data?.details);
    default:
      return new Error(message);
  }
}
```

#### 7.5 Update Build Configuration

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@core': path.resolve(__dirname, './src/core'),
        '@domain': path.resolve(__dirname, './src/domain'),
        '@features': path.resolve(__dirname, './src/features'),
        '@shared': path.resolve(__dirname, './src/shared'),
        '@app': path.resolve(__dirname, './src/app'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['@mui/material', '@emotion/react', '@emotion/styled'],
          },
        },
      },
    },
  };
});
```

**Acceptance Criteria**:
- [ ] Mock mode can be disabled via environment variable
- [ ] All API calls go to real backend
- [ ] Token refresh works seamlessly
- [ ] Error responses properly mapped
- [ ] Build optimized for production

---

## Integration Points

### With Identity Core API

```
Web App                    Identity Core API
   │                              │
   ├── POST /auth/login ─────────►│
   │◄──── JWT tokens ─────────────┤
   │                              │
   ├── GET /users ───────────────►│
   │   (Bearer token)             │
   │◄──── Paginated users ────────┤
   │                              │
   ├── PUT /users/{id}/settings ─►│
   │◄──── Updated settings ───────┤
   │                              │
   ├── POST /users/{id}/change-password ►│
   │◄──── 204 No Content ─────────┤
```

### With Biometric Processor (via Identity Core API)

The web app does not communicate directly with Biometric Processor. All biometric operations are proxied through Identity Core API.

---

## Testing Strategy

### Test Types

| Type | Coverage Target | Tools |
|------|-----------------|-------|
| Unit Tests | ≥80% | Vitest |
| Component Tests | ≥70% | React Testing Library |
| Integration Tests | Critical paths | MSW + Vitest |
| E2E Tests | Happy paths | Playwright (optional) |

### Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch

# Run specific test file
npm test -- --filter="PasswordService"
```

---

## Deployment Checklist

### Pre-Deployment

- [ ] All tests pass
- [ ] Build succeeds without errors
- [ ] Environment variables configured
- [ ] Mock mode disabled
- [ ] API endpoints verified
- [ ] CORS configured on backend

### Build

```bash
# Production build
npm run build

# Preview production build
npm run preview
```

### Post-Deployment

- [ ] Verify login works
- [ ] Verify dashboard loads
- [ ] Verify CRUD operations
- [ ] Check browser console for errors
- [ ] Verify token refresh works

---

## Timeline Summary

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Settings Integration | 2 days | Identity API |
| Phase 2: Password Management | 2 days | Identity API |
| Phase 3: Role-Based UI | 2 days | Auth context |
| Phase 4: Dark Mode | 2 days | Phase 1 |
| Phase 5: Test Coverage | 3 days | All features |
| Phase 6: Pagination | 1 day | API support |
| Phase 7: Real API Integration | 2 days | Identity API |
| **Total** | **14 days** | |

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Feature Completion | 100% |
| Test Coverage | ≥80% |
| Build Time | <60s |
| Bundle Size | <1MB |
| Lighthouse Score | ≥90 |

---

**Document Status**: Ready for Implementation
**Last Updated**: January 2026
**Next Review**: After Phase 7 completion
