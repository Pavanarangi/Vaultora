import { describe, it, expect } from 'vitest'
import {
  formatFileSize,
  formatRelativeTime,
  getMimeIcon,
  getMimeColor,
  validateFile,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../lib/utils'

describe('formatFileSize', () => {
  it('formats bytes', () => expect(formatFileSize(0)).toBe('0 B'))
  it('formats kilobytes', () => expect(formatFileSize(1024)).toBe('1 KB'))
  it('formats megabytes', () => expect(formatFileSize(1024 * 1024)).toBe('1 MB'))
  it('formats fractional MB', () => expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB'))
  it('formats gigabytes', () => expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2 GB'))
})

describe('formatRelativeTime', () => {
  it('returns "just now" for recent timestamps', () => {
    const recent = new Date(Date.now() - 30_000).toISOString()
    expect(formatRelativeTime(recent)).toBe('just now')
  })

  it('returns minutes for 2-minute-old timestamp', () => {
    const twoMin = new Date(Date.now() - 2 * 60_000).toISOString()
    expect(formatRelativeTime(twoMin)).toBe('2m ago')
  })

  it('returns hours for 2-hour-old timestamp', () => {
    const twoHrs = new Date(Date.now() - 2 * 3600_000).toISOString()
    expect(formatRelativeTime(twoHrs)).toBe('2h ago')
  })

  it('returns days for 3-day-old timestamp', () => {
    const threeDays = new Date(Date.now() - 3 * 86400_000).toISOString()
    expect(formatRelativeTime(threeDays)).toBe('3d ago')
  })
})

describe('getMimeIcon', () => {
  it('returns image emoji for image types', () => {
    expect(getMimeIcon('image/png')).toBe('🖼️')
    expect(getMimeIcon('image/jpeg')).toBe('🖼️')
  })
  it('returns PDF emoji for PDF', () => {
    expect(getMimeIcon('application/pdf')).toBe('📄')
  })
  it('returns document emoji for Word', () => {
    expect(getMimeIcon('application/msword')).toBe('📝')
  })
  it('returns spreadsheet emoji for Excel', () => {
    expect(getMimeIcon('application/vnd.ms-excel')).toBe('📊')
  })
  it('returns text emoji for plain text', () => {
    expect(getMimeIcon('text/plain')).toBe('📃')
  })
  it('returns folder emoji for unknown type', () => {
    expect(getMimeIcon('application/unknown')).toBe('📁')
  })
})

describe('getMimeColor', () => {
  it('returns pink for images', () => {
    expect(getMimeColor('image/png')).toContain('pink')
  })
  it('returns red for PDF', () => {
    expect(getMimeColor('application/pdf')).toContain('red')
  })
  it('returns blue for Word docs', () => {
    expect(getMimeColor('application/msword')).toContain('blue')
  })
})

describe('validateFile', () => {
  it('accepts valid PDF files', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    expect(validateFile(file)).toBeNull()
  })

  it('rejects files over the size limit', () => {
    const bigFile = new File(['x'.repeat(100)], 'big.pdf', { type: 'application/pdf' })
    Object.defineProperty(bigFile, 'size', { value: MAX_FILE_SIZE_BYTES + 1 })
    const result = validateFile(bigFile)
    expect(result).not.toBeNull()
    expect(result).toContain('exceeds')
  })

  it('rejects disallowed MIME types', () => {
    const exe = new File(['binary'], 'malware.exe', { type: 'application/x-msdownload' })
    const result = validateFile(exe)
    expect(result).not.toBeNull()
    expect(result).toContain('not allowed')
  })

  it('accepts all allowed MIME types', () => {
    ALLOWED_MIME_TYPES.forEach(mimeType => {
      const file = new File(['content'], 'test', { type: mimeType })
      expect(validateFile(file)).toBeNull()
    })
  })
})
