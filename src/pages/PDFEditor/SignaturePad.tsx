import { useRef } from 'react'
import ReactSignatureCanvas from 'react-signature-canvas'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'

interface SignaturePadProps {
  open: boolean
  onClose: () => void
  onConfirm: (dataUrl: string) => void
}

export default function SignaturePad({ open, onClose, onConfirm }: SignaturePadProps) {
  const sigRef = useRef<ReactSignatureCanvas>(null)

  const handleConfirm = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return
    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL('image/png')
    onConfirm(dataUrl)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Draw Signature" size="md">
      <div className="space-y-4">
        <div className="border-2 border-dashed border-line2 rounded-lg overflow-hidden bg-white">
          <ReactSignatureCanvas
            ref={sigRef}
            penColor="black"
            canvasProps={{ width: 500, height: 200, className: 'w-full' }}
          />
        </div>
        <div className="flex justify-between">
          <Button variant="secondary" onClick={() => sigRef.current?.clear()}>
            Clear
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={handleConfirm}>Use Signature</Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
