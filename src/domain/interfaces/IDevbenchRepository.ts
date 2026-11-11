/**
 * Device benchmark store (identity-core-api `DevbenchController`).
 *
 * `submitRun` is PUBLIC and write-only (`POST /devbench/runs`, no auth, rate-limited).
 * `exportRuns` is ROOT-only (`GET /admin/devbench/runs?format=json|csv`).
 */
export type DevbenchExportFormat = 'json' | 'csv'

export interface IDevbenchRepository {
    /** Stores one run document; resolves with the server-assigned id. */
    submitRun(run: object): Promise<string>

    /** The full export as text (JSON array or CSV). */
    exportRuns(format: DevbenchExportFormat): Promise<string>
}
