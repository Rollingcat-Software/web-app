import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Box, Button, Grid, TextField, Typography } from '@mui/material'
import { NavigateNext } from '@mui/icons-material'
import { IdInfoSchema } from '@domain/validators/userEnrollmentValidator'
import type { IdInfoData } from '@domain/models/UserEnrollment'

interface IdInfoStepProps {
    defaultValues?: IdInfoData | null
    onNext: (data: IdInfoData) => void
}

export default function IdInfoStep({ defaultValues, onNext }: IdInfoStepProps) {
    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm<IdInfoData>({
        resolver: zodResolver(IdInfoSchema),
        defaultValues: defaultValues ?? {
            nationalId: '',
            dateOfBirth: '',
            fullName: '',
        },
    })

    const onSubmit = (data: IdInfoData) => {
        onNext(data)
    }

    return (
        <Box>
            <Typography variant="h6" gutterBottom>
                Identity Information
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Please provide your identity details. This information will be verified during the
                enrollment process.
            </Typography>

            <form onSubmit={handleSubmit(onSubmit)}>
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="fullName"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Full Name"
                                    fullWidth
                                    required
                                    error={!!errors.fullName}
                                    helperText={errors.fullName?.message}
                                    placeholder="John Doe"
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="nationalId"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="National ID"
                                    fullWidth
                                    required
                                    error={!!errors.nationalId}
                                    helperText={errors.nationalId?.message}
                                    placeholder="ABC-123456"
                                />
                            )}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Controller
                            name="dateOfBirth"
                            control={control}
                            render={({ field }) => (
                                <TextField
                                    {...field}
                                    label="Date of Birth"
                                    type="date"
                                    fullWidth
                                    required
                                    error={!!errors.dateOfBirth}
                                    helperText={errors.dateOfBirth?.message ?? 'Format: YYYY-MM-DD'}
                                    InputLabelProps={{ shrink: true }}
                                    inputProps={{ lang: document.documentElement.lang || 'en' }}
                                />
                            )}
                        />
                    </Grid>
                </Grid>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                    <Button
                        type="submit"
                        variant="contained"
                        endIcon={<NavigateNext />}
                        size="large"
                    >
                        Next
                    </Button>
                </Box>
            </form>
        </Box>
    )
}
