import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import SharedPage from '../pages/SharedPage'
import { renderWithProviders } from './test-utils'
import * as api from '../lib/api'
import type { Document } from '../types/database'

vi.mock('../lib/api')

const mockSharedDocs: Document[] = [
  {
    id: 'shared-1',
    owner_id: 'user-2',
    title: 'Shared Roadmap 2026',
    description: 'Quarterly roadmap',
    file_path: 'user-2/shared-1/roadmap.xlsx',
    file_name: 'roadmap.xlsx',
    file_size: 204800,
    mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    version: 1,
    tags: ['product'],
    created_at: '2026-10-18T10:00:00Z',
    updated_at: '2026-10-18T10:00:00Z',
  },
]

describe('SharedPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no documents are shared', async () => {
    vi.mocked(api.fetchSharedWithMe).mockResolvedValue([])
    renderWithProviders(<SharedPage />)

    expect(await screen.findByText('No documents shared with you yet')).toBeInTheDocument()
  })

  it('renders shared documents table when items exist', async () => {
    vi.mocked(api.fetchSharedWithMe).mockResolvedValue(mockSharedDocs)
    renderWithProviders(<SharedPage />)

    expect(await screen.findByText('Shared Roadmap 2026')).toBeInTheDocument()
    expect(screen.getByText('roadmap.xlsx')).toBeInTheDocument()
  })
})
