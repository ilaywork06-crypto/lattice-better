import { Download, ExternalLink, FileText, Link2, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { openFile } from '@/api/client'
import * as E from '@/api/endpoints'
import { useAction } from '@/api/queries'
import type { ItemDetail } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { useConfirm } from '@/components/ui/confirm'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/misc'
import { cn } from '@/lib/cn'
import { formatBytes, timeAgo } from '@/lib/format'
import { useSession } from '@/lib/session'

export function DocumentsPanel({ item }: { item: ItemDetail }) {
  const { t } = useTranslation()
  const { can } = useSession()
  const confirm = useConfirm()
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [link, setLink] = useState({ name: '', url: '' })
  const writable = can('write_items')

  const upload = useAction(async (files: File[]) => {
    for (const f of files) await E.items.uploadDocument(item.id, f)
    return files.length
  }, { success: (n) => t('documents.uploaded', { count: n }) })
  const addLink = useAction(() => E.items.linkDocument(item.id, link), {
    success: t('documents.linkAdded'),
    onSuccess: () => { setLinkOpen(false); setLink({ name: '', url: '' }) },
  })
  const remove = useAction((docId: number) => E.items.removeDocument(item.id, docId), { success: t('documents.removed') })

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (writable && e.dataTransfer.files.length) upload.mutate(Array.from(e.dataTransfer.files))
  }

  return (
    <Card>
      <CardHeader
        title={t('documents.title')}
        description={t('documents.hint')}
        actions={writable && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setLinkOpen(true)}><Link2 /> {t('documents.addLink')}</Button>
            <Button size="sm" onClick={() => input.current?.click()} loading={upload.isPending}><Upload /> {t('documents.upload')}</Button>
          </>
        )}
      />
      <CardBody>
        <input ref={input} type="file" multiple hidden onChange={(e) => { if (e.target.files?.length) upload.mutate(Array.from(e.target.files)); e.target.value = '' }} />
        {writable && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => input.current?.click()}
            className={cn(
              'mb-4 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border py-6 text-sm text-muted-foreground transition-colors hover:border-input',
              dragging && 'border-primary bg-primary-soft/40 text-primary-soft-foreground',
            )}
          >
            <Upload className="size-5" />
            {t('documents.drop')}
          </div>
        )}
        {item.documents.length === 0 ? (
          <EmptyState compact icon={<FileText />} title={t('documents.empty')} />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {item.documents.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 place-items-center rounded-lg bg-muted text-muted-foreground">
                  {d.is_file ? <FileText className="size-4" /> : <Link2 className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{d.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {[d.doc_type, d.is_file ? formatBytes(d.size_bytes) : d.url, timeAgo(d.created_at)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label={t('common.open')}
                  onClick={() => (d.is_file ? void openFile(E.documents.downloadPath(d.id)) : window.open(d.url ?? '', '_blank'))}>
                  {d.is_file ? <Download /> : <ExternalLink />}
                </Button>
                {writable && (
                  <Button size="icon-sm" variant="ghost" className="text-danger" aria-label={t('common.delete')}
                    onClick={async () => { if (await confirm({ title: t('documents.removeTitle'), description: d.name, danger: true, confirmLabel: t('common.delete') })) remove.mutate(d.id) }}>
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent size="sm" title={t('documents.addLink')} icon={<Link2 />}
          footer={<>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!link.name || !link.url} loading={addLink.isPending} onClick={() => addLink.mutate(undefined)}>{t('common.add')}</Button>
          </>}>
          <div className="flex flex-col gap-4">
            <Field label={t('common.name')} required><Input value={link.name} onChange={(e) => setLink({ ...link, name: e.target.value })} /></Field>
            <Field label="URL" required><Input dir="ltr" type="url" placeholder="https://" value={link.url} onChange={(e) => setLink({ ...link, url: e.target.value })} /></Field>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
