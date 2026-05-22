import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType } from 'docx'

type PMNode = {
  type: string
  content?: PMNode[]
  text?: string
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  attrs?: Record<string, unknown>
}

function marksToRun(text: string, marks: PMNode['marks'] = []): TextRun {
  return new TextRun({
    text,
    bold: marks.some((m) => m.type === 'bold'),
    italics: marks.some((m) => m.type === 'italic'),
    underline: marks.some((m) => m.type === 'underline') ? {} : undefined,
    strike: marks.some((m) => m.type === 'strike'),
  })
}

function nodeToChildren(node: PMNode): TextRun[] {
  if (!node.content) return []
  return node.content.flatMap((child) => {
    if (child.type === 'text') return [marksToRun(child.text ?? '', child.marks)]
    return nodeToChildren(child)
  })
}

function nodeToDocxParagraph(node: PMNode): Paragraph | Table | null {
  if (node.type === 'heading') {
    const levelMap: Record<number, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
    }
    return new Paragraph({
      heading: levelMap[(node.attrs?.level as number) ?? 1],
      children: nodeToChildren(node),
    })
  }

  if (node.type === 'paragraph') {
    return new Paragraph({ children: nodeToChildren(node) })
  }

  if (node.type === 'blockquote') {
    const children = nodeToChildren({ type: 'blockquote', content: node.content })
    return new Paragraph({ children, indent: { left: 720 } })
  }

  if (node.type === 'codeBlock') {
    const text = node.content?.map((n) => n.text ?? '').join('') ?? ''
    return new Paragraph({
      children: [new TextRun({ text, font: 'Courier New', size: 18 })],
      indent: { left: 720 },
    })
  }

  if (node.type === 'table') {
    const rows = (node.content ?? []).map((row) => {
      const cells = (row.content ?? []).map(
        (cell) =>
          new TableCell({
            children: (cell.content ?? []).map((p) => nodeToDocxParagraph(p) as Paragraph).filter(Boolean),
          })
      )
      return new TableRow({ children: cells })
    })
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } })
  }

  return null
}

export async function exportDocxBuffer(prosemirrorJson: Record<string, unknown>, title = 'Document'): Promise<Buffer> {
  const pm = prosemirrorJson as unknown as PMNode
  const children: (Paragraph | Table)[] = []

  for (const node of pm.content ?? []) {
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const isBullet = node.type === 'bulletList'
      for (const item of node.content ?? []) {
        for (const child of item.content ?? []) {
          children.push(
            new Paragraph({
              children: nodeToChildren(child),
              bullet: isBullet ? { level: 0 } : undefined,
              numbering: !isBullet ? { reference: 'default-numbering', level: 0 } : undefined,
            })
          )
        }
      }
    } else {
      const el = nodeToDocxParagraph(node)
      if (el) children.push(el)
    }
  }

  const doc = new Document({ sections: [{ children }], title })
  return Packer.toBuffer(doc)
}

// Browser-side export (used in client components)
export async function exportDocx(prosemirrorJson: Record<string, unknown>, title = 'Document'): Promise<Blob> {
  const doc = new Document({ sections: [{ children: [] }], title })
  return Packer.toBlob(doc)
}
