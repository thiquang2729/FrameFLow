import fs from 'node:fs/promises'
import path from 'node:path'
import mammoth from 'mammoth'
import * as xlsx from 'xlsx'
import { PDFParse } from 'pdf-parse'

export interface ParsedScriptResult {
  text: string
  fileName: string
  format: string
}

export const SCRIPT_EXTENSIONS = ['txt', 'md', 'docx', 'xlsx', 'xls', 'pdf', 'json', 'csv']

export class ScriptParserService {
  async parseFile(filePath: string): Promise<ParsedScriptResult> {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Đường dẫn tệp kịch bản không hợp lệ.')
    }

    const realPath = await fs.realpath(filePath)
    const stats = await fs.stat(realPath)
    if (!stats.isFile()) {
      throw new Error('Đường dẫn được chọn không phải là tệp.')
    }

    if (stats.size > 25 * 1024 * 1024) {
      throw new Error('Tệp kịch bản quá lớn (tối đa 25MB).')
    }

    const ext = path.extname(realPath).slice(1).toLowerCase()
    const fileName = path.basename(realPath)

    if (!SCRIPT_EXTENSIONS.includes(ext)) {
      throw new Error(`Định dạng tệp .${ext} chưa được hỗ trợ. Hãy chọn file txt, md, docx, xlsx, pdf, json hoặc csv.`)
    }

    const buffer = await fs.readFile(realPath)
    let extractedText = ''

    switch (ext) {
      case 'txt':
      case 'md': {
        extractedText = buffer.toString('utf-8')
        break
      }
      case 'docx': {
        const result = await mammoth.extractRawText({ buffer })
        extractedText = result.value
        break
      }
      case 'pdf': {
        const parser = new PDFParse({ data: buffer })
        try {
          const res = await parser.getText()
          extractedText = res.text
        } finally {
          await parser.destroy().catch(() => {})
        }
        break
      }
      case 'xlsx':
      case 'xls': {
        const workbook = xlsx.read(buffer, { type: 'buffer' })
        const sheetSections: string[] = []

        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          if (!sheet) continue
          const rows = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
          if (!rows || rows.length === 0) continue

          const formatted = this.formatSheetRows(rows)
          if (formatted) {
            if (workbook.SheetNames.length > 1) {
              sheetSections.push(`=== Bảng: ${sheetName} ===\n${formatted}`)
            } else {
              sheetSections.push(formatted)
            }
          }
        }
        extractedText = sheetSections.join('\n\n')
        break
      }
      case 'csv': {
        extractedText = buffer.toString('utf-8')
        break
      }
      case 'json': {
        try {
          const parsed = JSON.parse(buffer.toString('utf-8'))
          extractedText = this.formatJsonScript(parsed)
        } catch {
          throw new Error('Tệp JSON không đúng định dạng.')
        }
        break
      }
      default:
        throw new Error(`Không thể xử lý định dạng .${ext}`)
    }

    const cleaned = extractedText.trim()
    if (!cleaned) {
      throw new Error('Tệp kịch bản không chứa nội dung văn bản có thể trích xuất.')
    }

    return {
      text: cleaned,
      fileName,
      format: ext
    }
  }

  private formatSheetRows(rows: unknown[][]): string {
    if (!rows.length) return ''
    const lines: string[] = []
    const firstRow = rows[0] || []
    const headers = firstRow.map((cell) => String(cell ?? '').trim())
    const hasHeaders = headers.some((h) => h.length > 0)

    for (let r = hasHeaders ? 1 : 0; r < rows.length; r++) {
      const row = rows[r]
      if (!row || !row.some((cell) => cell !== undefined && cell !== null && String(cell).trim().length > 0)) {
        continue
      }
      const parts: string[] = []
      const maxCol = Math.max(headers.length, row.length)
      for (let c = 0; c < maxCol; c++) {
        const colHeader = headers[c] || `Cột ${c + 1}`
        const cellVal = row[c] !== undefined && row[c] !== null ? String(row[c]).trim() : ''
        if (cellVal) {
          parts.push(`${colHeader}: ${cellVal}`)
        }
      }
      if (parts.length) {
        lines.push(parts.join(' | '))
      }
    }
    return lines.join('\n')
  }

  private formatJsonScript(data: unknown): string {
    if (typeof data === 'string') return data
    if (data && typeof data === 'object') {
      const obj = data as Record<string, unknown>
      // If object has explicit script / scenes fields
      if (typeof obj.script === 'string') return obj.script
      if (typeof obj.content === 'string') return obj.content
      if (Array.isArray(obj.scenes)) {
        return obj.scenes
          .map((scene, idx) => {
            if (typeof scene === 'string') return `Cảnh ${idx + 1}: ${scene}`
            if (scene && typeof scene === 'object') {
              return `[Cảnh ${idx + 1}]\n` + Object.entries(scene as Record<string, unknown>)
                .map(([k, v]) => `  ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')}`)
                .join('\n')
            }
            return `Cảnh ${idx + 1}: ${String(scene)}`
          })
          .join('\n\n')
      }
    }
    return JSON.stringify(data, null, 2)
  }
}
