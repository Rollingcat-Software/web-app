/**
 * AuthFlowBuilderPage
 *
 * Page-level component for the Auth Flow Builder.
 * Re-exports AuthFlowsPage which contains the full CRUD interface:
 *   - List existing auth flows for the tenant
 *   - Create new flows via dialog with flow name, operation type, and step builder
 *   - Edit existing flows (pre-populates dialog with existing flow data)
 *   - Delete flows with confirmation dialog
 *
 * Uses useAuthFlowBuilder hook internally for step management (add, remove, reorder).
 * See also: src/hooks/useAuthFlowBuilder.ts for standalone usage.
 */
export { default } from '@features/authFlows/components/AuthFlowsPage'
